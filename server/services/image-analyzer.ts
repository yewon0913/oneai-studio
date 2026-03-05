import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

1. camera: 카메라 바디, 렌즈(mm), 조리개(f값), 촬영거리, 아웃포커싱 정도
2. lighting: 조명 유형, 방향, 색온도(K), 그림자 방향, 대비
3. skin: 피부톤, 색감, 혈색, 질감, 윤기, 모공, 핏줄
4. outfit: 의상 종류, 소재, 색상, 액세서리, 디테일
5. pose: 전체 자세, 몸 방향, 손 위치, 제스처
6. expression: 표정, 눈빛, 시선 방향, 얼굴 방향
7. background: 배경 종류, 색상, 거리감, 전경 요소
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
  "prompt": "15가지 통합 영어 프롬프트 300단어 이내",
  "negativePrompt": "피해야 할 요소들 150단어 이내"
}`;

export async function analyzeImageToPrompt(imageUrl: string): Promise<AnalysisResult> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          { type: "text", text: ANALYSIS_PROMPT }
        ]
      }]
    });
    const text = (response.content[0] as any).text || "";
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("파싱 실패");
    const parsed = JSON.parse(match[0]);
    return { prompt: parsed.prompt || "", negativePrompt: parsed.negativePrompt || "", analysis: parsed.analysis || {} };
  } catch (err: any) {
    throw new Error(`이미지 분석 실패: ${err.message}`);
  }
}

export async function analyzeBase64ImageToPrompt(
  base64Data: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg"
): Promise<AnalysisResult> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType, data: base64Data } },
          { type: "text", text: ANALYSIS_PROMPT }
        ]
      }]
    });
    const text = (response.content[0] as any).text || "";
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("파싱 실패");
    const parsed = JSON.parse(match[0]);
    return { prompt: parsed.prompt || "", negativePrompt: parsed.negativePrompt || "", analysis: parsed.analysis || {} };
  } catch (err: any) {
    throw new Error(`이미지 분석 실패: ${err.message}`);
  }
}
