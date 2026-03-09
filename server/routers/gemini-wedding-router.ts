import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { generateGeminiWedding, analyzeBackground } from "../services/gemini-wedding-pipeline";

export const geminiWeddingRouter = router({

  // 배경 사진 분석 (분석 후 이미지 서버에 저장 안 됨)
  analyzeBackground: publicProcedure
    .input(z.object({
      imageBase64: z.string(),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
    }))
    .mutation(async ({ input }) => {
      const analysis = await analyzeBackground(input.imageBase64, input.mimeType);
      return analysis;
    }),

  // 생성 (신부/신랑 원본 이미지 직접 전송)
  generate: publicProcedure
    .input(z.object({
      brideImageBase64: z.string(),
      brideMimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
      groomImageBase64: z.string(),
      groomMimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
      backgroundAnalysis: z.object({
        venueType: z.string(),
        timeOfDay: z.string(),
        lighting: z.string(),
        colorTone: z.string(),
        season: z.string(),
        architectureStyle: z.string(),
        mood: z.string(),
        promptDescription: z.string(),
      }).nullable().default(null),
      customPrompt: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const results = await generateGeminiWedding(
        input.brideImageBase64,
        input.brideMimeType,
        input.groomImageBase64,
        input.groomMimeType,
        input.backgroundAnalysis,
        input.customPrompt,
      );
      return { images: results };
    }),
});
