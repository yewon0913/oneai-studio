import { fal } from "@fal-ai/client";

// ✅ 수정 1: FAL 초기화
fal.config({
  credentials: process.env.FAL_KEY ?? "",
});

export interface MemoryPipelineResult {
  restoredImageUrl: string;
  colorizedImageUrl: string | null;
  videoUrl: string | null;
  wasGrayscale: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ✅ 수정 2: base64 접두사 제거
function base64ToBlob(base64: string, mimeType: string): Blob {
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;
  const byteCharacters = atob(clean);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

async function isGrayscaleImage(imageUrl: string): Promise<boolean> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return false;
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let colorDiff = 0;
    let samples = 0;
    const step = Math.max(1, Math.floor(bytes.length / 300));
    for (let i = 0; i < bytes.length - 3; i += step) {
      const r = bytes[i];
      const g = bytes[i + 1];
      const b = bytes[i + 2];
      if (r !== undefined && g !== undefined && b !== undefined) {
        colorDiff += Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);
        samples++;
      }
    }
    const avgDiff = samples > 0 ? colorDiff / samples : 0;
    console.log("[Memory] Grayscale avgDiff:", avgDiff);
    return avgDiff < 15;
  } catch (err) {
    console.warn("[Memory] Grayscale check failed:", err);
    return false;
  }
}

async function restorePhoto(imageBase64: string, mimeType: string): Promise<string> {
  console.log("[Memory] Uploading to FAL storage...");
  const blob = base64ToBlob(imageBase64, mimeType);
  const uploadedUrl = await fal.storage.upload(blob);
  console.log("[Memory] FAL upload URL:", uploadedUrl);

  console.log("[Memory] Running CodeFormer...");
  const result = await fal.subscribe("fal-ai/codeformer", {
    input: {
      image_url: uploadedUrl,
      fidelity: 0.7,
      face_upscale: true,
    },
  });

  // ✅ 수정 3: 응답 구조 안전하게 파싱
  const data = result.data as Record<string, unknown>;
  const url = (data?.image as Record<string, unknown>)?.url as string | undefined;
  if (!url) {
    console.error("[Memory] CodeFormer raw response:", JSON.stringify(data));
    throw new Error("CodeFormer returned no image URL");
  }
  console.log("[Memory] Restored URL:", url);
  return url;
}

async function colorizePhoto(imageUrl: string): Promise<string> {
  try {
    console.log("[Memory] Running DDCOLOR...");
    const result = await fal.subscribe("fal-ai/ddcolor", {
      input: { image_url: imageUrl },
    });
    const data = result.data as Record<string, unknown>;
    const url = (data?.image as Record<string, unknown>)?.url as string | undefined;
    if (!url) {
      console.warn("[Memory] DDCOLOR no URL, fallback");
      return imageUrl;
    }
    console.log("[Memory] Colorized URL:", url);
    return url;
  } catch (error) {
    console.warn("[Memory] Colorization failed, fallback:", error);
    return imageUrl;
  }
}

