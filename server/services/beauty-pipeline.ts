/**
 * Beauty Branding Module - Image Generation Pipeline
 * Flux를 사용한 뷰티 이미지 생성 (4장, 832x1216)
 */

import { fal } from "@fal-ai/client";
import { analyzeBeautyImageBase64, BeautyAnalysisResult } from "./beauty-analyzer";

export interface BeautyGenerateInput {
  imageBase64: string;
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
  category: "skincare" | "makeup" | "luxury" | "natural";
  customPrompt?: string;
  aspectRatio?: "1:1" | "4:5" | "3:4" | "9:16";
  outputCount?: number;
}

export interface BeautyGenerateOutput {
  images: string[];
  prompt: string;
  negativePrompt: string;
  category: "skincare" | "makeup" | "luxury" | "natural";
  analysisDetail: BeautyAnalysisResult["analysis"];
}

/**
 * Base64를 URL로 변환 (S3 업로드 또는 data URL 사용)
 */
function base64ToDataUrl(base64: string, mimeType: string): string {
  if (base64.startsWith("data:")) {
    return base64;
  }
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Flux API를 통한 뷰티 이미지 생성
 */
export async function generateBeautyImages(
  input: BeautyGenerateInput
): Promise<BeautyGenerateOutput> {
  // FAL 설정 (배포 시점에 설정)
  fal.config({ credentials: process.env.FAL_KEY });

  // 1. 뷰티 전용 분석
  const analysis = await analyzeBeautyImageBase64(
    input.imageBase64,
    input.mimeType || "image/jpeg",
    input.category
  );

  const finalPrompt = input.customPrompt || analysis.prompt;
  const imageDataUrl = base64ToDataUrl(input.imageBase64, input.mimeType || "image/jpeg");

  // 2. Flux API 호출 (fal-ai/flux/dev/image-to-image)
  const outputCount = input.outputCount || 4;
  const images: string[] = [];

  try {
    // 4장을 순차적으로 생성
    for (let i = 0; i < outputCount; i++) {
      try {
        const result = await fal.subscribe("fal-ai/flux/dev/image-to-image" as any, {
          input: {
            prompt: finalPrompt,
            image_url: imageDataUrl,
            strength: 0.65,
            num_inference_steps: 32,
            guidance_scale: 4.5,
            enable_safety_checker: false,
            width: 832,
            height: 1216,
          } as any,
        });

        const imageUrl = (result as any).data?.images?.[0]?.url;
        if (imageUrl) {
          images.push(imageUrl);
        } else {
          console.warn(`[Beauty] 이미지 ${i + 1} 생성 실패: URL 없음`);
        }
      } catch (error) {
        console.error(`[Beauty] 이미지 ${i + 1} 생성 에러:`, error);
      }
    }

    if (images.length === 0) {
      throw new Error("모든 이미지 생성 실패");
    }

    return {
      images,
      prompt: finalPrompt,
      negativePrompt: analysis.negativePrompt,
      category: input.category,
      analysisDetail: analysis.analysis,
    };
  } catch (error) {
    console.error("Beauty image generation error:", error);
    throw error;
  }
}
