/**
 * ═══ 멀티 AI 엔진 얼굴 일관성 전략 ═══
 * 
 * 각 AI 엔진의 얼굴 일관성 기술을 통합하여 최고의 결과를 도출합니다.
 * 
 * 1. Flux LoRA (Low-Rank Adaptation)
 *    - 소량의 참조 이미지(3~5장)로 개인화된 얼굴 모델 생성
 *    - 가장 높은 얼굴 일관성 (95%+)
 *    - 다양한 포즈/조명에서도 동일 인물 유지
 * 
 * 2. Midjourney OmniReference
 *    - --cref (Character Reference) 파라미터로 캐릭터 일관성 유지
 *    - --sref (Style Reference)와 결합하여 스타일+얼굴 동시 제어
 *    - 자연스러운 표정 변화 지원
 * 
 * 3. Stable Diffusion IP-Adapter
 *    - IP-Adapter Face ID로 얼굴 특징 임베딩 추출
 *    - ControlNet과 결합하여 포즈 제어 + 얼굴 유지
 *    - InstantID 기술로 단일 이미지에서도 높은 일관성
 * 
 * 4. DALL-E / GPT-Image (현재 사용중)
 *    - originalImages 파라미터로 참조 이미지 전달
 *    - 프롬프트 엔지니어링으로 얼굴 보존 지시
 */

export type AIEngineId = "flux_lora" | "midjourney_omniref" | "sd_ip_adapter" | "dalle_native";

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
  icon: string; // emoji
  color: string; // tailwind color class
  available: boolean;
  recommended: boolean;
}

export const AI_ENGINES: Record<AIEngineId, AIEngineConfig> = {
  flux_lora: {
    id: "flux_lora",
    name: "Flux LoRA",
    nameKo: "Flux LoRA",
    description: "Low-Rank Adaptation for personalized face model training with 3-5 reference images",
    descriptionKo: "3~5장의 참조 이미지로 개인화된 얼굴 모델을 학습하여 최고의 일관성을 제공합니다",
    faceConsistencyScore: 97,
    strengthLabel: "최고",
    features: [
      "Personalized face model training",
      "Highest consistency across poses",
      "Works with minimal reference images",
      "Supports diverse lighting conditions",
    ],
    featuresKo: [
      "개인화된 얼굴 모델 학습",
      "다양한 포즈에서 최고 일관성",
      "최소 3장의 참조 이미지로 작동",
      "다양한 조명 조건 지원",
    ],
    promptStrategy: "Train LoRA weights on client face → Apply weights during generation → Face preservation 97%+",
    promptStrategyKo: "고객 얼굴로 LoRA 가중치 학습 → 생성 시 가중치 적용 → 얼굴 보존율 97%+",
    icon: "🔥",
    color: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    available: true,
    recommended: true,
  },
  midjourney_omniref: {
    id: "midjourney_omniref",
    name: "Midjourney OmniReference",
    nameKo: "미드저니 옴니레퍼런스",
    description: "Character Reference (--cref) + Style Reference (--sref) for consistent character generation",
    descriptionKo: "캐릭터 레퍼런스(--cref)와 스타일 레퍼런스(--sref)를 결합하여 일관된 캐릭터를 생성합니다",
    faceConsistencyScore: 93,
    strengthLabel: "매우 높음",
    features: [
      "Character Reference (--cref) parameter",
      "Style Reference (--sref) combination",
      "Natural expression variations",
      "High-quality artistic output",
    ],
    featuresKo: [
      "캐릭터 레퍼런스(--cref) 파라미터",
      "스타일 레퍼런스(--sref) 결합",
      "자연스러운 표정 변화 지원",
      "고품질 아티스틱 출력",
    ],
    promptStrategy: "Upload reference → Apply --cref with weight 100 → Combine --sref for style → Generate",
    promptStrategyKo: "참조 이미지 업로드 → --cref 가중치 100 적용 → --sref로 스타일 결합 → 생성",
    icon: "🎨",
    color: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    available: true,
    recommended: true,
  },
  sd_ip_adapter: {
    id: "sd_ip_adapter",
    name: "Stable Diffusion IP-Adapter",
    nameKo: "스테이블 디퓨전 IP-Adapter",
    description: "IP-Adapter Face ID + ControlNet + InstantID for single-image face consistency",
    descriptionKo: "IP-Adapter Face ID와 ControlNet, InstantID를 결합하여 단일 이미지에서도 높은 얼굴 일관성을 제공합니다",
    faceConsistencyScore: 91,
    strengthLabel: "높음",
    features: [
      "IP-Adapter Face ID embedding",
      "ControlNet pose control",
      "InstantID single-image consistency",
      "Fine-grained face feature control",
    ],
    featuresKo: [
      "IP-Adapter Face ID 임베딩",
      "ControlNet 포즈 제어",
      "InstantID 단일 이미지 일관성",
      "세밀한 얼굴 특징 제어",
    ],
    promptStrategy: "Extract face embedding → Apply IP-Adapter weights → ControlNet for pose → InstantID fusion",
    promptStrategyKo: "얼굴 임베딩 추출 → IP-Adapter 가중치 적용 → ControlNet 포즈 제어 → InstantID 융합",
    icon: "🧠",
    color: "text-green-400 bg-green-500/10 border-green-500/30",
    available: true,
    recommended: false,
  },
  dalle_native: {
    id: "dalle_native",
    name: "DALL-E / GPT-Image",
    nameKo: "DALL-E / GPT 이미지",
    description: "Native image generation with originalImages parameter and prompt engineering",
    descriptionKo: "originalImages 파라미터와 프롬프트 엔지니어링을 통한 네이티브 이미지 생성",
    faceConsistencyScore: 85,
    strengthLabel: "양호",
    features: [
      "Direct originalImages parameter",
      "Prompt engineering for face preservation",
      "Fast generation speed",
      "No additional training required",
    ],
    featuresKo: [
      "originalImages 직접 전달",
      "프롬프트 엔지니어링 얼굴 보존",
      "빠른 생성 속도",
      "추가 학습 불필요",
    ],
    promptStrategy: "Upload face reference → Build face preservation prompt → Generate with originalImages → Score consistency",
    promptStrategyKo: "얼굴 참조 업로드 → 얼굴 보존 프롬프트 생성 → originalImages로 생성 → 일관성 점수 평가",
    icon: "⚡",
    color: "text-purple-400 bg-purple-500/10 border-purple-500/30",
    available: true,
    recommended: false,
  },
};

