/**
 * face-swap-pipeline.ts
 *
 * FAL AI reactor 기반 얼굴 교체 파이프라인
 *
 * 목적:
 *   Gemini/Flux가 생성한 웨딩 이미지에 실제 고객 얼굴을 교체
 *   → "비슷하지만 다른 사람" 문제 해결
 *
 * 처리 순서:
 *   1. FAL reactor (fal-ai/reactor)     → 얼굴 교체
 *   2. CodeFormer (fal-ai/codeformer)   → 얼굴 선명화 & 피부 복원
 *   3. 최종 색 그레이딩 (sharp)
 *
 * 지원 모드:
 *   single — 신부 or 신랑 단독 얼굴 교체
 *   couple — 신부 + 신랑 동시 교체 (reactor 2회 순차 실행)
 *
 * ⛔ 절대 수정 금지: image-pipeline.ts, couple-pipeline.ts, routers.ts
 *
 * 환경변수:
 *   FAL_KEY — fal.ai API 키 (필수)
 */

import sharp from 'sharp';
import * as fal from '@fal-ai/serverless-client';

fal.config({ credentials: process.env.FAL_KEY ?? '' });

// ── Types ─────────────────────────────────────────────────────────────────────

export type SwapMode = 'single' | 'couple';
export type FaceRole = 'bride' | 'groom' | 'solo';

export interface FaceSource {
  role: FaceRole;
  /** 고객 원본 얼굴 이미지 버퍼 (정면, 밝은 사진 권장) */
  imageBuffer: Buffer;
}

export interface FaceSwapInput {
  /** Gemini / Flux / Midjourney 로 생성된 타겟 이미지 */
  targetImageBuffer: Buffer;
  /** 교체할 얼굴 소스 목록 (최대 2명) */
  faceSources: FaceSource[];
  mode: SwapMode;
  /** CodeFormer 선명화 여부 (기본 true) */
  useCodeFormer?: boolean;
  /** 얼굴 교체 강도 0.0~1.0 (기본 0.9) */
  faceStrength?: number;
  /** 얼굴 복원 fidelity 0.0~1.0 (기본 0.8) */
  restoreStrength?: number;
  /** 최종 출력 너비 (기본: 원본 유지) */
  outputWidth?: number;
  outputHeight?: number;
}

export interface FaceSwapOutput {
  resultBuffer: Buffer;
  /** reactor 직후 (CodeFormer 이전) 중간 결과 */
  intermediateBuffer?: Buffer;
  processingSteps: string[];
  falJobs: string[];
}

// ── Buffer → Data URI ─────────────────────────────────────────────────────────

function toDataUri(buf: Buffer, mime: string = 'image/jpeg'): string {
  return `data:${mime};base64,${buf.toString('base64')}`;
}

async function urlToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
}

// ── Step 1: FAL Reactor — 얼굴 교체 ──────────────────────────────────────────

/**
 * FAL reactor로 타겟 이미지의 얼굴을 소스 얼굴로 교체
 *
 * - couple 모드: 신랑 먼저 → 신부 순으로 2회 실행
 *   (순서 중요: 신부가 마지막에 처리되어 더 선명)
 */
async function runReactor(
  targetBuffer: Buffer,
  sourceBuffer: Buffer,
  _faceStrength: number = 0.9
): Promise<Buffer> {
  // JPEG로 통일
  const targetJpeg = await sharp(targetBuffer).jpeg({ quality: 95 }).toBuffer();
  const sourceJpeg = await sharp(sourceBuffer).jpeg({ quality: 95 }).toBuffer();

  // ✅ HOTFIX v2: fal-ai/reactor → fal-ai/face-swap, 파라미터명 변경
  const result = await fal.run('fal-ai/face-swap', {
    input: {
      base_image_url: toDataUri(targetJpeg),   // ✅ 수정 (구: image_url)
      swap_image_url: toDataUri(sourceJpeg),   // ✅ 수정 (구: reference_image_url)
    },
  }) as { image: { url: string } };

  return urlToBuffer(result.image.url);
}

// ── Step 2: CodeFormer — 얼굴 선명화 ─────────────────────────────────────────

async function runCodeFormer(
  imageBuffer: Buffer,
  fidelity: number = 0.8
): Promise<Buffer> {
  const jpeg = await sharp(imageBuffer).jpeg({ quality: 95 }).toBuffer();

  const result = await fal.run('fal-ai/codeformer', {
    input: {
      image_url: toDataUri(jpeg),
      fidelity,
      upscale: 2,
      face_upsample: true,
      background_enhance: false,   // 배경 변형 방지
    },
  }) as { image: { url: string } };

  return urlToBuffer(result.image.url);
}

