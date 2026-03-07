import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { generateCouplePipeline } from "../services/couple-pipeline";
import { analyzeBase64ImageToPrompt } from "../services/image-analyzer";

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

      // 15가지 카테고리 분석 (개인촬영과 동일)
      const result = await analyzeBase64ImageToPrompt(
        clean,
        (input.mimeType as "image/jpeg" | "image/png" | "image/webp") || "image/jpeg"
      );

      return {
        prompt: result.prompt,
        negativePrompt: result.negativePrompt,
        analysis: result.analysis,
      };
    }),
});
