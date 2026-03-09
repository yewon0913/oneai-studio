/**
 * Beauty Pipeline v3.0 - 90점 달성 버전
 *
 * ⚠️  beauty-analyzer-standalone.ts 사용 — shared-analyzer.ts와 완전 분리
 * 웨딩/gemini 파이프라인 수정이 이 파일에 영향을 주지 않습니다.
 *
 * 개선사항:
 * 1. 연령대 자동 감지 → 피부 과보정 방지
 * 2. 표정 6가지 변주 → 반복 패턴 제거
 * 3. 헤어 자연스러움 강화
 * 4. 얼굴 유사도 최대화
 * 5. 선글라스 착용 시 안정성 강화
 */

import { analyzeBeautyImage } from "./beauty-analyzer-standalone";

export interface BeautyGenerateInput {
  imageBase64: string;
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
  category: "skincare" | "makeup" | "luxury" | "natural";
  customPrompt?: string;
  customNegative?: string;
  outputCount?: number;
  expressionVariant?: number; // 0~5 지정 가능, 없으면 랜덤
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

// 카테고리별 추가 프롬프트 (v3: 실사감 강화)
const CATEGORY_EXTRA: Record<string, string> = {
  skincare: [
    "glass skin with visible pores",
    "dewy fresh hydrated complexion",
    "Laneige Sulwhasoo campaign style",
    "natural skin luminosity",
    "NOT airbrushed NOT filtered",
  ].join(", "),

  makeup: [
    "professional makeup with visible skin texture",
    "Korean beauty editorial style",
    "3CE Romand campaign",
    "precise eyeliner defined brows",
    "foundation with natural skin showing through",
  ].join(", "),

  luxury: [
    "luxury beauty brand campaign",
    "Chanel Dior editorial quality",
    "high fashion sophisticated",
    "dramatic luxury lighting",
    "premium jewelry accessories",
    "Vogue Korea cover quality",
  ].join(", "),

  natural: [
    "fresh no-makeup-makeup look",
    "vitamin skin healthy glow",
    "clean beauty organic minimal",
    "sun-kissed natural radiance",
    "skin texture completely preserved",
  ].join(", "),
};

export async function generateBeautyImages(
  input: BeautyGenerateInput
): Promise<BeautyGenerateOutput> {
  console.log("[beauty-v3] 시작...");

  // 1. Claude Vision으로 실제 분석 (beauty-analyzer-standalone 전용)
  const analysis = await analyzeBeautyImage(
    input.imageBase64,
    input.mimeType || "image/jpeg",
    input.expressionVariant
  );

  console.log("[beauty-v3] 분석 완료:", {
    skinTone: analysis.skinTone,
    estimatedAge: analysis.estimatedAge,
    hasGlasses: analysis.hasGlasses,
    expressionVariant: analysis.expressionVariant,
    lightingType: analysis.lightingType,
  });

  // 2. 최종 프롬프트
  const categoryExtra = CATEGORY_EXTRA[input.category] || CATEGORY_EXTRA.natural;
  const finalPrompt   = input.customPrompt || `${analysis.generatedPrompt}, ${categoryExtra}`;
  const finalNegative = input.customNegative || analysis.generatedNegative;

  // 3. 이미지 URL
  const imageDataUrl = input.imageBase64.startsWith("data:")
    ? input.imageBase64
    : `data:${input.mimeType || "image/jpeg"};base64,${input.imageBase64}`;

  const outputCount = input.outputCount || 2;
  const images: string[] = [];

  console.log("[beauty-v3]", outputCount, "장 생성 시작...");

  for (let i = 0; i < outputCount; i++) {
    // 2장 이상일 때 두 번째부터 표정 변주 다르게
    let currentPrompt = finalPrompt;
    if (i > 0 && !input.customPrompt) {
      const nextVariant = (analysis.expressionVariant + i) % 6;
      const EXPRESSION_VARIANTS = [
        "genuine natural smile, soft eyes with warmth, relaxed jaw, authentic joy",
        "confident direct gaze, subtle smirk, strong eyebrows, composed expression",
        "thoughtful introspective look, slightly downward gaze, serene neutral expression",
        "mid-laugh natural expression, eyes slightly crinkled, open mouth smile, candid joy",
        "elegant side profile gaze, slight chin tilt, graceful composure",
        "fresh casual expression, relaxed mouth, friendly approachable energy",
      ];
      // 표정 부분만 교체
      currentPrompt = finalPrompt + `, ${EXPRESSION_VARIANTS[nextVariant]}`;
    }

    try {
      console.log(`[beauty-v3] ${i + 1}/${outputCount} 생성 중...`);

      const result = await falRun("fal-ai/flux/dev/image-to-image", {
        prompt:                currentPrompt,
        image_url:             imageDataUrl,
        strength:              0.55,         // 원본 보존 강화
        num_inference_steps:   35,
        guidance_scale:        6.0,
        enable_safety_checker: false,
        width:                 832,
        height:                1216,
        negative_prompt:       finalNegative,
        seed:                  Math.floor(Math.random() * 999999),
      });

      const imageUrl = (result?.images as Array<{ url: string }>)?.[0]?.url;

      if (imageUrl) {
        try {
          const res    = await fetch(imageUrl);
          const buffer = await res.arrayBuffer();
          const b64    = Buffer.from(buffer).toString("base64");
          images.push(`data:image/jpeg;base64,${b64}`);
          console.log(`[beauty-v3] ${i + 1}번 base64 저장 완료`);
        } catch {
          images.push(imageUrl);
          console.log(`[beauty-v3] ${i + 1}번 URL 저장 (fallback)`);
        }
      } else {
        console.warn(`[beauty-v3] ${i + 1}번 이미지 없음`);
      }
    } catch (err) {
      console.error(`[beauty-v3] ${i + 1}번 에러:`, err);
    }
  }

  if (images.length === 0) throw new Error("모든 이미지 생성 실패");

  console.log(`[beauty-v3] 완료: ${images.length}/${outputCount}`);

  return {
    images,
    prompt:        finalPrompt,
    negativePrompt: finalNegative,
    category:      input.category,
    analysis: {
      skinTone:          analysis.skinTone,
      estimatedAge:      analysis.estimatedAge,
      skinAgingFeatures: analysis.skinAgingFeatures,
      hasGlasses:        analysis.hasGlasses,
      glassesStyle:      analysis.glassesStyle,
      hasBeard:          analysis.hasBear,
      hairStyle:         analysis.hairStyle,
      expressionVariant: analysis.expressionVariant,
      pose:              analysis.pose,
      lightingType:      analysis.lightingType,
      mood:              analysis.mood,
    },
  };
}
