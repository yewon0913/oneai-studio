/**
 * Memory Restoration Module - tRPC Router
 */

import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { runMemoryPipeline } from "../services/memory-pipeline";

export const memoryRouter = router({
  generateMemory: publicProcedure
    .input(
      z.object({
        imageBase64: z.string(),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        customPrompt: z.string(),
        voiceLine: z.string().nullable().optional(),
        shouldGenerateVideo: z.boolean().default(true),
        enableAudio: z.boolean().default(false),
        duration: z.union([z.literal(5), z.literal(10), z.literal(15)]).default(5),
      })
    )
    .mutation(async ({ input }) => {
      return await runMemoryPipeline(
        input.imageBase64,
        input.mimeType,
        input.customPrompt,
        input.voiceLine ?? null,
        input.shouldGenerateVideo,
        input.enableAudio,
        input.duration
      );
    }),
});
