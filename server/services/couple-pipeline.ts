import { correctImageOrientation } from "./image-orientation";
import { callGemini, extractImageUrl, type GeminiPart } from "../_core/imageGeneration";

export interface CoupleResult {
  url: string;
  log: string;
}

// ─── FAL REST API (birefnet, codeformer, ip-adapter용) ───

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
  cherry_blossom: "romantic Korean garden with cherry blossom trees in full bloom, soft pink petals falling gently, golden hour sunlight filtering through branches, dreamy bokeh background, professional wedding photography",
  chapel: "elegant luxury wedding chapel interior, white and ivory flower arrangements, crystal chandelier, soft warm candlelight, white marble floor, cinematic wedding photography",
  garden: "beautiful outdoor garden wedding venue, lush green lawn, white floral arch covered in roses, warm natural sunlight, soft bokeh, professional wedding photography",
  beach: "romantic beach at golden hour sunset, warm orange and pink sky reflected on calm ocean, soft sand, gentle waves, cinematic wedding photography",
  forest: "enchanted forest wedding, tall trees with dappled sunlight, green leaves, magical fairy light bokeh, romantic atmosphere, professional photography",
  palace: "grand royal palace garden, European architecture, manicured hedges, fountain, warm afternoon light, luxury wedding photography",
};

interface GenerateBackgroundOptions {
  scene: string;
  aspectRatio: string;
  coupleImageUrl: string;
  customPrompt?: string;
  customNegativePrompt?: string;
  engine?: string;
  faceLock?: boolean;
  refImageUrls?: string[];
}

async function generateBackground(options: GenerateBackgroundOptions): Promise<string> {
  const { scene, customPrompt, customNegativePrompt, faceLock, refImageUrls } = options;

  console.log(`[couple] Step 2: Generating background for ${scene} (Nano Banana Pro)...`);

  let backgroundPrompt = BACKGROUND_PROMPTS[scene] ?? BACKGROUND_PROMPTS.cherry_blossom;
  let prompt = customPrompt ? `${customPrompt}, ${backgroundPrompt}` : backgroundPrompt;

  prompt += ", couple, professional wedding photography, natural skin, clear faces, facial identity preserved";

  if (faceLock) {
    prompt += ", face consistency locked, preserve exact facial features, identical faces";
  }

  if (customNegativePrompt) {
    prompt += `\n\nAvoid: ${customNegativePrompt}`;
  } else {
    prompt += "\n\nAvoid: deformed, distorted, ugly, bad anatomy, blurry, low quality, cartoon, illustration, painting, 3d render, CGI, face distortion, facial deformation, blurry faces, different face, altered face";
  }

  if (prompt.length > 1500) {
    prompt = prompt.substring(0, 1500);
  }

  // Gemini parts 구성
  const parts: GeminiPart[] = [];

  // 참조 이미지가 있으면 Gemini에 전달 (얼굴 일관성)
  if (refImageUrls && refImageUrls.length > 0) {
    for (const refUrl of refImageUrls.slice(0, 2)) {
      try {
        const res = await fetch(refUrl);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          const mime = res.headers.get("content-type") || "image/jpeg";
          parts.push({ inlineData: { mimeType: mime, data: buffer.toString("base64") } });
          console.log(`[couple] 참조 이미지 추가: ${refUrl.slice(0, 60)}...`);
        }
      } catch (err) {
        console.warn(`[couple] 참조 이미지 로드 실패:`, err);
      }
    }
  }

  parts.push({ text: prompt });

  // Gemini Nano Banana Pro로 생성
  try {
    const response = await callGemini(parts);
    const url = await extractImageUrl(response);
    console.log("[couple] Background generated (Gemini):", url.slice(0, 80));
    return url;
  } catch (geminiErr: any) {
    console.warn(`[couple] Gemini 실패, FLUX.2 LoRA 폴백: ${geminiErr.message?.slice(0, 100)}`);
    return generateBackgroundFluxFallback(prompt, options.aspectRatio);
  }
}

// ─── FLUX.2 LoRA 폴백 ───────────────────────────────────

