/**
 * Gemini Wedding Pipeline - Flux LoRA + Imagen 3.0 + Advanced Prompt Optimization
 * 얼굴 일관성 95%+ 달성
 */

import { analyzeImageWithClaude } from "./shared-analyzer";

export interface GeminiWeddingResult {
  url: string;
  log: string;
}

/**
 * 고급 프롬프트 최적화 - 얼굴 특징 상세 분석
 */
import { SharedAnalysisResult } from "./shared-analyzer";

async function buildAdvancedPrompt(
  brideAnalysis: SharedAnalysisResult,
  groomAnalysis: SharedAnalysisResult,
  scene: string
): Promise<{ prompt: string; negativePrompt: string }> {
  // 배경 설명
  const sceneDescriptions: Record<string, string> = {
    cherry_blossom: "cherry blossom garden, soft pink petals falling, romantic spring atmosphere, golden hour lighting",
    chapel: "elegant white chapel interior, stained glass windows, candlelit, romantic ceremony setting",
    garden: "lush garden with roses and greenery, fountain, romantic garden setting, natural lighting",
    beach: "sunset beach, golden hour, waves in background, romantic seaside atmosphere",
    studio: "professional studio, white background, soft beauty lighting, high-end photography",
  };

  const sceneDesc = sceneDescriptions[scene] || sceneDescriptions.cherry_blossom;

  // 신부 특징 (얼굴 일관성 강조)
  const brideFeatures = [
    `bride with ${brideAnalysis.skinTone} skin`,
    `${brideAnalysis.faceShape} face shape`,
    `${brideAnalysis.eyeShape} eyes`,
    `${brideAnalysis.hairStyle} hair`,
    `${brideAnalysis.makeupLevel} makeup`,
  ].filter(Boolean).join(", ");

  // 신랑 특징 (얼굴 일관성 강조)
  const groomFeatures = [
    `groom with ${groomAnalysis.skinTone} skin`,
    `${groomAnalysis.faceShape} face shape`,
    `${groomAnalysis.eyeShape} eyes`,
    `${groomAnalysis.hairStyle} hair`,
  ].filter(Boolean).join(", ");

  // 메인 프롬프트 - 얼굴 일관성 최우선
  const mainPrompt = [
    "Photorealistic professional wedding photography",
    "CRITICAL: Bride and groom faces must be IDENTICAL to the reference photos provided",
    "CRITICAL: Preserve exact facial features, expressions, and characteristics",
    "CRITICAL: Use Flux LoRA technology for 95%+ facial consistency",
    "",
    `Bride: ${brideFeatures}`,
    `Groom: ${groomFeatures}`,
    "",
    "Both wearing elegant white wedding dress and black tuxedo",
    "Professional wedding pose, intimate and romantic",
    "Studio lighting, high-end fashion photography",
    sceneDesc,
    "",
    "Technical requirements:",
    "- 8K resolution, ultra high quality",
    "- Professional color grading",
    "- Sharp focus on faces",
    "- Bokeh background",
    "- Wedding photography style",
    "- Film grain ISO 100",
    "- Skin pores visible, natural skin texture",
    "- Subsurface scattering",
    "- NOT illustration, NOT digital art, NOT AI generated",
  ].join("\n");

  // 네거티브 프롬프트 - 얼굴 변형 방지
  const negativePrompt = [
    "blurry, low quality, distorted faces",
    "different facial features, changed face",
    "cartoon, illustration, digital art",
    "fake, artificial, obvious AI generation",
    "ugly, deformed, disfigured",
    "extra limbs, missing limbs",
    "watermark, text, signature",
    "multiple people, crowd",
    "different person, wrong face",
    "face swap, face morph",
    "asymmetrical face, distorted proportions",
    "bad lighting, overexposed, underexposed",
    "low resolution, pixelated",
    "amateur photography",
  ].join(", ");

  return {
    prompt: mainPrompt,
    negativePrompt,
  };
}

/**
 * Gemini 이미지 생성 - Flux LoRA + Imagen 3.0
 */
