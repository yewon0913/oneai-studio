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

  const variationExtra = variation === "romantic"
    ? "Natural candid moment, genuine laughter, slight body turn, relaxed and joyful"
    : "Elegant poised stance, sophisticated gaze, luxury editorial pose, timeless and refined";

  // ═══ [1단계] 인물 정보 + 얼굴 보존 ═══
  const stage1 = `Korean woman (BRIDE) and Korean man (GROOM) — from the reference photos.

CRITICAL FACE PRESERVATION:
- BRIDE face shape — preserve exactly, do NOT slim to V-line. Hair — NEVER change color or length. Eyes — do NOT enlarge beyond reference. Nose — NOT westernized. Natural skin texture — NOT plastic.
- GROOM face shape — preserve exact jawline width. Hair — NEVER change. Eyes — preserve eye corner angle. Nose — NOT westernized. Natural skin texture — NOT plastic.
- Same person always. Environment changes, person NEVER changes.`;

  // ═══ [2단계] 컨셉 + 조명 + 의상 ═══
  const stage2 = `Lighting: ${lightingDesc}
Background: ${bg.promptDescription}. ${bg.architectureStyle} style venue, ${bg.season} season, ${bg.colorTone} color palette.
Outfit — Bride: elegant white Korean bridal gown, fitted bodice with delicate lace details. Groom: classic black tuxedo with white shirt and black bow tie.
Moment: ${variationExtra}. Both subjects equally in frame.
Shot on Canon EOS R5, 85mm f/2.0, RAW, 8K resolution.`;

  // ═══ [3단계] ENHANCEMENT ═══
  const stage3 = `BEAUTY ENHANCEMENT — One Natural Spoon:
SKIN: Remove all blemishes and dark circles. Even out skin tone with warm healthy glow. Subtle luminosity — like "best skin day ever". Keep natural pores and texture — NOT plastic.
EYES: Add one natural catchlight in each eye. Slightly brighten the iris. Subtle definition to lashes — natural, NOT dramatic. Eyes must look alive, warm, and sparkling.
HAIR: Smooth, glossy, freshly-styled version of their exact hairstyle. Same cut, same color — just the best version of it.
LIGHTING ENHANCEMENT: Place light at the most flattering angle for their specific face structure. Add subtle highlight on cheekbones. Soft shadow that defines without aging.
Enhance by maximum 20~30% — no more. Same person. Better version. That's all.

BRIDE ENHANCEMENT: Porcelain-free natural glow. Slight rosy bloom on cheeks. Natural catchlight + subtle lash definition. Glossy smooth hair, bangs fall naturally.
GROOM ENHANCEMENT: Keep natural jawline — subtle shadow definition only. Clean pores, slight healthy ruddiness. Strong natural eye contact. Maximum hair volume and shine.

Skin pores visible, natural skin texture, subsurface scattering, film grain ISO 200.
NOT illustration, NOT digital art, NOT AI generated look. Magazine cover quality.`;

  return [stage1, stage2, stage3].join("\n\n");
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
    // 배경 없을 때 기본 프롬프트 (4단계 구조)
    const defaultStage1 = `Korean woman (BRIDE) and Korean man (GROOM) — from the reference photos.

CRITICAL FACE PRESERVATION:
- BRIDE face shape — preserve exactly, do NOT slim. Hair — NEVER change color or length. Eyes — do NOT enlarge. Nose — NOT westernized. Natural skin — NOT plastic.
- GROOM face shape — preserve jawline width. Hair — NEVER change. Eyes — preserve eye corner angle. Nose — NOT westernized. Natural skin — NOT plastic.
- Same person always. Environment changes, person NEVER changes.`;

    const defaultStage3 = `BEAUTY ENHANCEMENT — One Natural Spoon:
SKIN: Remove blemishes, even skin tone, warm healthy glow. Keep natural pores — NOT plastic.
EYES: Natural catchlight, bright iris, subtle lash definition. Alive, warm, sparkling.
HAIR: Glossy, freshly-styled version of their exact hairstyle. Same cut, same color.
Enhance 20~30% max. Same person. Better version. That's all.
NOT illustration, NOT digital art, NOT AI generated.`;

    prompt1 = [
      defaultStage1,
      `Lighting: Golden hour natural light, warm rim light on hair.
Background: Beautiful outdoor garden, warm romantic atmosphere.
Outfit — Bride: elegant white wedding dress. Groom: classic black tuxedo.
Moment: Natural candid pose, genuine smiles, slight body turn.
Shot on Canon EOS R5, 85mm f/2.0, 8K.`,
      defaultStage3,
    ].join("\n\n");

    prompt2 = [
      defaultStage1,
      `Lighting: Crystal chandelier warm prismatic light, high-key elegant.
Background: Grand ballroom interior, luxury editorial atmosphere.
Outfit — Bride: minimalist sleek white wedding dress. Groom: modern slim-fit black tuxedo.
Moment: Sophisticated poised pose, elegant and refined, Vogue Korea quality.
Shot on Hasselblad X2D, 80mm f/2.8, 8K.`,
      defaultStage3,
    ].join("\n\n");
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
