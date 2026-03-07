import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { generateCouplePipeline } from "../services/couple-pipeline";
import { analyzeBeautyImageBase64 } from "../services/beauty-analyzer";

export const coupleRouter = router({
  generateCouple: publicProcedure
    .input(z.object({
      coupleImageBase64: z.string(),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
      scene: z.enum(["cherry_blossom", "chapel", "garden", "beach", "forest", "palace", "all"]).default("cherry_blossom"),
      aspectRatio: z.enum(["4:3", "16:9", "1:1"]).default("4:3"),
    }))
    .mutation(async ({ input }) => {
      console.log("[couple-router] Starting...");
      const results = await generateCouplePipeline(
        input.coupleImageBase64,
        input.mimeType,
        input.scene,
        input.aspectRatio,
      );
      return { images: results.map((r) => ({ url: r.url, log: r.log })) };
    }),

  analyzeImage: publicProcedure
    .input(z.object({
      imageBase64: z.string(),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
    }))
    .query(async ({ input }) => {
      console.log("[couple-router] Analyzing couple image...");
      const analysis = await analyzeBeautyImageBase64(
        input.imageBase64,
        input.mimeType,
        "natural"
      );
      return {
        prompt: analysis.prompt,
        negativePrompt: analysis.negativePrompt,
        analysis: analysis.analysis,
      };
    }),
});