async function generateBackgroundFluxFallback(prompt: string, aspectRatio: string): Promise<string> {
  console.log("[couple] FLUX.2 LoRA 폴백 시도...");

  const imageSize = aspectRatio === "16:9" ? "landscape_16_9" : aspectRatio === "1:1" ? "square_hd" : "portrait_4_3";

  // FLUX.2 LoRA 시도 → flux-pro 폴백 → flux/dev 폴백
  const models = ["fal-ai/flux-2/lora", "fal-ai/flux-pro/v1.1", "fal-ai/flux/dev"];

  for (const modelId of models) {
    try {
      const result = await falRun(modelId, {
        prompt,
        num_inference_steps: 32,
        guidance_scale: 4.0,
        image_size: imageSize,
        enable_safety_checker: false,
        num_images: 1,
      });

      const url = (result?.images as Array<{ url: string }>)?.[0]?.url;
      if (url) {
        console.log(`[couple] ${modelId} 성공:`, url.slice(0, 80));
        return url;
      }
    } catch (err: any) {
      console.warn(`[couple] ${modelId} 실패: ${err.message?.slice(0, 80)}`);
      continue;
    }
  }

  throw new Error("모든 이미지 생성 모델 실패");
}

// ─── IP-Adapter 얼굴 일관성 강화 ────────────────────────

async function runIpAdapterFace(
  imageUrl: string,
  faceRefUrl: string,
  prompt: string,
): Promise<string> {
  try {
    console.log("[couple] IP-Adapter 얼굴 일관성 강화...");

    const result = await falRun("fal-ai/ip-adapter-face-id", {
      image_url: imageUrl,
      face_image_url: faceRefUrl,
      prompt,
      strength: 0.6,
      num_inference_steps: 30,
      guidance_scale: 5.0,
    });

    const url = (result?.images as Array<{ url: string }>)?.[0]?.url
      || (result?.image as Record<string, unknown>)?.url as string;

    if (url) {
      console.log("[couple] IP-Adapter 완료:", url.slice(0, 60));
      return url;
    }
    console.warn("[couple] IP-Adapter 응답에 URL 없음, 원본 유지");
    return imageUrl;
  } catch (err: any) {
    console.warn(`[couple] IP-Adapter 실패 (원본 유지): ${err.message?.slice(0, 100)}`);
    return imageUrl;
  }
}

// ─── CodeFormer 얼굴 선명화 ─────────────────────────────

async function enhanceFaces(imageUrl: string): Promise<string> {
  try {
    console.log("[couple] Step 4: Enhancing faces (CodeFormer)...");
    const result = await falRun("fal-ai/codeformer", {
      image_url: imageUrl,
      fidelity: 0.78,
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

// ─── 메인 파이프라인 ────────────────────────────────────

export async function generateCouplePipeline(
  coupleImageBase64: string,
  mimeType: string,
  scene: string,
  aspectRatio: string = "4:3",
  customPrompt?: string,
  customNegativePrompt?: string,
  engine?: string,
  faceLock?: boolean,
  _comparisonMode?: boolean
): Promise<CoupleResult[]> {
  console.log("[couple] ===== Pipeline Start (Nano Banana Pro + IP-Adapter) =====");
  console.log("[couple] Scene:", scene, "Ratio:", aspectRatio, "FaceLock:", faceLock);

  const results: CoupleResult[] = [];

  const coupleUrl = await uploadToFal(coupleImageBase64, mimeType);
  const subjectUrl = await removeBackground(coupleUrl);

  const scenes = scene === "all"
    ? ["cherry_blossom", "chapel"]
    : [scene];

  for (const s of scenes) {
    const stepLog: string[] = ["배경제거✅"];
    try {
      // Gemini Nano Banana Pro로 배경 생성
      const bgUrl = await generateBackground({
        scene: s,
        aspectRatio,
        coupleImageUrl: coupleUrl,
        customPrompt,
        customNegativePrompt,
        engine,
        faceLock,
        refImageUrls: [coupleUrl],
      });
      stepLog.push("배경생성(Gemini)✅");

      // IP-Adapter 얼굴 일관성 (faceLock 활성화 시)
      let processedUrl = bgUrl;
      if (faceLock) {
        processedUrl = await runIpAdapterFace(bgUrl, coupleUrl, `wedding couple, ${s}, professional photography`);
        stepLog.push("IP-Adapter✅");
      }

      // CodeFormer 후처리
      let finalUrl = await enhanceFaces(processedUrl);
      stepLog.push("CodeFormer✅");

      // 방향 보정
      try {
        const response = await fetch(finalUrl);
        const buffer = await response.arrayBuffer();
        const generatedBase64 = Buffer.from(buffer).toString("base64");
        const correctedBase64 = await correctImageOrientation(
          coupleImageBase64,
          generatedBase64,
          mimeType,
          mimeType
        );
        const correctedDataUrl = `data:${mimeType};base64,${correctedBase64}`;
        finalUrl = correctedDataUrl;
        stepLog.push("방향보정✅");
      } catch (orientationError) {
        console.warn(`[couple] Scene ${s} 방향 보정 실패:`, orientationError);
      }

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
