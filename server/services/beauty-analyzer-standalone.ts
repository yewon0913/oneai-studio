/**
 * Beauty Analyzer Standalone v1.0
 *
 * ⚠️  완전 독립 파일 — wedding/gemini 코드와 절대 공유하지 않음
 *
 * 이 파일은 개인촬영(beauty/branding) 전용입니다.
 * shared-analyzer.ts, gemini-wedding-pipeline.ts, gemini-wedding-faceswap-pipeline.ts
 * 등 웨딩 관련 파일과 완전히 분리되어 있습니다.
 *
 * 웨딩 파이프라인 수정이 이 파일에 영향을 주지 않습니다.
 * 이 파일 수정이 웨딩 파이프라인에 영향을 주지 않습니다.
 */

import Anthropic from "@anthropic-ai/sdk";

// ─── Beauty 전용 분석 결과 인터페이스 ────────────────────

export interface BeautyAnalysisResult {
  skinTone: string;
  skinTexture: string;
  faceShape: string;
  eyeShape: string;
  hasGlasses: boolean;
  glassesStyle: string;
  hasBear: boolean;
  bearStyle: string;
  hairStyle: string;
  hairColor: string;
  pose: string;
  gaze: string;
  expression: string;
  makeupLevel: string;
  lightingType: string;
  lightingDirection: string;
  shadowPresence: string;
  background: string;
  outfit: string;
  mood: string;
  estimatedAge: string;
  skinAgingFeatures: string;
  faceFeatureDetails: string;
  expressionVariant: number;
  generatedPrompt: string;
  generatedNegative: string;
}

// ─── Beauty 전용 표정 6가지 변주 시스템 ─────────────────

const BEAUTY_EXPRESSION_VARIANTS = [
  // 0: 자연스러운 미소
  "genuine natural smile, soft eyes with warmth, relaxed jaw, authentic joy",
  // 1: 강인한 눈빛
  "confident direct gaze, subtle smirk, strong eyebrows, composed expression",
  // 2: 생각하는 표정
  "thoughtful introspective look, slightly downward gaze, serene neutral expression",
  // 3: 자연스러운 웃음
  "mid-laugh natural expression, eyes slightly crinkled, open mouth smile, candid joy",
  // 4: 우아한 측면
  "elegant side profile gaze, slight chin tilt, graceful composure",
  // 5: 신선한 표정
  "fresh casual expression, relaxed mouth, friendly approachable energy",
];

// ─── Beauty 전용 연령대별 피부 처리 ─────────────────────

function buildBeautyAgeAppropriateSkin(estimatedAge: string, skinAgingFeatures: string): string {
  const age = parseInt(estimatedAge) || 30;

  if (age >= 50) {
    return [
      "age-appropriate natural skin",
      "preserve natural aging features gracefully",
      "subtle laugh lines preserved",
      "natural skin texture with character",
      "distinguished mature beauty",
      "NOT over-smoothed, NOT de-aged",
      skinAgingFeatures,
    ].filter(Boolean).join(", ");
  }

  if (age >= 40) {
    return [
      "natural skin texture preserved",
      "minimal retouching aesthetic",
      "subtle fine lines preserved",
      "real skin character maintained",
      "NOT airbrushed, NOT plastic",
      skinAgingFeatures,
    ].filter(Boolean).join(", ");
  }

  // 20~39
  return [
    "natural youthful skin",
    "visible pores texture",
    "skin imperfections preserved",
    "authentic skin tone",
  ].join(", ");
}

// ─── Beauty 전용 얼굴 유사도 강화 키워드 ────────────────

function buildBeautyFaceLikeness(a: BeautyAnalysisResult): string {
  const parts = [
    `maintain original ${a.faceShape} face shape exactly`,
    `preserve ${a.eyeShape} eye shape`,
    a.faceFeatureDetails ? `${a.faceFeatureDetails}` : "",
    "same person facial identity preserved",
    "realistic face likeness, NOT over-handsome, NOT beautified",
    "original facial proportions maintained",
  ];

  if (a.hasGlasses) {
    parts.push(
      `wearing ${a.glassesStyle} glasses exactly as original`,
      "glasses frame preserved completely",
      "face visible through glasses"
    );
  }

  return parts.filter(Boolean).join(", ");
}

// ─── Beauty 전용 조명 빌더 ──────────────────────────────