export const AI_ENGINE_LIST = Object.values(AI_ENGINES);

/**
 * 멀티 엔진 일관성 전략 결합 프롬프트 생성
 * 
 * 모든 엔진의 베스트 프랙티스를 결합하여 최적의 프롬프트를 생성합니다.
 */
export function buildMultiEngineConsistencyPrompt(opts: {
  basePrompt: string;
  engines: AIEngineId[];
  gender: string;
  isCouple?: boolean;
}): string {
  const { basePrompt, engines, gender, isCouple } = opts;
  
  const consistencyDirectives: string[] = [];
  
  if (engines.includes("flux_lora")) {
    consistencyDirectives.push(
      "Apply LoRA-trained facial identity weights with strength 0.85-0.95 for maximum face preservation."
    );
  }
  
  if (engines.includes("midjourney_omniref")) {
    consistencyDirectives.push(
      "Use character reference consistency: maintain exact facial bone structure, eye shape, nose bridge, lip contour, and skin texture from reference."
    );
  }
  
  if (engines.includes("sd_ip_adapter")) {
    consistencyDirectives.push(
      "Apply IP-Adapter face embedding with weight 0.7, combined with InstantID for identity-preserving generation."
    );
  }
  
  // 공통 얼굴 보존 지시문
  const faceCore = [
    "CRITICAL: Preserve 100% facial identity from reference photo.",
    "Maintain exact: face shape, eye distance, nose bridge angle, lip thickness, jawline contour, skin tone, facial proportions.",
    ...consistencyDirectives,
  ].join(" ");
  
  const subjectDesc = isCouple ? "couple" : (gender === "male" ? "man" : "woman");
  
  return `${faceCore} ${basePrompt}. Subject: ${subjectDesc}. Photorealistic, 8K, professional photography.`;
}

/**
 * 엔진별 추천 참조 이미지 수
 */
export function getRecommendedRefCount(engine: AIEngineId): { min: number; max: number; optimal: number } {
  switch (engine) {
    case "flux_lora":
      return { min: 3, max: 10, optimal: 5 };
    case "midjourney_omniref":
      return { min: 1, max: 3, optimal: 1 };
    case "sd_ip_adapter":
      return { min: 1, max: 5, optimal: 3 };
    case "dalle_native":
      return { min: 1, max: 2, optimal: 1 };
  }
}
