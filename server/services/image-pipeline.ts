import { createFalClient } from "@fal-ai/client";

const fal = createFalClient({ credentials: process.env.FAL_KEY! });

const BASE_PROMPT_PREFIX =
  "RAW photo, photorealistic, shot on Canon EOS R5 85mm f/1.2 lens, " +
  "ISO 400, natural skin texture, visible pores, hair strands detail, " +
  "cinematic color grade, Korean wedding photography, 8K UHD,";

const DEFAULT_NEGATIVE =
  "(worst quality:2),(low quality:2),(AI art:1.5),(illustration:1.5)," +
  "(cartoon:1.5),(3d render:1.5),(plastic skin:1.8),(smooth skin:1.4)," +
  "(fake:1.5),(inconsistent face:2),(different person:2)," +
  "(face swap artifact:1.8),bad hands,extra fingers,ugly,deformed,blurry";

type ImageSize = "square_hd" | "square" | "portrait_4_3" | "portrait_16_9" | "landscape_4_3" | "landscape_16_9";

// ═══════════════════════════════════════════════════════════════
// STEP 1: 기본 이미지 생성 (배경 + 장면 + 포즈)
// Flux/dev로 얼굴 참조 없이 프롬프트만으로 생성
// ═══════════════════════════════════════════════════════════════

export async function generateBaseImage(
  prompt: string,
  negativePrompt?: string,
  imageSize?: ImageSize
): Promise<string> {
  const result = await fal.subscribe("fal-ai/flux/dev", {
    input: {
      prompt: `${BASE_PROMPT_PREFIX} ${prompt}`,
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      enable_safety_checker: false,
      image_size: imageSize || "portrait_4_3",
    },
  });
  const data = (result as any).data || result;
  return data.images[0].url;
}

// ═══════════════════════════════════════════════════════════════
// STEP 2a: 단일 얼굴 합성 (Face Swap)
// 생성된 이미지에 고객 얼굴을 합성
// ═══════════════════════════════════════════════════════════════

export async function faceSwapSingle(
  targetImageUrl: string,
  sourceFaceUrl: string,
): Promise<string> {
  const result = await fal.subscribe("half-moon-ai/ai-face-swap/faceswapimage", {
    input: {
      source_face_url: sourceFaceUrl,
      target_image_url: targetImageUrl,
      enable_occlusion_prevention: false,
    },
  });
  const data = (result as any).data || result;
  return data.image.url;
}

// ═══════════════════════════════════════════════════════════════
// STEP 2b: 다중 얼굴 합성 (커플/가족용 Face Swap)
// 생성된 이미지에 신부/신랑 얼굴을 동시에 합성
// ═══════════════════════════════════════════════════════════════

export async function faceSwapMulti(
  targetImageUrl: string,
  face1Url: string,
  face1Gender: "female" | "male",
  face2Url?: string,
  face2Gender?: "female" | "male",
): Promise<string> {
  const input: Record<string, any> = {
    source_face_url_1: face1Url,
    source_gender_1: face1Gender,
    target_image_url: targetImageUrl,
    enable_occlusion_prevention: false,
  };

  if (face2Url && face2Gender) {
    input.source_face_url_2 = face2Url;
    input.source_gender_2 = face2Gender;
  }

  const result = await fal.subscribe("half-moon-ai/ai-face-swap/faceswapimagemulti", {
    input,
  });
  const data = (result as any).data || result;
  return data.image.url;
}

// ═══════════════════════════════════════════════════════════════
// STEP 3: 4K 업스케일
// ═══════════════════════════════════════════════════════════════

export async function upscale4K(imageUrl: string): Promise<string> {
  const result = await fal.subscribe("fal-ai/esrgan", {
    input: {
      image_url: imageUrl,
      scale: 4,
      face: true,
    },
  });
  const data = (result as any).data || result;
  return data.image.url;
}

// ═══════════════════════════════════════════════════════════════
// STEP 배경 제거 (선택적)
// ═══════════════════════════════════════════════════════════════

