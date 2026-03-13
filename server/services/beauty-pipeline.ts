/**
 * Beauty Pipeline v4.0 - Nano Banana Pro + IP-Adapter
 *
 * ⚠️  beauty-analyzer-standalone.ts 사용 — shared-analyzer.ts와 완전 분리
 *
 * v4 업그레이드:
 * 1. Gemini Nano Banana Pro (gemini-3-pro-image-preview) 이미지 생성
 * 2. FAL IP-Adapter Face ID 얼굴 일관성 강화
 * 3. FLUX.2 LoRA 폴백
 */

import { analyzeBeautyImage } from "./beauty-analyzer-standalone";
import { callGemini, extractImageBase64, type GeminiPart } from "../_core/imageGeneration";

export interface BeautyGenerateInput {
  imageBase64: string;
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
  category: "skincare" | "makeup" | "luxury" | "natural";
  customPrompt?: string;
  customNegative?: string;
  outputCount?: number;
  expressionVariant?: number;
  /** IP-Adapter 얼굴 일관성 강화 (기본 false) */
  faceLock?: boolean;
}

export interface BeautyGenerateOutput {
  images: string[];
  prompt: string;
  negativePrompt: string;
  category: string;
  analysis: Record<string, unknown>;
}

// ─── FAL REST API (IP-Adapter, FLUX.2 LoRA 폴백용) ──────

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

// ─── IP-Adapter 얼굴 일관성 강화 ────────────────────────

async function runIpAdapterFace(
  generatedImageBase64: string,
  faceRefBase64: string,
  mimeType: string,
): Promise<string | null> {
  try {
    console.log("[beauty-v4] IP-Adapter 얼굴 일관성 강화...");

    // base64를 FAL에 업로드
    const falKey = process.env.FAL_KEY;
    if (!falKey) return null;

    const uploadBase64 = async (b64: string, name: string): Promise<string> => {
      const clean = b64.includes(",") ? b64.split(",")[1] : b64;
      const buffer = Buffer.from(clean, "base64");

      const initiateRes = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate", {
        method: "POST",
        headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content_type: mimeType, file_name: name }),
      });
      if (!initiateRes.ok) throw new Error("initiate failed");
      const { upload_url, file_url } = await initiateRes.json();

      const s3Res = await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: buffer,
      });
      if (!s3Res.ok) throw new Error("S3 upload failed");
      return file_url;
    };

    const [genUrl, faceUrl] = await Promise.all([
      uploadBase64(generatedImageBase64, "beauty-gen.jpg"),
      uploadBase64(faceRefBase64, "beauty-face-ref.jpg"),
    ]);

    const result = await falRun("fal-ai/ip-adapter-face-id", {
      image_url: genUrl,
      face_image_url: faceUrl,
      prompt: "beauty portrait, same person, preserve facial identity",
      strength: 0.5,
      scale: 0.85,
      s_scale: 1.0,
      face_id_weight: 0.85,
      num_inference_steps: 25,
      guidance_scale: 5.0,
    });

    const url = (result?.images as Array<{ url: string }>)?.[0]?.url
      || (result?.image as Record<string, unknown>)?.url as string;

    if (url) {
      const res = await fetch(url);
      const buffer = Buffer.from(await res.arrayBuffer());
      console.log("[beauty-v4] IP-Adapter 완료");
      return buffer.toString("base64");
    }
    return null;
  } catch (err: any) {
    console.warn(`[beauty-v4] IP-Adapter 실패 (스킵): ${err.message?.slice(0, 100)}`);
    return null;
  }
}

// ─── Gemini Nano Banana Pro 이미지 생성 ─────────────────

async function generateWithGemini(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  negativePrompt: string,
): Promise<string | null> {
  try {
    const clean = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;

    const parts: GeminiPart[] = [
      { inlineData: { mimeType, data: clean } },
      {
        text: `Transform this portrait photo based on the following beauty concept. Preserve the person's facial identity, bone structure, and unique features exactly.\n\n${prompt}\n\nAvoid: ${negativePrompt}`,
      },
    ];

    const response = await callGemini(parts);
    const { data } = extractImageBase64(response);
    console.log("[beauty-v4] Gemini 이미지 생성 성공");
    return data;
  } catch (err: any) {
    console.warn(`[beauty-v4] Gemini 실패: ${err.message?.slice(0, 100)}`);
    return null;
  }
}

// ─── FLUX.2 LoRA 폴백 ───────────────────────────────────

