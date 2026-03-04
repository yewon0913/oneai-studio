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

// ─── 1. 기본 이미지 생성 (얼굴 참조 없이 프롬프트만) ───

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

// ─── 2. 얼굴 ID 보존 이미지 생성 (flux-pulid) ───
// flux-pulid는 reference_image_url(얼굴 참조)과 prompt를 함께 받아
// 참조 얼굴의 ID를 보존하면서 프롬프트에 맞는 새 이미지를 생성합니다.
// ※ baseImageUrl을 입력으로 받지 않음 - 프롬프트 기반 생성 모델

export async function generateWithFaceId(
  prompt: string,
  faceReferenceUrl: string,
  opts?: {
    negativePrompt?: string;
    idWeight?: number;
    guidanceScale?: number;
    numSteps?: number;
    imageSize?: "square_hd" | "square" | "portrait_4_3" | "portrait_16_9" | "landscape_4_3" | "landscape_16_9";
  }
): Promise<string> {
  const result = await fal.subscribe("fal-ai/flux-pulid", {
    input: {
      prompt: `${BASE_PROMPT_PREFIX} ${prompt}`,
      reference_image_url: faceReferenceUrl,
      negative_prompt: opts?.negativePrompt || DEFAULT_NEGATIVE,
      num_inference_steps: opts?.numSteps || 20,
      start_step: 2,
      guidance_scale: opts?.guidanceScale || 4.0,
      id_weight: opts?.idWeight || 0.9,
      true_cfg: 1.0,
      image_size: opts?.imageSize || "portrait_4_3",
      enable_safety_checker: false,
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

// ─── 5. 개인 사진 파이프라인 (얼굴 ID 보존) ───
// flux-pulid로 얼굴 참조 + 프롬프트를 한 번에 처리

export async function runSinglePipeline(
  prompt: string,
  faceImageUrl: string,
  negativePrompt?: string
): Promise<string> {
  // Step1: flux-pulid로 얼굴 ID 보존하면서 프롬프트 기반 이미지 생성
  const withFace = await generateWithFaceId(prompt, faceImageUrl, {
    negativePrompt,
    idWeight: 0.9,
  });
  // Step2: 4K 업스케일
  const upscaled = await upscale4K(withFace);
  return upscaled;
}

// ─── 6. 커플 사진 파이프라인 ───
// 커플 사진은 flux-pulid가 한 번에 두 얼굴을 처리할 수 없으므로
// 프롬프트로 커플 장면을 생성한 후, 주요 참조 얼굴(신부)의 ID를 보존

export async function runCouplePipeline(
  prompt: string,
  brideFaceUrl: string,
  groomFaceUrl: string,
  negativePrompt?: string
): Promise<string> {
  // flux-pulid는 단일 얼굴 참조만 지원하므로,
  // 신부 얼굴을 주 참조로 사용하여 커플 장면 생성
  const withBride = await generateWithFaceId(prompt, brideFaceUrl, {
    negativePrompt,
    idWeight: 0.85,
  });
  // 4K 업스케일
  const upscaled = await upscale4K(withBride);
  return upscaled;
}

// ─── 7. 얼굴 앙상블 (여러 참조 사진 중 최적 선택) ───
// flux-pulid는 단일 reference_image_url만 지원하므로,
// 여러 참조 사진이 있을 때 첫 번째(정면) 사진을 사용

export async function applyFaceEnsemble(
  baseImageUrl: string,
  faceImageUrls: string[]
): Promise<string> {
  if (faceImageUrls.length === 0) return baseImageUrl;
  // 첫 번째 사진(정면)을 주 참조로 사용
  // baseImageUrl은 flux-pulid에서 사용할 수 없으므로 무시
  // 대신 프롬프트를 통해 장면을 재현
  return faceImageUrls[0]; // 참조 URL만 반환 (호출자가 generateWithFaceId 사용)
}

// ─── Legacy 호환 함수 (deprecated) ───
export async function applyFace(
  baseImageUrl: string,
  faceImageUrl: string,
  weight = 1.0
): Promise<string> {
  // flux-pulid는 baseImageUrl을 입력으로 받지 않으므로
  // 프롬프트 기반으로 얼굴 ID 보존 이미지를 생성
  return generateWithFaceId(
    "Preserve the exact scene composition, lighting, and pose from the original image",
    faceImageUrl,
    { idWeight: weight }
  );
}