export async function removeBackground(imageUrl: string): Promise<string> {
  const result = await fal.subscribe("fal-ai/imageutils/rembg", {
    input: { image_url: imageUrl },
  });
  const data = (result as any).data || result;
  return data.image.url;
}

// ═══════════════════════════════════════════════════════════════
// PuLID 직접 생성 (레거시 호환 + 대안 엔진)
// 프롬프트 + 얼굴 참조를 동시에 사용하여 이미지 생성
// ═══════════════════════════════════════════════════════════════

export async function generateWithPuLID(
  prompt: string,
  faceReferenceUrl: string,
  opts?: {
    negativePrompt?: string;
    idWeight?: number;
    imageSize?: ImageSize;
  }
): Promise<string> {
  const result = await fal.subscribe("fal-ai/flux-pulid", {
    input: {
      prompt: `${BASE_PROMPT_PREFIX} ${prompt}`,
      reference_image_url: faceReferenceUrl,
      negative_prompt: opts?.negativePrompt || DEFAULT_NEGATIVE,
      num_inference_steps: 20,
      start_step: 2,
      guidance_scale: 4.0,
      id_weight: opts?.idWeight ?? 1.0,
      true_cfg: 1.0,
      image_size: opts?.imageSize || "portrait_4_3",
      enable_safety_checker: false,
    },
  });
  const data = (result as any).data || result;
  return data.images[0].url;
}

// ═══════════════════════════════════════════════════════════════
// Flux LoRA 생성 (레거시 호환)
// ═══════════════════════════════════════════════════════════════

export async function generateWithFluxLora(
  prompt: string,
  opts?: {
    negativePrompt?: string;
    imageSize?: ImageSize;
    loras?: Array<{ path: string; scale?: number }>;
  }
): Promise<string> {
  const input: Record<string, any> = {
    prompt: `${BASE_PROMPT_PREFIX} ${prompt}`,
    image_size: opts?.imageSize || "portrait_4_3",
    num_images: 1,
    enable_safety_checker: false,
    output_format: "jpeg",
    guidance_scale: 3.5,
    num_inference_steps: 28,
  };

  if (opts?.loras && opts.loras.length > 0) {
    input.loras = opts.loras;
  }

  const result = await fal.subscribe("fal-ai/flux-lora", { input } as any);
  const data = (result as any).data || result;
  return data.images[0].url;
}

// ═══════════════════════════════════════════════════════════════
// 통합 파이프라인 - 올바른 3단계 순서
//
// 핵심 전략 (모든 엔진 공통):
// 1. generateBaseImage → 배경/장면/포즈 생성 (얼굴 참조 없음)
// 2. faceSwap → 생성된 이미지에 고객 얼굴 합성
// 3. (선택) upscale4K → 최종 업스케일
//
// 엔진별 차이:
// - flux_pulid: PuLID 직접 생성 (프롬프트+얼굴 동시, 레거시)
// - flux_lora/midjourney_omni/flux_dev: 3단계 파이프라인
// - dalle_native: 호출자가 직접 generateImage 사용
// ═══════════════════════════════════════════════════════════════

export type EngineType = "flux_lora" | "midjourney_omni" | "flux_pulid" | "flux_dev" | "dalle_native";

