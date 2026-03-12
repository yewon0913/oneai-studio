/**
 * Image generation helper — FAL AI 기반
 *
 * couple-pipeline.ts / beauty-pipeline.ts와 동일한 FAL 호출 패턴 사용
 *
 * 모델:
 * - text-to-image:  fal-ai/flux-pro/v1.1 (고품질) → flux/dev 폴백
 * - image-to-image: fal-ai/flux/dev/image-to-image (참조 이미지 기반)
 * - 업스케일/복원:  fal-ai/codeformer (얼굴 보존 + 선명화)
 */

import { storagePut } from "server/storage";

// ─── Types ────────────────────────────────────────────────

export type GenerateImageOptions = {
  prompt: string;
  negativePrompt?: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
  /** 참조 이미지 기반 image-to-image 변환 강도 (0~1, 기본 0.65) */
  strength?: number;
  /** 얼굴 보존 모드 — guidance/steps 강화 */
  faceFixMode?: boolean;
  /** 출력 이미지 비율 */
  imageSize?: string;
};

export type GenerateImageResponse = {
  url?: string;
};

// ─── FAL REST API 직접 호출 (couple-pipeline 패턴) ───────

async function falRun(
  modelId: string,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error("FAL_KEY is not configured");

  const res = await fetch(`https://fal.run/${modelId}`, {
    method: "POST",
    headers: {
      "Authorization": `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const text = await res.text();
  console.log(`[ImageGen] ${modelId} status: ${res.status}`);
  if (!res.ok) throw new Error(`${modelId} failed ${res.status}: ${text.slice(0, 300)}`);

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${modelId} invalid JSON: ${text.slice(0, 200)}`);
  }
}

// ─── 참조 이미지 → FAL 접근 가능 URL 변환 ───────────────

async function resolveImageUrl(img: {
  url?: string;
  b64Json?: string;
  mimeType?: string;
}): Promise<string | null> {
  if (img.url) return img.url;
  if (img.b64Json) {
    const mime = img.mimeType || "image/png";
    const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
    const buffer = Buffer.from(img.b64Json, "base64");
    const { url } = await storagePut(
      `generated/ref-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`,
      buffer,
      mime
    );
    return url;
  }
  return null;
}

// ─── 업스케일/복원 프롬프트 감지 ─────────────────────────

function isUpscaleOrRestore(prompt: string): boolean {
  const keywords = ["upscale", "enhance", "restore", "sharpen", "clarity", "resolution", "복원"];
  return keywords.some(k => prompt.toLowerCase().includes(k));
}

// ─── 기본 네거티브 프롬프트 ──────────────────────────────

const DEFAULT_NEGATIVE_PROMPT = [
  "(deformed:1.3), (distorted:1.3), (ugly:1.3), (bad anatomy:1.3)",
  "blurry, low quality, cartoon, illustration, painting, 3d render, CGI",
  "(face distortion:2.0), (facial deformation:2.0), (blurry faces:2.0)",
  "(different face:1.8), (face change:1.8), (altered face:1.8)",
].join(", ");

// ─── 메인 함수 ──────────────────────────────────────────

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  let prompt = options.prompt;
  if (prompt.length > 1000) {
    prompt = prompt.substring(0, 1000);
  }

  const negativePrompt = options.negativePrompt || DEFAULT_NEGATIVE_PROMPT;
  const faceFixMode = options.faceFixMode ?? false;
  const refImages = options.originalImages || [];

  // 참조 이미지가 있는 경우
  if (refImages.length > 0) {
    const imageUrl = await resolveImageUrl(refImages[0]);
    if (imageUrl) {
      // 업스케일/복원 요청이면 CodeFormer 사용
      if (isUpscaleOrRestore(prompt)) {
        return runCodeFormer(imageUrl);
      }
      // 참조 이미지 2장 이상이면 나머지도 URL 변환 (프롬프트 키워드용 로그)
      if (refImages.length > 1) {
        console.log(`[ImageGen] 참조 이미지 ${refImages.length}장 (1장만 image-to-image에 사용)`);
      }
      return runFluxImageToImage(prompt, negativePrompt, imageUrl, options.strength, faceFixMode);
    }
  }

  // 참조 이미지 없음: text-to-image
  return runFluxTextToImage(prompt, negativePrompt, faceFixMode, options.imageSize);
}

// ─── Text-to-image: flux-pro/v1.1 ───────────────────────