async function createKlingVideo(
  imageUrl: string,
  customPrompt: string,
  voiceLine: string | null,
  durationSec: 5 | 10 | 15,
  enableAudio: boolean
): Promise<string | null> {
  const apiKey = process.env.PIAPI_API_KEY;
  if (!apiKey) {
    console.warn("[Memory] PIAPI_API_KEY not set");
    return null;
  }

  try {
    let finalPrompt = customPrompt;
    if (voiceLine) {
      finalPrompt += ` The person says in Korean: "${voiceLine}"`;
    }
    console.log("[Memory] Kling prompt:", finalPrompt.slice(0, 120));

    const submitRes = await fetch("https://api.piapi.ai/api/v1/task", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "kling",
        task_type: "video_generation",
        input: {
          image_url: imageUrl,
          prompt: finalPrompt,
          negative_prompt: "blurry, distorted face, unnatural movement",
          duration: durationSec,
          mode: "pro",
          aspect_ratio: "9:16",
          version: "2.6",
          ...(enableAudio && { enable_audio: true }),
        },
        config: { service_mode: "public" },
      }),
    });

    const submitText = await submitRes.text();
    console.log("[Memory] PiAPI submit status:", submitRes.status);
    console.log("[Memory] PiAPI submit body:", submitText.slice(0, 300));

    if (!submitRes.ok) throw new Error(`PiAPI submit ${submitRes.status}: ${submitText}`);

    let submitData: Record<string, unknown>;
    try {
      submitData = JSON.parse(submitText);
    } catch {
      throw new Error(`PiAPI not JSON: ${submitText}`);
    }

    // ✅ 수정 3: task_id 위치 유연하게
    const inner = submitData?.data as Record<string, unknown> | undefined;
    const taskId = (inner?.task_id ?? submitData?.task_id) as string | undefined;
    if (!taskId) throw new Error(`No task_id: ${submitText}`);
    console.log("[Memory] Kling task_id:", taskId);

    // ✅ 수정 4: 폴링 20분 (240 × 5초)
    for (let i = 0; i < 240; i++) {
      await sleep(5000);

      let pollData: Record<string, unknown>;
      try {
        const pollRes = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
          headers: { "x-api-key": apiKey },
        });
        if (!pollRes.ok) {
          console.warn(`[Memory] Poll ${i} HTTP ${pollRes.status}`);
          continue;
        }
        pollData = await pollRes.json();
      } catch (pollErr) {
        console.warn(`[Memory] Poll ${i} error:`, pollErr);
        continue;
      }

      const pollInner = (pollData?.data ?? pollData) as Record<string, unknown>;
      const status = pollInner?.status as string;
      if (i % 6 === 0) console.log(`[Memory] Poll ${i}: status=${status}`);

      if (status === "completed") {
        const output = pollInner?.output as Record<string, unknown> | undefined;
        const works = output?.works as Array<Record<string, unknown>> | undefined;
        // ✅ 수정 3: video_url 3곳 탐색
        const videoUrl =
          output?.video_url as string ??
          (works?.[0]?.video as Record<string, unknown>)?.resource as string ??
          (works?.[0]?.resource as Record<string, unknown>)?.resource as string ??
          null;
        console.log("[Memory] Final video URL:", videoUrl);
        return videoUrl;
      }

      if (status === "failed") {
        throw new Error(`Kling failed: ${JSON.stringify(pollInner?.error ?? pollInner)}`);
      }
    }

    throw new Error("Timeout after 20 minutes");
  } catch (error) {
    console.error("[Memory] Video error:", error);
    return null;
  }
}

// ─── Main Pipeline ────────────────────────────────────────

export async function runMemoryPipeline(
  imageBase64: string,
  mimeType: string,
  customPrompt: string,
  voiceLine: string | null,
  shouldGenerateVideo: boolean,
  enableAudio: boolean,
  duration: 5 | 10 | 15
): Promise<MemoryPipelineResult> {
  console.log("[Memory] ===== Pipeline Start =====");

  // ✅ 수정 5: 각 단계 독립 에러 처리
  let restoredUrl: string;
  try {
    restoredUrl = await restorePhoto(imageBase64, mimeType);
  } catch (err) {
    console.error("[Memory] Step 1 FAILED:", err);
    throw new Error(`사진 복원 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  let grayscale = false;
  let colorizedUrl: string | null = null;
  try {
    grayscale = await isGrayscaleImage(restoredUrl);
    if (grayscale) {
      colorizedUrl = await colorizePhoto(restoredUrl);
    } else {
      console.log("[Memory] Color photo, skipping colorization");
    }
  } catch (err) {
    console.warn("[Memory] Step 2 error (non-fatal):", err);
  }

  const finalImageUrl = colorizedUrl ?? restoredUrl;
  let videoUrl: string | null = null;

  if (shouldGenerateVideo) {
    try {
      videoUrl = await createKlingVideo(finalImageUrl, customPrompt, voiceLine, duration, enableAudio);
    } catch (err) {
      console.warn("[Memory] Step 3 error (non-fatal):", err);
    }
  }

  console.log("[Memory] ===== Pipeline Complete =====");
  return {
    restoredImageUrl: restoredUrl,
    colorizedImageUrl: colorizedUrl,
    videoUrl,
    wasGrayscale: grayscale,
  };
}
