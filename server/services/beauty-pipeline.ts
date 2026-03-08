/**
 * Beauty Pipeline v2 - 실사감 극대화
 * Claude Vision 실제 분석 + 프롬프트 엔진 적용
 * 기존 파일 교체용
 */

import { analyzeImageWithClaude } from "./shared-analyzer";

export interface BeautyGenerateInput {
  imageBase64: string;
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
  category: "skincare" | "makeup" | "luxury" | "natural";
  customPrompt?: string;
  customNegative?: string;
  outputCount?: number;
}

export interface BeautyGenerateOutput {
  images: string[];
  prompt: string;
  negativePrompt: string;
  category: string;
  analysis: Record<string, unknown>;
}

async function falRun(
  modelId: string,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error("FAL_KEY not set");

  const res = await fetch(`https://fal.run/${modelId}`, {
    method: "POST",
    headers: {
      "Authorization": `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`${modelId} failed ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// 카테고리별 추가 프롬프트
const CATEGORY_EXTRA: Record<string, string> = {
  skincare: "glass skin, dewy fresh, hydrated luminous complexion, Laneige Sulwhasoo campaign style, water droplets on skin",
  makeup:   "flawless foundation with visible pores, Korean beauty style, 3CE Romand editorial, precise eyeliner, defined brows",
  luxury:   "luxury beauty brand campaign, Chanel Dior editorial, high fashion, dramatic sophisticated, jewelry accessories",
  natural:  "fresh no-makeup glow, vitamin skin, clean beauty, organic minimal, sun-kissed healthy skin",
};

export async function generateBeautyImages(
  input: BeautyGenerateInput
): Promise<BeautyGenerateOutput> {
  console.log("[beauty-v2] Starting analysis...");

  // 1. Claude Vision으로 실제 분석
  const analysis = await analyzeImageWithClaude(
    input.imageBase64,
    input.mimeType || "image/jpeg",
    "beauty"
  );

  console.log("[beauty-v2] Analysis done:", {
    skinTone: analysis.skinTone,
    hasGlasses: analysis.hasGlasses,
    pose: analysis.pose,
    lightingType: analysis.lightingType,
  });

  // 2. 최종 프롬프트 (커스텀 or 분석 기반)
  const categoryExtra = CATEGORY_EXTRA[input.category] || CATEGORY_EXTRA.natural;
  const finalPrompt = input.customPrompt ||
    `${analysis.generatedPrompt}, ${categoryExtra}`;
  const finalNegative = input.customNegative || analysis.generatedNegative;

  // 3. 이미지 데이터 URL
  const imageDataUrl = input.imageBase64.startsWith("data:")
    ? input.imageBase64
    : `data:${input.mimeType || "image/jpeg"};base64,${input.imageBase64}`;

  const outputCount = input.outputCount || 2;
  const images: string[] = [];

  console.log("[beauty-v2] Generating", outputCount, "images...");

  for (let i = 0; i < outputCount; i++) {
    try {
      console.log(`[beauty-v2] Image ${i + 1}/${outputCount}...`);

      const result = await falRun("fal-ai/flux/dev/image-to-image", {
        prompt: finalPrompt,
        image_url: imageDataUrl,
        // strength 낮춤 → 원본 보존 강화 (포즈/얼굴 자연스럽게)
        strength: 0.55,
        num_inference_steps: 35,
        guidance_scale: 6.0,
        enable_safety_checker: false,
        width: 832,
        height: 1216,
        negative_prompt: finalNegative,
        seed: Math.floor(Math.random() * 999999),
      });

      const imageUrl = (result?.images as Array<{ url: string }>)?.[0]?.url;

      if (imageUrl) {
        // base64로 저장 (URL 만료 방지)
        try {
          const res = await fetch(imageUrl);
          const buffer = await res.arrayBuffer();
          const b64 = Buffer.from(buffer).toString("base64");
          images.push(`data:image/jpeg;base64,${b64}`);
          console.log(`[beauty-v2] Image ${i + 1} saved as base64`);
        } catch {
          images.push(imageUrl);
          console.log(`[beauty-v2] Image ${i + 1} saved as URL (fallback)`);
        }
      } else {
        console.warn(`[beauty-v2] Image ${i + 1} no URL in response`);
      }
    } catch (err) {
      console.error(`[beauty-v2] Image ${i + 1} error:`, err);
    }
  }

  if (images.length === 0) throw new Error("모든 이미지 생성 실패");

  console.log(`[beauty-v2] Done: ${images.length}/${outputCount}`);

  return {
    images,
    prompt: finalPrompt,
    negativePrompt: finalNegative,
    category: input.category,
    analysis: {
      skinTone: analysis.skinTone,
      hasGlasses: analysis.hasGlasses,
      glassesStyle: analysis.glassesStyle,
      hasBeard: analysis.hasBear,
      hairStyle: analysis.hairStyle,
      pose: analysis.pose,
      expression: analysis.expression,
      lightingType: analysis.lightingType,
      mood: analysis.mood,
    },
  };
}
