/**
 * Image generation helper v2.0 — FLUX.2 LoRA Primary
 *
 * 모델 우선순위:
 *   1. FLUX.2 LoRA (fal-ai/flux-2/lora) — Primary
 *   2. Gemini (gemini-3-pro → flash → exp) — Fallback #1
 *   3. FLUX Pro v1.1 (fal-ai/flux-pro/v1.1) — Fallback #2
 *
 * 생성된 이미지는 FAL Storage에 업로드하여 공개 URL 반환
 */

import sharp from "sharp";
import { storagePut } from "../storage";

// ─── Types ────────────────────────────────────────────────

export type GenerateImageOptions = {
  prompt: string;
  negativePrompt?: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
  /** 참조 이미지 기반 image-to-image 변환 강도 (0~1, 기본 0.75) */
  strength?: number;
  /** 얼굴 보존 모드 — guidance/steps 강화 */
  faceFixMode?: boolean;
  /** 출력 이미지 비율 */
  imageSize?: string;
};

export type GenerateImageResponse = {
  url?: string;
};

// ─── FAL REST API ─────────────────────────────────────────

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

// ─── Gemini API 호출 ─────────────────────────────────────

const GEMINI_MODELS = [
  "gemini-3-pro-image-preview",
  "gemini-2.5-flash-image",
  "gemini-2.0-flash-exp",
];

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return key;
}

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: { mimeType: string; data: string };
      }>;
    };
  }>;
  error?: { message: string; code: number };
};

export async function callGemini(
  parts: GeminiPart[],
): Promise<GeminiResponse> {
  const apiKey = getGeminiApiKey();

  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  };

  let lastError = "";
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    console.log(`[Gemini] ${model} 호출 (parts: ${parts.length})`);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      lastError = `${model} failed ${res.status}: ${text.slice(0, 200)}`;
      console.warn(`[Gemini] ${lastError}`);
      if (res.status === 404) continue;
      throw new Error(`Gemini API failed ${res.status}: ${text.slice(0, 300)}`);
    }

    try {
      return JSON.parse(text) as GeminiResponse;
    } catch {
      throw new Error(`Gemini invalid JSON: ${text.slice(0, 200)}`);
    }
  }

  throw new Error(`All Gemini models failed. Last: ${lastError}`);
}

// ─── 참조 이미지 → base64 변환 (exported for pipelines) ──

export async function resolveImageToBase64(img: {
  url?: string;
  b64Json?: string;
  mimeType?: string;
}): Promise<{ data: string; mimeType: string } | null> {
  if (img.b64Json) {
    return { data: img.b64Json, mimeType: img.mimeType || "image/png" };
  }
  if (img.url) {
    try {
      const res = await fetch(img.url);
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") || img.mimeType || "image/png";
      return { data: buffer.toString("base64"), mimeType: contentType };
    } catch (err: any) {
      console.warn(`[FLUX.2] 참조 이미지 다운로드 실패: ${err.message?.slice(0, 100)}`);
      return null;
    }
  }
  return null;
}

// ─── Gemini 응답에서 이미지 추출 → URL 변환 (exported) ───

export async function extractImageUrl(response: GeminiResponse): Promise<string> {
  const candidates = response.candidates;
  if (!candidates?.length) {
    throw new Error("Gemini 응답에 candidates 없음");
  }

  const parts = candidates[0].content?.parts;
  if (!parts?.length) {
    throw new Error("Gemini 응답에 parts 없음");
  }

  const imagePart = parts.find(p => p.inlineData?.data);
  if (!imagePart?.inlineData) {
    const textPart = parts.find(p => p.text);
    throw new Error(`Gemini가 이미지를 생성하지 못함: ${textPart?.text?.slice(0, 200) || "응답 없음"}`);
  }

  const { data, mimeType } = imagePart.inlineData;
  const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";
  const buffer = Buffer.from(data, "base64");

  const { url } = await storagePut(
    `generated/gemini-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`,
    buffer,
    mimeType
  );

  console.log(`[Gemini] 이미지 업로드 완료: ${url.slice(0, 80)}...`);
  return url;
}

// ─── Gemini 응답에서 base64 직접 추출 (pipelines용) ──────

