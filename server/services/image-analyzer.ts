import { invokeLLM } from "../_core/llm";

// ─────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────
export interface AnalysisResult {
  prompt: string;
  negativePrompt: string;
  analysis: {
    // 1순위 그룹 — 얼굴
    faceFeatures: string;      // 이목구비 특징, 얼굴형, 이미지 고유성

    // 2순위 그룹 — 피부
    skin: string;              // 피부톤, 색감(웜/쿨), 혈색, 질감, 모공, 핏줄, 윤기

    // 3순위 그룹 — 조명
    lighting: string;          // 조명 유형, 방향, 색온도(K), 그림자, 대비

    // 4순위 그룹 — 표정/눈빛
    expression: string;        // 표정, 눈빛, 시선 방향, 얼굴 방향, 내면 감정

    // 5순위 그룹 — 카메라/렌즈
    camera: string;            // 카메라 바디, 렌즈(mm), f값, 촬영 거리, 보케

    // 6순위 그룹 — 분위기/색보정
    mood: string;              // 전체 무드, 감성, 스타일
    colorGrade: string;        // 색보정 스타일, 채도, LUT 느낌

    // 7순위 그룹 — 의상/액세서리
    outfit: string;            // 의상 종류, 소재, 색상, 액세서리, 디테일

    // 8순위 그룹 — 포즈/제스처
    pose: string;              // 자세, 몸 방향, 손 위치, 제스처

    // 9순위 그룹 — 배경/공간/시간
    background: string;        // 배경 종류, 색상, 거리감
    space: string;             // 공간감, 깊이감, 전/중/후경
    time: string;              // 계절, 날씨, 시간대

    // 10순위 그룹 — 헤어 (마지막, 약하게)
    hairSimple: string;        // 핵심 2~3단어만: 색상 + 길이 + 스타일
    hairNegative: string;      // 이 헤어와 반대되는 요소들 (영어 키워드)

    // 광학/구도 (보조)
    optical: string;           // 렌즈플레어, 색수차, 비네팅, 보케 모양
    composition: string;       // 피사체 위치, 황금비율, 헤드룸
  };
}

// ─────────────────────────────────────────────────────
// Vision 분석 프롬프트
// ─────────────────────────────────────────────────────
const ANALYSIS_PROMPT = `당신은 전문 사진작가 + AI 프롬프트 엔지니어 + 20년 경력 뷰티 전문가입니다.
이 사진을 아래 순서와 원칙으로 정밀 분석하세요.

[분석 우선순위 원칙]

1. faceFeatures: 이 사람만의 고유한 이목구비 특징 (눈 모양, 코 라인, 입술, 턱선, 얼굴형)
2. skin: 피부톤(웜/쿨/뉴트럴), 색감, 혈색, 질감, 모공, 핏줄, 윤기, 투명도
3. lighting: 조명 유형(자연광/인공광), 방향(좌/우/위/역광), 색온도(K), 그림자 방향, 대비
4. expression: 표정, 눈빛 강도, 시선 방향, 얼굴 각도, 감정 상태
5. camera: 카메라 바디, 렌즈(mm 추정), 조리개(f값 추정), 촬영 거리, 아웃포커싱 정도
6. mood: 전체 분위기, 감성, 사진 스타일 (editorial/romantic/dramatic 등)
7. colorGrade: 색보정 스타일, 채도 수준, 하이라이트/섀도우 처리, LUT 느낌
8. outfit: 의상 종류, 소재 질감, 색상, 주요 액세서리 디테일
9. pose: 전체 자세, 몸 방향, 손 위치, 제스처, 체중 분배
10. background: 배경 종류, 주요 색상, 배경과의 거리감
11. space: 공간감, 깊이감, 전/중/후경 레이어
12. time: 계절, 날씨, 시간대 (골든아워/블루아워/정오 등)
13. hairSimple: 헤어의 핵심만 — 색상 + 길이 + 스타일 3단어 이내로
14. hairNegative: hairSimple과 반대되는 헤어 요소들 (영어 키워드)
15. optical: 렌즈플레어, 색수차, 비네팅, 보케 형태
16. composition: 피사체 위치(3분할/중앙), 헤드룸, 여백 방향

[중요 규칙]

- 모든 분석은 영어 키워드로 변환
- hairSimple은 반드시 3단어 이내 (예: "long black hair", "brown wavy bob")
- faceFeatures는 이 사람만의 고유 특징을 구체적으로 (예: "almond shaped eyes, high cheekbones, soft jawline")
- 추정이 어려운 항목은 빈 문자열로

JSON만 응답 (마크다운 없이, 다른 텍스트 없이):
{
  "analysis": {
    "faceFeatures": "",
    "skin": "",
    "lighting": "",
    "expression": "",
    "camera": "",
    "mood": "",
    "colorGrade": "",
    "outfit": "",
    "pose": "",
    "background": "",
    "space": "",
    "time": "",
    "hairSimple": "",
    "hairNegative": "",
    "optical": "",
    "composition": ""
  }
}`;

