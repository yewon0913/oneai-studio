/**
 * 참조 이미지 기반 이미지 생성 — Gemini Nano Banana Pro + FLUX.2 LoRA 폴백
 *
 * Gemini: 참조 이미지를 inlineData로 전달하여 구도 유지 + 변형
 * FLUX.2 LoRA: Gemini 실패 시 폴백 (fal-ai/flux-2/lora)
 */

import { callGemini, extractImageUrl, type GeminiPart } from "../_core/imageGeneration";

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

export async function generateFromReference(
  prompt: string,
  referenceImageUrl: string,
  strength: number = 0.75
): Promise<string> {
  console.log("[image-pipeline] Nano Banana Pro 시도...");

  // 1. Gemini Nano Banana Pro 시도
  try {
    const refRes = await fetch(referenceImageUrl);
    if (refRes.ok) {
      const buffer = Buffer.from(await refRes.arrayBuffer());
      const mime = refRes.headers.get("content-type") || "image/jpeg";

      const parts: GeminiPart[] = [
        { inlineData: { mimeType: mime, data: buffer.toString("base64") } },
        { text: `Transform this image while preserving the composition and structure (strength: ${strength}). ${prompt}` },
      ];

      const response = await callGemini(parts);
      const url = await extractImageUrl(response);
      console.log("[image-pipeline] Gemini 성공:", url.slice(0, 80));
      return url;
    }
  } catch (err: any) {
    console.warn(`[image-pipeline] Gemini 실패: ${err.message?.slice(0, 100)}`);
  }

  // 2. FLUX.2 LoRA 폴백
  const models = ["fal-ai/flux-2/lora", "fal-ai/flux/dev/image-to-image"];

  for (const modelId of models) {
    try {
      console.log(`[image-pipeline] ${modelId} 폴백...`);
      const result = await falRun(modelId, {
        prompt,
        image_url: referenceImageUrl,
        strength,
        num_inference_steps: 28,
        guidance_scale: 3.5,
        enable_safety_checker: false,
      });

      const url = (result?.images as Array<{ url: string }>)?.[0]?.url;
      if (url) {
        console.log(`[image-pipeline] ${modelId} 성공:`, url.slice(0, 80));
        return url;
      }
    } catch (err: any) {
      console.warn(`[image-pipeline] ${modelId} 실패: ${err.message?.slice(0, 80)}`);
      continue;
    }
  }

  throw new Error("모든 이미지 생성 모델 실패");
}
