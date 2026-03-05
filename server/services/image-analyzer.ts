import { invokeLLM } from "../_core/llm";

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
    hair: string;
  };
}

const ANALYSIS_PROMPT = `이 사진을 전문 사진작가와 AI 프롬프트 엔지니어의 시각으로 분석해줘.

아래 16가지 카테고리를 전부 분석해서 AI 이미지 생성에 최적화된 영어 프롬프트 키워드로 변환해줘.

### 프롬프트 생성 가중치 순서 (중요도 높은 순서):

**1순위 - 얼굴 일관성 (가중치 1.5):**
face consistency, facial features, face recognition, exact facial match, identity preservation

**2순위 - 피부/표정/조명/카메라 (가중치 1.0):**
2. skin: 피부톤, 색감, 혈색, 질감, 윤기, 모공, 핏줄
6. expression: 표정, 눈빛, 시선 방향, 얼굴 방향
2. lighting: 조명 유형, 방향, 색온도(K), 그림자 방향, 대비
1. camera: 카메라 바디, 렌즈(mm), 조리개(f값), 촬영거리, 아웃포커싱 정도

**3순위 - 헤어 (가중치 0.8):**
16. hair: 헤어스타일(업스타일/반업/다운), 길이, 직모/웨이브/컬, 헤어컬러, 앞머리 유무, 볼륨, 광택

**4순위 - 의상/포즈/배경/색보정 (가중치 0.5):**
4. outfit: 의상 종류, 소재, 색상, 액세서리, 디테일
5. pose: 전체 자세, 몸 방향, 손 위치, 제스처
7. background: 배경 종류, 색상, 거리감, 전경 요소
14. colorGrade: 색보정 스타일, 채도, 명도, LUT 느낌

**추가 분석 (프롬프트에 포함):**
8. mood: 전체 분위기, 감성, 스타일
9. movement: 정지/동적, 바람, 드레스/머리 움직임
10. space: 공간감, 깊이감, 전/중/후경 레이어
11. time: 계절, 날씨, 시간대
12. optical: 렌즈플레어, 색수차, 비네팅, 보케 모양
13. composition: 피사체 위치, 황금비율, 헤드룸, 여백
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
    "innerState": "영어 키워드",
    "hair": "영어 키워드 (예: long straight black hair, no bangs, high gloss)"
  },
  "prompt": "프롬프트 생성 순서: 1순위 face consistency(1.5) → 2순위 피부/표정/조명/카메라(1.0) → 3순위 헤어(0.8) → 4순위 의상/포즈/배경/색보정(0.5) → 추가요소. 총 300단어 이내",
  "negativePrompt": "피해야 할 요소들 150단어 이내. 헤어 분석 결과의 반대 요소를 반드시 포함할 것 (예: 직모이면 curly hair, wavy hair를 네거티브에 추가. 컬이면 straight hair를 네거티브에 추가. 업스타일이면 hair down을 네거티브에 추가. 다운이면 updo, bun을 네거티브에 추가. 앞머리 없으면 bangs를 네거티브에 추가)"
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

export async function analyzeImageToPrompt(imageUrl: string): Promise<AnalysisResult> {
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
    return parseResponse(text);
  } catch (err: any) {
    throw new Error(`이미지 분석 실패: ${err.message}`);
  }
}

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
    return parseResponse(text);
  } catch (err: any) {
    throw new Error(`이미지 분석 실패: ${err.message}`);
  }
}
