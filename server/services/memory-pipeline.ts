/**
 * Memory Restoration Module - Image & Video Pipeline
 * CodeFormer(복원) + DeOldify(컬러화) + Kling 3.0(영상화)
 */

import { fal } from "@fal-ai/client";

export interface MemoryGenerateInput {
  imageBase64: string;
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
  animationStyle: "calm" | "nostalgia" | "lively";
  generateVideo: boolean;
}

export interface MemoryGenerateOutput {
  restoredImageUrl: string;
  colorizedImageUrl: string | null;
  videoUrl: string | null;
  wasGrayscale: boolean;
  prompt: string;
}

async function isGrayscale(base64: string): Promise<boolean> {
  try {
    const buffer = Buffer.from(base64, "base64");
    const sampleSize = Math.min(buffer.length, 50000);
    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (let i = 100; i < sampleSize - 3; i += 30) {
      const r = buffer[i];
      const g = buffer[i + 1];
      const b = buffer[i + 2];
      if (r !== undefined && g !== undefined && b !== undefined) {
        rSum += r; gSum += g; bSum += b; count++;
      }
    }
    if (count === 0) return false;
    const rAvg = rSum / count;
    const gAvg = gSum / count;
    const bAvg = bSum / count;
    const maxDiff = Math.max(
      Math.abs(rAvg - gAvg),
      Math.abs(gAvg - bAvg),
      Math.abs(rAvg - bAvg)
    );
    return maxDiff < 15;
  } catch {
    return false;
  }
}

function toDataUrl(base64: string, mimeType: string): string {
  if (base64.startsWith("data:")) return base64;
  return `data:${mimeType};base64,${base64}`;
}

async function restoreWithCodeFormer(imageBase64: string, mimeType: string): Promise<string> {
  fal.config({ credentials: process.env.FAL_KEY });
  const imageUrl = toDataUrl(imageBase64, mimeType);
  const result = await fal.subscribe("fal-ai/codeformer" as any, {
    input: {
      image_url: imageUrl,
      codeformer_fidelity: 0.7,
      background_enhance: true,
      face_upsample: true,
      upscale: 2,
    } as any,
  });
  const output = (result as any).data;
  const url = output?.image?.url || output?.output || output?.url;
  if (!url) throw new Error("CodeFormer: 복원 결과 URL이 없습니다");
  return url;
}

async function colorizeWithDeOldify(imageUrl: string): Promise<string> {
  fal.config({ credentials: process.env.FAL_KEY });
  const result = await fal.subscribe("fal-ai/deoldify" as any, {
    input: {
      image_url: imageUrl,
      model: "Artistic",
      render_factor: 35,
    } as any,
  });
  const output = (result as any).data;
  const url = output?.image?.url || output?.output || output?.url;
  if (!url) throw new Error("DeOldify: 컬러화 결과 URL이 없습니다");
  return url;
}

const ANIMATION_PROMPTS: Record<string, { prompt: string; negativePrompt: string }> = {
  calm: {
    prompt: "The person in this restored historical photograph gently blinks their eyes and breathes softly. A slight warm smile appears on their face. Their expression is peaceful and full of memories. The background has a very subtle, gentle movement like a soft breeze. Cinematic, warm sepia tones, nostalgic atmosphere, slow and graceful motion, film grain texture.",
    negativePrompt: "fast motion, jerky movement, distorted face, unnatural expression, excessive movement, blinking too fast, scary, horror",
  },
  nostalgia: {
    prompt: "The person in this old photograph slowly turns their head and looks directly at the camera with warm, loving eyes. They gently nod as if greeting someone they haven't seen in a long time. Soft bokeh light particles float in the background. Emotional, vintage, warm golden hour light, gentle and loving movement, tearful but happy atmosphere.",
    negativePrompt: "modern background, artificial lighting, fast motion, unnatural expression, distorted features",
  },
  lively: {
    prompt: "The person in this restored photograph comes alive with joy. They smile broadly and wave their hand in a warm greeting. Their eyes light up with happiness and vitality. Natural outdoor lighting with gentle wind moving their hair slightly. Full of life, vibrant, joyful expression, realistic natural movement.",
    negativePrompt: "stiff movement, expressionless, dark atmosphere, horror, distorted face, unnatural motion",
  },
};

async function generateVideoWithKling(
  imageUrl: string,
  animationStyle: "calm" | "nostalgia" | "lively"
): Promise<string> {
  const piApiKey = process.env.PIAPI_API_KEY;
  if (!piApiKey) throw new Error("PIAPI_API_KEY 환경변수가 설정되지 않았습니다");

  const { prompt, negativePrompt } = ANIMATION_PROMPTS[animationStyle];

  const createRes = await fetch("https://api.piapi.ai/api/kling/v1/video/image2video", {
    method: "POST",
    headers: {
      "x-api-key": piApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "kling-v3",
      image_url: imageUrl,
      prompt,
      negative_prompt: negativePrompt,
      duration: 5,
      mode: "pro",
      aspect_ratio: "9:16",
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Kling API 오류: ${createRes.status} - ${errText}`);
  }

  const createData = await createRes.json();
  const taskId = createData?.data?.task_id || createData?.task_id;
  if (!taskId) throw new Error("Kling: task_id를 받지 못했습니다");

  const maxAttempts = 120;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 5000));

    const statusRes = await fetch(`https://api.piapi.ai/api/kling/v1/video/${taskId}`, {
      headers: { "x-api-key": piApiKey },
    });

    if (!statusRes.ok) continue;

    const statusData = await statusRes.json();
    const status = statusData?.data?.status || statusData?.status;

    if (status === "succeeded" || status === "completed") {
      const videoUrl =
        statusData?.data?.output?.works?.[0]?.resource?.resource ||
        statusData?.data?.video_url ||
        statusData?.output?.video_url;
      if (!videoUrl) throw new Error("Kling: 영상 URL을 찾을 수 없습니다");
      return videoUrl;
    }

    if (status === "failed" || status === "error") {
      const errMsg = statusData?.data?.error_message || "영상 생성 실패";
      throw new Error(`Kling 영상 생성 실패: ${errMsg}`);
    }
  }

  throw new Error("Kling: 영상 생성 타임아웃 (10분 초과)");
}

export async function runMemoryPipeline(
  input: MemoryGenerateInput
): Promise<MemoryGenerateOutput> {
  const mimeType = input.mimeType || "image/jpeg";
  const { prompt } = ANIMATION_PROMPTS[input.animationStyle];

  let restoredImageUrl: string;
  try {
    restoredImageUrl = await restoreWithCodeFormer(input.imageBase64, mimeType);
  } catch (err) {
    console.error("[Memory] CodeFormer 실패, 원본 사용:", err);
    restoredImageUrl = toDataUrl(input.imageBase64, mimeType);
  }

  const grayscale = await isGrayscale(input.imageBase64);
  let colorizedImageUrl: string | null = null;

  if (grayscale) {
    try {
      colorizedImageUrl = await colorizeWithDeOldify(restoredImageUrl);
    } catch (err) {
      console.error("[Memory] DeOldify 실패, 복원 이미지 사용:", err);
      colorizedImageUrl = null;
    }
  }

  const finalImageUrl = colorizedImageUrl || restoredImageUrl;

  let videoUrl: string | null = null;
  if (input.generateVideo) {
    videoUrl = await generateVideoWithKling(finalImageUrl, input.animationStyle);
  }

  return {
    restoredImageUrl,
    colorizedImageUrl,
    videoUrl,
    wasGrayscale: grayscale,
    prompt,
  };
}
