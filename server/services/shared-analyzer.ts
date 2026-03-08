import Anthropic from "@anthropic-ai/sdk";

export interface SharedAnalysisResult {
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
  generatedPrompt: string;
  generatedNegative: string;
}

export async function analyzeImageWithClaude(
  base64: string,
  mimeType: string,
  mode: "beauty" | "couple" | "wedding"
): Promise<SharedAnalysisResult> {
  console.log("[shared-analyzer] Claude Vision 호출 시작, mode:", mode);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1500,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/webp", data: clean },
        },
        {
          type: "text",
          text: `사진을 분석해서 JSON만 반환해. 다른 텍스트 없이:
{
  "skinTone": "피부톤 영어",
  "skinTexture": "피부결 영어",
  "faceShape": "얼굴형 영어",
  "eyeShape": "눈 모양 영어",
  "hasGlasses": true or false,
  "glassesStyle": "안경 스타일 또는 none",
  "hasBeard": true or false,
  "beardStyle": "수염 스타일 또는 none",
  "hairStyle": "헤어스타일 영어",
  "hairColor": "헤어 색상 영어",
  "pose": "포즈 영어",
  "gaze": "시선 영어",
  "expression": "표정 영어",
  "makeupLevel": "메이크업 정도 영어",
  "lightingType": "outdoor natural 또는 indoor studio 또는 mixed",
  "lightingDirection": "조명 방향 영어",
  "shadowPresence": "그림자 영어",
  "background": "배경 영어",
  "outfit": "의상 영어",
  "mood": "분위기 영어"
}`,
        },
      ],
    }],
  });

  console.log("[shared-analyzer] Claude Vision 응답 받음");

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("분석 결과 파싱 실패: " + text.slice(0, 200));

  const raw = JSON.parse(jsonMatch[0]);
  console.log("[shared-analyzer] 파싱 완료:", raw.skinTone, raw.lightingType);

  const result: SharedAnalysisResult = {
    skinTone: raw.skinTone || "warm beige",
    skinTexture: raw.skinTexture || "natural pores visible",
    faceShape: raw.faceShape || "oval",
    eyeShape: raw.eyeShape || "almond",
    hasGlasses: raw.hasGlasses || false,
    glassesStyle: raw.glassesStyle || "none",
    hasBear: raw.hasBeard || false,
    bearStyle: raw.beardStyle || "none",
    hairStyle: raw.hairStyle || "natural hair",
    hairColor: raw.hairColor || "black",
    pose: raw.pose || "natural relaxed pose",
    gaze: raw.gaze || "looking slightly off-camera",
    expression: raw.expression || "genuine smile",
    makeupLevel: raw.makeupLevel || "light natural",
    lightingType: raw.lightingType || "outdoor natural",
    lightingDirection: raw.lightingDirection || "upper left sunlight",
    shadowPresence: raw.shadowPresence || "soft natural shadow",
    background: raw.background || "natural environment",
    outfit: raw.outfit || "casual outfit",
    mood: raw.mood || "natural elegant",
    generatedPrompt: "",
    generatedNegative: "",
  };

  result.generatedPrompt = buildPrompt(result, mode);
  result.generatedNegative = buildNegative();

  return result;
}

function buildPrompt(a: SharedAnalysisResult, mode: "beauty" | "couple" | "wedding"): string {
  const camera = "shot on Canon EOS R5, 85mm f/2.8, RAW photo, photorealistic, 8K";

  const realism = "skin pores visible, natural skin texture, subsurface scattering, film grain ISO 400, NOT illustration, NOT digital art, NOT AI generated";

  const skinFace = [
    `${a.skinTone}`,
    `${a.skinTexture}`,
    `${a.faceShape} face`,
    `${a.eyeShape} eyes`,
    a.hasGlasses ? `wearing ${a.glassesStyle} glasses, glasses preserved` : "",
    a.hasBear ? `${a.bearStyle} beard preserved` : "",
    `${a.hairStyle}`,
  ].filter(Boolean).join(", ");

  const poseExpression = [
    `${a.pose}`,
    "slight body turn 15 degrees",
    "relaxed shoulders",
    `${a.expression}`,
    `${a.gaze}`,
    "candid natural moment",
    "weight shifted to one leg",
  ].join(", ");

  const lighting = buildLighting(a);

  const background = `${a.background}, background slightly visible f/2.8, NOT completely blurred, environmental context visible`;

  const modeExtra = {
    beauty: `${a.makeupLevel}, Korean beauty model, professional beauty photography`,
    couple: `${a.mood} atmosphere, romantic couple, professional wedding photography`,
    wedding: `wedding attire, ${a.mood} wedding, Korean wedding style`,
  }[mode];

  return [camera, realism, skinFace, poseExpression, lighting, background, modeExtra]
    .filter(Boolean).join(", ")
    .replace(/,\s*,/g, ",").replace(/\s+/g, " ").trim();
}

function buildLighting(a: SharedAnalysisResult): string {
  if (a.lightingType.includes("outdoor")) {
    return `outdoor ${a.lightingDirection}, hard sunlight casting natural shadows, sun catchlight in eyes, ${a.shadowPresence}, ambient occlusion under nose and chin, natural color temperature 5500K`;
  }
  if (a.lightingType.includes("studio")) {
    return `studio ${a.lightingDirection}, Rembrandt lighting triangle on cheek, visible key light in eyes, fill light ratio 3:1, hard shadow on background, specular highlight on nose, defined shadow under jaw`;
  }
  return `indoor ${a.lightingDirection}, window light soft directional, natural shadow on one side, warm color temperature 4000K`;
}

function buildNegative(): string {
  return "(illustration:1.8), (digital art:1.8), (anime:1.8), (cartoon:1.8), (CGI:1.6), (plastic skin:1.8), (airbrushed:1.8), (smooth skin:1.6), (porcelain skin:1.6), (wax skin:1.6), (beauty filter:1.6), (no pores:1.5), (stiff pose:1.5), (frontal symmetrical pose:1.5), (standing at attention:1.5), (expressionless:1.5), (blank stare:1.5), (flat lighting:1.5), (no shadows:1.5), (completely blurred background:1.4), (extreme bokeh:1.4), watermark, text, deformed, bad anatomy, blurry, low quality";
}
