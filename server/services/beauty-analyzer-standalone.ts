/**
 * Beauty Analyzer Standalone v2.0
 *
 * ⚠️  완전 독립 파일 — wedding/gemini 코드와 절대 공유하지 않음
 *
 * 이 파일은 개인촬영(beauty/branding) 전용입니다.
 * shared-analyzer.ts, gemini-wedding-pipeline.ts, gemini-wedding-faceswap-pipeline.ts
 * 등 웨딩 관련 파일과 완전히 분리되어 있습니다.
 *
 * 웨딩 파이프라인 수정이 이 파일에 영향을 주지 않습니다.
 * 이 파일 수정이 웨딩 파이프라인에 영향을 주지 않습니다.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * v2.0 개선사항: 얼굴 유사도 최대화
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 1. Claude Vision 분석 항목 확장
 *    - 눈 형태 상세 분석 (크기, 모양, 쌍꺼풀)
 *    - 턱선 분석 (둥근형/V라인/각진형)
 *    - 얼굴형 정밀 분석
 *    - 특이사항 자동 감지 (안경, 수염, 눈 형태 등)
 *
 * 2. 네거티브 프롬프트 강화
 *    - (different person:2.0) ← 최우선 가중치
 *    - 얼굴 특징 변화 방지 (1.8~1.9)
 *    - 피부 보정 방지 (1.7~1.8)
 *
 * 3. 포지티브 프롬프트 강화
 *    - "preserve exact facial features" 필수
 *    - "same person, identical face" 필수
 *    - 눈/얼굴 구조 유지 명시
 *
 * 4. 연령대별 처리 정밀화
 *    - 20대: natural youthful skin
 *    - 30대: natural skin, mature features
 *    - 40대: subtle fine lines preserved
 *    - 50대+: natural wrinkles preserved (weight 1.9)
 *    - 60대+: age-appropriate appearance (weight 2.0)
 */

import Anthropic from "@anthropic-ai/sdk";

// ─── Beauty 전용 분석 결과 인터페이스 (v2.0 확장) ────────────────────

export interface BeautyAnalysisResult {
  // 기본 정보
  estimatedAge: string;
  skinTone: string;
  skinTexture: string;

  // 얼굴 형태 (확장)
  faceShape: string; // 계란형, 둥근형, 각진형, 역삼각형
  jawlineType: string; // 둥근형, V라인, 각진형
  jawlineDescription: string;

  // 눈 (상세 분석)
  eyeShape: string; // 크고 둥근, 가늘고 긴, 일반형
  eyeSize: string; // 큼, 중간, 작음
  eyeOpenness: string; // 크게 뜸, 자연스러움, 가늘게 뜸
  doubleEyelidPresence: string; // 쌍꺼풀 있음/없음
  eyeColorDescription: string;

  // 코
  noseShape: string; // 높음, 보통, 낮음
  noseWidth: string; // 좁음, 보통, 넓음
  noseDescription: string;

  // 입
  lipShape: string; // 두꺼움, 보통, 얇음
  lipColor: string;
  lipDescription: string;

  // 특이사항
  hasGlasses: boolean;
  glassesStyle: string;
  glassesDescription: string;
  hasBear: boolean;
  bearStyle: string;
  bearDescription: string;
  hasDistinctiveMarks: boolean; // 점, 흉터, 주근깨 등
  distinctiveMarksDescription: string;

  // 헤어
  hairStyle: string;
  hairColor: string;
  hairLength: string; // 초단발, 단발, 중간, 롱, 매우 긴
  hairTexture: string; // 직모, 웨이브, 곱슬머리
  hairDescription: string;

  // 피부
  skinAgingFeatures: string;
  visibleWrinkles: string; // 없음, 미세, 보통, 뚜렷함
  skinCondition: string; // 맑음, 여드름, 흡집, 기타

  // 표정 및 자세
  pose: string;
  gaze: string;
  expression: string;
  makeupLevel: string;

  // 조명 및 배경
  lightingType: string;
  lightingDirection: string;
  shadowPresence: string;
  background: string;
  outfit: string;
  mood: string;

  // 얼굴 특징 상세
  faceFeatureDetails: string;

  // 표정 변주
  expressionVariant: number;