// ─────────────────────────────────────────────────────
// 핵심 함수: 최강 우선순위 프롬프트 조립
// ─────────────────────────────────────────────────────
export function buildFinalPrompt(result: AnalysisResult): {
  prompt: string;
  negativePrompt: string;
} {
  const a = result.analysis;

  // ══════════════════════════════════════════
  // POSITIVE PROMPT — 10단계 우선순위
  // ══════════════════════════════════════════

  // ── 1순위: 얼굴 일관성 — 절대 최강 ──────────────
  // AI가 가장 먼저 읽는 자리 = 가장 강하게 반영
  const tier1_face = [
    "(face consistency:1.5)",
    "(same person:1.4)",
    "(identical facial features:1.4)",
    a.faceFeatures ? `(${a.faceFeatures}:1.3)` : "",
  ]
    .filter(Boolean)
    .join(", ");

  // ── 2순위: 피부 — ONE AI STUDIO 핵심 차별점 ─────
  // 뷰티 20년 전문가 심미안의 핵심
  const tier2_skin = a.skin
    ? `(${a.skin}:1.2), skin pores visible, natural skin texture, subsurface scattering`
    : "skin pores visible, natural skin texture, subsurface scattering";

  // ── 3순위: 조명 — 분위기 전체를 지배 ────────────
  // 조명이 틀리면 피부도 의미 없음
  const tier3_lighting = a.lighting
    ? `${a.lighting}, catch light in eyes, natural shadow direction`
    : "natural lighting, catch light in eyes";

  // ── 4순위: 표정/눈빛 — 감성과 생동감 ────────────
  // 고객이 "나다" 느끼는 두 번째 요소
  const tier4_expression = a.expression
    ? `${a.expression}, ${a.time ? a.time : ""}`
    : "";

  // ── 5순위: 카메라/렌즈 — 하이엔드 품질 결정 ─────
  const tier5_camera = a.camera
    ? `${a.camera}, ${a.optical ? a.optical : "natural optical bokeh"}, ${a.composition ? a.composition : ""}`
    : "85mm portrait lens, f/1.4, natural optical bokeh";

  // ── 6순위: 분위기 + 색보정 — 전체 무드 ──────────
  const tier6_mood = [a.mood, a.colorGrade, a.space]
    .filter(Boolean)
    .join(", ");

  // ── 7순위: 의상/액세서리 ─────────────────────────
  const tier7_outfit = a.outfit || "";

  // ── 8순위: 포즈/제스처 ───────────────────────────
  // 손은 어차피 Inpaint 교정 → 낮은 우선순위
  const tier8_pose = a.pose
    ? `${a.pose}, bouquet held naturally covering hands`
    : "natural pose, bouquet held naturally";

  // ── 9순위: 배경 ───────────────────────────────────
  // 배경은 매번 달라도 고객 불만 없음
  const tier9_background = a.background || "";

  // ── 10순위: 헤어 — 맨 마지막, 가장 약하게 ────────
  // 웨딩 때 어차피 업스타일로 바뀜
  // 얼굴 일관성 절대 해치지 않도록 0.7로 낮춤
  const tier10_hair = a.hairSimple ? `(${a.hairSimple}:0.7)` : "";

  // ── 품질 고정 태그 (항상 마지막) ─────────────────
  const qualityTags = [
    "photorealistic",
    "8K ultra detail",
    "RAW photo",
    "film grain ISO 400",
    "editorial photography",
    "Fujifilm GFX100S medium format",
  ].join(", ");

  // ── 최종 조립 ─────────────────────────────────────
  const finalPrompt = [
    tier1_face, // 1: 얼굴 (절대 최강)
    tier2_skin, // 2: 피부
    tier3_lighting, // 3: 조명
    tier4_expression, // 4: 표정/눈빛
    tier5_camera, // 5: 카메라/렌즈
    tier6_mood, // 6: 분위기/색보정
    tier7_outfit, // 7: 의상
    tier8_pose, // 8: 포즈
    tier9_background, // 9: 배경
    tier10_hair, // 10: 헤어 (최하위, 0.7)
    qualityTags, // 품질 고정
  ]
    .filter(Boolean)
    .join(", ");

  // ══════════════════════════════════════════
  // NEGATIVE PROMPT — 5단계 방어 레이어
  // ══════════════════════════════════════════

  // ── 레이어 1: 얼굴/신원 방어 (최강) ─────────────
  const neg_face = [
    "(different person:1.6)",
    "(face swap:1.5)",
    "(wrong face:1.5)",
    "(inconsistent face:1.4)",
    "(merged faces:1.5)",
  ].join(", ");

  // ── 레이어 2: 피부 품질 방어 ─────────────────────
  const neg_skin = [
    "(plastic skin:1.5)",
    "(smooth skin:1.4)",
    "(airbrushed:1.4)",
    "(porcelain skin:1.3)",
    "(wax skin:1.4)",
    "(artificial skin:1.4)",
  ].join(", ");

  // ── 레이어 3: 해부학적 오류 방어 ─────────────────
  const neg_anatomy = [
    "(mutated hands:1.5)",
    "(merged fingers:1.5)",
    "(extra fingers:1.5)",
    "(bad hands:1.4)",
    "(bad teeth:1.4)",
    "(merged teeth:1.3)",
  ].join(", ");

  // ── 레이어 4: 광학/스타일 오류 방어 ─────────────
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
    "(overexposed:1.3)",
    "(flat lighting:1.3)",
    "(deformed:1.4)",
  ].join(", ");

  // ── 레이어 5: 헤어 방어 (반대 요소) ─────────────
  const neg_hair = a.hairNegative || "";

  // ── 네거티브 최종 조립 ────────────────────────────
  const finalNegative = [neg_face, neg_skin, neg_anatomy, neg_quality, neg_hair]
    .filter(Boolean)
    .join(", ");

  return {
    prompt: finalPrompt,
    negativePrompt: finalNegative,
  };
}

