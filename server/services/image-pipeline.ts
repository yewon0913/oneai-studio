import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

const BASE_PROMPT_PREFIX =
  "RAW photo, photorealistic, shot on Canon EOS R5 85mm f/1.2 lens, " +
  "ISO 400, natural skin texture, visible pores, hair strands detail, " +
  "cinematic color grade, Korean wedding photography, 8K UHD,";

const DEFAULT_NEGATIVE =
  "(worst quality:2),(low quality:2),(AI art:1.5),(illustration:1.5)," +
  "(cartoon:1.5),(3d render:1.5),(plastic skin:1.8),(smooth skin:1.4)," +
  "(fake:1.5),(inconsistent face:2),(different person:2)," +
  "(face swap artifact:1.8),bad hands,extra fingers,ugly,deformed,blurry";

// ─── 1. 기본 이미지 생성 (배경+포즈) ───

export async function generateBaseImage(
  prompt: string,
  negativePrompt?: string
): Promise<string> {
  const result = await fal.subscribe("fal-ai/flux/dev", {
    input: {
      prompt: `${BASE_PROMPT_PREFIX} ${prompt}`,
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      enable_safety_checker: false,
      image_size: "portrait_4_3",
    },
  });
  return result.data.images[0].url;
}

// ─── 2. 고객 얼굴 합성 - 핵심! (flux-pulid) ───

export async function applyFace(
  baseImageUrl: string,
  faceImageUrl: string,
  weight = 1.0
): Promise<string> {
  const result = await fal.subscribe("fal-ai/flux-pulid", {
    input: {
      prompt: "Preserve the exact face identity, natural skin texture, photorealistic",
      reference_image_url: faceImageUrl,
      negative_prompt: DEFAULT_NEGATIVE,
      num_inference_steps: 20,
      start_step: 4,
      guidance_scale: 4.0,
      id_weight: weight,
      true_cfg: 1.0,
    },
  });
  return result.data.images[0].url;
}

// ─── 3. 4K 업스케일 ───

export async function upscale4K(imageUrl: string): Promise<string> {
  const result = await fal.subscribe("fal-ai/esrgan", {
    input: {
      image_url: imageUrl,
      scale: 4,
      face: true,
    },
  });
  return result.data.image.url;
}

// ─── 4. 배경 제거 ───

export async function removeBackground(imageUrl: string): Promise<string> {
  const result = await fal.subscribe("fal-ai/imageutils/rembg", {
    input: { image_url: imageUrl },
  });
  return result.data.image.url;
}

// ─── 5. 개인 사진 풀 파이프라인 ───

export async function runSinglePipeline(
  prompt: string,
  faceImageUrl: string,
  negativePrompt?: string
): Promise<string> {
  // Step1: 배경+포즈 생성
  const baseUrl = await generateBaseImage(prompt, negativePrompt);
  // Step2: 얼굴 합성
  const withFace = await applyFace(baseUrl, faceImageUrl, 1.0);
  // Step3: 4K 업스케일
  const upscaled = await upscale4K(withFace);
  return upscaled;
}

// ─── 6. 커플 사진 풀 파이프라인 ───

export async function runCouplePipeline(
  prompt: string,
  brideFaceUrl: string,
  groomFaceUrl: string,
  negativePrompt?: string
): Promise<string> {
  // Step1: 배경+포즈 생성
  const baseUrl = await generateBaseImage(prompt, negativePrompt);
  // Step2: 신부 얼굴 먼저 합성
  const withBride = await applyFace(baseUrl, brideFaceUrl, 1.0);
  // Step3: 신랑 얼굴 합성
  const withCouple = await applyFace(withBride, groomFaceUrl, 0.9);
  // Step4: 4K 업스케일
  const upscaled = await upscale4K(withCouple);
  return upscaled;
}