export function extractImageBase64(response: GeminiResponse): { data: string; mimeType: string } {
  const candidates = response.candidates;
  if (!candidates?.length) throw new Error("Gemini 응답에 candidates 없음");

  const parts = candidates[0].content?.parts;
  if (!parts?.length) throw new Error("Gemini 응답에 parts 없음");

  const imagePart = parts.find(p => p.inlineData?.data);
  if (!imagePart?.inlineData) {
    const textPart = parts.find(p => p.text);
    throw new Error(`Gemini가 이미지를 생성하지 못함: ${textPart?.text?.slice(0, 200) || "응답 없음"}`);
  }

  return { data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType };
}

// ─── FAL Storage 업로드 ─────────────────────────────────

async function uploadToFalStorage(base64Data: string): Promise<string | null> {
  try {
    const falKey = process.env.FAL_KEY;
    if (!falKey) return null;

    const clean = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
    const buffer = Buffer.from(clean, "base64");

    const initiateRes = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate", {
      method: "POST",
      headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content_type: "image/jpeg", file_name: "face-ref.jpg" }),
    });
    if (!initiateRes.ok) throw new Error(`initiate failed ${initiateRes.status}`);
    const { upload_url, file_url } = await initiateRes.json();

    const s3Res = await fetch(upload_url, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: buffer,
    });
    if (!s3Res.ok) throw new Error(`S3 upload failed ${s3Res.status}`);

    return file_url;
  } catch (err: any) {
    console.warn(`[FAL Storage] 업로드 실패: ${err.message?.slice(0, 100)}`);
    return null;
  }
}

// ─── [Primary] FLUX.2 LoRA ────────────────────────────────

async function generateWithFlux2(
  prompt: string,
  negativePrompt: string | undefined,
  refImageDataUrl: string | undefined,
  strength: number,
): Promise<string> {
  console.log("[FLUX.2] Primary 생성 시도...");

  const input: Record<string, unknown> = {
    prompt,
    image_size: { width: 1024, height: 1024 },
    num_inference_steps: 28,
    guidance_scale: 7.5,
    enable_safety_checker: false,
    seed: Math.floor(Math.random() * 999999),
  };
  if (negativePrompt) input.negative_prompt = negativePrompt;
  if (refImageDataUrl) {
    input.image_url = refImageDataUrl;
    input.strength = strength;
  }

  const result = await falRun("fal-ai/flux-2/lora", input);
  const imageUrl = (result?.images as Array<{ url: string }>)?.[0]?.url;
  if (!imageUrl) throw new Error("FLUX.2 응답에 이미지 URL 없음");

  console.log("[FLUX.2] Primary 성공");
  return imageUrl;
}

// ─── [Fallback #2] FLUX Pro v1.1 ─────────────────────────

async function generateWithFluxPro(
  prompt: string,
  negativePrompt: string | undefined,
  refImageDataUrl: string | undefined,
  strength: number,
): Promise<string> {
  console.log("[FLUX Pro] Fallback #2 시도...");

  const input: Record<string, unknown> = {
    prompt,
    image_size: { width: 1024, height: 1024 },
    num_inference_steps: 28,
    guidance_scale: 7.0,
    enable_safety_checker: false,
    seed: Math.floor(Math.random() * 999999),
  };
  if (negativePrompt) input.negative_prompt = negativePrompt;
  if (refImageDataUrl) {
    input.image_url = refImageDataUrl;
    input.strength = strength;
  }

  const result = await falRun("fal-ai/flux-pro/v1.1", input);
  const imageUrl = (result?.images as Array<{ url: string }>)?.[0]?.url;
  if (!imageUrl) throw new Error("FLUX Pro 응답에 이미지 URL 없음");

  console.log("[FLUX Pro] Fallback #2 성공");
  return imageUrl;
}

