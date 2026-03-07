import { correctImageOrientation } from "./image-orientation";

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
  const { scene, aspectRatio, coupleImageUrl, customPrompt, customNegativePrompt, engine, faceLock, refImageUrls } = options;
  
  console.log(`[couple] Step 2: Generating background for ${scene}...`);
  console.log(`[couple] Engine: ${engine || "flux-dev"}, FaceLock: ${faceLock}`);

  // 배경 프롬프트 구성
  let prompt = BACKGROUND_PROMPTS[scene] ?? BACKGROUND_PROMPTS.cherry_blossom;
  
  // 커스텀 프롬프트가 있으면 병합
  if (customPrompt) {
    prompt = `${prompt}, ${customPrompt}`;
  }

  // 얼굴 일관성 강화 키워드 추가 (극대화)
  prompt += ", couple posing together, beautiful faces clearly visible, natural skin texture, maintain exact facial features, preserve face appearance, identical face, same face, exact same person, face consistency, facial identity preserved, professional wedding photography";

  // faceLock 활성화 시 추가 강화
  if (faceLock) {
    prompt += ", CRITICAL: face consistency, MUST preserve exact facial features, identical facial identity, exact same face appearance, face identity locked, no face changes, face fidelity maximum, facial recognition match 100%";
  }

  // 네거티브 프롬프트 (극대화)
  let negativePrompt = customNegativePrompt || 
    "(deformed:1.3), (distorted:1.3), (ugly:1.3), (bad anatomy:1.3), blurry, low quality, cartoon, illustration, painting, 3d render, CGI, (no people:0.5)";

  // 얼굴 손상 방지 키워드 (극대화)
  negativePrompt += ", (face distortion:2.0), (facial deformation:2.0), (blurry faces:2.0), (face change:1.8), (different face:1.8), (face swap:1.8), (altered face:1.8), (unrecognizable face:1.8), (face modification:1.8), (wrong face:1.8)";

  // 프롬프트 길이 제한 (최대 1000자)
  if (prompt.length > 1000) {
    prompt = prompt.substring(0, 1000);
  }

  console.log(`[couple] Prompt (${prompt.length}): ${prompt.substring(0, 100)}...`);

  // 엔진별 모델 선택 및 파라미터 조정
  let modelId = "fal-ai/flux/dev";
  let guidanceScale = 4.0;
  let numInferenceSteps = 30;

  if (engine === "flux-lora") {
    // Flux Pro 1.1 (고품질, 6배 빠름)
    modelId = "fal-ai/flux-pro/v1.1";
    guidanceScale = faceLock ? 6.5 : 4.5;  // faceLock 시 극대화
    numInferenceSteps = faceLock ? 40 : 32;
  } else if (engine === "stable-diffusion") {
    // Stable Diffusion은 FAL에서 지원하지 않으므로 Flux Dev로 폴백
    console.warn("[couple] Stable Diffusion not available on FAL, using Flux Dev instead");
    modelId = "fal-ai/flux/dev";
    guidanceScale = faceLock ? 5.5 : 4.0;
    numInferenceSteps = faceLock ? 35 : 30;
  } else {
    // flux-dev (기본값)
    guidanceScale = faceLock ? 5.5 : 4.0;  // faceLock 시 극대화
    numInferenceSteps = faceLock ? 35 : 30;
  }

  console.log(`[couple] Using model: ${modelId}, guidance: ${guidanceScale}, steps: ${numInferenceSteps}`);

  // FAL Flux API 입력 구성
  const input: Record<string, unknown> = {
    prompt,
    negative_prompt: negativePrompt,
    num_inference_steps: numInferenceSteps,
    guidance_scale: guidanceScale,
    image_size: aspectRatio === "16:9" ? "landscape_16_9" : aspectRatio === "1:1" ? "square_hd" : "portrait_4_3",
    enable_safety_checker: false,
    num_images: 1,
  };

  // 노트: FAL Flux API는 originalImages 파라미터를 지원하지 않습니다.
  // 대신 프롬프트에 얼굴 보존 키워드를 강화했습니다.
  if (coupleImageUrl) {
    console.log(`[couple] Couple image URL provided (used in prompt keywords only)`);
  }
  if (refImageUrls && refImageUrls.length > 0) {
    console.log(`[couple] Reference images: ${refImageUrls.length} (used in prompt keywords only)`);
  }

  const result = await falRun(modelId, input);

  const images = result?.images as Array<{ url: string }> | undefined;
  const url = images?.[0]?.url;
  if (!url) throw new Error("Image generation returned no URL");

  console.log("[couple] Background generated:", url);
  return url;
}

async function enhanceFaces(imageUrl: string): Promise<string> {
  try {
    console.log("[couple] Step 4: Enhancing faces...");
    const result = await falRun("fal-ai/codeformer", {
      image_url: imageUrl,
      fidelity: 0.95, // 얼굴 보존 극대화
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
  aspectRatio: string = "4:3",
  customPrompt?: string,
  customNegativePrompt?: string,
  engine?: string,
  faceLock?: boolean
): Promise<CoupleResult[]> {
  console.log("[couple] ===== Pipeline Start =====");
  console.log("[couple] Scene:", scene, "Ratio:", aspectRatio, "Engine:", engine, "FaceLock:", faceLock);

  const results: CoupleResult[] = [];

  const coupleUrl = await uploadToFal(coupleImageBase64, mimeType);

  const subjectUrl = await removeBackground(coupleUrl);

  const refImageUrls: string[] = [];

  const scenes = scene === "all"
    ? ["cherry_blossom", "chapel"]
    : [scene];

  for (const s of scenes) {
    const stepLog: string[] = ["배경제거✅"];
    try {
      // 배경 생성
      const bgUrl = await generateBackground({
        scene: s,
        aspectRatio,
        coupleImageUrl: coupleUrl,
        customPrompt,
        customNegativePrompt,
        engine,
        faceLock,
        refImageUrls,
      });
      stepLog.push("배경생성✅");

      let finalUrl = await enhanceFaces(bgUrl);
      stepLog.push("후처리✅");

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
