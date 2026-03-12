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
import { storagePut } from '../storage';

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

// ── Buffer → S3 URL ───────────────────────────────────────────────────────────────

async function urlToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
}

// FAL AI는 data: URI 불가 → S3 공개 URL로 변환
async function uploadBufToS3(buf: Buffer, ext: string = 'jpg'): Promise<string> {
  const key = `faceswap-tmp/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const { url } = await storagePut(key, buf, mime);
  return url;
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

  // FAL AI는 data: URI 불가 → S3 공개 URL로 변환
  console.log('[face-swap] S3 업로드 중...');
  const [targetUrl, sourceUrl] = await Promise.all([
    uploadBufToS3(targetJpeg, 'jpg'),
    uploadBufToS3(sourceJpeg, 'jpg'),
  ]);
  console.log(`[face-swap] target: ${targetUrl.slice(0, 60)}...`);
  console.log(`[face-swap] source: ${sourceUrl.slice(0, 60)}...`);

  const result = await fal.run('fal-ai/face-swap', {
    input: {
      base_image_url: targetUrl,
      swap_image_url: sourceUrl,
    },
  }) as { image: { url: string } };

  console.log(`[face-swap] ✅ 완료: ${result.image.url.slice(0, 60)}...`);
  return urlToBuffer(result.image.url);
}

// ── Step 2: CodeFormer — 얼굴 선명화 ─────────────────────────────────────────

async function runCodeFormer(
  imageBuffer: Buffer,
  fidelity: number = 0.85
): Promise<Buffer> {
  const jpeg = await sharp(imageBuffer).jpeg({ quality: 95 }).toBuffer();

  // FAL AI는 data: URI 불가 → S3 공개 URL로 변환
  const imageUrl = await uploadBufToS3(jpeg, 'jpg');
  console.log(`[codeformer] image: ${imageUrl.slice(0, 60)}...`);

  const result = await fal.run('fal-ai/codeformer', {
    input: {
      image_url: imageUrl,
      fidelity,
      upscale: 2,
      face_upsample: true,
      background_enhance: false,   // 배경 변형 방지
    },
  }) as { image: { url: string } };

  console.log(`[codeformer] ✅ 완료: ${result.image.url.slice(0, 60)}...`);
  return urlToBuffer(result.image.url);
}

// ── Step 2.5: IP-Adapter 얼굴 일관성 강화 ─────────────────────────────────────

async function runIpAdapter(
  imageBuffer: Buffer,
  faceRefBuffer: Buffer,
): Promise<Buffer> {
  try {
    console.log('[ip-adapter] 얼굴 일관성 강화 중...');
    const imageUrl = await uploadBufToS3(
      await sharp(imageBuffer).jpeg({ quality: 95 }).toBuffer(), 'jpg'
    );
    const faceUrl = await uploadBufToS3(
      await sharp(faceRefBuffer).jpeg({ quality: 95 }).toBuffer(), 'jpg'
    );

    const falKey = process.env.FAL_KEY;
    if (!falKey) throw new Error("FAL_KEY not set");

    const res = await fetch('https://fal.run/fal-ai/ip-adapter-face-id', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: imageUrl,
        face_image_url: faceUrl,
        prompt: 'same person, preserve facial identity exactly, high quality portrait',
        strength: 0.5,
        num_inference_steps: 25,
        guidance_scale: 5.0,
      }),
    });

    const text = await res.text();
    if (!res.ok) throw new Error(`IP-Adapter failed ${res.status}: ${text.slice(0, 200)}`);

    const result = JSON.parse(text);
    const url = (result?.images as Array<{ url: string }>)?.[0]?.url
      || (result?.image as Record<string, unknown>)?.url as string;

    if (url) {
      console.log(`[ip-adapter] ✅ 완료: ${url.slice(0, 60)}...`);
      return urlToBuffer(url);
    }

    console.warn('[ip-adapter] 응답에 URL 없음, 원본 유지');
    return imageBuffer;
  } catch (err: any) {
    console.warn(`[ip-adapter] 실패 (원본 유지): ${err.message?.slice(0, 100)}`);
    return imageBuffer;
  }
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

  // ── IP-Adapter 얼굴 일관성 강화 ────────────────────────────────────────
  const primarySource = faceSources[0];
  if (primarySource) {
    steps.push('[IP-Adapter] 얼굴 일관성 강화 중...');
    current = await runIpAdapter(current, primarySource.imageBuffer);
    falJobs.push('ip-adapter-face-id');
    steps.push('[IP-Adapter] 얼굴 일관성 강화 완료 ✓');
  }

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
