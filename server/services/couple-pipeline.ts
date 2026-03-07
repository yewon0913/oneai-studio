export interface CoupleResult {
  url: string;
  log: string;
}

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
  console.log(`[couple] ${modelId} status:`, res.status);
  if (!res.ok) throw new Error(`${modelId} failed ${res.status}: ${text.slice(0, 300)}`);

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${modelId} not JSON: ${text.slice(0, 200)}`);
  }
}

async function uploadToFal(base64: string, mimeType: string): Promise<string> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error("FAL_KEY not set");

  const clean = base64.includes(",") ? base64.split(",")[1] : base64;
  const buffer = Buffer.from(clean, "base64");
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";

  const initiateRes = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate", {
    method: "POST",
    headers: {
      "Authorization": `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content_type: mimeType, file_name: `couple.${ext}` }),
  });

  if (!initiateRes.ok) throw new Error(`FAL initiate failed: ${await initiateRes.text()}`);
  const { upload_url, file_url } = await initiateRes.json();

  const s3Res = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: buffer,
  });
  if (!s3Res.ok) throw new Error(`S3 upload failed ${s3Res.status}`);

  console.log("[couple] Uploaded:", file_url);
  return file_url;
}

async function removeBackground(imageUrl: string): Promise<string> {
  console.log("[couple] Step 1: Removing background...");

  const result = await falRun("fal-ai/birefnet", {
    image_url: imageUrl,
    model: "General Use (Light)",
    operating_resolution: "1024x1024",
    output_format: "png",
  });

  const url = (result?.image as Record<string, unknown>)?.url as string;
  if (!url) {
    console.error("[couple] BiRefNet response:", JSON.stringify(result).slice(0, 300));
    throw new Error("BiRefNet returned no URL");
  }

  console.log("[couple] Background removed:", url);
  return url;
}

const BACKGROUND_PROMPTS: Record<string, string> = {
  cherry_blossom: "romantic Korean garden, cherry blossom trees in full bloom, soft pink petals falling gently, golden hour sunlight filtering through branches, dreamy bokeh background, professional wedding photography, no people",
  chapel: "elegant luxury wedding chapel interior, white and ivory flower arrangements, crystal chandelier, soft warm candlelight, white marble floor, cinematic wedding photography, no people",
  garden: "beautiful outdoor garden wedding venue, lush green lawn, white floral arch covered in roses, warm natural sunlight, soft bokeh, professional wedding photography, no people",
  beach: "romantic beach at golden hour sunset, warm orange and pink sky reflected on calm ocean, soft sand, gentle waves, cinematic wedding photography, no people",
  forest: "enchanted forest wedding, tall trees with dappled sunlight, green leaves, magical fairy light bokeh, romantic atmosphere, professional photography, no people",
  palace: "grand royal palace garden, European architecture, manicured hedges, fountain, warm afternoon light, luxury wedding photography, no people",
};

async function generateBackground(scene: string, aspectRatio: string): Promise<string> {
  console.log("[couple] Step 2: Generating background:", scene);

  const prompt = BACKGROUND_PROMPTS[scene] ?? BACKGROUND_PROMPTS.cherry_blossom;

  const result = await falRun("fal-ai/flux/dev", {
    prompt,
    num_inference_steps: 28,
    guidance_scale: 3.5,
    image_size: aspectRatio === "16:9" ? "landscape_16_9" : aspectRatio === "1:1" ? "square_hd" : "portrait_4_3",
    enable_safety_checker: false,
    num_images: 1,
  });

  const images = result?.images as Array<{ url: string }> | undefined;
  const url = images?.[0]?.url;
  if (!url) throw new Error("FLUX returned no URL");

  console.log("[couple] Background generated:", url);
  return url;
}

async function enhanceFaces(imageUrl: string): Promise<string> {
  try {
    console.log("[couple] Step 4: Enhancing faces...");
    const result = await falRun("fal-ai/codeformer", {
      image_url: imageUrl,
      fidelity: 0.85,
      upscaling: 2,
      face_upscale: true,
    });

    const url = (result?.image as Record<string, unknown>)?.url as string;
    if (!url) {
      console.warn("[couple] CodeFormer no URL, using input");
      return imageUrl;
    }
    console.log("[couple] Faces enhanced:", url);
    return url;
  } catch (err) {
    console.warn("[couple] CodeFormer failed, fallback:", err);
    return imageUrl;
  }
}

export async function generateCouplePipeline(
  coupleImageBase64: string,
  mimeType: string,
  scene: string,
  aspectRatio: string = "4:3"
): Promise<CoupleResult[]> {
  console.log("[couple] ===== Pipeline Start =====");
  console.log("[couple] Scene:", scene, "Ratio:", aspectRatio);

  const results: CoupleResult[] = [];

  const coupleUrl = await uploadToFal(coupleImageBase64, mimeType);

  const subjectUrl = await removeBackground(coupleUrl);

  const scenes = scene === "all"
    ? ["cherry_blossom", "chapel", "garden", "beach"]
    : [scene];

  for (const s of scenes) {
    const stepLog: string[] = ["배경제거✅"];
    try {
      const bgUrl = await generateBackground(s, aspectRatio);
      stepLog.push("배경생성✅");

      const finalUrl = await enhanceFaces(bgUrl);
      stepLog.push("후처리✅");

      results.push({ url: finalUrl, log: stepLog.join(" ") });
      console.log(`[couple] Scene ${s} complete`);
    } catch (sceneErr) {
      console.error(`[couple] Scene ${s} failed:`, sceneErr);
    }
  }

  if (results.length === 0) {
    throw new Error("모든 배경 생성에 실패했습니다.");
  }

  console.log(`[couple] ===== Complete: ${results.length} images =====`);
  return results;
}
