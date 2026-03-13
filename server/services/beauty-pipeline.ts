/**
 * Beauty Pipeline v6.0 - FLUX.2 LoRA Primary + InstantID + 검은화면 재시도
 *
 * ⚠️  beauty-analyzer-standalone.ts 사용 — shared-analyzer.ts와 완전 분리
 *
 * v6 업그레이드:
 * 1. FLUX.2 LoRA (fal-ai/flux-2/lora) — Primary 이미지 생성
 * 2. Gemini — Fallback #1
 * 3. FLUX Pro v1.1 (fal-ai/flux-pro/v1.1) — Fallback #2
 * 4. InstantID (fal-ai/instant-id) 얼굴 일관성 강화 (IP-Adapter 교체)
 * 5. 검은화면 자동 재시도 (최대 3회, 10KB 미만 → 재시도)
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

// ─── InstantID 얼굴 일관성 강화 (IP-Adapter 교체) ────────

async function runInstantId(
  faceRefBase64: string,
  mimeType: string,
  prompt: string,
  negativePrompt: string,
): Promise<string | null> {
  try {
    console.log("[beauty-v6] InstantID 얼굴 일관성 강화...");

    const falKey = process.env.FAL_KEY;
    if (!falKey) return null;

    // 참조 이미지 FAL Storage 업로드
    const clean = faceRefBase64.includes(",") ? faceRefBase64.split(",")[1] : faceRefBase64;
    const buffer = Buffer.from(clean, "base64");

    const initiateRes = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate", {
      method: "POST",
      headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content_type: mimeType, file_name: "beauty-face-ref.jpg" }),
    });
    if (!initiateRes.ok) throw new Error("initiate failed");
    const { upload_url, file_url } = await initiateRes.json();

    const s3Res = await fetch(upload_url, {
      method: "PUT",
      headers: { "Content-Type": mimeType },
      body: buffer,
    });
    if (!s3Res.ok) throw new Error("S3 upload failed");

    const result = await falRun("fal-ai/instant-id", {
      face_image_url: file_url,
      prompt,
      negative_prompt: negativePrompt,
      identitynet_strength_ratio: 0.80,
      adapter_strength_ratio: 0.80,
      num_inference_steps: 30,
      guidance_scale: 5.0,
      image_size: { width: 1024, height: 1024 },
    });

    const url = (result?.images as Array<{ url: string }>)?.[0]?.url
      || (result?.image as Record<string, unknown>)?.url as string;

    if (url) {
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      console.log("[beauty-v6] InstantID 완료");
      return buf.toString("base64");
    }
    return null;
  } catch (err: any) {
    console.warn(`[beauty-v6] InstantID 실패 (스킵): ${err.message?.slice(0, 100)}`);
    return null;
  }
}

// ─── 검은화면 자동 재시도 로직 ──────────────────────────

async function generateWithRetry(
  label: string,
  generateFn: () => Promise<string | null>,
  maxRetries = 3,
): Promise<string | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const base64 = await generateFn();
      if (base64) {
        // 검은화면 감지: base64 크기가 너무 작으면 검은/빈 이미지
        const sizeBytes = Buffer.byteLength(base64, "base64");
        if (sizeBytes > 10000) {
          return base64;
        }
        console.log(`[beauty-v6] ${label} 검은화면 감지 (${sizeBytes}bytes), 재시도 ${attempt + 1}/${maxRetries}`);
      }
    } catch (err: any) {
      console.log(`[beauty-v6] ${label} 생성 오류 재시도 ${attempt + 1}/${maxRetries}: ${err.message?.slice(0, 80)}`);
    }
    if (attempt < maxRetries - 1) {
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return null;
}

// ─── [Primary] FLUX.2 LoRA 이미지 생성 ──────────────────

async function generateWithFluxPrimary(
  imageDataUrl: string,
  prompt: string,
  negativePrompt: string,
): Promise<string | null> {
  return generateWithRetry("FLUX.2 LoRA", async () => {
    console.log("[beauty-v6] FLUX.2 LoRA (Primary) 생성 중...");
    const result = await falRun("fal-ai/flux-2/lora", {
      prompt,
      negative_prompt: negativePrompt,
      image_url: imageDataUrl,
      strength: 0.75,
      num_inference_steps: 28,
      guidance_scale: 7.5,
      image_size: { width: 1024, height: 1024 },
      enable_safety_checker: false,
      seed: Math.floor(Math.random() * 999999),
    });

    const imageUrl = (result?.images as Array<{ url: string }>)?.[0]?.url;
    if (imageUrl) {
      const res = await fetch(imageUrl);
      const buffer = Buffer.from(await res.arrayBuffer());
      console.log("[beauty-v6] FLUX.2 LoRA 성공");
      return buffer.toString("base64");
    }
    return null;
  });
}

// ─── [Fallback #1] Gemini Nano Banana Pro ────────────────

async function generateWithGeminiFallback(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  negativePrompt: string,
): Promise<string | null> {
  return generateWithRetry("Gemini", async () => {
    console.log("[beauty-v6] Gemini (Fallback #1) 시도...");
    const clean = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;

    const parts: GeminiPart[] = [
      { inlineData: { mimeType, data: clean } },
      {
        text: `Transform this portrait photo based on the following beauty concept. Preserve the person's facial identity, bone structure, and unique features exactly.\n\n${prompt}\n\nAvoid: ${negativePrompt}`,
      },
    ];

    const response = await callGemini(parts);
    const { data } = extractImageBase64(response);
    console.log("[beauty-v6] Gemini 성공");
    return data;
  });
}

// ─── Film Grain 후처리 ──────────────────────────────────

async function applyFilmGrain(imageBase64: string): Promise<string> {
  try {
    console.log("[beauty-v6] Film Grain 후처리...");
    const falKey = process.env.FAL_KEY;
    if (!falKey) return imageBase64;

    const clean = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const buffer = Buffer.from(clean, "base64");

    const initiateRes = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate", {
      method: "POST",
      headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content_type: "image/jpeg", file_name: "beauty-grain.jpg" }),
    });
    if (!initiateRes.ok) throw new Error("initiate failed");
    const { upload_url, file_url } = await initiateRes.json();

    const s3Res = await fetch(upload_url, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: buffer,
    });
    if (!s3Res.ok) throw new Error("S3 upload failed");

    const result = await falRun("fal-ai/image-editing", {
      image_url: file_url,
      prompt: "add subtle film grain, natural photo texture",
      strength: 0.08,
    });

    const url = (result?.image as Record<string, unknown>)?.url as string
      || (result?.images as Array<{ url: string }>)?.[0]?.url;
    if (url) {
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      console.log("[beauty-v6] Film Grain 완료");
      return buf.toString("base64");
    }
    return imageBase64;
  } catch (err: any) {
    console.warn(`[beauty-v6] Film Grain 실패 (원본 유지): ${err.message?.slice(0, 80)}`);
    return imageBase64;
  }
}

// ─── [Fallback #2] FLUX Pro v1.1 ────────────────────────

async function generateWithFluxProFallback(
  imageDataUrl: string,
  prompt: string,
  negativePrompt: string,
): Promise<string | null> {
  return generateWithRetry("FLUX Pro v1.1", async () => {
    console.log("[beauty-v6] FLUX Pro v1.1 (Fallback #2) 시도...");
    const result = await falRun("fal-ai/flux-pro/v1.1", {
      prompt,
      negative_prompt: negativePrompt,
      image_url: imageDataUrl,
      strength: 0.70,
      num_inference_steps: 28,
      guidance_scale: 7.0,
      image_size: { width: 1024, height: 1024 },
      enable_safety_checker: false,
      seed: Math.floor(Math.random() * 999999),
    });

    const imageUrl = (result?.images as Array<{ url: string }>)?.[0]?.url;
    if (imageUrl) {
      const res = await fetch(imageUrl);
      const buffer = Buffer.from(await res.arrayBuffer());
      console.log("[beauty-v6] FLUX Pro v1.1 성공");
      return buffer.toString("base64");
    }
    return null;
  });
}

// ─── 메인 함수 ──────────────────────────────────────────

export async function generateBeautyImages(
  input: BeautyGenerateInput
): Promise<BeautyGenerateOutput> {
  console.log("[beauty-v6] 시작 (FLUX.2 LoRA Primary + Gemini/FLUX Pro Fallback)...");

  // 1. Claude Vision으로 실제 분석
  const analysis = await analyzeBeautyImage(
    input.imageBase64,
    input.mimeType || "image/jpeg"
  );

  console.log("[beauty-v6] 분석 완료:", {
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

  console.log("[beauty-v6]", outputCount, "장 생성 시작...");

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
      console.log(`[beauty-v6] ${i + 1}/${outputCount} 생성 중...`);

      // [Primary] FLUX.2 LoRA
      let generatedBase64: string | null = null;
      try {
        generatedBase64 = await generateWithFluxPrimary(
          imageDataUrl,
          currentPrompt,
          finalNegative,
        );
      } catch (fluxError: any) {
        console.log('[FLUX.2 실패 원인]:', fluxError?.message || fluxError);
      }
      if (!generatedBase64) {
        console.log('[FLUX.2 실패 원인]: 3회 재시도 후에도 유효한 이미지 없음 (null 반환)');
      }

      // [Fallback #1] Gemini
      if (!generatedBase64) {
        generatedBase64 = await generateWithGeminiFallback(
          input.imageBase64,
          mimeType,
          currentPrompt,
          finalNegative,
        );
      }

      // [Fallback #2] FLUX Pro v1.1
      if (!generatedBase64) {
        generatedBase64 = await generateWithFluxProFallback(
          imageDataUrl,
          currentPrompt,
          finalNegative,
        );
      }

      if (generatedBase64) {
        // InstantID 얼굴 일관성 (faceLock 활성화 시에만)
        let finalBase64 = generatedBase64;
        if (input.faceLock) {
          const instantIdResult = await runInstantId(
            input.imageBase64,
            mimeType,
            currentPrompt,
            finalNegative,
          );
          finalBase64 = instantIdResult || generatedBase64;
        }

        // Film Grain 후처리
        finalBase64 = await applyFilmGrain(finalBase64);

        console.log(`[beauty-v6] ${i + 1}번 완료`);
        return `data:image/jpeg;base64,${finalBase64}`;
      } else {
        console.warn(`[beauty-v6] ${i + 1}번 이미지 없음 (모든 모델 실패)`);
        return null;
      }
    } catch (err) {
      console.error(`[beauty-v6] ${i + 1}번 에러:`, err);
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

  console.log(`[beauty-v6] 완료: ${images.length}/${outputCount}`);

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
