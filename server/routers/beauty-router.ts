// ─────────────────────────────────────────────────────
// 뷰티 브랜딩 tRPC 라우터
// ─────────────────────────────────────────────────────

import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { generateBeautyImages, analyzeBeautyOnly } from "../services/beauty-pipeline";

export const beautyRouter = router({
  // ─────────────────────────────────────────────────────
  // 뷰티 이미지 생성
  // ─────────────────────────────────────────────────────
  generateBeauty: publicProcedure
    .input(
      z.object({
        imageBase64: z.string().optional(),
        category: z.enum(["skincare", "makeup", "luxury", "natural"]),
        skinTone: z.enum(["ivory", "beige", "warm_beige", "golden"]),
        makeupStyle: z.enum(["nomakeup", "natural", "glam", "full"]),
        lighting: z.enum(["soft", "dramatic", "natural", "studio"]),
        mood: z.string(),
        customPrompt: z.string().optional(),
        outputCount: z.number().min(1).max(8).optional(),
      })
    )
    .mutation(async ({ input }) => {
      return await generateBeautyImages(input);
    }),

  // ─────────────────────────────────────────────────────
  // 분석만 수행 (프리뷰용)
  // ─────────────────────────────────────────────────────
  analyzeBeauty: publicProcedure
    .input(
      z.object({
        imageBase64: z.string().optional(),
        category: z.enum(["skincare", "makeup", "luxury", "natural"]),
        skinTone: z.enum(["ivory", "beige", "warm_beige", "golden"]),
        makeupStyle: z.enum(["nomakeup", "natural", "glam", "full"]),
        lighting: z.enum(["soft", "dramatic", "natural", "studio"]),
        mood: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return await analyzeBeautyOnly(input);
    }),
});