// ─── 메인 함수 ──────────────────────────────────────────

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  let prompt = options.prompt;
  if (prompt.length > 1000) {
    prompt = prompt.substring(0, 1000);
  }

  const negativePrompt = options.negativePrompt;
  const strength = options.strength ?? 0.75;

  if (options.faceFixMode) {
    prompt = `${prompt}\n\nIMPORTANT: Preserve facial features exactly. Maintain face identity, expression, and proportions precisely.`;
  }

  // 참조 이미지 준비
  const refImages = options.originalImages || [];
  let refImageDataUrl: string | undefined;
  const geminiParts: GeminiPart[] = [];

  if (refImages.length > 0) {
    console.log(`[FLUX.2] 참조 이미지 ${refImages.length}장 처리`);
    for (const img of refImages) {
      const resolved = await resolveImageToBase64(img);
      if (resolved) {
        // FLUX용: 첫 번째 참조 이미지를 data URL로
        if (!refImageDataUrl) {
          refImageDataUrl = `data:${resolved.mimeType};base64,${resolved.data}`;
        }

        // Gemini용: 512px 리사이즈
        let resizedData = resolved.data;
        try {
          const buf = Buffer.from(resolved.data, "base64");
          const meta = await sharp(buf).metadata();
          const longer = Math.max(meta.width || 0, meta.height || 0);
          if (longer > 512) {
            const resized = await sharp(buf)
              .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
              .jpeg({ quality: 85 })
              .toBuffer();
            resizedData = resized.toString("base64");
            console.log(`[FLUX.2] 참조 이미지 리사이즈: ${meta.width}x${meta.height} → 512px`);
          }
        } catch (resizeErr: any) {
          console.warn(`[FLUX.2] 리사이즈 실패 (원본 사용): ${resizeErr.message?.slice(0, 80)}`);
        }
        geminiParts.push({
          inlineData: { mimeType: "image/jpeg", data: resizedData },
        });
      }
    }
  }

  // 참조 이미지 base64 (InstantID용)
  let refImageBase64: string | undefined;
  if (refImages.length > 0) {
    const firstImg = refImages[0];
    if (firstImg.b64Json) {
      refImageBase64 = firstImg.b64Json;
    } else if (firstImg.url) {
      const resolved = await resolveImageToBase64(firstImg);
      if (resolved) refImageBase64 = resolved.data;
    }
  }

  // ── [1] FLUX.2 LoRA Primary ──
  try {
    let finalUrl = await generateWithFlux2(prompt, negativePrompt, refImageDataUrl, strength);

    // FLUX.2 성공 후 InstantID 얼굴 일관성 강화
    if (refImageBase64) {
      try {
        console.log('[InstantID] 시작...');
        const faceRefUrl = await uploadToFalStorage(refImageBase64);
        console.log('[FAL Storage] 결과:', faceRefUrl || '❌ 실패');

        if (faceRefUrl) {
          const instantResult = await falRun('fal-ai/instant-id', {
            face_image_url: faceRefUrl,
            prompt,
            negative_prompt: negativePrompt || '',
            identitynet_strength_ratio: 0.65,
            adapter_strength_ratio: 0.65,
            num_inference_steps: 30,
            guidance_scale: 5.0,
            image_size: { width: 1024, height: 1024 },
          });
          console.log('[InstantID] 응답 키:', Object.keys(instantResult || {}));
          const instantUrl = (instantResult?.images as Array<{ url: string }>)?.[0]?.url;
          if (instantUrl) {
            finalUrl = instantUrl;
            console.log('[InstantID] 성공 ✅');
          } else {
            console.log('[InstantID] 실패 - 원본 유지');
          }
        }
      } catch (instantErr: any) {
        console.warn(`[InstantID] 에러 (원본 유지): ${instantErr.message?.slice(0, 100)}`);
      }
    }

    return { url: finalUrl };
  } catch (fluxError: any) {
    console.log("[FLUX.2 실패 원인]:", fluxError?.message || fluxError);
  }

  // ── [2] Gemini Fallback #1 ──
  try {
    console.log("[Gemini] Fallback #1 시도...");
    let geminiPrompt = prompt;
    if (negativePrompt) {
      geminiPrompt = `${prompt}\n\nAvoid: ${negativePrompt}`;
    }

    const parts: GeminiPart[] = [...geminiParts, { text: geminiPrompt }];
    if (parts.length === 0) {
      throw new Error("프롬프트 또는 참조 이미지가 필요합니다");
    }

    const response = await callGemini(parts);
    if (response.error) {
      throw new Error(`Gemini error: ${response.error.message}`);
    }

    const url = await extractImageUrl(response);
    return { url };
  } catch (geminiError: any) {
    console.log("[Gemini 실패 원인]:", geminiError?.message || geminiError);
  }

  // ── [3] FLUX Pro v1.1 Fallback #2 ──
  try {
    const url = await generateWithFluxPro(prompt, negativePrompt, refImageDataUrl, strength);
    return { url };
  } catch (fluxProError: any) {
    console.log("[FLUX Pro 실패 원인]:", fluxProError?.message || fluxProError);
  }

  throw new Error("모든 이미지 생성 모델 실패 (FLUX.2 → Gemini → FLUX Pro)");
}
