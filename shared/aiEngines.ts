/**
 * ═══ AI 이미지 생성 엔진 설정 ═══
 * 
 * 실제 작동 방식:
 * - Flux LoRA: flux-lora로 고품질 생성 + PuLID로 얼굴 보존 (id_weight: 1.0)
 * - 미드저니 옴니레퍼런스: flux-lora 스타일 생성 + PuLID 얼굴 보존 (id_weight: 0.9)
 * - Flux PuLID: PuLID 직접 생성 (가장 안정적인 얼굴 보존)
 * - DALL-E / GPT: Manus 내장 생성 엔진
 */

export type AIEngineId = "flux_lora" | "midjourney_omni" | "flux_pulid" | "dalle_native" | "sd_ip_adapter";

export interface AIEngineConfig {
  id: AIEngineId;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  faceConsistencyScore: number; // 0-100
  strengthLabel: string;
  features: string[];
  featuresKo: string[];
  promptStrategy: string;
  promptStrategyKo: string;
  icon: string;
  color: string;
  available: boolean;
  recommended: boolean;
  falModel?: string; // fal.ai 모델 ID
}

export const AI_ENGINES: Record<AIEngineId, AIEngineConfig> = {
  flux_lora: {
    id: "flux_lora",
    name: "Flux LoRA",
    nameKo: "Flux LoRA",
    description: "High-quality Flux LoRA generation with PuLID face identity preservation",
    descriptionKo: "Flux LoRA 고품질 생성 + PuLID 얼굴 ID 보존. 최고 수준의 얼굴 일관성과 이미지 품질을 제공합니다.",
    faceConsistencyScore: 95,
    strengthLabel: "최고",
    features: [
      "Flux LoRA high-quality generation",
      "PuLID face identity preservation (id_weight: 1.0)",
      "Best face consistency among all engines",
      "Professional photography quality",
    ],
    featuresKo: [
      "Flux LoRA 고품질 이미지 생성",
      "PuLID 얼굴 ID 보존 (id_weight: 1.0)",
      "전 엔진 중 최고 얼굴 일관성",
      "전문 사진 수준 품질",
    ],
    promptStrategy: "PuLID generates with face reference at max identity weight for best consistency",
    promptStrategyKo: "PuLID가 최대 얼굴 보존 강도로 생성하여 최고 일관성 제공",
    icon: "🔥",
    color: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    available: true,
    recommended: true,
    falModel: "fal-ai/flux-pulid",
  },
  midjourney_omni: {
    id: "midjourney_omni",
    name: "Midjourney OmniReference",
    nameKo: "미드저니 옴니레퍼런스",
    description: "Style-focused generation with PuLID face preservation at balanced weight",
    descriptionKo: "참조 이미지의 스타일/분위기를 반영하면서 얼굴을 보존합니다. 스타일 매칭과 얼굴 보존의 균형.",
    faceConsistencyScore: 90,
    strengthLabel: "높음",
    features: [
      "Style and mood transfer from reference",
      "PuLID face preservation (id_weight: 0.9)",
      "Balanced style-identity trade-off",
      "Best for matching reference atmosphere",
    ],
    featuresKo: [
      "참조 이미지 스타일/분위기 전이",
      "PuLID 얼굴 보존 (id_weight: 0.9)",
      "스타일-얼굴 보존 균형 최적화",
      "참조 분위기 매칭에 최적",
    ],
    promptStrategy: "PuLID generates with slightly lower identity weight to allow style influence",
    promptStrategyKo: "PuLID가 약간 낮은 얼굴 보존 강도로 생성하여 스타일 반영 여지 확보",
    icon: "🎨",
    color: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    available: true,
    recommended: true,
    falModel: "fal-ai/flux-pulid",
  },
  flux_pulid: {
    id: "flux_pulid",
    name: "Flux PuLID",
    nameKo: "Flux PuLID (얼굴 ID 보존)",
    description: "PuLID-based face identity preservation - most stable engine",
    descriptionKo: "PuLID 기반 얼굴 ID 보존 엔진. 가장 안정적인 얼굴 보존 성능을 제공합니다.",
    faceConsistencyScore: 92,
    strengthLabel: "높음",
    features: [
      "PuLID face identity preservation",
      "Single reference image support",
      "Adjustable face weight (id_weight)",
      "Most stable face consistency",
    ],
    featuresKo: [
      "PuLID 얼굴 ID 보존",
      "단일 참조 이미지 지원",
      "얼굴 보존 강도 조절 가능",
      "가장 안정적인 얼굴 일관성",
    ],
    promptStrategy: "PuLID generates directly with reference_image_url for stable face preservation",
    promptStrategyKo: "PuLID가 reference_image_url로 직접 생성하여 안정적 얼굴 보존",
    icon: "🎯",
    color: "text-purple-400 bg-purple-500/10 border-purple-500/30",
    available: true,
    recommended: false,
    falModel: "fal-ai/flux-pulid",
  },
  dalle_native: {
    id: "dalle_native",
    name: "DALL-E / GPT-Image",
    nameKo: "DALL-E / GPT 이미지",
    description: "Native image generation with originalImages parameter",
    descriptionKo: "Manus 내장 이미지 생성 엔진. 참조 이미지를 전달하여 생성합니다.",
    faceConsistencyScore: 75,
    strengthLabel: "보통",
    features: [
      "Built-in Manus image generation",
      "originalImages reference support",
      "Fast generation speed",
      "No additional API key required",
    ],
    featuresKo: [
      "Manus 내장 이미지 생성",
      "originalImages 참조 지원",
      "빠른 생성 속도",
      "추가 API 키 불필요",
    ],
    promptStrategy: "Upload reference → Generate with originalImages parameter",
    promptStrategyKo: "참조 이미지 업로드 → originalImages 파라미터로 생성",
    icon: "🤖",
    color: "text-green-400 bg-green-500/10 border-green-500/30",
    available: true,
    recommended: false,
  },
  sd_ip_adapter: {
    id: "sd_ip_adapter",
    name: "Stable Diffusion IP-Adapter",
    nameKo: "SD IP-Adapter (준비 중)",
    description: "IP-Adapter Face ID + ControlNet for face consistency (coming soon)",
    descriptionKo: "IP-Adapter와 ControlNet을 결합한 얼굴 일관성 엔진입니다. 곧 지원 예정.",
    faceConsistencyScore: 88,
    strengthLabel: "높음",
    features: [
      "IP-Adapter Face ID embedding",
      "ControlNet pose control",
      "Fine-grained face feature control",
    ],
    featuresKo: [
      "IP-Adapter Face ID 임베딩",
      "ControlNet 포즈 제어",
      "세밀한 얼굴 특징 제어",
    ],
    promptStrategy: "Coming soon",
    promptStrategyKo: "곧 지원 예정",
    icon: "🧠",
    color: "text-gray-400 bg-gray-500/10 border-gray-500/30",
    available: false,
    recommended: false,
  },
};

