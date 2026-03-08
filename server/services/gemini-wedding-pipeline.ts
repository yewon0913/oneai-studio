/**
 * Gemini Wedding Pipeline v3.0
 * 최강 프롬프트 엔진 통합 버전
 */

import { buildWeddingPromptPair } from "./wedding-prompt-engine";

export interface GeminiWeddingResult {
  url: string;
  log: string;
}

interface AnalysisResult {
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

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"],
      temperature: 0.9,
      topP: 0.95,
    },
  };

  console.log("[gemini] calling gemini-2.0-flash-exp-image-generation...");

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
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  console.log("[gemini] parts count:", parts.length);

  for (const p of parts) {
    const imgData = p.inline_data || p.inlineData;
    if (imgData?.data) {
      const mime = imgData.mimeType || imgData.mime_type || "image/png";
      console.log("[gemini] image found, mime:", mime);
      return `data:${mime};base64,${imgData.data}`;
    }
  }

  throw new Error("Gemini returned no image");
}

export async function generateGeminiWedding(
  brideAnalysis: AnalysisResult,
  groomAnalysis: AnalysisResult,
  mainPrompt: string,
  negativePrompt: string
): Promise<GeminiWeddingResult[]> {
  console.log("[gemini-wedding] v3.0 Starting...");
  console.log("[gemini-wedding] Bride:", brideAnalysis.skinTone, brideAnalysis.faceShape);
  console.log("[gemini-wedding] Groom:", groomAnalysis.skinTone, groomAnalysis.faceShape);

  // 커스텀 프롬프트가 있으면 그대로, 없으면 엔진으로 생성
  let prompt1 = mainPrompt;
  let prompt2 = mainPrompt;

  if (!mainPrompt || mainPrompt.trim().length < 50) {
    console.log("[gemini-wedding] Using prompt engine...");
    const { prompt1: p1, prompt2: p2 } = buildWeddingPromptPair(brideAnalysis, groomAnalysis);
    prompt1 = p1;
    prompt2 = p2;
  }

  const prompts = [prompt1, prompt2];
  const results: GeminiWeddingResult[] = [];

  for (let i = 0; i < 2; i++) {
    console.log(`[gemini-wedding] Generating ${i + 1}/2...`);
    try {
      const imageUrl = await callGemini(prompts[i]);
      results.push({ url: imageUrl, log: `v3.0 ✅` });
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
