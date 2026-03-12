/**
 * Image generation helper — FAL AI 기반
 *
 * 모델 구성:
 * - 텍스트만 (text-to-image): fal-ai/flux-pro/v1.1 (고품질)
 * - 참조 이미지 포함 (image-to-image): fal-ai/flux/dev/image-to-image
 * - 업스케일/복원: fal-ai/codeformer (얼굴 보존 + 선명화)
 */

import { fal } from "@fal-ai/client";
import { storagePut } from "server/storage";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
};

function ensureFalConfig() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not configured");
  fal.config({ credentials: key });
}

/**
 * 참조 이미지 → FAL이 접근 가능한 URL로 변환
 * base64 데이터는 FAL storage에 업로드
 */
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
      `generated/ref-${Date.now()}.${ext}`,
      buffer,
      mime
    );
    return url;
  }
  return null;
}

/**
 * 업스케일/복원 프롬프트인지 감지
 */
function isUpscaleOrRestore(prompt: string): boolean {
  const keywords = ["upscale", "enhance", "restore", "sharpen", "clarity", "resolution", "복원"];
  return keywords.some(k => prompt.toLowerCase().includes(k));
}

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  ensureFalConfig();

  let prompt = options.prompt;
  if (prompt.length > 2000) {
    prompt = prompt.substring(0, 1997) + "...";
  }

  const refImages = options.originalImages || [];

  // 참조 이미지가 있는 경우
  if (refImages.length > 0) {
    const imageUrl = await resolveImageUrl(refImages[0]);
    if (imageUrl) {
      // 업스케일/복원 요청이면 CodeFormer 사용
      if (isUpscaleOrRestore(prompt)) {
        return runCodeFormer(imageUrl);
      }
      // 일반 이미지 변환: flux/dev/image-to-image
      return runFluxImageToImage(prompt, imageUrl);
    }
  }

  // 참조 이미지 없음: text-to-image (flux-pro)
  return runFluxTextToImage(prompt);
}

/**
 * Text-to-image: fal-ai/flux-pro/v1.1
 */
async function runFluxTextToImage(prompt: string): Promise<GenerateImageResponse> {
  console.log(`[ImageGen] flux-pro/v1.1 text-to-image, prompt: ${prompt.length}자`);

  try {
    const result = await fal.subscribe("fal-ai/flux-pro/v1.1" as any, {
      input: {
        prompt,
        num_inference_steps: 32,
        guidance_scale: 4.0,
        image_size: "landscape_4_3",
        safety_tolerance: "6",
        enable_safety_checker: false,
      } as any,
    });

    const url = (result as any)?.data?.images?.[0]?.url;
    if (!url) throw new Error("FAL 응답에 이미지 URL 없음");
    return { url };
  } catch (err: any) {
    // flux-pro 실패 시 flux/dev로 폴백
    console.warn(`[ImageGen] flux-pro 실패, flux/dev로 폴백: ${err.message?.slice(0, 100)}`);
    return runFluxDevFallback(prompt);
  }
}

/**
 * flux/dev 폴백 (flux-pro 실패 시)
 */
async function runFluxDevFallback(prompt: string): Promise<GenerateImageResponse> {
  console.log(`[ImageGen] flux/dev 폴백 text-to-image`);

  const result = await fal.subscribe("fal-ai/flux/dev" as any, {
    input: {
      prompt,
      num_inference_steps: 28,
      guidance_scale: 3.5,
      image_size: "landscape_4_3",
      enable_safety_checker: false,
    } as any,
  });

  const url = (result as any)?.data?.images?.[0]?.url;
  if (!url) throw new Error("FAL flux/dev 응답에 이미지 URL 없음");
  return { url };
}

/**
 * Image-to-image: fal-ai/flux/dev/image-to-image
 * 참조 이미지의 구도를 유지하면서 프롬프트에 맞게 변형
 */
async function runFluxImageToImage(
  prompt: string,
  referenceUrl: string
): Promise<GenerateImageResponse> {
  console.log(`[ImageGen] flux/dev/image-to-image, prompt: ${prompt.length}자`);

  try {
    const result = await fal.subscribe("fal-ai/flux/dev/image-to-image" as any, {
      input: {
        prompt,
        image_url: referenceUrl,
        strength: 0.65,
        num_inference_steps: 32,
        guidance_scale: 4.5,
        enable_safety_checker: false,
      } as any,
    });

    const url = (result as any)?.data?.images?.[0]?.url;
    if (!url) throw new Error("FAL 응답에 이미지 URL 없음");
    return { url };
  } catch (err: any) {
    // image-to-image 실패 시 text-to-image로 폴백
    console.warn(`[ImageGen] image-to-image 실패, text-to-image로 폴백: ${err.message?.slice(0, 100)}`);
    return runFluxTextToImage(prompt);
  }
}

/**
 * CodeFormer: 업스케일/복원 전용
 * 얼굴 보존 + 선명화 + 2x 업스케일
 */
async function runCodeFormer(imageUrl: string): Promise<GenerateImageResponse> {
  console.log(`[ImageGen] codeformer 업스케일/복원`);

  try {
    const result = await fal.subscribe("fal-ai/codeformer" as any, {
      input: {
        image_url: imageUrl,
        fidelity: 0.9,
        upscaling: 2,
        face_upsample: true,
      } as any,
    });

    const url = (result as any)?.data?.image?.url;
    if (!url) throw new Error("CodeFormer 응답에 이미지 URL 없음");
    return { url };
  } catch (err: any) {
    console.warn(`[ImageGen] CodeFormer 실패: ${err.message?.slice(0, 100)}`);
    // 폴백: 원본 URL 반환 (업스케일 실패해도 원본은 유지)
    return { url: imageUrl };
  }
}
