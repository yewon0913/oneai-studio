/**
 * gemini-wedding-faceswap-pipeline.ts
 *
 * Gemini 웨딩 사진 생성 → FAL Reactor face-swap 자동 연결 파이프라인
 *
 * 처리 순서:
 *   1. generateGeminiWedding 실행 → AI 웨딩 이미지 2장 생성
 *   2. FAL Reactor → 신랑 얼굴 교체
 *   3. FAL Reactor → 신부 얼굴 교체
 *   4. CodeFormer → 얼굴 선명화
 *   5. 최종 결과 반환
 *
 * ⛔ 절대 수정 금지: image-pipeline.ts, couple-pipeline.ts, routers.ts
 */

import * as fal from '@fal-ai/serverless-client';
import { generateGeminiWedding, analyzeBackground, GeminiWeddingResult, BackgroundAnalysis } from './gemini-wedding-pipeline';

fal.config({ credentials: process.env.FAL_KEY ?? '' });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FaceSwapAutoInput {
  brideImageBase64: string;
  brideMimeType?: string;
  groomImageBase64: string;
  groomMimeType?: string;
  backgroundImageBase64?: string;
  backgroundMimeType?: string;
  backgroundDescription?: string;
  customPrompt?: string;
  style?: string;
  /** face-swap 자동 실행 여부 (기본 true) */
  autoFaceSwap?: boolean;
  /** 신부 얼굴 원본 버퍼 */
  brideImageBuffer?: Buffer;
  /** 신랑 얼굴 원본 버퍼 */
  groomImageBuffer?: Buffer;
  /** 얼굴 교체 강도 0~1 (기본 0.85) */
  faceStrength?: number;
  /** CodeFormer fidelity 0~1 (기본 0.75) */
  restoreFidelity?: number;
  /** CodeFormer 실행 여부 (기본 true) */
  useCodeFormer?: boolean;
}

