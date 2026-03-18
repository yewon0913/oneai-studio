/**
 * Image generation helper — Gemini Primary + FLUX Pro Fallback
 *
 * 모델 우선순위:
 *   1. Gemini (3.1-flash-image → 2.5-flash-image → 2.0-flash-exp)
 *      — 503/429 시 모델당 최대 3회 재시도 (3초→5초→8초 점진적 대기)
 *   2. FLUX Pro v1.1 (fal-ai/flux-pro/v1.1) — Fallback
 *
 * ⚠️ 모델 업데이트 (2026.03.19):
 *   - gemini-3-pro-image-preview → 3/9 종료됨, 제거
 *   - gemini-3.1-flash-image-preview → 최신 Nano Banana 2 (2/26 출시)
 *   - gemini-2.5-flash-image → Nano Banana (안정)
 *   - gemini-2.0-flash-exp → 6/1 종료 예정 (최후 백업)
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

// ─── 유틸: 대기 함수 ─────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Gemini API 호출 (최신 모델 + 503/429 재시도) ─────────

const GEMINI_MODELS = [
  "gemini-3.1-flash-image-preview",  // 최신 Nano Banana 2 (2026.02.26 출시)
  "gemini-2.5-flash-image",           // Nano Banana (안정)
  "gemini-2.0-flash-exp",             // 백업 (2026.06.01 종료 예정)
];

/** 503/429 재시도 설정 */
const RETRY_MAX = 3;
const RETRY_DELAYS = [3000, 5000, 8000]; // 3초, 5초, 8초 점진적 대기

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

    // ── 503/429 재시도 루프 ──
    for (let attempt = 0; attempt <= RETRY_MAX; attempt++) {
      if (attempt > 0) {
        const delay = RETRY_DELAYS[attempt - 1] || 8000;
        console.log(`[Gemini] ${model} 재시도 ${attempt}/${RETRY_MAX} (${delay / 1000}초 대기...)`);
        await sleep(delay);
      }

      console.log(`[Gemini] ${model} 호출 (parts: ${parts.length}${attempt > 0 ? `, retry #${attempt}` : ""})`);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const text = await res.text();

      // ── 성공 ──
      if (res.ok) {
        try {
          console.log(`[Gemini] ${model} 성공 ✅${attempt > 0 ? ` (재시도 #${attempt}에서 성공)` : ""}`);
          return JSON.parse(text) as GeminiResponse;
        } catch {
          throw new Error(`Gemini invalid JSON: ${text.slice(0, 200)}`);
        }
      }

      // ── 503/429 = 일시적 과부하 → 재시도 ──
      if (res.status === 503 || res.status === 429) {
        lastError = `${model} failed ${res.status}: ${text.slice(0, 200)}`;
        console.warn(`[Gemini] ${lastError}`);
        if (attempt < RETRY_MAX) {
          continue; // 재시도
        }
        console.warn(`[Gemini] ${model} 재시도 ${RETRY_MAX}회 모두 실패, 다음 모델...`);
        break;
      }

      // ── 404 = 모델 없음 → 다음 모델 ──
      if (res.status === 404) {
        lastError = `${model} not found (404)`;
        console.warn(`[Gemini] ${lastError}`);
        break;
      }

      // ── 그 외 에러 → throw ──
      throw new Error(`Gemini API failed ${res.status}: ${text.slice(0, 300)}`);
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
      console.warn(`[ImageGen] 참조 이미지 다운로드 실패: ${err.message?.slice(0, 100)}`);
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

// ─── [Fallback] FLUX Pro v1.1 ─────────────────────────────

async function generateWithFluxPro(
  prompt: string,
  negativePrompt: string | undefined,
  refImageDataUrl: string | undefined,
  strength: number,
): Promise<string> {
  console.log("[FLUX Pro] Fallback 시도...");

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

  console.log("[FLUX Pro] Fallback 성공");
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
    console.log(`[ImageGen] 참조 이미지 ${refImages.length}장 처리`);
    for (const img of refImages) {
      const resolved = await resolveImageToBase64(img);
      if (resolved) {
        // FLUX Pro용: 첫 번째 참조 이미지를 data URL로
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
            console.log(`[ImageGen] 참조 이미지 리사이즈: ${meta.width}x${meta.height} → 512px`);
          }
        } catch (resizeErr: any) {
          console.warn(`[ImageGen] 리사이즈 실패 (원본 사용): ${resizeErr.message?.slice(0, 80)}`);
        }
        geminiParts.push({
          inlineData: { mimeType: "image/jpeg", data: resizedData },
        });
      }
    }
  }

  // ── [1] Gemini Primary (최신 모델 + 재시도) ──
  try {
    console.log("[Gemini] Primary 생성 시도...");
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
    console.log("[Gemini] Primary 성공 ✅");
    return { url };
  } catch (geminiError: any) {
    console.log("[Gemini 실패 원인]:", geminiError?.message || geminiError);
  }

  // ── [2] FLUX Pro v1.1 Fallback ──
  try {
    const url = await generateWithFluxPro(prompt, negativePrompt, refImageDataUrl, strength);
    return { url };
  } catch (fluxProError: any) {
    console.log("[FLUX Pro 실패 원인]:", fluxProError?.message || fluxProError);
  }

  throw new Error("모든 이미지 생성 모델 실패 (Gemini → FLUX Pro)");
}
