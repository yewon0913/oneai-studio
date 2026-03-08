/**
 * Gemini Wedding Pipeline v2
 * 배경 카테고리 완전 제거
 * 분석 결과 + 프롬프트 기반으로 생성
 */

export interface GeminiWeddingResult {
  url: string;
  log: string;
}

interface AnalysisResult {
  skinTone: string;
  faceShape: string;
  eyeShape: string;
  hasGlasses: boolean;
  glassesStyle: string;
  hasBear: boolean;
  bearStyle: string;
  hairStyle: string;
  makeupLevel: string;
  lightingType: string;
  mood: string;
  generatedNegative: string;
  [key: string]: unknown;
}

async function callGeminiImageGeneration(
  prompt: string,
  negativePrompt: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"],
      temperature: 1,
      topP: 0.95,
    },
  };

  // 작동하는 모델만 사용 (404 모델 제거)
  const models = [
    "gemini-2.0-flash-exp-image-generation",
  ];

  for (const model of models) {
    console.log("[gemini] trying model:", model);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      const text = await res.text();
      console.log("[gemini] model:", model, "status:", res.status);

      if (!res.ok) {
        console.warn("[gemini] failed:", model, text.slice(0, 200));
        continue;
      }

      const data = JSON.parse(text);
      const resParts = data?.candidates?.[0]?.content?.parts ?? [];
      console.log("[gemini] parts count:", resParts.length);

      for (const p of resParts) {
        const imgData = p.inline_data || p.inlineData;
        if (imgData?.data) {
          const mime = imgData.mimeType || imgData.mime_type || "image/png";
          console.log("[gemini] image found, mime:", mime);
          return `data:${mime};base64,${imgData.data}`;
        }
      }

      console.warn("[gemini] no image in response");
    } catch (err) {
      console.warn("[gemini] error:", model, err);
    }
  }

  throw new Error("Gemini 이미지 생성 실패");
}

export async function generateGeminiWedding(
  brideAnalysis: AnalysisResult,
  groomAnalysis: AnalysisResult,
  mainPrompt: string,
  negativePrompt: string
): Promise<GeminiWeddingResult[]> {
  console.log("[gemini-wedding] Starting generation...");
  console.log("[gemini-wedding] Bride:", brideAnalysis.skinTone, brideAnalysis.faceShape);
  console.log("[gemini-wedding] Groom:", groomAnalysis.skinTone, groomAnalysis.faceShape);

  const results: GeminiWeddingResult[] = [];

  for (let i = 0; i < 2; i++) {
    console.log(`[gemini-wedding] Generating ${i + 1}/2...`);
    try {
      const imageUrl = await callGeminiImageGeneration(mainPrompt, negativePrompt);
      results.push({ url: imageUrl, log: "Gemini ✅" });
      console.log(`[gemini-wedding] ${i + 1} done ✅`);
    } catch (err) {
      console.error(`[gemini-wedding] ${i + 1} failed:`, err);
      results.push({
        url: "",
        log: `실패: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }
  }

  console.log(`[gemini-wedding] Done: ${results.filter(r => r.url).length}/2`);
  return results;
}