export interface FaceSwapAutoOutput {
  /** face-swap 적용된 최종 이미지들 (base64) */
  images: string[];
  /** Gemini 원본 이미지들 (face-swap 이전, 비교용) */
  originalGeminiImages?: string[];
  /** 처리 단계 로그 */
  faceSwapSteps?: string[];
  /** face-swap 성공 여부 */
  faceSwapSuccess?: boolean;
  /** face-swap 에러 메시지 (실패 시) */
  faceSwapError?: string;
  /** Gemini 원본 결과 (로그 포함) */
  geminiResults?: GeminiWeddingResult[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDataUri(buf: Buffer, mime = 'image/jpeg'): string {
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function base64ToDataUri(b64: string, mime = 'image/jpeg'): string {
  if (b64.startsWith('data:')) return b64;
  return `data:${mime};base64,${b64}`;
}

async function urlToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
}

// ── FAL Reactor ───────────────────────────────────────────────────────────────

async function runReactor(
  targetBase64: string,
  sourceBuffer: Buffer,
  faceStrength: number
): Promise<Buffer> {
  const targetDataUri = base64ToDataUri(targetBase64);
  const sourceDataUri = toDataUri(sourceBuffer);

  const result = await fal.run('fal-ai/reactor', {
    input: {
      image_url: targetDataUri,
      reference_image_url: sourceDataUri,
      face_restore_fidelity: faceStrength,
      enable_nsfw_filter: false,
      upscale: false,
      det_thresh: 0.35,
      det_maxnum: 2,
    },
  }) as { image: { url: string } };

  return urlToBuffer(result.image.url);
}

// ── CodeFormer ────────────────────────────────────────────────────────────────

async function runCodeFormer(
  imageBuffer: Buffer,
  fidelity: number
): Promise<Buffer> {
  const dataUri = toDataUri(imageBuffer);

  const result = await fal.run('fal-ai/codeformer', {
    input: {
      image_url: dataUri,
      fidelity,
      upscale: 2,
      face_upsample: true,
      background_enhance: false,
    },
  }) as { image: { url: string } };

  return urlToBuffer(result.image.url);
}

// ── 단일 이미지 face-swap 처리 ────────────────────────────────────────────────

async function processSingleImage(
  geminiBase64: string,
  brideBuffer: Buffer | undefined,
  groomBuffer: Buffer | undefined,
  faceStrength: number,
  restoreFidelity: number,
  useCodeFormer: boolean,
  steps: string[],
  imageIndex: number
): Promise<string> {
  const label = `이미지 #${imageIndex + 1}`;
  let currentBuffer: Buffer | undefined = undefined;

  try {
    // 신랑 먼저
    if (groomBuffer) {
      steps.push(`[${label}] 신랑 얼굴 교체 중...`);
      currentBuffer = await runReactor(
        currentBuffer ? (currentBuffer as Buffer).toString('base64') : geminiBase64,
        groomBuffer,
        faceStrength
      );
      steps.push(`[${label}] 신랑 얼굴 교체 완료 ✓`);
    }

    // 신부 나중 (신부가 최상위 레이어로 더 선명하게)
    if (brideBuffer) {
      steps.push(`[${label}] 신부 얼굴 교체 중...`);
      const targetBase64 = currentBuffer
        ? (currentBuffer as Buffer).toString('base64')
        : geminiBase64;
      currentBuffer = await runReactor(targetBase64, brideBuffer, faceStrength);
      steps.push(`[${label}] 신부 얼굴 교체 완료 ✓`);
    }

    if (!currentBuffer) {
      return geminiBase64;
    }

    // CodeFormer 선명화
    if (useCodeFormer) {
      steps.push(`[${label}] CodeFormer 얼굴 선명화 중...`);
      currentBuffer = await runCodeFormer(currentBuffer, restoreFidelity);
      steps.push(`[${label}] CodeFormer 완료 ✓`);
    }

    return (currentBuffer as Buffer).toString('base64');

  } catch (err: any) {
    steps.push(`[${label}] ⚠️ face-swap 실패: ${err.message} → 원본 반환`);
    return (currentBuffer as Buffer | undefined)?.toString('base64') ?? geminiBase64;
  }
}

// ── 메인 파이프라인 ───────────────────────────────────────────────────────────

export async function runGeminiWeddingWithFaceSwap(
  input: FaceSwapAutoInput
): Promise<FaceSwapAutoOutput> {
  const {
    brideImageBase64,
    brideMimeType = 'image/jpeg',
    groomImageBase64,
    groomMimeType = 'image/jpeg',
    backgroundImageBase64,
    backgroundMimeType = 'image/jpeg',
    customPrompt,
    autoFaceSwap = true,
    brideImageBuffer,
    groomImageBuffer,
    faceStrength = 0.85,
    restoreFidelity = 0.75,
    useCodeFormer = true,
  } = input;

  // ── 1. 배경 분석 (선택) ─────────────────────────────────────────────────────
  let backgroundAnalysis: BackgroundAnalysis | null = null;
  if (backgroundImageBase64) {
    try {
      const cleanBg = backgroundImageBase64.startsWith('data:')
        ? backgroundImageBase64.split(',')[1]
        : backgroundImageBase64;
      backgroundAnalysis = await analyzeBackground(cleanBg, backgroundMimeType);
    } catch (err: any) {
      console.warn('[gemini-faceswap] 배경 분석 실패 (스킵):', err.message);
    }
  }

  // ── 2. Gemini 웨딩 이미지 생성 ─────────────────────────────────────────────
  const geminiResults = await generateGeminiWedding(
    brideImageBase64,
    brideMimeType,
    groomImageBase64,
    groomMimeType,
    backgroundAnalysis,
    customPrompt
  );

  // Gemini 결과에서 base64 추출 (url 필드가 data URI 또는 https URL)
  const generatedImages: string[] = geminiResults.map(r => {
    if (r.url.startsWith('data:')) {
      return r.url.split(',')[1]; // data URI → pure base64
    }
    return r.url; // https URL (face-swap에서 직접 처리)
  });

  // face-swap 비활성화 or 얼굴 이미지 없으면 Gemini 결과 그대로 반환
  if (!autoFaceSwap || (!brideImageBuffer && !groomImageBuffer)) {
    return {
      images: geminiResults.map(r => r.url),
      geminiResults,
      faceSwapSuccess: false,
      faceSwapSteps: ['face-swap 스킵 (얼굴 이미지 미제공)'],
    };
  }

  if (generatedImages.length === 0) {
    return {
      images: [],
      geminiResults,
      faceSwapSuccess: false,
      faceSwapSteps: ['Gemini 생성 이미지 없음'],
    };
  }

  // ── 3. 생성된 이미지들에 face-swap 순차 적용 ───────────────────────────────
  const steps: string[] = [];
  const originalImages: string[] = [];
  const faceSwappedImages: string[] = [];

  steps.push(`총 ${generatedImages.length}장 face-swap 시작...`);

  for (let i = 0; i < generatedImages.length; i++) {
    originalImages.push(geminiResults[i].url);

    const swappedBase64 = await processSingleImage(
      generatedImages[i],
      brideImageBuffer,
      groomImageBuffer,
      faceStrength,
      restoreFidelity,
      useCodeFormer,
      steps,
      i
    );

    faceSwappedImages.push(swappedBase64);
  }

  steps.push(`✅ 전체 face-swap 완료 (${faceSwappedImages.length}장)`);

  return {
    images: faceSwappedImages.map(b64 =>
      b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`
    ),
    originalGeminiImages: originalImages,
    faceSwapSteps: steps,
    faceSwapSuccess: true,
    geminiResults,
  };
}
