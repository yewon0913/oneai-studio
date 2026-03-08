export interface GeminiWeddingResult {
  url: string;
  log: string;
}

async function callGeminiImageGeneration(
  prompt: string,
  images: { base64: string; mimeType: string }[]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const parts: Record<string, unknown>[] = [];

  for (const img of images) {
    const clean = img.base64.includes(",") ? img.base64.split(",")[1] : img.base64;
    parts.push({ inline_data: { mime_type: img.mimeType, data: clean } });
  }
  parts.push({ text: prompt });

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"],
      temperature: 1,
      topP: 0.95,
    },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const text = await res.text();
  console.log("[gemini] status:", res.status);
  if (!res.ok) throw new Error(`Gemini API failed ${res.status}: ${text.slice(0, 300)}`);

  const data = JSON.parse(text);
  const parts2 = data?.candidates?.[0]?.content?.parts ?? [];

  for (const p of parts2) {
    if (p.inline_data?.data) {
      const mime = p.inline_data.mime_type || "image/png";
      return `data:${mime};base64,${p.inline_data.data}`;
    }
  }

  throw new Error("Gemini returned no image");
}

const SCENE_PROMPTS: Record<string, string> = {
  cherry_blossom: "standing together in a romantic cherry blossom garden, soft pink petals falling, golden hour light",
  chapel: "standing in an elegant wedding chapel, white floral arch, warm candlelight, marble floor",
  garden: "standing in a beautiful outdoor garden, white floral arch, warm sunlight",
  beach: "standing on a beach at golden sunset, ocean backdrop, warm light",
  studio: "standing in a luxury photo studio, clean white background, professional lighting",
};

export async function generateGeminiWedding(
  brideImageBase64: string,
  brideMimeType: string,
  groomImageBase64: string,
  groomMimeType: string,
  scene: string,
  customPrompt?: string
): Promise<GeminiWeddingResult[]> {
  console.log("[gemini-wedding] Starting, scene:", scene);

  const sceneDesc = SCENE_PROMPTS[scene] ?? SCENE_PROMPTS.cherry_blossom;
  const basePrompt = customPrompt?.trim() ||
    `Create a photorealistic Korean wedding photo of this couple ${sceneDesc}.
The woman is wearing an elegant white wedding dress, the man is wearing a black tuxedo.
Keep their facial features exactly as shown in the reference photos.
Professional wedding photography style, cinematic lighting, 8K quality, highly detailed.
The couple is standing close together, looking at the camera with natural smiles.`;

  const results: GeminiWeddingResult[] = [];

  for (let i = 0; i < 2; i++) {
    try {
      console.log(`[gemini-wedding] Generating ${i + 1}/2...`);
      const dataUrl = await callGeminiImageGeneration(basePrompt, [
        { base64: brideImageBase64, mimeType: brideMimeType },
        { base64: groomImageBase64, mimeType: groomMimeType },
      ]);
      results.push({ url: dataUrl, log: "Gemini생성✅" });
      console.log(`[gemini-wedding] ${i + 1} done`);
    } catch (err) {
      console.error(`[gemini-wedding] ${i + 1} failed:`, err);
    }
  }

  if (results.length === 0) {
    throw new Error("Gemini 웨딩 생성 실패. GEMINI_API_KEY를 확인해주세요.");
  }

  return results;
}