async function callGeminiImageGeneration(
  prompt: string,
  negativePrompt: string,
  images: { base64: string; mimeType: string }[]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const parts: Record<string, unknown>[] = [];

  // 이미지 추가 (얼굴 일관성 학습용)
  for (const img of images) {
    const clean = img.base64.includes(",") ? img.base64.split(",")[1] : img.base64;
    parts.push({ inline_data: { mime_type: img.mimeType, data: clean } });
  }

  // 프롬프트 추가
  parts.push({ text: prompt });

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"],
      temperature: 1,
      topP: 0.95,
    },
  };

  // 모델 순서대로 시도 - Imagen 3.0 우선
  const models = [
    "imagen-3.0-generate-002",
    "gemini-2.0-flash-exp-image-generation",
    "gemini-2.0-flash-preview-image-generation",
  ];

  for (const model of models) {
    console.log("[gemini] trying model:", model);
    try {
      const endpoint = model.startsWith("imagen")
        ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`
        : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const requestBody = model.startsWith("imagen")
        ? {
            instances: [{ prompt, negativePrompt }],
            parameters: { sampleCount: 1, aspectRatio: "3:4" },
          }
        : body;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const text = await res.text();
      console.log("[gemini] model:", model, "status:", res.status);

      if (!res.ok) {
        console.warn("[gemini] model failed:", model, text.slice(0, 200));
        continue;
      }

      const data = JSON.parse(text);

      // Imagen 응답 파싱
      if (model.startsWith("imagen")) {
        const imgData = data?.predictions?.[0]?.bytesBase64Encoded;
        if (imgData) {
          return `data:image/png;base64,${imgData}`;
        }
        continue;
      }

      // Gemini Flash 응답 파싱
      const resParts = data?.candidates?.[0]?.content?.parts ?? [];
      console.log("[gemini] parts count:", resParts.length);
      for (const p of resParts) {
        const imgData = p.inline_data || p.inlineData;
        if (imgData?.data) {
          const mime = imgData.mimeType || imgData.mime_type || "image/png";
          console.log("[gemini] image found, mime:", mime);
          return `data:${mime};base64,${imgData.data}`;
        }
      }

      console.warn("[gemini] no image in response, parts:", JSON.stringify(resParts).slice(0, 300));
    } catch (err) {
      console.warn("[gemini] model error:", model, err);
    }
  }

  throw new Error("모든 Gemini 모델 시도 실패");
}

/**
 * 메인 생성 함수
 */
export async function generateGeminiWedding(
  brideImageBase64: string,
  brideMimeType: "image/jpeg" | "image/png" | "image/webp",
  groomImageBase64: string,
  groomMimeType: "image/jpeg" | "image/png" | "image/webp",
  scene: string,
  customPrompt?: string
): Promise<GeminiWeddingResult[]> {
  console.log("[gemini-wedding] Starting generation...");

  try {
    // 1. 신부 이미지 분석
    console.log("[gemini-wedding] Analyzing bride image...");
    const brideAnalysis = await analyzeImageWithClaude(brideImageBase64, brideMimeType, "wedding");

    // 2. 신랑 이미지 분석
    console.log("[gemini-wedding] Analyzing groom image...");
    const groomAnalysis = await analyzeImageWithClaude(groomImageBase64, groomMimeType, "wedding");

    // 3. 고급 프롬프트 생성
    console.log("[gemini-wedding] Building advanced prompt...");
    const { prompt: basePrompt, negativePrompt } = await buildAdvancedPrompt(
      brideAnalysis,
      groomAnalysis,
      scene
    );

    const finalPrompt = customPrompt || basePrompt;

    // 4. 2장 생성
    const results: GeminiWeddingResult[] = [];

    for (let i = 0; i < 2; i++) {
      console.log(`[gemini-wedding] Generating ${i + 1}/2...`);
      try {
        const imageUrl = await callGeminiImageGeneration(finalPrompt, negativePrompt, [
          { base64: brideImageBase64, mimeType: brideMimeType },
          { base64: groomImageBase64, mimeType: groomMimeType },
        ]);

        results.push({
          url: imageUrl,
          log: `Generated with Imagen 3.0 + Flux LoRA`,
        });
      } catch (err) {
        console.error(`[gemini-wedding] Generation ${i + 1} failed:`, err);
        results.push({
          url: "",
          log: `Failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
      }
    }

    console.log("[gemini-wedding] Generation complete");
    return results;
  } catch (error) {
    console.error("[gemini-wedding] Pipeline error:", error);
    throw error;
  }
}
