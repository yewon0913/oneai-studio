// ─────────────────────────────────────────────────────
// 규칙 기반 이미지 분석 및 프롬프트 생성 시스템
// LLM 의존성 제거 (무료, 빠름, 안정적)
// ─────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────
export interface AnalysisResult {
  prompt: string;
  negativePrompt: string;
  analysis: {
    // 기본 정보
    skinTone: string;           // "warm", "cool", "neutral", "deep"
    skinTexture: string;        // "smooth", "textured", "matte", "glowy"
    skinCondition: string;      // "clear", "fair", "mature"
    
    // 얼굴 특징
    faceShape: string;          // "oval", "round", "square", "heart"
    eyeShape: string;           // "almond", "round", "hooded"
    eyeColor: string;           // "brown", "dark brown", "black"
    
    // 표정/눈빛
    expression: string;         // "smile", "neutral", "serious", "gentle"
    eyeContact: string;         // "direct", "downward", "sideways"
    
    // 조명
    lighting: string;           // "natural", "soft", "dramatic", "studio"
    lightDirection: string;     // "front", "side", "back", "top"
    
    // 헤어
    hairColor: string;          // "black", "brown", "blonde", "red"
    hairLength: string;         // "short", "medium", "long"
    hairStyle: string;          // "straight", "wavy", "curly", "bob"
    
    // 의상
    outfitType: string;         // "casual", "formal", "professional"
    outfitColor: string;        // 주요 색상
    
    // 배경
    backgroundColor: string;    // "white", "neutral", "blurred"
    backgroundType: string;     // "plain", "nature", "studio"
    
    // 카메라/렌즈
    shotType: string;           // "headshot", "portrait", "upper_body"
    cameraDistance: string;     // "close", "medium", "far"
  };
}

// ─────────────────────────────────────────────────────
// 규칙 기반 분석 데이터
// ─────────────────────────────────────────────────────

const SKIN_TONE_KEYWORDS = {
  warm: ["warm undertone", "golden", "peachy", "warm glow"],
  cool: ["cool undertone", "rosy", "pink", "cool tone"],
  neutral: ["neutral undertone", "balanced", "natural"],
  deep: ["deep skin tone", "rich tone", "dark complexion"],
};

const SKIN_TEXTURE_KEYWORDS = {
  smooth: ["smooth skin", "poreless", "refined texture"],
  textured: ["textured skin", "visible pores", "natural texture"],
  matte: ["matte finish", "no shine", "natural matte"],
  glowy: ["glowing skin", "luminous", "dewy", "radiant"],
};

const LIGHTING_KEYWORDS = {
  natural: ["natural light", "daylight", "window light", "soft natural"],
  soft: ["soft lighting", "diffused", "gentle", "flattering"],
  dramatic: ["dramatic lighting", "high contrast", "moody"],
  studio: ["studio lighting", "professional light", "controlled"],
};

const LIGHT_DIRECTION_KEYWORDS = {
  front: ["front lighting", "frontal", "even light"],
  side: ["side lighting", "directional", "side-lit"],
  back: ["backlighting", "rim light", "backlit"],
  top: ["top lighting", "overhead", "from above"],
};

const HAIR_COLOR_KEYWORDS = {
  black: ["black hair", "jet black", "dark black"],
  brown: ["brown hair", "dark brown", "light brown"],
  blonde: ["blonde hair", "golden", "light blonde"],
  red: ["red hair", "auburn", "copper"],
};

const HAIR_LENGTH_KEYWORDS = {
  short: ["short hair", "bob", "pixie", "cropped"],
  medium: ["medium hair", "shoulder-length", "mid-length"],
  long: ["long hair", "flowing", "waist-length"],
};

const HAIR_STYLE_KEYWORDS = {
  straight: ["straight hair", "sleek", "smooth"],
  wavy: ["wavy hair", "waves", "undulating"],
  curly: ["curly hair", "curls", "coils"],
  bob: ["bob", "bob cut", "blunt cut"],
};

const EXPRESSION_KEYWORDS = {
  smile: ["smiling", "smile", "happy", "cheerful"],
  neutral: ["neutral expression", "serious", "calm"],
  gentle: ["gentle smile", "soft expression", "serene"],
  serious: ["serious", "intense", "focused"],
};

const OUTFIT_TYPE_KEYWORDS = {
  casual: ["casual", "relaxed", "everyday"],
  formal: ["formal", "elegant", "sophisticated"],
  professional: ["professional", "business", "corporate"],
};

const SHOT_TYPE_KEYWORDS = {
  headshot: ["headshot", "head and shoulders", "close-up"],
  portrait: ["portrait", "face-focused", "head portrait"],
  upper_body: ["upper body", "torso", "shoulders"],
};

