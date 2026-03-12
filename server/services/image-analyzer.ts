import Anthropic from "@anthropic-ai/sdk";

export interface AnalysisResult {
  prompt: string;
  negativePrompt: string;
  analysis: {
    camera: string;
    lighting: string;
    skin: string;
    outfit: string;
    pose: string;
    expression: string;
    background: string;
    mood: string;
    movement: string;
    space: string;
    time: string;
    optical: string;
    composition: string;
    colorGrade: string;
    innerState: string;
  };
}

const ANALYSIS_PROMPT = `이 사진을 전문 사진작가와 AI 프롬프트 엔지니어의 시각으로 분석해줘.

아래 15가지 카테고리를 전부 분석해서 AI 이미지 생성에 최적화된 영어 프롬프트 키워드로 변환해줘.

**CRITICAL: outfit과 background는 반드시 프롬프트의 최상단에 명시되어야 함!**

1. camera: 카메라 바디, 렌즈(mm), 조리개(f값), 촬영거리, 아웃포커싱 정도
2. lighting: 조명 유형, 방향, 색온도(K), 그림자 방향, 대비
3. skin: 피부톤, 색감, 혈색, 질감, 윤기, 모공, 핏줄
4. outfit: 의상 종류, 소재, 색상, 액세서리, 디테일 [최우선]
5. pose: 전체 자세, 몸 방향, 손 위치, 제스처
6. expression: 표정, 눈빛, 시선 방향, 얼굴 방향
7. background: 배경 종류, 색상, 거리감, 전경 요소 [최우선]
8. mood: 전체 분위기, 감성, 스타일
9. movement: 정지/동적, 바람, 드레스/머리 움직임
10. space: 공간감, 깊이감, 전/중/후경 레이어
11. time: 계절, 날씨, 시간대
12. optical: 렌즈플레어, 색수차, 비네팅, 보케 모양
13. composition: 피사체 위치, 황금비율, 헤드룸, 여백
14. colorGrade: 색보정 스타일, 채도, 명도, LUT 느낌
15. innerState: 인물 내면 감정, 심리적 분위기, 생동감

JSON만 응답 (다른 텍스트 없이):
{
  "analysis": {
    "camera": "영어 키워드",
    "lighting": "영어 키워드",
    "skin": "영어 키워드",
    "outfit": "영어 키워드",
    "pose": "영어 키워드",
    "expression": "영어 키워드",
    "background": "영어 키워드",
    "mood": "영어 키워드",
    "movement": "영어 키워드",
    "space": "영어 키워드",
    "time": "영어 키워드",
    "optical": "영어 키워드",
    "composition": "영어 키워드",
    "colorGrade": "영어 키워드",
    "innerState": "영어 키워드"
  },
  "prompt": "15가지 통합 영어 프롬프트 300단어 이내. CRITICAL: outfit과 background는 반드시 처음에 명시되어야 함!",
  "negativePrompt": "피해야 할 요소들 150단어 이내. 포함: 다른 의류, 다른 배경, 다른 조명, 다른 색상"
}`;

function parseResponse(text: string): AnalysisResult {
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("JSON 파싱 실패: 응답에서 JSON을 찾을 수 없습니다");
  const parsed = JSON.parse(match[0]);
  return {
    prompt: parsed.prompt || "",
    negativePrompt: parsed.negativePrompt || "",
    analysis: parsed.analysis || {},
  };
}

/**
 * URL 이미지를 다운로드해서 base64로 변환 후 Claude로 분석
 */
async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`이미지 다운로드 실패: ${res.status}`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return {
    base64: buffer.toString("base64"),
    mimeType: contentType.split(";")[0],
  };
}

/**
 * Anthropic Claude로 이미지 분석 (ANTHROPIC_API_KEY 사용)
 */
async function analyzeWithClaude(
  base64Data: string,
  mimeType: string
): Promise<AnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다");

  const client = new Anthropic({ apiKey });
  const clean = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as "image/jpeg" | "image/png" | "image/webp",
              data: clean,
            },
          },
          { type: "text", text: ANALYSIS_PROMPT },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return parseResponse(text);
}

/**
 * Gemini로 이미지 분석 (GEMINI_API_KEY 사용, Anthropic 실패 시 폴백)
 */
async function analyzeWithGemini(
  base64Data: string,
  mimeType: string
): Promise<AnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다");

  const clean = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: clean,
                },
              },
              { text: ANALYSIS_PROMPT },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 4000,
        },
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gemini API 실패 (${response.status}): ${detail}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return parseResponse(text);
}

/**
 * Claude → Gemini 폴백 순서로 이미지 분석
 */
async function analyzeImage(base64Data: string, mimeType: string): Promise<AnalysisResult> {
  // 1차: Anthropic Claude
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await analyzeWithClaude(base64Data, mimeType);
    } catch (err: any) {
      console.warn(`[image-analyzer] Claude 분석 실패: ${err.message?.slice(0, 100)} → Gemini 폴백`);
    }
  }

  // 2차: Google Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      return await analyzeWithGemini(base64Data, mimeType);
    } catch (err: any) {
      console.warn(`[image-analyzer] Gemini 분석 실패: ${err.message?.slice(0, 100)}`);
    }
  }

  throw new Error("이미지 분석 불가: ANTHROPIC_API_KEY 또는 GEMINI_API_KEY가 필요합니다");
}

export async function analyzeImageToPrompt(imageUrl: string): Promise<AnalysisResult> {
  try {
    const { base64, mimeType } = await fetchImageAsBase64(imageUrl);
    return await analyzeImage(base64, mimeType);
  } catch (err: any) {
    throw new Error(`이미지 분석 실패: ${err.message}`);
  }
}

export async function analyzeBase64ImageToPrompt(
  base64Data: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg"
): Promise<AnalysisResult> {
  try {
    return await analyzeImage(base64Data, mimeType);
  } catch (err: any) {
    throw new Error(`이미지 분석 실패: ${err.message}`);
  }
}
