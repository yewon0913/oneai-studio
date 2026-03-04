/**
 * ═══ AI 이미지 생성 엔진 설정 ═══
 * 
 * fal.ai 기반 실제 작동하는 엔진들입니다.
 * 
 * 1. Flux PuLID (얼굴 ID 보존 생성)
 *    - fal-ai/flux-pulid 모델 사용
 *    - reference_image_url로 얼굴 참조 이미지 전달
 *    - id_weight로 얼굴 보존 강도 조절 (0~1)
 *    - 프롬프트 + 얼굴 참조를 한 번에 처리
 * 
 * 2. Flux Dev (고품질 기본 생성)
 *    - fal-ai/flux/dev 모델 사용
 *    - 얼굴 참조 없이 프롬프트만으로 생성
 *    - 가장 빠른 생성 속도
 * 
 * 3. DALL-E / GPT-Image (Manus 내장)
 *    - generateImage 헬퍼 사용
 *    - originalImages로 참조 이미지 전달
 */

export type AIEngineId = "flux_pulid" | "flux_dev" | "dalle_native" | "sd_ip_adapter";

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
  flux_pulid: {
    id: "flux_pulid",
    name: "Flux PuLID",
    nameKo: "Flux PuLID (얼굴 ID 보존)",
    description: "PuLID-based face identity preservation with Flux model",
    descriptionKo: "참조 사진의 얼굴 ID를 보존하면서 프롬프트에 맞는 이미지를 생성합니다. 웨딩 사진에 최적화.",
    faceConsistencyScore: 92,
    strengthLabel: "최고",
    features: [
      "Face identity preservation from reference photo",
      "Prompt-guided scene generation",
      "Adjustable face weight (id_weight)",
      "High-quality photorealistic output",
    ],
    featuresKo: [
      "참조 사진에서 얼굴 ID 보존",
      "프롬프트 기반 장면 생성",
      "얼굴 보존 강도 조절 가능 (id_weight)",
      "고품질 포토리얼리스틱 출력",
    ],
    promptStrategy: "Upload face reference → flux-pulid generates scene with preserved face ID",
    promptStrategyKo: "얼굴 참조 업로드 → flux-pulid가 얼굴 ID를 보존하면서 장면 생성",
    icon: "🎯",
    color: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    available: true,
    recommended: true,
    falModel: "fal-ai/flux-pulid",
  },
  flux_dev: {
    id: "flux_dev",
    name: "Flux Dev",
    nameKo: "Flux Dev (고품질 생성)",
    description: "High-quality image generation without face reference",
    descriptionKo: "얼굴 참조 없이 프롬프트만으로 고품질 이미지를 생성합니다. 배경/장면 생성에 적합.",
    faceConsistencyScore: 0,
    strengthLabel: "없음",
    features: [
      "Prompt-only generation",
      "Highest image quality",
      "Fast generation speed",
      "Best for backgrounds and scenes",
    ],
    featuresKo: [
      "프롬프트만으로 생성",
      "최고 이미지 품질",
      "빠른 생성 속도",
      "배경/장면 생성에 최적",
    ],
    promptStrategy: "Generate from prompt only, no face reference",
    promptStrategyKo: "프롬프트만으로 생성, 얼굴 참조 없음",
    icon: "⚡",
    color: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    available: true,
    recommended: false,
    falModel: "fal-ai/flux/dev",
  },
  dalle_native: {
    id: "dalle_native",
    name: "DALL-E / GPT-Image",
    nameKo: "DALL-E / GPT 이미지",
    description: "Native image generation with originalImages parameter",
    descriptionKo: "Manus 내장 이미지 생성 엔진. originalImages로 참조 이미지를 전달하여 생성합니다.",
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
    color: "text-purple-400 bg-purple-500/10 border-purple-500/30",
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
  
  if (engines.includes("flux_pulid")) {
    consistencyDirectives.push(
      "CRITICAL: Preserve 100% facial identity from reference photo. Maintain exact face shape, eye distance, nose bridge, lip contour, jawline, skin tone."
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
    case "flux_pulid":
      return { min: 1, max: 5, optimal: 1 };
    case "flux_dev":
      return { min: 0, max: 0, optimal: 0 };
    case "dalle_native":
      return { min: 1, max: 2, optimal: 1 };
    case "sd_ip_adapter":
      return { min: 1, max: 5, optimal: 3 };
  }
}
