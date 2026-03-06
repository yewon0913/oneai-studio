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
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
        animationStyle: z.enum(["calm", "nostalgia", "lively"]),
        generateVideo: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      return await runMemoryPipeline(input);
    }),
});