  // 생성된 프롬프트
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

// ─── 얼굴 유사도 최대화: 공통 필수 포지티브 프롬프트 ─────────────────

function buildFaceLikenessCore(): string {
  return [
    "preserve exact facial features",
    "same person, identical face",
    "maintain original eye shape exactly",
    "maintain original face structure",
    "maintain original facial proportions",
    "original facial identity preserved",
    "realistic face likeness, NOT over-handsome, NOT beautified",
    "NOT changed facial features",
  ].join(", ");
}

// ─── 얼굴 유사도 최대화: 공통 필수 네거티브 프롬프트 ─────────────────

function buildFaceLikenessNegative(): string {
  return [
    "(different person:2.0)",
    "(changing facial features:1.9)",
    "(different eye shape:1.8)",
    "(different face structure:1.8)",
    "(plastic surgery look:1.8)",
    "(airbrushed skin:1.7)",
    "(smooth poreless skin:1.7)",
  ].join(", ");
}

// ─── 연령대별 피부 처리 (v2.0 정밀화) ─────────────────────

function buildAgeAppropriatePrompt(estimatedAge: string, skinAgingFeatures: string): string {
  const age = parseInt(estimatedAge) || 30;

  if (age >= 60) {
    // 60대+: 최강 나이 보존
    return [
      "mature Korean woman in her 60s",
      "age-appropriate appearance (weight:2.0)",
      "natural wrinkles preserved (weight:2.0)",
      "NOT de-aged (weight:2.0)",
      "natural aging features preserved gracefully",
      "distinguished mature beauty",
      "real skin character maintained",
      "subtle laugh lines visible",
      "natural skin texture with character",
      skinAgingFeatures,
    ].filter(Boolean).join(", ");
  }

  if (age >= 50) {
    // 50대: 나이 보존
    return [
      "mature Korean woman",
      "natural wrinkles preserved (weight:1.9)",
      "NOT de-aged (weight:1.9)",
      "age-appropriate appearance",
      "natural aging features preserved",
      "subtle laugh lines preserved",
      "natural skin texture with character",
      "distinguished mature beauty",
      "real skin character maintained",
      skinAgingFeatures,
    ].filter(Boolean).join(", ");
  }

  if (age >= 40) {
    // 40대: 미세한 라인 보존
    return [
      "natural skin texture preserved",
      "subtle fine lines preserved",
      "real skin character maintained",
      "minimal retouching aesthetic",
      "natural mid-40s appearance",
      "mature features preserved",
      "NOT airbrushed, NOT plastic",
      skinAgingFeatures,
    ].filter(Boolean).join(", ");
  }

  if (age >= 30) {
    // 30대: 자연스러운 피부
    return [
      "natural skin texture",
      "visible pores texture",
      "natural 30s appearance",
      "mature features preserved",
      "skin imperfections preserved naturally",
      "authentic skin tone",
      skinAgingFeatures,
    ].filter(Boolean).join(", ");
  }

  // 20대: 젊은 피부
  return [
    "natural youthful skin",
    "visible pores texture",
    "natural 20s appearance",
    "skin imperfections preserved",
    "authentic skin tone",
    skinAgingFeatures,
  ].filter(Boolean).join(", ");
}

// ─── 눈 형태 특화 프롬프트 ─────────────────────

function buildEyePrompt(analysis: BeautyAnalysisResult): string {
  const parts: string[] = [];

  // 눈 크기
  if (analysis.eyeSize === "크음") {
    parts.push("naturally large round eyes preserved");
  } else if (analysis.eyeSize === "작음") {
    parts.push("naturally small eyes preserved");
  }

  // 눈 모양
  if (analysis.eyeOpenness === "가늘게 뜸") {
    parts.push("naturally elongated eye shape preserved");
  } else if (analysis.eyeOpenness === "크게 뜸") {
    parts.push("natural round eye shape preserved");
  }

  // 쌍꺼풀
  if (analysis.doubleEyelidPresence.includes("없음")) {
    parts.push("monolid eyes preserved");
  } else if (analysis.doubleEyelidPresence.includes("있음")) {
    parts.push("double eyelid preserved");
  }

  return parts.join(", ");
}

// ─── 턱선 특화 프롬프트 ─────────────────────

function buildJawlinePrompt(analysis: BeautyAnalysisResult): string {
  if (analysis.jawlineType.includes("V라인")) {
    return "V-line jawline preserved, sharp chin definition";
  }
  if (analysis.jawlineType.includes("각진형")) {
    return "angular jawline preserved, defined jaw structure";
  }
  if (analysis.jawlineType.includes("둥근형")) {
    return "round jawline preserved, soft chin contour";
  }
  return "natural jawline preserved";
}

// ─── 특이사항 자동 감지 프롬프트 ─────────────────────

function buildDistinctiveFeatures(analysis: BeautyAnalysisResult): string {
  const parts: string[] = [];

  // 안경
  if (analysis.hasGlasses) {
    parts.push(
      `wearing ${analysis.glassesStyle} glasses exactly as original`,
      "glasses frame preserved completely",
      "face visible through glasses"
    );
  } else {
    parts.push("no glasses, clear face");
  }

  // 수염
  if (analysis.hasBear) {
    parts.push(
      `${analysis.bearStyle} beard preserved exactly`,
      "facial hair maintained"
    );
  } else {
    parts.push("(clean-shaven, no beard:1.8)");
  }

  // 특이한 표시
  if (analysis.hasDistinctiveMarks && analysis.distinctiveMarksDescription) {
    parts.push(`${analysis.distinctiveMarksDescription} preserved`);
  }

  return parts.filter(Boolean).join(", ");
}

// ─── 헤어 프롬프트 ─────────────────────

function buildHairPrompt(analysis: BeautyAnalysisResult): string {
  return [
    `(${analysis.hairStyle}:1.3)`,
    `${analysis.hairColor} hair`,
    `${analysis.hairLength} length`,
    `${analysis.hairTexture} texture`,
    "natural flyaway hair strands",
    "realistic hair texture",
    "individual hair strands visible",
    "NOT perfect hair, natural hair movement",
    analysis.hairDescription,
  ].filter(Boolean).join(", ");
}

// ─── 통합 포지티브 프롬프트 빌더 ─────────────────────

function buildBeautyPrompt(analysis: BeautyAnalysisResult): string {
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

  // 얼굴 유사도 최우선
  const faceLikeness = buildFaceLikenessCore();

  // 연령대별 피부
  const agePrompt = buildAgeAppropriatePrompt(analysis.estimatedAge, analysis.skinAgingFeatures);

  // 눈 특화
  const eyePrompt = buildEyePrompt(analysis);

  // 턱선 특화
  const jawlinePrompt = buildJawlinePrompt(analysis);

  // 특이사항
  const distinctiveFeatures = buildDistinctiveFeatures(analysis);

  // 헤어
  const hairPrompt = buildHairPrompt(analysis);

  // 표정
  const expression = BEAUTY_EXPRESSION_VARIANTS[analysis.expressionVariant];

  // 조명
  const lighting = [
    `${analysis.lightingType} ${analysis.lightingDirection}`,
    "natural shadow definition",
    "soft box diffused",
  ].join(", ");

  // 최종 조합
  const parts = [
    faceLikeness,
    agePrompt,
    eyePrompt,
    jawlinePrompt,
    distinctiveFeatures,
    hairPrompt,
    expression,
    lighting,
    realism,
    camera,
    analysis.faceFeatureDetails,
  ];

  return parts
    .filter(Boolean)
    .join(", ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── 통합 네거티브 프롬프트 빌더 ─────────────────────

function buildBeautyNegative(analysis: BeautyAnalysisResult): string {
  // 얼굴 유사도 최우선 (공통)
  const faceLikeness = buildFaceLikenessNegative();

  // 기본 네거티브
  const base = [
    "(illustration:1.9), (digital art:1.9), (painting:1.8), (anime:1.9), (cartoon:1.9)",
    "(AI generated look:1.7), (CGI:1.7), (3D render:1.7)",
    "(plastic skin:1.9), (airbrushed skin:1.9), (smooth poreless skin:1.8)",
    "(wax skin:1.8), (beauty filter:1.8), (instagram filter:1.7)",
    "(perfect flawless skin:1.7), (no pores:1.7)",
    "(over-smoothed:1.8), (porcelain skin:1.7)",
    "(over-handsome:1.7), (over-beautified face:1.7)",
    "(wrong nose shape:1.8), (wrong eye shape:1.7)",
    "(idealized features:1.6), (k-pop idol face:1.6)",
    "(stiff pose:1.5), (frontal symmetrical pose:1.5)",
    "(standing at attention:1.5), (mannequin pose:1.5)",
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

  // 연령대별 추가 네거티브
  const age = parseInt(analysis.estimatedAge) || 30;
  if (age >= 50) {
    base.push(
      "(younger looking:1.9)",
      "(de-aged:1.9)",
      "(smooth youthful skin:1.8)"
    );
  }

  // 안경 관련
  if (analysis.hasGlasses) {
    base.push(
      "(removed glasses:1.9), (no glasses:1.9)",
      "(wrong glasses style:1.7)",
      "(face distorted by glasses:1.6)"
    );
  } else {
    base.push("(wearing glasses when shouldn't:1.8)");
  }

  // 수염 관련
  if (analysis.hasBear) {
    base.push("(removed beard:1.8), (clean shaven when should have beard:1.8)");
  } else {
    base.push("(unexpected beard:1.8), (facial hair when shouldn't have:1.8)");
  }

  return [faceLikeness, base.join(", ")].join(", ");
}

// ─── Beauty 전용 Mock 데이터 (API 실패 시 fallback) ─────

function getBeautyMockResult(expressionVariantOverride?: number): BeautyAnalysisResult {
  const expressionVariant = expressionVariantOverride !== undefined
    ? expressionVariantOverride
    : Math.floor(Math.random() * BEAUTY_EXPRESSION_VARIANTS.length);

  const result: BeautyAnalysisResult = {
    estimatedAge: "30",
    skinTone: "warm beige",
    skinTexture: "natural pores visible",
    faceShape: "oval",
    jawlineType: "둥근형",
    jawlineDescription: "soft round jawline",
    eyeShape: "almond",
    eyeSize: "중간",
    eyeOpenness: "자연스러움",
    doubleEyelidPresence: "쌍꺼풀 있음",
    eyeColorDescription: "dark brown",
    noseShape: "보통",
    noseWidth: "보통",
    noseDescription: "natural nose bridge",
    lipShape: "보통",
    lipColor: "natural pink",
    lipDescription: "medium lips",
    hasGlasses: false,
    glassesStyle: "none",
    glassesDescription: "no glasses",
    hasBear: false,
    bearStyle: "none",
    bearDescription: "clean-shaven",
    hasDistinctiveMarks: false,
    distinctiveMarksDescription: "none",
    hairStyle: "shoulder-length natural hair",
    hairColor: "deep black",
    hairLength: "중간",
    hairTexture: "직모",
    hairDescription: "natural hair texture",
    pose: "slight body turn, relaxed standing",
    gaze: "looking slightly off-camera",
    expression: "genuine smile",
    makeupLevel: "light natural",
    lightingType: "outdoor natural",
    lightingDirection: "upper left sunlight",
    shadowPresence: "soft natural shadow",
    background: "natural environment",
    outfit: "casual elegant outfit",
    mood: "natural elegant",
    skinAgingFeatures: "none",
    visibleWrinkles: "없음",
    skinCondition: "맑음",
    faceFeatureDetails: "natural nose bridge, medium lips, soft jawline",
    expressionVariant,
    generatedPrompt: "",
    generatedNegative: "",
  };

  result.generatedPrompt = buildBeautyPrompt(result);
  result.generatedNegative = buildBeautyNegative(result);

  return result;
}

// ─── Claude Vision 분석 함수 (v2.0 확장) ─────────────────────

export async function analyzeBeautyImage(
  imageBase64: string,
  mimeType: string
): Promise<BeautyAnalysisResult> {
  const client = new Anthropic();

  const systemPrompt = `당신은 전문 포토그래퍼 및 뷰티 분석가입니다.
고객의 사진을 분석하여 다음을 정확히 파악하세요:

[필수 분석 항목]
1. 얼굴 형태: 계란형, 둥근형, 각진형, 역삼각형 중 선택
2. 턱선: 둥근형, V라인, 각진형 중 선택
3. 눈 크기: 크음, 중간, 작음
4. 눈 모양: 크고 둥근, 가늘고 긴, 일반형
5. 눈 뜨는 정도: 크게 뜸, 자연스러움, 가늘게 뜸
6. 쌍꺼풀: 있음/없음
7. 코 높이: 높음, 보통, 낮음
8. 코 넓이: 좁음, 보통, 넓음
9. 입 모양: 두꺼움, 보통, 얇음
10. 안경: 있음/없음 (있으면 프레임 스타일 설명)
11. 수염: 있음/없음 (있으면 스타일 설명)
12. 특이한 표시: 점, 흉터, 주근깨 등
13. 헤어: 색상, 길이(초단발/단발/중간/롱/매우 긴), 질감(직모/웨이브/곱슬머리)
14. 피부 상태: 맑음, 여드름, 흉터, 기타
15. 주름: 없음, 미세, 보통, 뚜렷함
16. 추정 나이: 정확한 연령대

[응답 형식]
JSON으로 다음 필드를 포함하여 응답:
{
  "estimatedAge": "30",
  "skinTone": "따뜻한 베이지",
  "skinTexture": "자연스러운 모공",
  "faceShape": "계란형",
  "jawlineType": "둥근형",
  "jawlineDescription": "부드러운 턱선",
  "eyeShape": "아몬드형",
  "eyeSize": "중간",
  "eyeOpenness": "자연스러움",
  "doubleEyelidPresence": "쌍꺼풀 있음",
  "eyeColorDescription": "어두운 갈색",
  "noseShape": "보통",
  "noseWidth": "보통",
  "noseDescription": "자연스러운 콧대",
  "lipShape": "보통",
  "lipColor": "자연스러운 핑크",
  "lipDescription": "중간 두께 입술",
  "hasGlasses": false,
  "glassesStyle": "없음",
  "glassesDescription": "안경 없음",
  "hasBear": false,
  "bearStyle": "없음",
  "bearDescription": "면도된 상태",
  "hasDistinctiveMarks": false,
  "distinctiveMarksDescription": "없음",
  "hairStyle": "어깨길이 자연스러운 머리",
  "hairColor": "검은색",
  "hairLength": "중간",
  "hairTexture": "직모",
  "hairDescription": "자연스러운 머리결",
  "skinAgingFeatures": "없음",
  "visibleWrinkles": "없음",
  "skinCondition": "맑음",
  "faceFeatureDetails": "자연스러운 콧대, 중간 입술, 부드러운 턱선"
}`;

  const userPrompt = `이 사진을 분석해주세요. 위의 모든 필수 분석 항목을 포함하여 JSON으로 응답해주세요.`;

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-1-20250805",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: userPrompt,
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return getBeautyMockResult();
    }

    // JSON 추출
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return getBeautyMockResult();
    }

    const analysisData = JSON.parse(jsonMatch[0]);

    // 기본값 설정
    const result: BeautyAnalysisResult = {
      estimatedAge: analysisData.estimatedAge || "30",
      skinTone: analysisData.skinTone || "따뜻한 톤",
      skinTexture: analysisData.skinTexture || "자연스러운 모공",
      faceShape: analysisData.faceShape || "계란형",
      jawlineType: analysisData.jawlineType || "둥근형",
      jawlineDescription: analysisData.jawlineDescription || "자연스러운 턱선",
      eyeShape: analysisData.eyeShape || "아몬드형",
      eyeSize: analysisData.eyeSize || "중간",
      eyeOpenness: analysisData.eyeOpenness || "자연스러움",
      doubleEyelidPresence: analysisData.doubleEyelidPresence || "쌍꺼풀 있음",
      eyeColorDescription: analysisData.eyeColorDescription || "갈색",
      noseShape: analysisData.noseShape || "보통",
      noseWidth: analysisData.noseWidth || "보통",
      noseDescription: analysisData.noseDescription || "자연스러운 코",
      lipShape: analysisData.lipShape || "보통",
      lipColor: analysisData.lipColor || "자연스러운 핑크",
      lipDescription: analysisData.lipDescription || "중간 입술",
      hasGlasses: analysisData.hasGlasses || false,
      glassesStyle: analysisData.glassesStyle || "없음",
      glassesDescription: analysisData.glassesDescription || "안경 없음",
      hasBear: analysisData.hasBear || false,
      bearStyle: analysisData.bearStyle || "없음",
      bearDescription: analysisData.bearDescription || "면도된 상태",
      hasDistinctiveMarks: analysisData.hasDistinctiveMarks || false,
      distinctiveMarksDescription: analysisData.distinctiveMarksDescription || "없음",
      hairStyle: analysisData.hairStyle || "자연스러운 머리",
      hairColor: analysisData.hairColor || "검은색",
      hairLength: analysisData.hairLength || "중간",
      hairTexture: analysisData.hairTexture || "직모",
      hairDescription: analysisData.hairDescription || "자연스러운 머리결",
      pose: "slight body turn, relaxed standing",
      gaze: "looking slightly off-camera",
      expression: "genuine smile",
      makeupLevel: "light natural",
      lightingType: "outdoor natural",
      lightingDirection: "upper left sunlight",
      shadowPresence: "soft natural shadow",
      background: "natural environment",
      outfit: "casual elegant outfit",
      mood: "natural elegant",
      skinAgingFeatures: analysisData.skinAgingFeatures || "없음",
      visibleWrinkles: analysisData.visibleWrinkles || "없음",
      skinCondition: analysisData.skinCondition || "맑음",
      faceFeatureDetails: analysisData.faceFeatureDetails || "자연스러운 얼굴",
      expressionVariant: Math.floor(Math.random() * BEAUTY_EXPRESSION_VARIANTS.length),
      generatedPrompt: "",
      generatedNegative: "",
    };

    // 프롬프트 생성
    result.generatedPrompt = buildBeautyPrompt(result);
    result.generatedNegative = buildBeautyNegative(result);

    return result;
  } catch (error) {
    console.error("[beauty-analyzer] Claude Vision 분석 실패:", error);
    return getBeautyMockResult();
  }
}