async function generateWithFluxFallback(
  imageDataUrl: string,
  prompt: string,
  negativePrompt: string,
): Promise<string | null> {
  // FLUX.2 LoRA → flux/dev 폴백
  const models = ["fal-ai/flux-2/lora", "fal-ai/flux/dev/image-to-image"];

  for (const modelId of models) {
    try {
      console.log(`[beauty-v4] ${modelId} 폴백 시도...`);
      const result = await falRun(modelId, {
        prompt,
        image_url: imageDataUrl,
        strength: 0.50,
        num_inference_steps: 35,
        guidance_scale: 6.0,
        enable_safety_checker: false,
        width: 832,
        height: 1216,
        negative_prompt: negativePrompt,
        seed: Math.floor(Math.random() * 999999),
      });

      const imageUrl = (result?.images as Array<{ url: string }>)?.[0]?.url;
      if (imageUrl) {
        const res = await fetch(imageUrl);
        const buffer = Buffer.from(await res.arrayBuffer());
        console.log(`[beauty-v4] ${modelId} 성공`);
        return buffer.toString("base64");
      }
    } catch (err: any) {
      console.warn(`[beauty-v4] ${modelId} 실패: ${err.message?.slice(0, 80)}`);
      continue;
    }
  }

  return null;
}

// ─── 메인 함수 ──────────────────────────────────────────

export async function generateBeautyImages(
  input: BeautyGenerateInput
): Promise<BeautyGenerateOutput> {
  console.log("[beauty-v4] 시작 (Nano Banana Pro + IP-Adapter)...");

  // 1. Claude Vision으로 실제 분석
  const analysis = await analyzeBeautyImage(
    input.imageBase64,
    input.mimeType || "image/jpeg"
  );

  console.log("[beauty-v4] 분석 완료:", {
    skinTone: analysis.skinTone,
    estimatedAge: analysis.estimatedAge,
    hasGlasses: analysis.hasGlasses,
    expressionVariant: analysis.expressionVariant,
  });

  // 2. 최종 프롬프트
  const categoryExtra = CATEGORY_EXTRA[input.category] || CATEGORY_EXTRA.natural;
  const finalPrompt = input.customPrompt || `${analysis.generatedPrompt}, ${categoryExtra}`;
  const finalNegative = input.customNegative || analysis.generatedNegative;

  // 3. 이미지 준비
  const mimeType = input.mimeType || "image/jpeg";
  const imageDataUrl = input.imageBase64.startsWith("data:")
    ? input.imageBase64
    : `data:${mimeType};base64,${input.imageBase64}`;

  const outputCount = input.outputCount || 2;
  const images: string[] = [];

  console.log("[beauty-v4]", outputCount, "장 생성 시작...");

  // 각 이미지 생성 태스크를 함수로 정의
  const generateOne = async (i: number): Promise<string | null> => {
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
      currentPrompt = finalPrompt + `, ${EXPRESSION_VARIANTS[nextVariant]}`;
    }

    try {
      console.log(`[beauty-v4] ${i + 1}/${outputCount} 생성 중...`);

      // Gemini Nano Banana Pro 시도
      let generatedBase64 = await generateWithGemini(
        input.imageBase64,
        mimeType,
        currentPrompt,
        finalNegative,
      );

      // Gemini 실패 시 FLUX.2 LoRA 폴백
      if (!generatedBase64) {
        generatedBase64 = await generateWithFluxFallback(
          imageDataUrl,
          currentPrompt,
          finalNegative,
        );
      }

      if (generatedBase64) {
        // IP-Adapter 얼굴 일관성 (faceLock 활성화 시에만)
        let finalBase64 = generatedBase64;
        if (input.faceLock) {
          const ipResult = await runIpAdapterFace(
            generatedBase64,
            input.imageBase64,
            mimeType,
          );
          finalBase64 = ipResult || generatedBase64;
        }
        console.log(`[beauty-v4] ${i + 1}번 완료`);
        return `data:image/jpeg;base64,${finalBase64}`;
      } else {
        console.warn(`[beauty-v4] ${i + 1}번 이미지 없음 (모든 모델 실패)`);
        return null;
      }
    } catch (err) {
      console.error(`[beauty-v4] ${i + 1}번 에러:`, err);
      return null;
    }
  };

  // outputCount >= 2이면 Promise.all로 병렬 실행
  const tasks = Array.from({ length: outputCount }, (_, i) => generateOne(i));
  const results = await Promise.all(tasks);
  for (const r of results) {
    if (r) images.push(r);
  }

  if (images.length === 0) throw new Error("모든 이미지 생성 실패");

  console.log(`[beauty-v4] 완료: ${images.length}/${outputCount}`);

  return {
    images,
    prompt: finalPrompt,
    negativePrompt: finalNegative,
    category: input.category,
    analysis: {
      skinTone: analysis.skinTone,
      estimatedAge: analysis.estimatedAge,
      skinAgingFeatures: analysis.skinAgingFeatures,
      hasGlasses: analysis.hasGlasses,
      glassesStyle: analysis.glassesStyle,
      hasBeard: analysis.hasBear,
      hairStyle: analysis.hairStyle,
      expressionVariant: analysis.expressionVariant,
      pose: analysis.pose,
      lightingType: analysis.lightingType,
      mood: analysis.mood,
    },
  };
}
