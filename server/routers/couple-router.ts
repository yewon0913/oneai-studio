import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { generateCouplePipeline } from "../services/couple-pipeline";

export const coupleRouter = router({
  generateCouple: publicProcedure
    .input(z.object({
      coupleImageBase64: z.string(),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
      scene: z.enum(["cherry_blossom", "chapel", "garden", "beach", "forest", "palace", "all"]).default("cherry_blossom"),
      aspectRatio: z.enum(["4:3", "16:9", "1:1"]).default("4:3"),
      prompt: z.string().optional(),
      negativePrompt: z.string().optional(),
      engine: z.string().optional(),
      faceLock: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      console.log("[couple-router] Starting...");
      const results = await generateCouplePipeline(
        input.coupleImageBase64,
        input.mimeType,
        input.scene,
        input.aspectRatio,
        input.prompt,
        input.negativePrompt,
        input.engine,
        input.faceLock,
      );
      return { images: results.map((r) => ({ url: r.url, log: r.log })) };
    }),

  analyzeCouple: publicProcedure
    .input(z.object({
      imageBase64: z.string(),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const clean = input.imageBase64.includes(",")
        ? input.imageBase64.split(",")[1]
        : input.imageBase64;

      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      // 배경만 분석 (커플 인물은 분석 안 함)
      const response = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 512,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: (input.mimeType || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp", data: clean },
            },
            {
              type: "text",
              text: `이 커플 사진의 배경만 분석해서 배경 생성에 최적화된 영어 프롬프트를 만들어줘.
배경의 분위기, 조명, 색감, 장소, 계절, 날씨 등을 분석하세요.

JSON 형식으로만 응답해:
{
  "backgroundPrompt": "배경 생성용 영어 프롬프트 (50단어 이내, 배경만 설명)",
  "lighting": "감지된 조명 (한국어)",
  "atmosphere": "감지된 분위기 (한국어)",
  "location": "감지된 장소 (한국어)"
}`
            }
          ]
        }]
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("배경 분석 파싱 실패");
      
      const analysis = JSON.parse(jsonMatch[0]);
      return {
        prompt: analysis.backgroundPrompt || "",
        analysis: {
          lighting: analysis.lighting,
          atmosphere: analysis.atmosphere,
          location: analysis.location,
        }
      };
    }),
});
