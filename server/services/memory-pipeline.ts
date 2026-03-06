import { fal } from "@fal-ai/client";
fal.config({ credentials: process.env.FAL_KEY });

// ─── Types ───────────────────────────────────────────────

export type AnimationStyle = "calm" | "nostalgia" | "lively" | "gratitude";

export interface MemoryPipelineResult {
  restoredImageUrl: string;
  colorizedImageUrl: string | null;
  videoUrl: string | null;
  wasGrayscale: boolean;
}

// ─── Animation Prompts ───────────────────────────────────

const ANIMATION_PROMPTS: Record<AnimationStyle, string> = {
  calm: "The person in this restored historical photograph gently blinks their eyes and breathes softly. A slight warm smile appears on their face. Their expression is peaceful and full of memories. Cinematic, warm sepia tones, slow and graceful motion.",
  nostalgia: "The person in this old photograph slowly turns their head and looks directly at the camera with warm, loving eyes. They gently nod as if greeting someone they haven't seen in a long time. Emotional, vintage, warm golden hour light.",
  lively: "The person in this restored photograph comes alive with joy. They smile broadly and wave their hand in a warm greeting. Their eyes light up with happiness. Natural outdoor lighting, joyful expression, realistic natural movement.",
  gratitude: "The person in this restored photograph looks directly at the camera with heartfelt gratitude in their eyes. They place their hand on their heart and nod slowly with a warm, genuine smile. Emotional, intimate, soft warm lighting, deeply touching moment.",
};

// ─── Grayscale Detection ─────────────────────────────────

async function isGrayscaleImage(imageUrl: string): Promise<boolean> {
  try {
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // JPEG/PNG 샘플 픽셀로 채도 추정 (간단한 휴리스틱)
    let colorDiff = 0;
    let samples = 0;
    const step = Math.floor(bytes.length / 200);

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
    return avgDiff < 15; // 평균 색상 차이가 15 미만이면 흑백
  } catch {
    return false;
  }
}

// ─── Step 1: Photo Restoration (FAL CodeFormer) ──────────

async function restorePhoto(imageBase64: string, mimeType: string): Promise<string> {
  // FAL에 이미지 업로드
  const blob = base64ToBlob(imageBase64, mimeType);
  const uploadedUrl = await fal.storage.upload(blob);

  const result = await fal.subscribe("fal-ai/codeformer" as any, {
    input: {
      image_url: uploadedUrl,
      fidelity: 0.7,
      upscaling: 2,
      face_upscale: true,
    } as any,
  });

  const output = (result as any).data;
  const url = output?.image?.url || output?.output || output?.url;
  if (!url) throw new Error("CodeFormer: 복원 결과 URL이 없습니다");
  return url;
}

// ─── Step 2: Colorization (FAL DDCOLOR) ──────────────────

async function colorizePhoto(imageUrl: string): Promise<string> {
  try {
    const result = await fal.subscribe("fal-ai/ddcolor" as any, {
      input: {
        image_url: imageUrl,
      } as any,
    });

    const output = (result as any).data;
    const url = output?.image?.url || output?.output || output?.url;
    if (!url) throw new Error("DDColor: 컬러화 결과 URL이 없습니다");
    return url;
  } catch (error) {
    console.warn("Colorization failed, using restored image:", error);
    return imageUrl;
  }
}

// ─── Step 3: Video Generation (Kling 3.0 via PiAPI) ──────

async function generateVideo(
  imageUrl: string,
  style: AnimationStyle,
  duration: 5 | 10 | 15
): Promise<string | null> {
  if (!process.env.PIAPI_API_KEY) {
    console.warn("PIAPI_API_KEY not set, skipping video generation");
    return null;
  }

  try {
    // 작업 제출
    const submitRes = await fetch("https://api.piapi.ai/api/kling/v1/video/image2video", {
      method: "POST",
      headers: {
        "x-api-key": process.env.PIAPI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "kling-v3",
        image_url: imageUrl,
        prompt: ANIMATION_PROMPTS[style],
        duration,
        mode: "pro",
        aspect_ratio: "9:16",
      }),
    });

    if (!submitRes.ok) {
      const err = await submitRes.text();
      throw new Error(`PiAPI submit failed: ${err}`);
    }

    const submitData = await submitRes.json();
    const taskId = submitData?.task_id;
    if (!taskId) throw new Error("No task_id returned from PiAPI");

    // 폴링 (최대 10분)
    const maxAttempts = 120;
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(5000);

      const pollRes = await fetch(`https://api.piapi.ai/api/kling/v1/video/${taskId}`, {
        headers: { "x-api-key": process.env.PIAPI_API_KEY! },
      });

      if (!pollRes.ok) continue;

      const pollData = await pollRes.json();
      const status = pollData?.status;

      if (status === "succeeded" || status === "completed") {
        return pollData?.output?.works?.[0]?.resource?.resource ?? null;
      }
      if (status === "failed") {
        throw new Error(`Kling video generation failed: ${JSON.stringify(pollData)}`);
      }
    }

    throw new Error("Video generation timed out after 10 minutes");
  } catch (error) {
    console.error("Video generation error:", error);
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main Pipeline ────────────────────────────────────────

export async function runMemoryPipeline(
  imageBase64: string,
  mimeType: string,
  animationStyle: AnimationStyle,
  generateVideoFlag: boolean,
  duration: 5 | 10 | 15 = 5,
  direction?: string,
  enableBGM?: boolean,
  bgmStyle?: string,
  enableVoice?: boolean,
  voiceScript?: string
): Promise<MemoryPipelineResult> {
  console.log("[Memory] Step 1: Restoring photo with CodeFormer...");
  const restoredUrl = await restorePhoto(imageBase64, mimeType);
  console.log("[Memory] Restored:", restoredUrl);

  console.log("[Memory] Step 2: Checking grayscale...");
  const grayscale = await isGrayscaleImage(restoredUrl);
  console.log("[Memory] Is grayscale:", grayscale);

  let colorizedUrl: string | null = null;
  if (grayscale) {
    console.log("[Memory] Step 2b: Colorizing...");
    colorizedUrl = await colorizePhoto(restoredUrl);
    console.log("[Memory] Colorized:", colorizedUrl);
  }

  const finalImageUrl = colorizedUrl ?? restoredUrl;

  let videoUrl: string | null = null;
  if (generateVideoFlag) {
    console.log("[Memory] Step 3: Generating video...");
    videoUrl = await generateVideo(finalImageUrl, animationStyle, duration);
    console.log("[Memory] Video:", videoUrl);
  }

  return {
    restoredImageUrl: restoredUrl,
    colorizedImageUrl: colorizedUrl,
    videoUrl,
    wasGrayscale: grayscale,
  };
}
