/**
 * Memory Restoration Module - tRPC Router
 */

import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { runMemoryPipeline } from "../services/memory-pipeline";

export const memoryRouter = router({
  generateMemory: publicProcedure
    .input(
      z.object({
        imageBase64: z.string(),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        animationStyle: z.enum(["calm", "nostalgia", "lively", "gratitude"]),
        generateVideo: z.boolean().default(true),
        duration: z.union([z.literal(5), z.literal(10), z.literal(15)]).default(5),
        direction: z.string().optional(),
        enableBGM: z.boolean().default(false),
        bgmStyle: z.string().optional(),
        enableVoice: z.boolean().default(false),
        voiceScript: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return await runMemoryPipeline(
        input.imageBase64,
        input.mimeType,
        input.animationStyle,
        input.generateVideo,
        input.duration,
        input.direction,
        input.enableBGM,
        input.bgmStyle,
        input.enableVoice,
        input.voiceScript
      );
    }),
});
