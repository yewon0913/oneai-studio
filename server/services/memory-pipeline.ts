export interface MemoryPipelineResult {
  restoredImageUrl: string;
  colorizedImageUrl: string | null;
  videoUrl: string | null;
  wasGrayscale: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── FAL 직접 fetch 헬퍼 ─────────────────────────────────

async function falUploadImage(imageBase64: string, mimeType: string): Promise<string> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error("FAL_KEY not set");

  // base64 → Buffer
  const clean = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
  const buffer = Buffer.from(clean, "base64");

  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";

  // FAL storage에 업로드
  const uploadRes = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate", {
    method: "POST",
    headers: {
      "Authorization": `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content_type: mimeType,
      file_name: `upload.${ext}`,
    }),
  });

  if (!uploadRes.ok) {
    const t = await uploadRes.text();
    throw new Error(`FAL initiate upload failed ${uploadRes.status}: ${t}`);
  }

  const { upload_url, file_url } = await uploadRes.json();
  console.log("[Memory] Got upload_url:", upload_url);

  // S3에 실제 파일 업로드
  const s3Res = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: buffer,
  });

  if (!s3Res.ok) throw new Error(`S3 upload failed ${s3Res.status}`);
  console.log("[Memory] Uploaded to FAL, file_url:", file_url);
  return file_url;
}

async function falRunModel(
  modelId: string,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error("FAL_KEY not set");

  console.log(`[Memory] FAL run ${modelId}...`);

  // queue.fal.run 대신 fal.run 사용 (동기 방식, 폴링 불필요)
  const res = await fetch(`https://fal.run/${modelId}`, {
    method: "POST",
    headers: {
      "Authorization": `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const resText = await res.text();
  console.log(`[Memory] FAL ${modelId} status:`, res.status);
  console.log(`[Memory] FAL ${modelId} body:`, resText.slice(0, 200));

  if (!res.ok) throw new Error(`FAL ${modelId} failed ${res.status}: ${resText}`);

  try {
    return JSON.parse(resText);
  } catch {
    throw new Error(`FAL ${modelId} not JSON: ${resText}`);
  }
}

// ─── Grayscale Detection ─────────────────────────────────

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
      colorDiff += Math.abs(bytes[i] - bytes[i+1]) + Math.abs(bytes[i+1] - bytes[i+2]);
      samples++;
    }
    const avgDiff = samples > 0 ? colorDiff / samples : 0;
    console.log("[Memory] Grayscale avgDiff:", avgDiff);
    return avgDiff < 15;
  } catch (err) {
    console.warn("[Memory] Grayscale check failed:", err);
    return false;
  }
}

// ─── Step 1: Photo Restoration ───────────────────────────

async function restorePhoto(imageBase64: string, mimeType: string): Promise<string> {
  console.log("[Memory] Step 1: Uploading image...");
  const imageUrl = await falUploadImage(imageBase64, mimeType);

  console.log("[Memory] Step 1: Running CodeFormer...");
  const result = await falRunModel("fal-ai/codeformer", {
    image_url: imageUrl,
    fidelity: 0.7,
    upscaling: 2,
    face_upscale: true,
  });

  console.log("[Memory] Full CodeFormer result:", JSON.stringify(result).slice(0, 500));
  const outputImage = (result?.output as Record<string, unknown>)?.image as Record<string, unknown> | undefined;
  const url = (result?.image as Record<string, unknown>)?.url as string ?? outputImage?.url as string;
  if (!url) {
    console.error("[Memory] CodeFormer response:", JSON.stringify(result));
    throw new Error("CodeFormer returned no URL");
  }
  console.log("[Memory] Step 1 done:", url);
  return url;
}

// ─── Step 2: Colorization ────────────────────────────────

async function colorizePhoto(imageUrl: string): Promise<string> {
  try {
    console.log("[Memory] Step 2: Running DDCOLOR...");
    const result = await falRunModel("fal-ai/ddcolor", {
      image_url: imageUrl,
    });
    const url = (result?.image as Record<string, unknown>)?.url as string;
    if (!url) {
      console.warn("[Memory] DDCOLOR no URL, fallback");
      return imageUrl;
    }
    console.log("[Memory] Step 2 done:", url);
    return url;
  } catch (err) {
    console.warn("[Memory] Colorization failed, fallback:", err);
    return imageUrl;
  }
}

// ─── Step 3: Kling Video ──────────────────────────────────

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
    if (voiceLine) finalPrompt += ` The person says in Korean: "${voiceLine}"`;
    console.log("[Memory] Step 3: Submitting Kling...");

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
    console.log("[Memory] Kling submit status:", submitRes.status);
    console.log("[Memory] Kling submit body:", submitText.slice(0, 300));
    if (!submitRes.ok) throw new Error(`Kling submit ${submitRes.status}: ${submitText}`);

    const submitData = JSON.parse(submitText);
    const taskId =
      (submitData?.data as Record<string, unknown>)?.task_id as string ??
      submitData?.task_id as string;
    if (!taskId) throw new Error(`No task_id: ${submitText}`);
    console.log("[Memory] Kling task_id:", taskId);

    // 폴링 20분
    for (let i = 0; i < 240; i++) {
      await sleep(5000);
      try {
        const pollRes = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
          headers: { "x-api-key": apiKey },
        });
        if (!pollRes.ok) continue;

        const pollData = await pollRes.json();
        const inner = (pollData?.data ?? pollData) as Record<string, unknown>;
        const status = inner?.status as string;
        if (i % 6 === 0) console.log(`[Memory] Kling poll ${i}: ${status}`);

        if (status === "completed") {
          const output = inner?.output as Record<string, unknown>;
          const works = output?.works as Array<Record<string, unknown>>;
          const videoUrl =
            output?.video_url as string ??
            (works?.[0]?.video as Record<string, unknown>)?.resource as string ??
            null;
          console.log("[Memory] Step 3 done:", videoUrl);
          return videoUrl;
        }
        if (status === "failed") throw new Error(`Kling failed: ${JSON.stringify(inner?.error)}`);
      } catch (pollErr) {
        console.warn(`[Memory] Poll ${i} error:`, pollErr);
      }
    }
    throw new Error("Kling timeout 20min");
  } catch (err) {
    console.error("[Memory] Video error:", err);
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
    if (grayscale) colorizedUrl = await colorizePhoto(restoredUrl);
    else console.log("[Memory] Color photo, skip colorization");
  } catch (err) {
    console.warn("[Memory] Step 2 error (non-fatal):", err);
  }

  let videoUrl: string | null = null;
  if (shouldGenerateVideo) {
    try {
      videoUrl = await createKlingVideo(
        colorizedUrl ?? restoredUrl,
        customPrompt,
        voiceLine,
        duration,
        enableAudio
      );
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
