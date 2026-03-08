import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { generateGeminiWedding } from "../services/gemini-wedding-pipeline";

export const geminiWeddingRouter = router({
  generate: publicProcedure
    .input(z.object({
      brideImageBase64: z.string(),
      brideMimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
      groomImageBase64: z.string(),
      groomMimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
      scene: z.enum(["cherry_blossom", "chapel", "garden", "beach", "studio"]).default("cherry_blossom"),
      customPrompt: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const results = await generateGeminiWedding(
        input.brideImageBase64,
        input.brideMimeType,
        input.groomImageBase64,
        input.groomMimeType,
        input.scene,
        input.customPrompt,
      );
      return { images: results };
    }),
});
