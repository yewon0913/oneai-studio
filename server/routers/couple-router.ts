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
      refImages: z.array(z.object({ base64: z.string(), name: z.string() })).optional(),
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
        input.refImages,
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

      const response = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: input.mimeType || "image/jpeg", data: clean },
            },
            {
              type: "text",
              text: `이 커플 사진을 분석해서 웨딩 사진 생성에 최적화된 영어 프롬프트를 만들어줘.
JSON 형식으로만 응답해:
{
  "prompt": "웨딩 배경 합성에 쓸 영어 프롬프트 (배경, 조명, 분위기 포함, 50단어 이내)",
  "style": "감지된 스타일 (한국어)",
  "lighting": "감지된 조명 (한국어)",
  "mood": "감지된 분위기 (한국어)",
  "suggestion": "배경 추천 (한국어, 15자 이내)"
}`,
            }
          ]
        }]
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("분석 결과 파싱 실패");
      return JSON.parse(jsonMatch[0]);
    }),
});