// ── Step 3: 최종 색 그레이딩 ──────────────────────────────────────────────────

async function finalGrade(
  imageBuffer: Buffer,
  outputWidth?: number,
  outputHeight?: number
): Promise<Buffer> {
  let pipeline = sharp(imageBuffer).modulate({
    brightness: 1.01,
    saturation: 1.04,
  }).sharpen({ sigma: 0.5 });

  if (outputWidth && outputHeight) {
    pipeline = pipeline.resize(outputWidth, outputHeight, { fit: 'cover' });
  }

  return pipeline.jpeg({ quality: 96, progressive: true }).toBuffer();
}

// ── 메인 파이프라인 ───────────────────────────────────────────────────────────

export async function runFaceSwapPipeline(
  input: FaceSwapInput
): Promise<FaceSwapOutput> {
  const {
    targetImageBuffer,
    faceSources,
    mode,
    useCodeFormer = true,
    faceStrength = 0.9,
    restoreStrength = 0.8,
    outputWidth,
    outputHeight,
  } = input;

  const steps: string[] = [];
  const falJobs: string[] = [];

  let current = targetImageBuffer;

  if (mode === 'couple') {
    // ── 커플 모드: 신랑 → 신부 순서 ──────────────────────────────────────
    const groom = faceSources.find(f => f.role === 'groom');
    const bride = faceSources.find(f => f.role === 'bride');

    // 신랑 먼저
    if (groom) {
      steps.push('[face-swap] 신랑 얼굴 교체 중...');
      current = await runReactor(current, groom.imageBuffer, faceStrength);
      falJobs.push('face-swap-groom');
      steps.push('[face-swap] 신랑 얼굴 교체 완료 ✓');
    }

    // 신부 후
    if (bride) {
      steps.push('[face-swap] 신부 얼굴 교체 중...');
      current = await runReactor(current, bride.imageBuffer, faceStrength);
      falJobs.push('face-swap-bride');
      steps.push('[face-swap] 신부 얼굴 교체 완료 ✓');
    }

  } else {
    // ── 단독 모드 ─────────────────────────────────────────────────────────
    const source = faceSources[0];
    if (!source) throw new Error('faceSources가 비어 있습니다.');

    const label = source.role === 'bride' ? '신부' : '신랑';
    steps.push(`[face-swap] ${label} 얼굴 교체 중...`);
    current = await runReactor(current, source.imageBuffer, faceStrength);
    falJobs.push(`face-swap-${source.role}`);
    steps.push(`[face-swap] ${label} 얼굴 교체 완료 ✓`);
  }

  // reactor 직후 중간 결과 저장
  const intermediateBuffer = current;

  // ── CodeFormer 선명화 ──────────────────────────────────────────────────
  if (useCodeFormer) {
    steps.push('[CodeFormer] 얼굴 선명화 & 피부 복원 중...');
    current = await runCodeFormer(current, restoreStrength);
    falJobs.push('codeformer');
    steps.push('[CodeFormer] 선명화 완료 ✓');
  }

  // ── 최종 색 그레이딩 ───────────────────────────────────────────────────
  steps.push('[sharp] 최종 색 그레이딩 적용...');
  const resultBuffer = await finalGrade(current, outputWidth, outputHeight);
  steps.push('✅ 얼굴 교체 파이프라인 완료');

  return {
    resultBuffer,
    intermediateBuffer,
    processingSteps: steps,
    falJobs,
  };
}

// ── 편의 래퍼 함수들 ──────────────────────────────────────────────────────────

/** Gemini 웨딩 이미지 + 신부/신랑 얼굴 → 완성 커플 사진 */
export async function swapCouplefaces(
  geminiResultBuffer: Buffer,
  brideBuffer: Buffer,
  groomBuffer: Buffer,
  options?: Partial<FaceSwapInput>
): Promise<FaceSwapOutput> {
  return runFaceSwapPipeline({
    targetImageBuffer: geminiResultBuffer,
    faceSources: [
      { role: 'groom', imageBuffer: groomBuffer },
      { role: 'bride', imageBuffer: brideBuffer },
    ],
    mode: 'couple',
    useCodeFormer: true,
    faceStrength: 0.9,
    restoreStrength: 0.8,
    ...options,
  });
}

/** 단독 이미지 얼굴 교체 */
export async function swapSingleFace(
  targetBuffer: Buffer,
  sourceBuffer: Buffer,
  role: FaceRole = 'solo',
  options?: Partial<FaceSwapInput>
): Promise<FaceSwapOutput> {
  return runFaceSwapPipeline({
    targetImageBuffer: targetBuffer,
    faceSources: [{ role, imageBuffer: sourceBuffer }],
    mode: 'single',
    useCodeFormer: true,
    ...options,
  });
}