// ─────────────────────────────────────────────────────
// JSON 파싱 헬퍼
// ─────────────────────────────────────────────────────
function parseAnalysisResponse(text: string): AnalysisResult["analysis"] {
  const cleaned = text.replace(/`json/g, "").replace(/`/g, "").trim();
  const match = cleaned.match(/{[\s\S]*}/);
  if (!match) throw new Error("AI 분석 결과를 파싱할 수 없습니다");
  const parsed = JSON.parse(match[0]);
  return parsed.analysis || {};
}

// ─────────────────────────────────────────────────────
// 메인 분석 함수 — URL 버전
// ─────────────────────────────────────────────────────
export async function analyzeImageToPrompt(
  imageUrl: string
): Promise<AnalysisResult> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "high" },
            },
            {
              type: "text",
              text: ANALYSIS_PROMPT,
            },
          ],
        },
      ],
    });

    const rawContent = response.choices?.[0]?.message?.content || "";
    const text = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    const analysis = parseAnalysisResponse(text);

    const rawResult: AnalysisResult = {
      prompt: "",
      negativePrompt: "",
      analysis: analysis as AnalysisResult["analysis"],
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
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    const response = await invokeLLM({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "high" },
            },
            {
              type: "text",
              text: ANALYSIS_PROMPT,
            },
          ],
        },
      ],
    });

    const rawContent = response.choices?.[0]?.message?.content || "";
    const text = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    const analysis = parseAnalysisResponse(text);

    const rawResult: AnalysisResult = {
      prompt: "",
      negativePrompt: "",
      analysis: analysis as AnalysisResult["analysis"],
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
