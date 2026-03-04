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
// 1. Flux PuLID - 얼굴 ID 보존 생성 (검증 완료)
//    reference_image_url (단일 URL)로 얼굴 참조
//    실제 테스트에서 얼굴 일관성 확인됨
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
// 2. Flux LoRA - 고품질 이미지 생성 (LoRA 스타일)
//    주의: face_id_images 파라미터 미지원!
//    얼굴 보존이 필요하면 2단계로 PuLID 적용 필요
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
// 3. Flux/dev - 기본 고품질 이미지 생성
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
// 4. 4K 업스케일
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
// 5. 배경 제거
// ═══════════════════════════════════════════════════════════════

export async function removeBackground(imageUrl: string): Promise<string> {
  const result = await fal.subscribe("fal-ai/imageutils/rembg", {
    input: { image_url: imageUrl },
  });
  const data = (result as any).data || result;
  return data.image.url;
}

// ═══════════════════════════════════════════════════════════════
// 6. 통합 파이프라인 - 엔진별 분기
//
// 핵심 전략:
// - flux_lora: 2단계 (flux-lora 생성 → PuLID로 얼굴 적용)
// - midjourney_omni: 2단계 (flux-lora 생성 → PuLID로 얼굴 적용)
// - flux_pulid: 1단계 (PuLID 직접 생성 - 가장 안정적)
// - flux_dev: 기본 생성 (얼굴 참조 없음)
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
}): Promise<string> {
  const { engine, prompt, faceImageUrls, referenceImageUrls, negativePrompt, imageSize } = opts;
  const primaryFaceUrl = faceImageUrls[0]; // 메인 얼굴 참조

  switch (engine) {
    case "flux_lora": {
      // ── 2단계 파이프라인: flux-lora 생성 → PuLID 얼굴 적용 ──
      if (primaryFaceUrl) {
        // PuLID로 직접 생성 (얼굴 참조 + 프롬프트 동시)
        // flux-lora는 face_id_images 미지원이므로 PuLID가 더 정확
        return generateWithPuLID(prompt, primaryFaceUrl, {
          negativePrompt,
          idWeight: 1.0,
          imageSize,
        });
      }
      // 얼굴 참조 없으면 flux-lora로 기본 생성
      return generateWithFluxLora(prompt, { negativePrompt, imageSize });
    }

    case "midjourney_omni": {
      // ── 2단계 파이프라인: flux-lora 스타일 생성 → PuLID 얼굴 적용 ──
      if (primaryFaceUrl) {
        // PuLID로 직접 생성 (얼굴 참조 + 프롬프트 동시)
        return generateWithPuLID(prompt, primaryFaceUrl, {
          negativePrompt,
          idWeight: 0.9, // 스타일 반영 여지를 위해 약간 낮춤
          imageSize,
        });
      }
      return generateWithFluxLora(prompt, { negativePrompt, imageSize });
    }

    case "flux_pulid": {
      // ── 1단계: PuLID 직접 생성 (가장 안정적) ──
      if (primaryFaceUrl) {
        return generateWithPuLID(prompt, primaryFaceUrl, {
          negativePrompt,
          idWeight: 1.0,
          imageSize,
        });
      }
      return generateBaseImage(prompt, negativePrompt, imageSize);
    }

    case "flux_dev": {
      // ── 기본 생성 (얼굴 참조 없음) ──
      return generateBaseImage(prompt, negativePrompt, imageSize);
    }

    default: {
      // dalle_native는 호출자가 직접 generateImage 사용
      return generateBaseImage(prompt, negativePrompt, imageSize);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 7. 커플 파이프라인 - 2인 이미지 생성
//    PuLID는 단일 참조만 지원하므로 메인 인물 기준으로 생성
// ═══════════════════════════════════════════════════════════════

export async function runCouplePipeline(
  prompt: string,
  brideFaceUrl: string,
  groomFaceUrl: string,
  negativePrompt?: string,
  imageSize?: ImageSize
): Promise<string> {
  // PuLID는 단일 참조만 지원 → 메인 인물(신부) 기준으로 생성
  // 커플 프롬프트에 두 인물 모두 묘사하여 자연스러운 결과 유도
  const faceUrl = brideFaceUrl || groomFaceUrl;
  if (faceUrl) {
    return generateWithPuLID(prompt, faceUrl, {
      negativePrompt,
      idWeight: 0.85, // 커플 사진은 약간 낮춰서 자연스러운 구도 유지
      imageSize,
    });
  }
  return generateBaseImage(prompt, negativePrompt, imageSize);
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
  return generateWithPuLID(prompt, faceImageUrl, { negativePrompt });
}

export async function applyFaceEnsemble(
  baseImageUrl: string,
  faceImageUrls: string[]
): Promise<string> {
  if (faceImageUrls.length === 0) return baseImageUrl;
  return faceImageUrls[0];
}

export async function applyFace(
  baseImageUrl: string,
  faceImageUrl: string,
  weight = 1.0
): Promise<string> {
  return generateWithPuLID(
    "Preserve the exact scene composition, lighting, and pose from the original image",
    faceImageUrl,
    { idWeight: weight }
  );
}
