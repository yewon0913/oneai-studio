import { fal } from "@fal-ai/client";

export type AnimationStyle = "calm" | "nostalgia" | "lively";

export interface MemoryPipelineResult {
  restoredImageUrl: string;
  colorizedImageUrl: string | null;
  videoUrl: string | null;
  wasGrayscale: boolean;
}

// ─── Helpers ─────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

// ─── Grayscale Detection ─────────────────────────────────

async function isGrayscaleImage(imageUrl: string): Promise<boolean> {
  try {
    const response = await fetch(imageUrl);
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
    return avgDiff < 15;
  } catch {
    return false;
  }
}

// ─── Step 1: Photo Restoration ───────────────────────────

async function restorePhoto(imageBase64: string, mimeType: string): Promise<string> {
  console.log("[Memory] Uploading image to FAL...");
  const blob = base64ToBlob(imageBase64, mimeType);
  const uploadedUrl = await fal.storage.upload(blob);
  console.log("[Memory] Uploaded:", uploadedUrl);

  const result = await fal.subscribe("fal-ai/codeformer", {
    input: {
      image_url: uploadedUrl,
      fidelity: 0.7,
      face_upscale: true,
    },
  });

  const output = result.data as { image: { url: string } };
  if (!output?.image?.url) throw new Error("CodeFormer returned no image URL");
  return output.image.url;
}

// ─── Step 2: Colorization ────────────────────────────────

async function colorizePhoto(imageUrl: string): Promise<string> {
  try {
    const result = await fal.subscribe("fal-ai/ddcolor", {
      input: { image_url: imageUrl },
    });
    const output = result.data as { image: { url: string } };
    return output?.image?.url ?? imageUrl;
  } catch (error) {
    console.warn("[Memory] Colorization failed, using restored image:", error);
    return imageUrl;
  }
}

// ─── Step 3: Video Generation ────────────────────────────
// 함수명을 createKlingVideo로 변경 (generateVideo 파라미터와 충돌 방지)

async function createKlingVideo(
  imageUrl: string,
  customPrompt: string,
  voiceLine: string | null,
  durationSec: 5 | 10 | 15,
  enableAudio: boolean
): Promise<string | null> {
  const apiKey = process.env.PIAPI_API_KEY;
  if (!apiKey) {
    console.warn("[Memory] PIAPI_API_KEY not set, skipping video");
    return null;
  }

  try {
    let finalPrompt = customPrompt;
    if (voiceLine) {
      finalPrompt += ` The person says in Korean: "${voiceLine}"`;
    }

    console.log("[Memory] Submitting Kling job...");
    console.log("[Memory] Prompt:", finalPrompt.slice(0, 100));

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
          negative_prompt: "blurry, distorted face, unnatural movement, fast motion",
          duration: durationSec,
          mode: enableAudio ? "pro" : "pro",
          aspect_ratio: "9:16",
          version: "2.6",
          ...(enableAudio && { enable_audio: true }),
        },
        config: { service_mode: "public" },
      }),
    });

    const submitText = await submitRes.text();
    console.log("[Memory] PiAPI submit response:", submitText.slice(0, 200));

    if (!submitRes.ok) throw new Error(`PiAPI submit failed: ${submitText}`);

    const submitData = JSON.parse(submitText);
    const taskId = submitData?.data?.task_id;
    if (!taskId) throw new Error(`No task_id in response: ${submitText}`);

    console.log("[Memory] Kling task_id:", taskId);

    // 폴링 (최대 12분)
    for (let i = 0; i < 144; i++) {
      await sleep(5000);

      const pollRes = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
        headers: { "x-api-key": apiKey },
      });

      if (!pollRes.ok) {
        console.warn(`[Memory] Poll ${i} failed: ${pollRes.status}`);
        continue;
      }

      const pollData = await pollRes.json();
      const status = pollData?.data?.status;
      console.log(`[Memory] Poll ${i}: status=${status}`);

      if (status === "completed") {
        const videoUrl = pollData?.data?.output?.video_url ?? null;
        console.log("[Memory] Video URL:", videoUrl);
        return videoUrl;
      }

      if (status === "failed") {
        const errMsg = JSON.stringify(pollData?.data?.error ?? pollData);
        throw new Error(`Kling task failed: ${errMsg}`);
      }
    }

    throw new Error("Video generation timed out after 12 minutes");
  } catch (error) {
    console.error("[Memory] Video generation error:", error);
    return null;
  }
}

// ─── Main Pipeline ────────────────────────────────────────

export async function runMemoryPipeline(
  imageBase64: string,
  mimeType: string,
  customPrompt: string,
  voiceLine: string | null,
  shouldGenerateVideo: boolean,   // ← 이름 변경 (generateVideo → shouldGenerateVideo)
  enableAudio: boolean,
  duration: 5 | 10 | 15
): Promise<MemoryPipelineResult> {

  console.log("[Memory] Step 1: Restoring photo...");
  const restoredUrl = await restorePhoto(imageBase64, mimeType);

  console.log("[Memory] Step 2: Checking grayscale...");
  const grayscale = await isGrayscaleImage(restoredUrl);
  console.log("[Memory] Is grayscale:", grayscale);

  let colorizedUrl: string | null = null;
  if (grayscale) {
    console.log("[Memory] Step 2b: Colorizing...");
    colorizedUrl = await colorizePhoto(restoredUrl);
  }

  const finalImageUrl = colorizedUrl ?? restoredUrl;

  let videoUrl: string | null = null;
  if (shouldGenerateVideo) {   // ← 수정된 파라미터명 사용
    console.log("[Memory] Step 3: Creating video...");
    videoUrl = await createKlingVideo(finalImageUrl, customPrompt, voiceLine, duration, enableAudio);
  }

  return {
    restoredImageUrl: restoredUrl,
    colorizedImageUrl: colorizedUrl,
    videoUrl,
    wasGrayscale: grayscale,
  };
}