async function runFluxTextToImage(
  prompt: string,
  negativePrompt: string,
  faceFixMode: boolean,
  imageSize?: string,
): Promise<GenerateImageResponse> {
  const guidanceScale = faceFixMode ? 5.5 : 4.0;
  const numInferenceSteps = faceFixMode ? 40 : 32;

  console.log(`[ImageGen] flux-pro/v1.1 text-to-image (face:${faceFixMode}, guidance:${guidanceScale}, steps:${numInferenceSteps})`);

  try {
    const result = await falRun("fal-ai/flux-pro/v1.1", {
      prompt,
      negative_prompt: negativePrompt,
      num_inference_steps: numInferenceSteps,
      guidance_scale: guidanceScale,
      image_size: imageSize || "landscape_4_3",
      safety_tolerance: "6",
      enable_safety_checker: false,
      num_images: 1,
    });

    const url = (result?.images as Array<{ url: string }>)?.[0]?.url;
    if (!url) throw new Error("flux-pro 응답에 이미지 URL 없음");
    return { url };
  } catch (err: any) {
    console.warn(`[ImageGen] flux-pro 실패, flux/dev 폴백: ${err.message?.slice(0, 100)}`);
    return runFluxDevFallback(prompt, negativePrompt, faceFixMode, imageSize);
  }
}

// ─── flux/dev 폴백 ───────────────────────────────────────

async function runFluxDevFallback(
  prompt: string,
  negativePrompt: string,
  faceFixMode: boolean,
  imageSize?: string,
): Promise<GenerateImageResponse> {
  const guidanceScale = faceFixMode ? 5.0 : 3.5;
  const numInferenceSteps = faceFixMode ? 35 : 28;

  console.log(`[ImageGen] flux/dev 폴백 (guidance:${guidanceScale}, steps:${numInferenceSteps})`);

  const result = await falRun("fal-ai/flux/dev", {
    prompt,
    negative_prompt: negativePrompt,
    num_inference_steps: numInferenceSteps,
    guidance_scale: guidanceScale,
    image_size: imageSize || "landscape_4_3",
    enable_safety_checker: false,
    num_images: 1,
  });

  const url = (result?.images as Array<{ url: string }>)?.[0]?.url;
  if (!url) throw new Error("flux/dev 응답에 이미지 URL 없음");
  return { url };
}

// ─── Image-to-image: flux/dev/image-to-image ─────────────

async function runFluxImageToImage(
  prompt: string,
  negativePrompt: string,
  referenceUrl: string,
  strength?: number,
  faceFixMode?: boolean,
): Promise<GenerateImageResponse> {
  // beauty-pipeline과 동일한 파라미터 기본값
  const s = strength ?? (faceFixMode ? 0.50 : 0.65);
  const guidanceScale = faceFixMode ? 6.0 : 4.5;
  const numInferenceSteps = faceFixMode ? 35 : 32;

  console.log(`[ImageGen] flux/dev/image-to-image (strength:${s}, guidance:${guidanceScale}, steps:${numInferenceSteps})`);

  try {
    const result = await falRun("fal-ai/flux/dev/image-to-image", {
      prompt,
      negative_prompt: negativePrompt,
      image_url: referenceUrl,
      strength: s,
      num_inference_steps: numInferenceSteps,
      guidance_scale: guidanceScale,
      enable_safety_checker: false,
    });

    const url = (result?.images as Array<{ url: string }>)?.[0]?.url;
    if (!url) throw new Error("image-to-image 응답에 이미지 URL 없음");
    return { url };
  } catch (err: any) {
    console.warn(`[ImageGen] image-to-image 실패, text-to-image 폴백: ${err.message?.slice(0, 100)}`);
    return runFluxTextToImage(prompt, negativePrompt, faceFixMode ?? false);
  }
}

// ─── CodeFormer: 업스케일/복원 ───────────────────────────

async function runCodeFormer(imageUrl: string): Promise<GenerateImageResponse> {
  console.log(`[ImageGen] codeformer 업스케일/복원`);

  try {
    const result = await falRun("fal-ai/codeformer", {
      image_url: imageUrl,
      fidelity: 0.9,
      upscaling: 2,
      face_upsample: true,
    });

    const url = (result?.image as Record<string, unknown>)?.url as string;
    if (!url) throw new Error("CodeFormer 응답에 이미지 URL 없음");
    return { url };
  } catch (err: any) {
    console.warn(`[ImageGen] CodeFormer 실패: ${err.message?.slice(0, 100)}`);
    return { url: imageUrl };
  }
}
