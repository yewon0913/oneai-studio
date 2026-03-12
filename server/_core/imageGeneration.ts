/**
 * Image generation helper — Google Gemini 2.0 Flash 기반
 *
 * Gemini 2.0 Flash의 이미지 생성 기능 사용
 * - text-to-image: 프롬프트만으로 이미지 생성
 * - image-to-image: 참조 이미지 + 프롬프트로 이미지 편집/변환
 *
 * 생성된 이미지는 FAL Storage에 업로드하여 공개 URL 반환
 */

import { storagePut } from "server/storage";

// ─── Types ────────────────────────────────────────────────

export type GenerateImageOptions = {
  prompt: string;
  negativePrompt?: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
  /** 참조 이미지 기반 image-to-image 변환 강도 (0~1, 기본 0.65) */
  strength?: number;
  /** 얼굴 보존 모드 — guidance/steps 강화 */
  faceFixMode?: boolean;
  /** 출력 이미지 비율 */
  imageSize?: string;
};

export type GenerateImageResponse = {
  url?: string;
};

// ─── Gemini API 호출 ─────────────────────────────────────

const GEMINI_MODEL = "gemini-2.0-flash-preview-image-generation";

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return key;
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GeminiResponse = {
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

async function callGemini(
  parts: GeminiPart[],
): Promise<GeminiResponse> {
  const apiKey = getGeminiApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  };

  console.log(`[ImageGen] Gemini ${GEMINI_MODEL} 호출 (parts: ${parts.length})`);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini API failed ${res.status}: ${text.slice(0, 300)}`);
  }

  try {
    return JSON.parse(text) as GeminiResponse;
  } catch {
    throw new Error(`Gemini invalid JSON: ${text.slice(0, 200)}`);
  }
}

// ─── 참조 이미지 → base64 변환 ──────────────────────────

async function resolveImageToBase64(img: {
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

// ─── Gemini 응답에서 이미지 추출 → URL 변환 ─────────────

async function extractImageUrl(response: GeminiResponse): Promise<string> {
  const candidates = response.candidates;
  if (!candidates?.length) {
    throw new Error("Gemini 응답에 candidates 없음");
  }

  const parts = candidates[0].content?.parts;
  if (!parts?.length) {
    throw new Error("Gemini 응답에 parts 없음");
  }

  // 이미지 파트 찾기
  const imagePart = parts.find(p => p.inlineData?.data);
  if (!imagePart?.inlineData) {
    // 텍스트만 반환된 경우
    const textPart = parts.find(p => p.text);
    throw new Error(`Gemini가 이미지를 생성하지 못함: ${textPart?.text?.slice(0, 200) || "응답 없음"}`);
  }

  const { data, mimeType } = imagePart.inlineData;
  const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";
  const buffer = Buffer.from(data, "base64");

  // FAL Storage에 업로드
  const { url } = await storagePut(
    `generated/gemini-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`,
    buffer,
    mimeType
  );

  console.log(`[ImageGen] Gemini 이미지 업로드 완료: ${url.slice(0, 80)}...`);
  return url;
}

// ─── 메인 함수 ──────────────────────────────────────────

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  let prompt = options.prompt;
  if (prompt.length > 1000) {
    prompt = prompt.substring(0, 1000);
  }

  // 네거티브 프롬프트가 있으면 프롬프트에 포함
  if (options.negativePrompt) {
    prompt = `${prompt}\n\nAvoid: ${options.negativePrompt}`;
  }

  // 얼굴 보존 모드이면 프롬프트 강화
  if (options.faceFixMode) {
    prompt = `${prompt}\n\nIMPORTANT: Preserve facial features exactly. Maintain face identity, expression, and proportions precisely.`;
  }

  const refImages = options.originalImages || [];
  const parts: GeminiPart[] = [];

  // 참조 이미지 추가
  if (refImages.length > 0) {
    console.log(`[ImageGen] 참조 이미지 ${refImages.length}장 처리`);
    for (const img of refImages) {
      const resolved = await resolveImageToBase64(img);
      if (resolved) {
        parts.push({
          inlineData: { mimeType: resolved.mimeType, data: resolved.data },
        });
      }
    }
  }

  // 프롬프트 텍스트 추가
  parts.push({ text: prompt });

  if (parts.length === 0) {
    throw new Error("프롬프트 또는 참조 이미지가 필요합니다");
  }

  try {
    const response = await callGemini(parts);

    if (response.error) {
      throw new Error(`Gemini error: ${response.error.message}`);
    }

    const url = await extractImageUrl(response);
    return { url };
  } catch (err: any) {
    console.error(`[ImageGen] Gemini 이미지 생성 실패: ${err.message?.slice(0, 200)}`);
    throw err;
  }
}