// ─────────────────────────────────────────────────────
// 규칙 기반 분석 함수
// ─────────────────────────────────────────────────────

function analyzeImageByRules(imageUrl: string): AnalysisResult["analysis"] {
  // 이 함수는 실제 이미지 분석 없이 기본값을 반환합니다.
  // 실제 구현에서는 Computer Vision API를 사용하여 이미지를 분석합니다.
  // 여기서는 규칙 기반 프롬프트 생성의 구조를 보여줍니다.

  return {
    skinTone: "warm",
    skinTexture: "smooth",
    skinCondition: "clear",
    faceShape: "oval",
    eyeShape: "almond",
    eyeColor: "brown",
    expression: "gentle",
    eyeContact: "direct",
    lighting: "soft",
    lightDirection: "front",
    hairColor: "black",
    hairLength: "short",
    hairStyle: "bob",
    outfitType: "professional",
    outfitColor: "black",
    backgroundColor: "white",
    backgroundType: "plain",
    shotType: "portrait",
    cameraDistance: "medium",
  };
}

// ─────────────────────────────────────────────────────
// 프롬프트 생성 함수 (규칙 기반)
// ─────────────────────────────────────────────────────

export function buildFinalPrompt(result: AnalysisResult): {
  prompt: string;
  negativePrompt: string;
} {
  const a = result.analysis;

  // ══════════════════════════════════════════
  // POSITIVE PROMPT — 10단계 우선순위
  // ══════════════════════════════════════════

  // ── 1순위: 얼굴 일관성 ──────────────────────
  const tier1_face = [
    "(face consistency:1.5)",
    "(same person:1.4)",
    "(identical facial features:1.4)",
  ].join(", ");

  // ── 2순위: 피부 ─────────────────────────────
  const skinKeywords = [
    SKIN_TONE_KEYWORDS[a.skinTone as keyof typeof SKIN_TONE_KEYWORDS]?.[0] ||
      "warm undertone",
    SKIN_TEXTURE_KEYWORDS[a.skinTexture as keyof typeof SKIN_TEXTURE_KEYWORDS]?.[0] ||
      "smooth skin",
    a.skinCondition === "clear" ? "clear complexion" : "healthy skin",
  ];
  const tier2_skin = `(${skinKeywords.join(", ")}:1.2), skin pores visible, natural skin texture, subsurface scattering`;

  // ── 3순위: 조명 ─────────────────────────────
  const lightingKeywords = [
    LIGHTING_KEYWORDS[a.lighting as keyof typeof LIGHTING_KEYWORDS]?.[0] ||
      "soft lighting",
    LIGHT_DIRECTION_KEYWORDS[a.lightDirection as keyof typeof LIGHT_DIRECTION_KEYWORDS]?.[0] ||
      "front lighting",
  ];
  const tier3_lighting = `${lightingKeywords.join(", ")}, catch light in eyes, natural shadow direction`;

  // ── 4순위: 표정/눈빛 ────────────────────────
  const expressionKeywords = [
    EXPRESSION_KEYWORDS[a.expression as keyof typeof EXPRESSION_KEYWORDS]?.[0] ||
      "gentle expression",
    a.eyeContact === "direct" ? "direct eye contact" : "soft gaze",
  ];
  const tier4_expression = expressionKeywords.join(", ");

  // ── 5순위: 카메라/렌즈 ──────────────────────
  const cameraKeywords = [
    a.cameraDistance === "close"
      ? "85mm portrait lens"
      : a.cameraDistance === "medium"
        ? "50mm lens"
        : "35mm lens",
    "f/1.4 aperture",
    "natural optical bokeh",
  ];
  const tier5_camera = cameraKeywords.join(", ");

  // ── 6순위: 분위기/색보정 ────────────────────
  const moodKeywords = [
    a.outfitType === "professional"
      ? "professional, elegant"
      : a.outfitType === "formal"
        ? "sophisticated, refined"
        : "casual, relaxed",
    "balanced saturation",
    "soft highlights",
  ];
  const tier6_mood = moodKeywords.join(", ");

  // ── 7순위: 의상 ─────────────────────────────
  const outfitKeywords = [
    a.outfitType === "professional" ? "professional attire" : a.outfitType,
    a.outfitColor ? `${a.outfitColor} clothing` : "",
  ].filter(Boolean);
  const tier7_outfit = outfitKeywords.join(", ");

  // ── 8순위: 포즈 ─────────────────────────────
  const poseKeywords = [
    a.shotType === "upper_body"
      ? "upper body portrait"
      : a.shotType === "headshot"
        ? "headshot"
        : "portrait pose",
    "relaxed shoulders",
    "natural posture",
  ];
  const tier8_pose = poseKeywords.join(", ");

  // ── 9순위: 배경 ─────────────────────────────
  const backgroundKeywords = [
    a.backgroundColor === "white"
      ? "white background"
      : a.backgroundColor === "neutral"
        ? "neutral background"
        : "blurred background",
    a.backgroundType === "plain" ? "plain" : "soft",
  ];
  const tier9_background = backgroundKeywords.join(", ");

  // ── 10순위: 헤어 ────────────────────────────
  const hairKeywords = [
    HAIR_COLOR_KEYWORDS[a.hairColor as keyof typeof HAIR_COLOR_KEYWORDS]?.[0] ||
      "black hair",
    HAIR_LENGTH_KEYWORDS[a.hairLength as keyof typeof HAIR_LENGTH_KEYWORDS]?.[0] ||
      "short hair",
    HAIR_STYLE_KEYWORDS[a.hairStyle as keyof typeof HAIR_STYLE_KEYWORDS]?.[0] ||
      "straight",
  ];
  const tier10_hair = `(${hairKeywords.join(" ")}:0.7)`;

  // ── 품질 고정 태그 ──────────────────────────
  const qualityTags = [
    "photorealistic",
    "8K ultra detail",
    "RAW photo",
    "film grain ISO 400",
    "editorial photography",
  ].join(", ");

  // ── 최종 조립 ───────────────────────────────
  const finalPrompt = [
    tier1_face,
    tier2_skin,
    tier3_lighting,
    tier4_expression,
    tier5_camera,
    tier6_mood,
    tier7_outfit,
    tier8_pose,
    tier9_background,
    tier10_hair,
    qualityTags,
  ]
    .filter(Boolean)
    .join(", ");

  // ══════════════════════════════════════════
  // NEGATIVE PROMPT — 5단계 방어 레이어
  // ══════════════════════════════════════════

  const neg_face = [
    "(different person:1.6)",
    "(face swap:1.5)",
    "(wrong face:1.5)",
    "(inconsistent face:1.4)",
    "(merged faces:1.5)",
  ].join(", ");

  const neg_skin = [
    "(plastic skin:1.5)",
    "(smooth skin:1.4)",
    "(airbrushed:1.4)",
    "(porcelain skin:1.3)",
    "(wax skin:1.4)",
  ].join(", ");

  const neg_anatomy = [
    "(mutated hands:1.5)",
    "(merged fingers:1.5)",
    "(extra fingers:1.5)",
    "(bad hands:1.4)",
    "(bad teeth:1.4)",
  ].join(", ");

  const neg_quality = [
    "(gaussian blur:1.3)",
    "(fake bokeh:1.3)",
    "(artificial lighting:1.2)",
    "(cartoon:1.5)",
    "(anime:1.5)",
    "(painting:1.5)",
    "(illustration:1.5)",
    "(CGI:1.4)",
    "(3D render:1.4)",
  ].join(", ");

  const neg_hair = [
    "long hair",
    "curly hair",
    "blonde hair",
    "messy hair",
    "bangs",
  ].join(", ");

  const finalNegative = [neg_face, neg_skin, neg_anatomy, neg_quality, neg_hair]
    .filter(Boolean)
    .join(", ");

  return {
    prompt: finalPrompt,
    negativePrompt: finalNegative,
  };
}

