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
});
