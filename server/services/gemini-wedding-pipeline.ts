/**
 * Gemini Wedding Pipeline v4.0
 * 핵심 변경: 신부/신랑 원본 이미지를 Gemini에 직접 전송
 * 배경 사진은 Claude Vision 분석 후 삭제
 */

import { buildWeddingPromptPair } from "./wedding-prompt-engine";
import sharp from "sharp";

export interface GeminiWeddingResult {
  url: string;
  log: string;
}

export interface BackgroundAnalysis {
  venueType: string;       // 야외/실내/스튜디오
  timeOfDay: string;       // 골든아워/낮/밤/석양
  lighting: string;        // 자연광/인공조명/촛불
  colorTone: string;       // 따뜻/차가움/중성
  season: string;          // 봄/여름/가을/겨울
  architectureStyle: string; // 현대/클래식/자연
  mood: string;            // 로맨틱/럭셔리/미니멀
  promptDescription: string; // 생성용 배경 묘사
}

// ─── 배경 사진 Claude Vision 분석 ───────────────────────

export async function analyzeBackground(
  base64: string,
  mimeType: string
): Promise<BackgroundAnalysis> {
  const Anthropic = await import("@anthropic-ai/sdk");
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic.default({ apiKey });
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;

  console.log("[bg-analyzer] Claude Vision으로 배경 분석 중...");

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1000,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mimeType as any, data: clean },
        },
        {
          type: "text",
          text: `이 배경 사진을 분석해서 웨딩 사진 생성용 프롬프트를 만들어줘.
JSON만 반환해. 다른 텍스트 없이:
{
  "venueType": "outdoor/indoor/studio",
  "timeOfDay": "golden hour/noon/night/sunset/morning",
  "lighting": "natural sunlight/artificial/candlelight/mixed",
  "colorTone": "warm/cool/neutral",
  "season": "spring/summer/autumn/winter",
  "architectureStyle": "modern/classic/natural/industrial/traditional Korean",
  "mood": "romantic/luxury/minimal/rustic/urban/sacred",
  "promptDescription": "웨딩 배경으로 재현할 수 있는 상세한 영어 묘사 (3-4문장, 조명/색감/분위기/건축 포함)"
}`,
        },
      ],
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("배경 분석 파싱 실패");

  const raw = JSON.parse(jsonMatch[0]);
  console.log("[bg-analyzer] 완료:", raw.venueType, raw.mood);

  return {
    venueType: raw.venueType || "outdoor",
    timeOfDay: raw.timeOfDay || "golden hour",
    lighting: raw.lighting || "natural sunlight",
    colorTone: raw.colorTone || "warm",
    season: raw.season || "spring",
    architectureStyle: raw.architectureStyle || "classic",
    mood: raw.mood || "romantic",
    promptDescription: raw.promptDescription || "Beautiful outdoor venue with warm golden light",
  };
}

// ─── 이미지 전처리: PNG→JPEG 변환 + 512x512 리사이즈 ───────────────────────

async function preprocessImageForGemini(
  base64: string,
  mimeType: string
): Promise<{ base64: string; mimeType: string }> {
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;
  const buf = Buffer.from(clean, "base64");
  // JPEG로 변환 + 512x512 리사이즈 (Gemini 요구사항)
  const jpegBuf = await sharp(buf)
    .resize(512, 512, { fit: "cover", position: "center" })
    .jpeg({ quality: 90 })
    .toBuffer();
  return { base64: jpegBuf.toString("base64"), mimeType: "image/jpeg" };
}

// ─── Gemini 이미지 직접 전송 방식 ───────────────────────

async function callGeminiWithImages(
  prompt: string,
  images: { base64: string; mimeType: string }[]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  // 이미지 전처리: PNG→JPEG 변환 + 512x512 리사이즈
  const processedImages = await Promise.all(
    images.map(img => preprocessImageForGemini(img.base64, img.mimeType))
  );
  console.log("[gemini] 이미지 전처리 완료 (JPEG 512x512)");

  // parts: 이미지들 먼저, 프롬프트 마지막
  const parts: Record<string, unknown>[] = [];

  for (const img of processedImages) {
    parts.push({
      inline_data: { mime_type: img.mimeType, data: img.base64 },
    });
  }
  parts.push({ text: prompt });

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"],
      temperature: 0.9,
      topP: 0.95,
    },
  };

  console.log("[gemini] 이미지", images.length, "장 직접 전송...");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const text = await res.text();
  console.log("[gemini] status:", res.status);
  if (!res.ok) throw new Error(`Gemini failed ${res.status}: ${text.slice(0, 300)}`);

  const data = JSON.parse(text);
  const resParts = data?.candidates?.[0]?.content?.parts ?? [];
  console.log("[gemini] parts count:", resParts.length);

  for (const p of resParts) {
    const imgData = p.inline_data || p.inlineData;
    if (imgData?.data) {
      const mime = imgData.mimeType || imgData.mime_type || "image/png";
      console.log("[gemini] 이미지 찾음, mime:", mime);
      return `data:${mime};base64,${imgData.data}`;
    }
  }

  throw new Error("Gemini returned no image");
}

// ─── 배경 분석 기반 프롬프트 빌더 ───────────────────────