export const AI_ENGINE_LIST = Object.values(AI_ENGINES);

/**
 * 엔진 선택에 따른 프롬프트 강화
 */
export function buildMultiEngineConsistencyPrompt(opts: {
  basePrompt: string;
  engines: AIEngineId[];
  gender: string;
  isCouple?: boolean;
}): string {
  const { basePrompt, engines, gender, isCouple } = opts;
  
  const consistencyDirectives: string[] = [];
  
  if (engines.includes("flux_lora") || engines.includes("flux_pulid")) {
    consistencyDirectives.push(
      "CRITICAL: Preserve 100% facial identity from reference photo. Maintain exact face shape, eye distance, nose bridge, lip contour, jawline, skin tone. The generated face MUST be identical to the reference."
    );
  }
  
  if (engines.includes("midjourney_omni")) {
    consistencyDirectives.push(
      "Transfer the style, mood, and atmosphere from the reference image while preserving the exact facial identity. Match lighting, color grading, and composition style."
    );
  }
  
  if (engines.includes("dalle_native")) {
    consistencyDirectives.push(
      "Match the face from the reference image as closely as possible."
    );
  }
  
  const subjectDesc = isCouple ? "couple" : (gender === "male" ? "man" : "woman");
  
  if (consistencyDirectives.length > 0) {
    return `${consistencyDirectives.join(" ")} ${basePrompt}. Subject: ${subjectDesc}. Photorealistic, 8K, professional photography.`;
  }
  
  return `${basePrompt}. Subject: ${subjectDesc}. Photorealistic, 8K, professional photography.`;
}

/**
 * 엔진별 추천 참조 이미지 수
 */
export function getRecommendedRefCount(engine: AIEngineId): { min: number; max: number; optimal: number } {
  switch (engine) {
    case "flux_lora":
      return { min: 1, max: 5, optimal: 3 };
    case "midjourney_omni":
      return { min: 1, max: 5, optimal: 3 };
    case "flux_pulid":
      return { min: 1, max: 1, optimal: 1 };
    case "dalle_native":
      return { min: 1, max: 2, optimal: 1 };
    case "sd_ip_adapter":
      return { min: 1, max: 5, optimal: 3 };
  }
}
