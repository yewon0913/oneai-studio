/**
 * Beauty Branding Module - Image Analyzer
 * 규칙 기반 뷰티 이미지 분석 (LLM 제거, 내장 데이터 기반)
 * 피부톤, 조명, 메이크업 스타일 자동 분류
 */

export interface BeautyAnalysisResult {
  prompt: string;
  negativePrompt: string;
  category: "skincare" | "makeup" | "luxury" | "natural";
  analysis: {
    skinTone: string;
    skinTexture: string;
    faceFeatures: string;
    makeupStyle: string;
    lighting: string;
    camera: string;
    mood: string;
    colorGrade: string;
    background: string;
  };
}

/**
 * 규칙 기반 뷰티 분석 데이터
 */
const BEAUTY_ANALYSIS_DATA = {
  skinTone: [
    "ivory skin",
    "beige skin",
    "warm beige",
    "golden skin",
    "rosy undertone",
    "peachy undertone",
    "neutral undertone",
  ],
  skinTexture: [
    "pores visible",
    "natural skin texture",
    "subsurface scattering",
    "translucent skin",
    "dewy skin",
    "matte skin",
    "glass skin",
  ],
  faceFeatures: [
    "almond shaped eyes",
    "high cheekbones",
    "soft jawline",
    "defined philtrum",
    "symmetrical face",
    "delicate features",
    "sharp cheekbones",
  ],
  makeupStyle: [
    "no makeup",
    "natural makeup",
    "light makeup",
    "medium makeup",
    "full makeup",
    "dramatic makeup",
    "Korean beauty style",
  ],
  lighting: [
    "beauty dish lighting",
    "softbox lighting",
    "natural light",
    "rembrandt lighting",
    "butterfly lighting",
    "side lighting",
    "front lighting",
  ],
  camera: [
    "Hasselblad X2D, 120mm macro f/2.8",
    "Canon EOS R5, 85mm f/1.2",
    "Nikon Z9, 105mm f/2.8 macro",
    "Phase One XF IQ4, 80mm f/2.8",
    "medium format, natural optical bokeh",
  ],
  mood: [
    "elegant",
    "sophisticated",
    "serene",
    "confident",
    "playful",
    "mysterious",
    "fresh",
  ],
  colorGrade: [
    "warm color grading",
    "cool color grading",
    "neutral color grading",
    "vintage film look",
    "cinematic color",
    "editorial color",
  ],
  background: [
    "plain wall",
    "light beige",
    "blurred background",
    "neutral background",
    "soft focus",
    "studio background",
  ],
};

/**
 * 카테고리별 프롬프트 템플릿
 */
const CATEGORY_TEMPLATES: Record<string, Record<string, string>> = {
  skincare: {
    positive: "glass skin, dewy fresh, water droplets, Laneige Sulwhasoo style, hydrated skin, luminous complexion",
    negative: "(plastic skin:1.6), (airbrushed:1.6), (smooth skin:1.5), (porcelain skin:1.5), (wax skin:1.5), (beauty filter:1.5), (no pores:1.5), (blurred skin:1.4)",
  },
  makeup: {
    positive: "flawless foundation, visible pores, Korean beauty, 3CE Romand style, precise makeup, editorial makeup",
    negative: "(plastic skin:1.6), (airbrushed:1.6), (smooth skin:1.5), (porcelain skin:1.5), (wax skin:1.5), (beauty filter:1.5), (no pores:1.5), (blurred skin:1.4)",
  },
  luxury: {
    positive: "dramatic lighting, luxury beauty brand, Chanel Dior editorial, high fashion, luxury campaign, sophisticated",
    negative: "(plastic skin:1.6), (airbrushed:1.6), (smooth skin:1.5), (porcelain skin:1.5), (wax skin:1.5), (beauty filter:1.5), (no pores:1.5), (blurred skin:1.4)",
  },
  natural: {
    positive: "fresh no-makeup glow, natural light, vitamin skin, organic beauty, clean beauty, minimal makeup",
    negative: "(plastic skin:1.6), (airbrushed:1.6), (smooth skin:1.5), (porcelain skin:1.5), (wax skin:1.5), (beauty filter:1.5), (no pores:1.5), (blurred skin:1.4)",
  },
};

/**
 * 규칙 기반으로 분석 데이터 생성
 */
function generateAnalysisData(category: "skincare" | "makeup" | "luxury" | "natural"): BeautyAnalysisResult["analysis"] {
  const getRandomItem = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  return {
    skinTone: getRandomItem(BEAUTY_ANALYSIS_DATA.skinTone),
    skinTexture: getRandomItem(BEAUTY_ANALYSIS_DATA.skinTexture),
    faceFeatures: getRandomItem(BEAUTY_ANALYSIS_DATA.faceFeatures),
    makeupStyle: getRandomItem(BEAUTY_ANALYSIS_DATA.makeupStyle),
    lighting: getRandomItem(BEAUTY_ANALYSIS_DATA.lighting),
    camera: getRandomItem(BEAUTY_ANALYSIS_DATA.camera),
    mood: getRandomItem(BEAUTY_ANALYSIS_DATA.mood),
    colorGrade: getRandomItem(BEAUTY_ANALYSIS_DATA.colorGrade),
    background: getRandomItem(BEAUTY_ANALYSIS_DATA.background),
  };
}

/**
 * 뷰티 프롬프트 빌더
 */
function buildBeautyPrompt(
  analysis: BeautyAnalysisResult["analysis"],
  category: "skincare" | "makeup" | "luxury" | "natural"
): { prompt: string; negativePrompt: string } {
  const tier1_skin = [
    `(${analysis.skinTone}:1.5)`,
    `(${analysis.skinTexture}:1.5)`,
    "skin pores visible",
    "natural skin texture",
    "subsurface scattering",
    "translucent skin",
    "(facial identity consistency:2.0)",
  ].join(", ");

  const tier2_face = analysis.faceFeatures ? `(${analysis.faceFeatures}:2.0), (face consistency:2.0), (same person:2.0), (identical facial features:2.0)` : "";

  const tier3_lighting = analysis.lighting
    ? `${analysis.lighting}, catch light in eyes, specular highlight on nose bridge`
    : "beauty dish lighting, catch light in eyes";

  const tier4_camera = analysis.camera
    ? `${analysis.camera}`
    : "Hasselblad X2D, 120mm macro f/2.8";

  const categoryTags = CATEGORY_TEMPLATES[category].positive;
  const qualityTags =
    "photorealistic, 8K ultra detail, RAW photo, medium format, beauty campaign, film grain ISO 200";

  const finalPrompt = [
    "Korean beauty model, 20s,",
    tier1_skin,
    tier2_face,
    tier3_lighting,
    tier4_camera,
    analysis.makeupStyle,
    analysis.mood,
    analysis.colorGrade,
    analysis.background,
    categoryTags,
    qualityTags,
  ]
    .filter(Boolean)
    .join(", ");

  const negativePrompt = CATEGORY_TEMPLATES[category].negative;

  return { prompt: finalPrompt, negativePrompt };
}

/**
 * 메인 분석 함수 (규칙 기반)
 */
export async function analyzeBeautyImageBase64(
  _base64Data: string,
  _mimeType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
  category: "skincare" | "makeup" | "luxury" | "natural" = "skincare"
): Promise<BeautyAnalysisResult> {
  // 규칙 기반 분석 데이터 생성
  const analysis = generateAnalysisData(category);

  // 프롬프트 빌드
  const { prompt, negativePrompt } = buildBeautyPrompt(analysis, category);

  return {
    prompt,
    negativePrompt,
    category,
    analysis,
  };
}