function buildBeautyLighting(a: BeautyAnalysisResult): string {
  if (a.lightingType.includes("outdoor")) {
    return [
      `outdoor ${a.lightingDirection}`,
      "hard sunlight casting natural directional shadows",
      "sun catchlight at 11 o'clock in eyes",
      `${a.shadowPresence}`,
      "ambient occlusion under nose and chin",
      "rim lighting from sun direction",
      "natural color temperature 5500K",
      "golden hour warmth",
    ].join(", ");
  }

  if (a.lightingType.includes("studio")) {
    return [
      `studio ${a.lightingDirection}`,
      "Rembrandt lighting triangle on cheek",
      "fill light ratio 3:1",
      "defined shadow under jaw and nose",
      "specular highlight on nose bridge",
      "hair light separation from background",
      "professional studio strobe",
    ].join(", ");
  }

  return [
    `indoor ${a.lightingDirection}`,
    "window light soft directional",
    "natural shadow on one side of face",
    "ambient indoor warm light",
    "color temperature 4000K",
    "soft box diffused",
  ].join(", ");
}

// ─── Beauty 전용 프롬프트 빌더 ──────────────────────────

function buildBeautyPrompt(a: BeautyAnalysisResult): string {
  const camera = "shot on Canon EOS R5, 85mm f/2.0, RAW photo, photorealistic, 8K resolution";

  const realism = [
    "skin pores clearly visible",
    "natural skin texture with imperfections",
    "subsurface scattering on skin",
    "film grain ISO 400",
    "subtle chromatic aberration",
    "lens vignette subtle",
    "NOT illustration, NOT digital art, NOT AI generated, NOT CGI",
  ].join(", ");

  const skinAge = buildBeautyAgeAppropriateSkin(a.estimatedAge, a.skinAgingFeatures);
  const faceLikeness = buildBeautyFaceLikeness(a);

  const hair = [
    `(${a.hairStyle}:1.3)`,
    `${a.hairColor} hair`,
    "natural flyaway hair strands",
    "realistic hair texture",
    "individual hair strands visible",
    "NOT perfect hair, natural hair movement",
  ].join(", ");

  const pose = [
    `${a.pose}`,
    "slight body turn 15 degrees",
    "relaxed shoulders weight shifted",
    "natural hand placement",
    "weight shifted to one leg",
    "candid unstaged authentic moment",
  ].join(", ");

  const expressionText = BEAUTY_EXPRESSION_VARIANTS[a.expressionVariant];
  const lighting = buildBeautyLighting(a);

  const background = [
    `${a.background}`,
    "background slightly out of focus f/2.0",
    "background details partially visible",
    "environmental context visible",
    "NOT completely blurred",
  ].join(", ");

  // beauty 전용 모드 추가 키워드
  const beautyExtra = `${a.makeupLevel} makeup, ${a.mood} beauty, Korean beauty photography, professional portrait`;

  return [camera, realism, skinAge, faceLikeness, hair, pose, expressionText, lighting, background, beautyExtra]
    .filter(Boolean)
    .join(", ")
    .replace(/,\s*,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Beauty 전용 네거티브 프롬프트 빌더 ─────────────────

function buildBeautyNegative(a: BeautyAnalysisResult): string {
  const base = [
    "(illustration:1.9), (digital art:1.9), (painting:1.8), (anime:1.9), (cartoon:1.9)",
    "(AI generated look:1.7), (CGI:1.7), (3D render:1.7)",
    "(plastic skin:1.9), (airbrushed skin:1.9), (smooth poreless skin:1.8)",
    "(wax skin:1.8), (beauty filter:1.8), (instagram filter:1.7)",
    "(perfect flawless skin:1.7), (no pores:1.7)",
    "(over-smoothed:1.8), (de-aged:1.8), (porcelain skin:1.7)",
    "(different person:1.9), (changed face:1.9), (wrong facial features:1.8)",
    "(over-handsome:1.7), (over-beautified face:1.7)",
    "(wrong nose shape:1.8), (wrong eye shape:1.7)",
    "(idealized features:1.6), (k-pop idol face:1.6)",
    "(stiff pose:1.5), (frontal symmetrical pose:1.5)",
    "(standing at attention:1.5), (mannequin pose:1.5)",
    "(robot pose:1.4)",
    "(expressionless:1.5), (blank stare:1.5)",
    "(dead eyes:1.5), (repeated same smile:1.4)",
    "(forced smile:1.4)",
    "(perfect hair:1.5), (too neat hair:1.4)",
    "(helmet hair:1.5), (plastic hair:1.5)",
    "(flat lighting:1.5), (no shadows:1.5)",
    "(overexposed:1.4), (blown highlights:1.4)",
    "(completely blurred background:1.4), (extreme bokeh:1.4)",
    "watermark, logo, text, signature",
    "deformed hands, bad anatomy, extra fingers",
    "blurry, low quality, low resolution",
    "jpeg artifacts, noise",
  ];

  if (a.hasGlasses) {
    base.push(
      "(removed glasses:1.9), (no glasses:1.9)",
      "(wrong glasses style:1.7)",
      "(face distorted by glasses:1.6)"
    );
  }

  if (a.hasBear) {
    base.push("(removed beard:1.8), (clean shaven when should have beard:1.8)");
  }

  return base.join(", ");
}

// ─── Beauty 전용 Mock 데이터 (API 실패 시 fallback) ─────

function getBeautyMockResult(expressionVariantOverride?: number): BeautyAnalysisResult {
  const expressionVariant = expressionVariantOverride !== undefined
    ? expressionVariantOverride
    : Math.floor(Math.random() * BEAUTY_EXPRESSION_VARIANTS.length);

  const result: BeautyAnalysisResult = {
    skinTone:           "warm beige",
    skinTexture:        "natural pores visible",
    faceShape:          "oval",
    eyeShape:           "almond monolid",
    hasGlasses:         false,
    glassesStyle:       "none",
    hasBear:            false,
    bearStyle:          "none",
    hairStyle:          "shoulder-length natural hair",
    hairColor:          "deep black",
    pose:               "slight body turn, relaxed standing",
    gaze:               "looking slightly off-camera",
    expression:         "genuine smile",
    makeupLevel:        "light natural",
    lightingType:       "outdoor natural",
    lightingDirection:  "upper left sunlight",
    shadowPresence:     "soft natural shadow",
    background:         "natural environment",
    outfit:             "casual elegant outfit",
    mood:               "natural elegant",
    estimatedAge:       "30",
    skinAgingFeatures:  "none",
    faceFeatureDetails: "natural nose bridge, medium lips, soft jawline",
    expressionVariant,
    generatedPrompt:    "",
    generatedNegative:  "",
  };

  result.generatedPrompt   = buildBeautyPrompt(result);
  result.generatedNegative = buildBeautyNegative(result);

  return result;
}

// ─── Beauty 전용 Claude Vision 분석 (메인 함수) ──────────

export async function analyzeBeautyImage(
  base64: string,
  mimeType: string,
  expressionVariantOverride?: number
): Promise<BeautyAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn("[beauty-analyzer] ANTHROPIC_API_KEY 없음 → 폴백 반환");
    return getBeautyMockResult(expressionVariantOverride);
  }

  const client = new Anthropic({ apiKey });
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/webp", data: clean },
          },
          {
            type: "text",
            text: `이 사진을 정밀 분석해줘. 용도: 개인 뷰티/브랜딩 사진 생성용. 피부, 메이크업, 조명, 연령대에 집중해서 분석해.

반드시 JSON만 응답해. 다른 텍스트 없이:
{
  "skinTone": "피부톤 영어로 (예: warm ivory, golden beige, cool porcelain)",
  "skinTexture": "피부결 영어로 (예: dewy, matte, natural pores visible)",
  "faceShape": "얼굴형 영어로 (예: oval, round, heart-shaped, square)",
  "eyeShape": "눈 모양 영어로 (예: almond monolid, double eyelid almond)",
  "hasGlasses": true 또는 false,
  "glassesStyle": "안경 스타일 영어로 (예: black rectangular frames, rimless oval) 또는 none",
  "hasBeard": true 또는 false,
  "beardStyle": "수염 스타일 영어로 또는 none",
  "hairStyle": "헤어스타일 영어로. 길이 포함 (예: short ear-length bob, shoulder-length wavy, buzz cut)",
  "hairColor": "헤어 색상 영어로 (예: deep black, dark brown, ash brown)",
  "pose": "포즈 영어로 (예: slight body turn, relaxed standing, candid natural)",
  "gaze": "시선 영어로 (예: looking slightly off-camera, direct eye contact)",
  "expression": "표정 영어로 (예: genuine smile, subtle smirk, serene neutral)",
  "makeupLevel": "메이크업 정도 영어로 (예: no makeup, light natural, full glam)",
  "lightingType": "outdoor natural / indoor studio / mixed 중 하나",
  "lightingDirection": "조명 방향 영어로 (예: upper left sunlight, front softbox, side rim light)",
  "shadowPresence": "그림자 영어로 (예: strong directional shadow, soft shadow, no shadow)",
  "background": "배경 영어로 (예: blurred city street, white studio, garden)",
  "outfit": "의상 영어로 (예: white casual shirt, elegant black dress)",
  "mood": "전체 분위기 영어로 (예: elegant, fresh casual, romantic, professional)",
  "estimatedAge": "추정 나이 숫자만 (예: 25, 35, 45, 55)",
  "skinAgingFeatures": "나이에 맞는 피부 특징 영어로 (예: subtle laugh lines, natural forehead lines, youthful smooth) 또는 none",
  "faceFeatureDetails": "얼굴 특징 상세 영어로 (코 모양, 입술, 턱선 등 3가지) (예: slightly wide nose bridge, full lips, defined jawline)"
}`,
          },
        ],
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("분석 결과 파싱 실패");

    const raw = JSON.parse(jsonMatch[0]);

    const expressionVariant = expressionVariantOverride !== undefined
      ? expressionVariantOverride
      : Math.floor(Math.random() * BEAUTY_EXPRESSION_VARIANTS.length);

    const result: BeautyAnalysisResult = {
      skinTone:           raw.skinTone || "warm beige",
      skinTexture:        raw.skinTexture || "natural pores visible",
      faceShape:          raw.faceShape || "oval",
      eyeShape:           raw.eyeShape || "almond",
      hasGlasses:         raw.hasGlasses || false,
      glassesStyle:       raw.glassesStyle || "none",
      hasBear:            raw.hasBeard || false,
      bearStyle:          raw.beardStyle || "none",
      hairStyle:          raw.hairStyle || "natural hair",
      hairColor:          raw.hairColor || "black",
      pose:               raw.pose || "natural relaxed pose",
      gaze:               raw.gaze || "looking slightly off-camera",
      expression:         raw.expression || "genuine smile",
      makeupLevel:        raw.makeupLevel || "light natural",
      lightingType:       raw.lightingType || "outdoor natural",
      lightingDirection:  raw.lightingDirection || "upper left sunlight",
      shadowPresence:     raw.shadowPresence || "soft natural shadow",
      background:         raw.background || "natural environment",
      outfit:             raw.outfit || "casual outfit",
      mood:               raw.mood || "natural elegant",
      estimatedAge:       raw.estimatedAge || "30",
      skinAgingFeatures:  raw.skinAgingFeatures || "none",
      faceFeatureDetails: raw.faceFeatureDetails || "",
      expressionVariant,
      generatedPrompt:    "",
      generatedNegative:  "",
    };

    result.generatedPrompt   = buildBeautyPrompt(result);
    result.generatedNegative = buildBeautyNegative(result);

    console.log("[beauty-analyzer] ✅ Claude Vision 분석 완료");
    return result;

  } catch (err: any) {
    const msg = err?.message ?? '';
    const status = err?.status ?? err?.statusCode ?? 0;

    if (msg.includes('credit balance') || status === 400) {
      console.warn('[beauty-analyzer] ⚠️  Anthropic 크레딧 부족 → 폴백 반환');
    } else if (status === 401 || status === 403) {
      console.warn('[beauty-analyzer] ⚠️  Anthropic 인증 실패 → 폴백 반환');
    } else {
      console.warn('[beauty-analyzer] ⚠️  Claude Vision 실패:', msg.slice(0, 120), '→ 폴백 반환');
    }

    return getBeautyMockResult(expressionVariantOverride);
  }
}

// ─── Anthropic 크레딧 상태 확인 (beauty 전용) ────────────

export async function checkBeautyAnthropicCredits(): Promise<{
  available: boolean;
  message: string;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { available: false, message: 'ANTHROPIC_API_KEY 미등록' };
  }

  try {
    const client = new Anthropic({ apiKey });
    await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
    return { available: true, message: '정상' };
  } catch (err: any) {
    const msg = err?.message ?? '';
    if (msg.includes('credit balance')) {
      return { available: false, message: '크레딧 부족' };
    }
    if (err?.status === 401 || err?.status === 403) {
      return { available: false, message: '인증 실패' };
    }
    return { available: false, message: msg.slice(0, 80) || '알 수 없는 에러' };
  }
}