export async function runPipeline(opts: {
  engine: EngineType;
  prompt: string;
  faceImageUrls: string[];
  referenceImageUrls?: string[];
  negativePrompt?: string;
  imageSize?: ImageSize;
  isCouple?: boolean;
  brideGender?: "female" | "male";
  groomGender?: "female" | "male";
}): Promise<string> {
  const { engine, prompt, faceImageUrls, negativePrompt, imageSize, isCouple } = opts;
  const primaryFaceUrl = faceImageUrls[0];

  // ══════════════════════════════════════════════════════
  // 항상 3단계 파이프라인: generateBaseImage → faceSwap → return
  // (flux_pulid 직접 생성 분기 제거됨 - 모든 엔진 동일 파이프라인)
  // ══════════════════════════════════════════════════════

  // STEP 1: 배경 + 장면 + 포즈 이미지 생성 (얼굴 참조 없이)
  console.log("[Pipeline] STEP 1: Generating base image (no face reference)...");
  const baseImageUrl = await generateBaseImage(prompt, negativePrompt, imageSize);
  console.log("[Pipeline] STEP 1 complete:", baseImageUrl);

  // 얼굴 참조가 없으면 기본 이미지 그대로 반환
  if (!primaryFaceUrl) {
    return baseImageUrl;
  }

  // STEP 2: 생성된 이미지에 고객 얼굴 합성
  console.log("[Pipeline] STEP 2: Applying face swap...");
  let faceSwappedUrl: string;

  if (isCouple && faceImageUrls.length >= 2) {
    // 커플 모드: 다중 Face Swap (신부 + 신랑)
    const brideUrl = faceImageUrls[0];
    const groomUrl = faceImageUrls[1];
    const brideGender = opts.brideGender || "female";
    const groomGender = opts.groomGender || "male";
    faceSwappedUrl = await faceSwapMulti(
      baseImageUrl,
      brideUrl,
      brideGender,
      groomUrl,
      groomGender,
    );
  } else {
    // 개인 모드: 단일 Face Swap
    faceSwappedUrl = await faceSwapSingle(baseImageUrl, primaryFaceUrl);
  }
  console.log("[Pipeline] STEP 2 complete:", faceSwappedUrl);

  return faceSwappedUrl;
}

// ═══════════════════════════════════════════════════════════════
// 커플 파이프라인 (레거시 호환)
// ═══════════════════════════════════════════════════════════════

export async function runCouplePipeline(
  prompt: string,
  brideFaceUrl: string,
  groomFaceUrl: string,
  negativePrompt?: string,
  imageSize?: ImageSize
): Promise<string> {
  // STEP 1: 기본 이미지 생성
  const baseImageUrl = await generateBaseImage(prompt, negativePrompt, imageSize);

  // STEP 2: 다중 Face Swap
  if (brideFaceUrl && groomFaceUrl) {
    return faceSwapMulti(baseImageUrl, brideFaceUrl, "female", groomFaceUrl, "male");
  } else if (brideFaceUrl) {
    return faceSwapSingle(baseImageUrl, brideFaceUrl);
  } else if (groomFaceUrl) {
    return faceSwapSingle(baseImageUrl, groomFaceUrl);
  }

  return baseImageUrl;
}

// ═══════════════════════════════════════════════════════════════
// Legacy 호환 함수들
// ═══════════════════════════════════════════════════════════════

export async function generateWithFaceId(
  prompt: string,
  faceReferenceUrl: string,
  opts?: {
    negativePrompt?: string;
    idWeight?: number;
    guidanceScale?: number;
    numSteps?: number;
    imageSize?: ImageSize;
  }
): Promise<string> {
  return generateWithPuLID(prompt, faceReferenceUrl, {
    negativePrompt: opts?.negativePrompt,
    idWeight: opts?.idWeight ?? 1.0,
    imageSize: opts?.imageSize,
  });
}

export async function runSinglePipeline(
  prompt: string,
  faceImageUrl: string,
  negativePrompt?: string
): Promise<string> {
  // 3단계 파이프라인으로 변경
  const baseImageUrl = await generateBaseImage(prompt, negativePrompt);
  return faceSwapSingle(baseImageUrl, faceImageUrl);
}

export async function applyFaceEnsemble(
  baseImageUrl: string,
  faceImageUrls: string[]
): Promise<string> {
  if (faceImageUrls.length === 0) return baseImageUrl;
  // 첫 번째 얼굴로 face swap
  return faceSwapSingle(baseImageUrl, faceImageUrls[0]);
}

export async function applyFace(
  baseImageUrl: string,
  faceImageUrl: string,
  weight = 1.0
): Promise<string> {
  // 이제 실제 face swap API 사용
  return faceSwapSingle(baseImageUrl, faceImageUrl);
}
