/**
 * Wedding Pipeline Module - tRPC Router
 */

import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { generateWeddingImages } from "../services/wedding-pipeline";

export const weddingRouter = router({
  /**
   * 웨딩 이미지 생성 (솔로/커플)
   */
  generateWedding: publicProcedure
    .input(
      z.object({
        mode: z.enum(["solo_bride", "solo_groom", "couple"]),
        brideImageBase64: z.string().optional(),
        brideMimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
        groomImageBase64: z.string().optional(),
        groomMimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
        concept: z.enum(["white_studio", "outdoor_garden", "european_chapel", "grand_hall"]).optional(),
        customPrompt: z.string().optional(),
        outputCount: z.number().min(1).max(8).optional(),
      })
    )
    .mutation(async ({ input }) => {
      return await generateWeddingImages(input);
    }),
});
