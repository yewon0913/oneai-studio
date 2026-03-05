// ─────────────────────────────────────────────────────
// 뷰티 브랜딩 이미지 생성 파이프라인
// Flux API를 사용하여 4장의 뷰티 화보 생성
// ─────────────────────────────────────────────────────

import { analyzeBeautyImage, BeautyCategory, SkinTone, MakeupStyle, Lighting } from "./beauty-analyzer";

const FLUX_API_URL = process.env.BUILT_IN_FORGE_API_URL || "https://api.fal.ai/v1/flux";
const FLUX_API_KEY = process.env.BUILT_IN_FORGE_API_KEY || "";

export interface BeautyGenerateInput {
  imageBase64?: string;
  category: BeautyCategory;
  skinTone: SkinTone;
  makeupStyle: MakeupStyle;
  lighting: Lighting;
  mood: string;
  customPrompt?: string;
  outputCount?: number;
}

export interface BeautyGenerateOutput {
  images: string[];
  prompt: string;
  negativePrompt: string;
  category: BeautyCategory;
  selectedOptions: {
    skinTone: SkinTone;
    makeupStyle: MakeupStyle;
    lighting: Lighting;
    mood: string;
  };
}

// ─────────────────────────────────────────────────────
// Flux 이미지 생성 함수
// ─────────────────────────────────────────────────────

async function generateWithFlux(
  prompt: string,
  negativePrompt: string,
  outputCount: number = 4
): Promise<string[]> {
  try {
    const response = await fetch(FLUX_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FLUX_API_KEY}`,
      },
      body: JSON.stringify({
        prompt,
        negative_prompt: negativePrompt,
        width: 832,
        height: 1216,
        num_images: Math.min(outputCount, 8),
        guidance_scale: 3.5,
        num_inference_steps: 28,
        seed: Math.floor(Math.random() * 1000000),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Flux API 에러: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    // Flux API 응답 형식에 따라 이미지 추출
    const images = data.images || data.data || [];
    
    if (!Array.isArray(images) || images.length === 0) {
      throw new Error("Flux API에서 이미지를 생성하지 못했습니다");
    }

    return images.map((img: any) => {
      // 이미지가 URL 문자열이거나 객체일 수 있음
      if (typeof img === "string") return img;
      if (typeof img === "object" && img.url) return img.url;
      return img;
    });
  } catch (err: any) {
    console.error("Flux 이미지 생성 실패:", err);
    throw new Error(`이미지 생성 실패: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────
// 메인 생성 함수
// ─────────────────────────────────────────────────────

export async function generateBeautyImages(
  input: BeautyGenerateInput
): Promise<BeautyGenerateOutput> {
  try {
    // 1. 뷰티 분석 (규칙 기반, API 없음)
    const analysis = await analyzeBeautyImage(
      input.imageBase64 || "",
      input.category,
      input.skinTone,
      input.makeupStyle,
      input.lighting,
      input.mood
    );

    // 2. 커스텀 프롬프트가 있으면 사용, 없으면 분석 결과 사용
    const finalPrompt = input.customPrompt || analysis.prompt;

    // 3. Flux로 이미지 생성
    const images = await generateWithFlux(
      finalPrompt,
      analysis.negativePrompt,
      input.outputCount || 4
    );

    return {
      images,
      prompt: finalPrompt,
      negativePrompt: analysis.negativePrompt,
      category: input.category,
      selectedOptions: {
        skinTone: input.skinTone,
        makeupStyle: input.makeupStyle,
        lighting: input.lighting,
        mood: input.mood,
      },
    };
  } catch (err: any) {
    console.error("뷰티 이미지 생성 실패:", err);
    throw new Error(`뷰티 이미지 생성 실패: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────
// 분석만 수행 (프리뷰용)
// ─────────────────────────────────────────────────────

export async function analyzeBeautyOnly(
  input: Omit<BeautyGenerateInput, "outputCount">
) {
  return await analyzeBeautyImage(
    input.imageBase64 || "",
    input.category,
    input.skinTone,
    input.makeupStyle,
    input.lighting,
    input.mood
  );
}
