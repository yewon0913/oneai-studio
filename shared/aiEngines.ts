/**
 * ═══ 자동 최적화 파이프라인 구성 ═══
 *
 * 사용자가 엔진을 선택하지 않습니다.
 * 파이프라인이 자동으로 최적 경로를 결정합니다.
 *
 * Primary: Gemini 3 Pro Image → Fallback: FLUX.2 LoRA → FLUX Pro v1.1
 * 후처리: CodeFormer (fidelity 0.78) + Film Grain
 * 옵션: IP-Adapter FaceID (faceLock 활성화 시)
 */

export interface PipelineStageInfo {
  id: string;
  icon: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  type: "primary" | "fallback" | "postprocess" | "optional";
  order: number;
}

export const PIPELINE_STAGES: PipelineStageInfo[] = [
  {
    id: "gemini_3_pro",
    icon: "🥇",
    name: "Gemini 3 Pro Image",
    nameKo: "Gemini 3 Pro Image",
    description: "Primary generation engine — best face recognition",
    descriptionKo: "기본 생성 엔진 — 얼굴 인식 최고",
    type: "primary",
    order: 1,
  },
  {
    id: "flux2_lora",
    icon: "⚡",
    name: "FLUX.2 LoRA",
    nameKo: "FLUX.2 LoRA",
    description: "Auto-switch when Gemini fails",
    descriptionKo: "Gemini 실패 시 자동 전환",
    type: "fallback",
    order: 2,
  },
  {
    id: "flux_pro_v11",
    icon: "🔄",
    name: "FLUX Pro v1.1",
    nameKo: "FLUX Pro v1.1",
    description: "Final safety net",
    descriptionKo: "최종 안전망",
    type: "fallback",
    order: 3,
  },
  {
    id: "codeformer",
    icon: "✨",
    name: "CodeFormer",
    nameKo: "CodeFormer (fidelity 0.78)",
    description: "Face naturalness restoration",
    descriptionKo: "얼굴 자연스러움 복원",
    type: "postprocess",
    order: 4,
  },
  {
    id: "ip_adapter_faceid",
    icon: "🔒",
    name: "IP-Adapter FaceID",
    nameKo: "IP-Adapter FaceID",
    description: "Runs when faceLock is enabled",
    descriptionKo: "faceLock 활성화 시 실행",
    type: "optional",
    order: 5,
  },
];

// ── Legacy 호환: 기존 코드에서 AIEngineId를 참조하는 부분 대응 ──
export type AIEngineId = "flux_lora" | "midjourney_omniref" | "sd_ip_adapter" | "dalle_native";

export const AI_ENGINE_LIST = PIPELINE_STAGES;

export function buildMultiEngineConsistencyPrompt(opts: {
  basePrompt: string;
  engines: AIEngineId[];
  gender: string;
  isCouple?: boolean;
}): string {
  const { basePrompt, gender, isCouple } = opts;
  const subjectDesc = isCouple ? "couple" : (gender === "male" ? "man" : "woman");
  return `CRITICAL: Preserve 100% facial identity from reference photo. Maintain exact: face shape, eye distance, nose bridge angle, lip thickness, jawline contour, skin tone, facial proportions. ${basePrompt}. Subject: ${subjectDesc}. Photorealistic, 8K, professional photography.`;
}

export function getRecommendedRefCount(_engine: AIEngineId): { min: number; max: number; optimal: number } {
  return { min: 1, max: 5, optimal: 1 };
}
