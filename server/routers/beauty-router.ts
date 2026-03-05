/**
 * Beauty Branding Module - tRPC Router
 */

import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { generateBeautyImages } from "../services/beauty-pipeline";
import { analyzeBeautyImageBase64 } from "../services/beauty-analyzer";

export const beautyRouter = router({
  /**
   * 뷰티 이미지 생성
   */
  generateBeauty: publicProcedure
    .input(
      z.object({
        imageBase64: z.string(),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
        category: z.enum(["skincare", "makeup", "luxury", "natural"]),
        customPrompt: z.string().optional(),
        aspectRatio: z.enum(["1:1", "4:5", "3:4", "9:16"]).optional(),
        outputCount: z.number().min(1).max(8).optional(),
      })
    )
    .mutation(async ({ input }) => {
      return await generateBeautyImages(input);
    }),

  /**
   * 분석만 (프리뷰용)
   */
  analyzeBeauty: publicProcedure
    .input(
      z.object({
        imageBase64: z.string(),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
        category: z.enum(["skincare", "makeup", "luxury", "natural"]),
      })
    )
    .mutation(async ({ input }) => {
      return await analyzeBeautyImageBase64(
        input.imageBase64,
        input.mimeType || "image/jpeg",
        input.category
      );
    }),
});
