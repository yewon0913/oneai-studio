import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { generateGeminiWedding } from "../services/gemini-wedding-pipeline";
import { analyzeImageWithClaude } from "../services/shared-analyzer";

const analysisSchema = z.object({
  skinTone: z.string(),
  skinTexture: z.string(),
  faceShape: z.string(),
  eyeShape: z.string(),
  hasGlasses: z.boolean(),
  glassesStyle: z.string(),
  hasBear: z.boolean(),
  bearStyle: z.string(),
  hairStyle: z.string(),
  hairColor: z.string(),
  pose: z.string(),
  gaze: z.string(),
  expression: z.string(),
  makeupLevel: z.string(),
  lightingType: z.string(),
  lightingDirection: z.string(),
  shadowPresence: z.string(),
  background: z.string(),
  outfit: z.string(),
  mood: z.string(),
  generatedPrompt: z.string(),
  generatedNegative: z.string(),
});

export const geminiWeddingRouter = router({
  // 이미지 분석 (분석 후 이미지는 서버에 저장 안 됨)
  analyzeImage: publicProcedure
    .input(z.object({
      imageBase64: z.string(),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
    }))
    .mutation(async ({ input }) => {
      const analysis = await analyzeImageWithClaude(
        input.imageBase64,
        input.mimeType,
        "wedding"
      );
      // 분석 결과만 반환 (이미지 저장 없음)
      return analysis;
    }),

  // 생성 (분석 결과 + 프롬프트만 받음, 이미지 불필요)
  generate: publicProcedure
    .input(z.object({
      brideAnalysis: analysisSchema,
      groomAnalysis: analysisSchema,
      mainPrompt: z.string(),
      negativePrompt: z.string().default(""),
    }))
    .mutation(async ({ input }) => {
      const results = await generateGeminiWedding(
        input.brideAnalysis,
        input.groomAnalysis,
        input.mainPrompt,
        input.negativePrompt,
      );
      return { images: results };
    }),
});