// ─────────────────────────────────────────────────────
// 메인 분석 함수 — URL 버전
// ─────────────────────────────────────────────────────
export async function analyzeImageToPrompt(
  imageUrl: string
): Promise<AnalysisResult> {
  try {
    // 규칙 기반 분석 (LLM 없음)
    const analysis = analyzeImageByRules(imageUrl);

    const rawResult: AnalysisResult = {
      prompt: "",
      negativePrompt: "",
      analysis,
    };

    // buildFinalPrompt로 최강 우선순위 적용
    const optimized = buildFinalPrompt(rawResult);

    return {
      ...rawResult,
      prompt: optimized.prompt,
      negativePrompt: optimized.negativePrompt,
    };
  } catch (err: any) {
    console.error("이미지 분석 실패 (URL):", err);
    throw new Error(`이미지 분석 실패: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────
// 메인 분석 함수 — base64 버전
// ─────────────────────────────────────────────────────
export async function analyzeBase64ImageToPrompt(
  base64Data: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg"
): Promise<AnalysisResult> {
  try {
    // 규칙 기반 분석 (LLM 없음)
    const analysis = analyzeImageByRules("");

    const rawResult: AnalysisResult = {
      prompt: "",
      negativePrompt: "",
      analysis,
    };

    const optimized = buildFinalPrompt(rawResult);

    return {
      ...rawResult,
      prompt: optimized.prompt,
      negativePrompt: optimized.negativePrompt,
    };
  } catch (err: any) {
    console.error("이미지 분석 실패 (base64):", err);
    throw new Error(`이미지 분석 실패: ${err.message}`);
  }
}
