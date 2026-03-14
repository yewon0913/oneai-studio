/**
 * Image generation helper v7.0 — IP-Adapter FaceID + Premium FaceSwap
 *
 * 파이프라인:
 *   1. Premium (mode='premium'): FLUX Pro 템플릿 → Easel AI Face Swap → CodeFormer
 *   2. Standard (기본): IP-Adapter FaceID → CodeFormer 업스케일
 *   3. Gemini — Fallback
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
  /** Face Swap 성별 (기본 "male") */
  gender?: string;
  /** 파이프라인 모드: standard (IP-Adapter) | premium (Easel FaceSwap) */
  mode?: 'standard' | 'premium';
};

export type GenerateImageResponse = {
  url?: string;
};

// ─── FAL REST API (동기) ──────────────────────────────────

async function falRun(
  modelId: string,
  input: Record<string, unknown>,
  timeoutMs = 120000,
): Promise<Record<string, unknown>> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error("FAL_KEY not set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`https://fal.run/${modelId}`, {
      method: "POST",
      headers: {
        "Authorization": `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    const text = await res.text();
    if (!res.ok) throw new Error(`${modelId} failed ${res.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error(`${modelId} timeout (${timeoutMs}ms)`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── FAL Queue API (비동기 폴링) ─────────────────────────

async function falRunQueue(
  modelId: string,
  input: Record<string, unknown>,
  timeoutMs = 180000,
  pollIntervalMs = 3000,
): Promise<Record<string, unknown>> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error("FAL_KEY not set");

  const headers = {
    "Authorization": `Key ${falKey}`,
    "Content-Type": "application/json",
  };

  // 1. Submit to queue
  const submitRes = await fetch(`https://queue.fal.run/${modelId}`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  const submitText = await submitRes.text();
  if (!submitRes.ok) throw new Error(`${modelId} queue submit failed ${submitRes.status}: ${submitText.slice(0, 300)}`);
  const { request_id } = JSON.parse(submitText);
  if (!request_id) throw new Error(`${modelId} queue: no request_id`);
  console.log(`[Queue] ${modelId} submitted: ${request_id}`);

  // 2. Poll for status
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, pollIntervalMs));

    const statusRes = await fetch(
      `https://queue.fal.run/${modelId}/requests/${request_id}/status`,
      { headers },
    );
    if (!statusRes.ok) {
      console.warn(`[Queue] status check failed: ${statusRes.status}`);
      continue;
    }
    const status = await statusRes.json();

    if (status.status === 'COMPLETED') {
      // 3. Fetch result
      const resultRes = await fetch(
        `https://queue.fal.run/${modelId}/requests/${request_id}`,
        { headers },
      );
      const resultText = await resultRes.text();
      if (!resultRes.ok) throw new Error(`${modelId} result failed ${resultRes.status}: ${resultText.slice(0, 300)}`);
      console.log(`[Queue] ${modelId} completed`);
      return JSON.parse(resultText);
    }

    if (status.status === 'FAILED') {
      throw new Error(`${modelId} queue failed: ${JSON.stringify(status).slice(0, 200)}`);
    }

    if (status.status === 'IN_PROGRESS') {
      console.log('[FaceSwap] 처리 중...');
    }
  }

  throw new Error(`${modelId} queue timeout (${timeoutMs}ms)`);
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

  // 참조 이미지 base64 (Face Swap용)
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

  // ── [1] Premium: FLUX Pro Template + Easel Face Swap + CodeFormer ──
  if (options.mode === 'premium' && refImageBase64) {
    try {
      const faceRefUrl = await uploadToFalStorage(refImageBase64);
      console.log('[FAL Storage] 결과:', faceRefUrl || '❌ 실패');

      if (faceRefUrl) {
        console.log("[FLUX Pro] Premium 모드 - 템플릿 생성 시도...");
        const templateResult = await falRun("fal-ai/flux-pro/v1.1", {
          prompt,
          negative_prompt: negativePrompt || '',
          image_size: { width: 1024, height: 1024 },
          num_inference_steps: 28,
          guidance_scale: 3.5,
        });
        const templateUrl = (templateResult?.images as Array<{ url: string }>)?.[0]?.url;
        if (!templateUrl) throw new Error("FLUX Pro 템플릿 이미지 URL 없음");
        console.log("[FLUX Pro] 템플릿 생성 완료:", templateUrl.slice(0, 60));

        let finalUrl = templateUrl;
        let codeFormerInput = templateUrl;

        try {
          console.log('[FaceSwap] 요청 전송 (queue)...');
          const swapResult = await falRunQueue('easel-ai/advanced-face-swap', {
            face_image_0: faceRefUrl,
            gender_0: options.gender || 'male',
            target_image: templateUrl,
            workflow_type: 'user_hair',
            upscale: false,
          }, 600000, 3000);
          console.log('[FaceSwap] 응답 수신...');
          const swappedUrl = (swapResult?.image as Record<string, unknown>)?.url as string
            || (swapResult?.images as Array<{ url: string }>)?.[0]?.url;
          if (swappedUrl) {
            codeFormerInput = swappedUrl;
            console.log('[FaceSwap] 완료:', swappedUrl.slice(0, 60));
          } else {
            console.log('[FaceSwap] URL 없음 - 템플릿으로 CodeFormer 진행');
          }
        } catch (swapErr: any) {
          console.warn(`[FaceSwap] 에러 (템플릿으로 CodeFormer 진행): ${swapErr.message?.slice(0, 100)}`);
        }

        try {
          console.log('[CodeFormer] 시작...');
          const restoredResult = await falRun('fal-ai/codeformer', {
            image_url: codeFormerInput,
            fidelity: 0.78,
            upscale: 2,
            background_enhance: true,
            face_upsample: true,
          });
          const restoredUrl = (restoredResult?.image as Record<string, unknown>)?.url as string
            || (restoredResult?.images as Array<{ url: string }>)?.[0]?.url;
          if (restoredUrl) {
            finalUrl = restoredUrl;
            console.log('[CodeFormer] 완료 ✅');
          } else {
            finalUrl = codeFormerInput;
          }
        } catch (cfErr: any) {
          finalUrl = codeFormerInput;
          console.warn(`[CodeFormer] 에러: ${cfErr.message?.slice(0, 100)}`);
        }

        return { url: finalUrl };
      }
    } catch (premiumErr: any) {
      console.log("[Premium 실패 원인]:", premiumErr?.message || premiumErr);
    }
  }

  // ── [2] Standard (기본): IP-Adapter FaceID + CodeFormer ──
  if (refImageBase64) {
    try {
      const faceRefUrl = await uploadToFalStorage(refImageBase64);
      console.log('[FAL Storage] 결과:', faceRefUrl || '❌ 실패');

      if (faceRefUrl) {
        console.log('[IP-Adapter] Standard 모드 생성 시도...');
        const ipResult = await falRun('fal-ai/ip-adapter-face-id', {
          model_type: '1_5-v1',
          prompt,
          negative_prompt: negativePrompt || 'blurry, low resolution, bad, ugly, cartoon, anime, painting, CGI, plastic skin',
          face_image_url: faceRefUrl,
          guidance_scale: 7.5,
          num_inference_steps: 50,
          num_samples: 4,
          width: 768,
          height: 1024,
          seed: Math.floor(Math.random() * 999999),
        });
        console.log('[IP-Adapter] 응답 키:', Object.keys(ipResult || {}));
        const ipUrl = (ipResult?.image as Record<string, unknown>)?.url as string
          || (ipResult?.images as Array<{ url: string }>)?.[0]?.url;
        console.log('[IP-Adapter] 결과:', ipUrl?.slice(0, 60));

        if (ipUrl) {
          // CodeFormer 업스케일
          try {
            console.log('[CodeFormer] 시작...');
            const restoredResult = await falRun('fal-ai/codeformer', {
              image_url: ipUrl,
              fidelity: 0.78,
              upscale: 2,
              face_upsample: true,
            });
            const restoredUrl = (restoredResult?.image as Record<string, unknown>)?.url as string
              || (restoredResult?.images as Array<{ url: string }>)?.[0]?.url;
            if (restoredUrl) {
              console.log('[CodeFormer] 완료 ✅');
              return { url: restoredUrl };
            }
          } catch (cfErr: any) {
            console.warn(`[CodeFormer] 에러 (IP-Adapter 결과 사용): ${cfErr.message?.slice(0, 100)}`);
          }
          return { url: ipUrl };
        }
      }
    } catch (ipErr: any) {
      console.log("[IP-Adapter 실패 원인]:", ipErr?.message || ipErr);
    }
  }

  // ── [3] Gemini Fallback ──
  try {
    console.log("[Gemini] Fallback 시도...");
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
    console.log("[Gemini] Fallback 성공 ✅");
    return { url };
  } catch (geminiError: any) {
    console.log("[Gemini 실패 원인]:", geminiError?.message || geminiError);
  }

  throw new Error("모든 이미지 생성 모델 실패 (Premium FaceSwap → IP-Adapter → Gemini)");
}