function buildPromptWithBackground(
  bg: BackgroundAnalysis,
  variation: "romantic" | "luxury"
): string {

  const lightingDesc = {
    "golden hour": "warm golden hour light at 5800K, long soft shadows, sun catchlight in eyes, rim lighting from setting sun",
    "noon": "bright midday sun, crisp shadows, vibrant colors, high contrast natural light",
    "sunset": "dramatic sunset colors, amber and pink sky, silhouette-edge lighting, romantic warm glow",
    "morning": "soft morning light, cool 6000K, gentle diffused illumination, fresh dewy atmosphere",
    "night": "elegant evening ambiance, warm artificial lighting, bokeh city lights background, sophisticated atmosphere",
  }[bg.timeOfDay] || "beautiful natural lighting";

  const moodDesc = {
    "romantic": "deeply romantic and intimate, love story aesthetic",
    "luxury": "high-end luxury editorial, Vogue Korea quality, sophisticated elegance",
    "minimal": "clean minimalist beauty, understated sophistication, modern aesthetic",
    "rustic": "warm rustic charm, natural organic textures, countryside romance",
    "urban": "chic urban sophistication, contemporary city romance",
    "sacred": "sacred reverent atmosphere, timeless spiritual beauty",
  }[bg.mood] || "beautiful romantic atmosphere";

  const variationExtra = variation === "romantic"
    ? "Natural candid moment, genuine laughter, slight body turn, relaxed and joyful"
    : "Elegant poised stance, sophisticated gaze, luxury editorial pose, timeless and refined";

  return `MASTERPIECE WEDDING PHOTOGRAPH - Ultra photorealistic, award-winning Korean wedding photography.

The two people in the reference photos are the BRIDE and GROOM.
CRITICAL INSTRUCTION: Reproduce their EXACT facial features, hairstyles, and physical characteristics with 100% accuracy.
- Bride: preserve her EXACT face, hair length, hair color, eye shape, and all facial features
- Groom: preserve his EXACT face, hair, and all facial features

ATTIRE:
- Bride: elegant white Korean bridal gown, fitted bodice with delicate lace details
- Groom: classic black tuxedo with white shirt and black bow tie

BACKGROUND & VENUE:
${bg.promptDescription}
${bg.architectureStyle} style venue, ${bg.season} season atmosphere, ${bg.colorTone} color palette

LIGHTING:
${lightingDesc}

MOOD & COMPOSITION:
${moodDesc}. ${variationExtra}.
Both subjects equally in frame, professional wedding composition.

TECHNICAL QUALITY:
Shot on Canon EOS R5, 85mm f/2.0, RAW, 8K resolution.
Skin pores visible, natural skin texture, subsurface scattering, film grain ISO 200.
NOT illustration, NOT digital art, NOT AI generated look.
Professional color grading, magazine cover quality.`;
}

// ─── 메인 생성 함수 ─────────────────────────────────────

export async function generateGeminiWedding(
  brideImageBase64: string,
  brideMimeType: string,
  groomImageBase64: string,
  groomMimeType: string,
  backgroundAnalysis: BackgroundAnalysis | null,
  customPrompt?: string
): Promise<GeminiWeddingResult[]> {
  console.log("[gemini-wedding] v4.0 시작 - 원본 이미지 직접 전송 방식");

  const images = [
    { base64: brideImageBase64, mimeType: brideMimeType },
    { base64: groomImageBase64, mimeType: groomMimeType },
  ];

  // 프롬프트 결정
  let prompt1: string;
  let prompt2: string;

  if (customPrompt && customPrompt.trim().length > 50) {
    prompt1 = customPrompt;
    prompt2 = customPrompt;
  } else if (backgroundAnalysis) {
    prompt1 = buildPromptWithBackground(backgroundAnalysis, "romantic");
    prompt2 = buildPromptWithBackground(backgroundAnalysis, "luxury");
  } else {
    // 배경 없을 때 기본 프롬프트
    prompt1 = `MASTERPIECE WEDDING PHOTOGRAPH.
The two people in the reference photos are the BRIDE and GROOM.
CRITICAL: Reproduce their EXACT facial features, hairstyle, hair length, hair color with 100% accuracy.
Bride wearing elegant white wedding dress. Groom wearing classic black tuxedo.
Beautiful outdoor golden hour garden setting, warm romantic atmosphere.
Natural candid pose, genuine smiles, slight body turn.
Shot on Canon EOS R5, 85mm f/2.0, photorealistic, 8K, NOT illustration, NOT AI generated.`;

    prompt2 = `MASTERPIECE WEDDING PHOTOGRAPH.
The two people in the reference photos are the BRIDE and GROOM.
CRITICAL: Reproduce their EXACT facial features, hairstyle, hair length, hair color with 100% accuracy.
Bride wearing minimalist sleek white wedding dress. Groom wearing modern slim-fit black tuxedo.
Elegant grand ballroom interior, crystal chandeliers, luxury editorial atmosphere.
Sophisticated poised pose, elegant and refined, Vogue Korea quality.
Shot on Hasselblad X2D, 80mm f/2.8, photorealistic, 8K, NOT illustration, NOT AI generated.`;
  }

  const prompts = [prompt1, prompt2];
  const results: GeminiWeddingResult[] = [];

  for (let i = 0; i < 2; i++) {
    console.log(`[gemini-wedding] Generating ${i + 1}/2...`);
    try {
      const imageUrl = await callGeminiWithImages(prompts[i], images);
      results.push({ url: imageUrl, log: `v4.0 ✅` });
      console.log(`[gemini-wedding] ${i + 1} done ✅`);
    } catch (err) {
      console.error(`[gemini-wedding] ${i + 1} failed:`, err);
      results.push({
        url: "",
        log: `실패: ${err instanceof Error ? err.message : "Unknown"}`,
      });
    }
  }

  console.log(`[gemini-wedding] Done: ${results.filter(r => r.url).length}/2`);
  return results;
}
