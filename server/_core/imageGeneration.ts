/**
 * Image generation helper — FAL AI (Flux) 기반
 * Forge API 의존 제거, FAL_KEY 환경변수 사용
 *
 * - 텍스트만: flux-dev (text-to-image)
 * - 참조 이미지 포함: flux-dev/image-to-image
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

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  ensureFalConfig();

  let prompt = options.prompt;
  if (prompt.length > 2000) {
    prompt = prompt.substring(0, 1997) + "...";
  }

  const refImages = options.originalImages || [];

  // 참조 이미지가 있으면 image-to-image, 없으면 text-to-image
  if (refImages.length > 0) {
    const imageUrl = await resolveImageUrl(refImages[0]);
    if (imageUrl) {
      return generateImageToImage(prompt, imageUrl);
    }
  }

  return generateTextToImage(prompt);
}

/**
 * Text-to-image: fal-ai/flux/dev
 */
async function generateTextToImage(prompt: string): Promise<GenerateImageResponse> {
  console.log(`[ImageGen] FAL text-to-image, prompt length: ${prompt.length}`);

  try {
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
    if (!url) throw new Error("FAL 응답에 이미지 URL 없음");

    return { url };
  } catch (err: any) {
    console.error(`[ImageGen] FAL text-to-image 실패:`, err.message?.slice(0, 200));
    throw new Error(`이미지 생성 실패: ${err.message}`);
  }
}

/**
 * Image-to-image: fal-ai/flux/dev/image-to-image
 */
async function generateImageToImage(
  prompt: string,
  referenceUrl: string
): Promise<GenerateImageResponse> {
  console.log(`[ImageGen] FAL image-to-image, prompt length: ${prompt.length}`);

  try {
    const result = await fal.subscribe("fal-ai/flux/dev/image-to-image" as any, {
      input: {
        prompt,
        image_url: referenceUrl,
        strength: 0.75,
        num_inference_steps: 28,
        guidance_scale: 3.5,
        enable_safety_checker: false,
      } as any,
    });

    const url = (result as any)?.data?.images?.[0]?.url;
    if (!url) throw new Error("FAL 응답에 이미지 URL 없음");

    return { url };
  } catch (err: any) {
    // image-to-image 실패 시 text-to-image로 폴백
    console.warn(`[ImageGen] image-to-image 실패, text-to-image로 폴백:`, err.message?.slice(0, 100));
    return generateTextToImage(prompt);
  }
}
