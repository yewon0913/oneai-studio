/**
 * Beauty Branding Module - Image Generation Pipeline
 * Flux를 사용한 뷰티 이미지 생성 (4장, 832x1216)
 */

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
 * Flux API를 통한 뷰티 이미지 생성
 */
export async function generateBeautyImages(
  input: BeautyGenerateInput
): Promise<BeautyGenerateOutput> {
  // 1. 뷰티 전용 분석
  const analysis = await analyzeBeautyImageBase64(
    input.imageBase64,
    input.mimeType || "image/jpeg",
    input.category
  );

  const finalPrompt = input.customPrompt || analysis.prompt;

  // 2. Flux API 호출 (기존 image-pipeline.ts 참고)
  const FLUX_API_URL = process.env.FLUX_API_URL || "https://api.flux.ai/v1/images/generate";
  const FLUX_API_KEY = process.env.FLUX_API_KEY;

  if (!FLUX_API_KEY) {
    throw new Error("FLUX_API_KEY is not set");
  }

  const width = 832;
  const height = 1216; // 세로형 뷰티 화보

  try {
    const fluxResponse = await fetch(FLUX_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FLUX_API_KEY}`,
      },
      body: JSON.stringify({
        prompt: finalPrompt,
        negative_prompt: analysis.negativePrompt,
        width,
        height,
        num_images: input.outputCount || 4,
        guidance_scale: 3.5,
        num_inference_steps: 28,
      }),
    });

    if (!fluxResponse.ok) {
      const errorData = await fluxResponse.json();
      throw new Error(`Flux API error: ${JSON.stringify(errorData)}`);
    }

    const fluxData = await fluxResponse.json();
    const images: string[] = fluxData.images || fluxData.data || [];

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
