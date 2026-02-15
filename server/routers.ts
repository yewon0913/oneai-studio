import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { generateImage } from "./_core/imageGeneration";
import { storagePut } from "./storage";
import { notifyOwner } from "./_core/notification";
import { nanoid } from "nanoid";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Dashboard ───
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      return db.getDashboardStats(ctx.user.id);
    }),
  }),

  // ─── Clients ───
  clients: router({
    list: protectedProcedure
      .input(z.object({ search: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return db.getClientsByUser(ctx.user.id, input?.search);
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getClientById(input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().optional(),
        consultationNotes: z.string().optional(),
        preferredConcept: z.string().optional(),
        status: z.enum(["consulting", "in_progress", "completed", "delivered"]).optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createClient({ ...input, userId: ctx.user.id });
        await db.createNotification({
          userId: ctx.user.id,
          type: "system",
          title: "새 고객 등록",
          message: `${input.name} 고객이 등록되었습니다.`,
          relatedClientId: result.id,
        });
        return result;
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        consultationNotes: z.string().optional(),
        preferredConcept: z.string().optional(),
        status: z.enum(["consulting", "in_progress", "completed", "delivered"]).optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateClient(id, data);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteClient(input.id);
        return { success: true };
      }),
  }),

  // ─── Client Photos ───
  clientPhotos: router({
    list: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return db.getClientPhotos(input.clientId);
      }),
    upload: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        photoType: z.enum(["front", "side", "additional"]),
        fileName: z.string(),
        mimeType: z.string(),
        base64Data: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.base64Data, "base64");
        const fileKey = `clients/${input.clientId}/photos/${nanoid()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        const result = await db.createClientPhoto({
          clientId: input.clientId,
          photoType: input.photoType,
          originalUrl: url,
          fileKey,
          fileName: input.fileName,
          mimeType: input.mimeType,
          fileSize: buffer.length,
        });
        await db.createNotification({
          userId: ctx.user.id,
          type: "photo_uploaded",
          title: "사진 업로드 완료",
          message: `고객 사진이 업로드되었습니다. (${input.photoType})`,
          relatedClientId: input.clientId,
        });
        return { id: result.id, url };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteClientPhoto(input.id);
        return { success: true };
      }),
  }),

  // ─── Projects ───
  projects: router({
    list: protectedProcedure
      .input(z.object({ clientId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return db.getProjectsByUser(ctx.user.id, input?.clientId);
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getProjectById(input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        title: z.string().min(1),
        category: z.enum(["wedding", "restoration", "kids", "profile", "video", "custom"]).optional(),
        concept: z.string().optional(),
        referenceImageUrl: z.string().optional(),
        pinterestUrl: z.string().optional(),
        notes: z.string().optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createProject({ ...input, userId: ctx.user.id });
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        category: z.enum(["wedding", "restoration", "kids", "profile", "video", "custom"]).optional(),
        concept: z.string().optional(),
        status: z.enum(["draft", "generating", "review", "revision", "upscaling", "completed", "delivered"]).optional(),
        referenceImageUrl: z.string().optional(),
        pinterestUrl: z.string().optional(),
        notes: z.string().optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateProject(id, data);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProject(input.id);
        return { success: true };
      }),
  }),

  // ─── Prompt Library ───
  prompts: router({
    list: protectedProcedure
      .input(z.object({ category: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return db.getPrompts(ctx.user.id, input?.category);
      }),
    defaults: protectedProcedure.query(async () => {
      return db.getDefaultPrompts();
    }),
    create: protectedProcedure
      .input(z.object({
        category: z.enum(["wedding", "restoration", "kids", "profile", "video", "custom"]),
        subcategory: z.string().optional(),
        title: z.string().min(1),
        prompt: z.string().min(1),
        negativePrompt: z.string().optional(),
        parameters: z.record(z.string(), z.unknown()).optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createPrompt({ ...input, userId: ctx.user.id });
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        prompt: z.string().optional(),
        negativePrompt: z.string().optional(),
        parameters: z.record(z.string(), z.unknown()).optional(),
        subcategory: z.string().optional(),
        category: z.enum(["wedding", "restoration", "kids", "profile", "video", "custom"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updatePrompt(id, data);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePrompt(input.id);
        return { success: true };
      }),
  }),

  // ─── AI Generation ───
  generations: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getGenerationsByProject(input.projectId);
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getGenerationById(input.id);
      }),
    generate: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        promptId: z.number().optional(),
        promptText: z.string().min(1),
        negativePrompt: z.string().optional(),
        parameters: z.record(z.string(), z.unknown()).optional(),
        referenceImageUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const startTime = Date.now();
        // Create generation record
        const gen = await db.createGeneration({
          projectId: input.projectId,
          promptId: input.promptId,
          promptText: input.promptText,
          negativePrompt: input.negativePrompt,
          parameters: input.parameters,
          status: "generating",
          stage: "draft",
        });

        // Increment prompt usage if using library prompt
        if (input.promptId) {
          await db.incrementPromptUsage(input.promptId);
        }

        try {
          // Generate image using built-in image generation
          const genOptions: any = { prompt: input.promptText };
          if (input.referenceImageUrl) {
            genOptions.originalImages = [{ url: input.referenceImageUrl, mimeType: "image/jpeg" }];
          }
          const result = await generateImage(genOptions);
          const imageUrl = result.url;
          if (!imageUrl) throw new Error("Image generation returned no URL");

          // Store to S3
          const response = await fetch(imageUrl);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const fileKey = `generations/${input.projectId}/${nanoid()}.png`;
          const { url: storedUrl } = await storagePut(fileKey, buffer, "image/png");

          const generationTime = Date.now() - startTime;
          await db.updateGeneration(gen.id, {
            resultImageUrl: storedUrl,
            resultImageKey: fileKey,
            status: "completed",
            generationTimeMs: generationTime,
          });

          // Update project status
          await db.updateProject(input.projectId, { status: "review" });

          // Notify
          await db.createNotification({
            userId: ctx.user.id,
            type: "generation_complete",
            title: "AI 이미지 생성 완료",
            message: `이미지가 성공적으로 생성되었습니다. (${(generationTime / 1000).toFixed(1)}초)`,
            relatedProjectId: input.projectId,
          });

          return { id: gen.id, imageUrl: storedUrl, generationTimeMs: generationTime };
        } catch (error: any) {
          await db.updateGeneration(gen.id, {
            status: "failed",
            reviewNotes: error.message || "Generation failed",
          });
          throw error;
        }
      }),
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "generating", "completed", "failed", "reviewed", "approved", "rejected"]),
        stage: z.enum(["draft", "review", "upscaled", "final"]).optional(),
        qualityScore: z.number().optional(),
        faceConsistencyScore: z.number().optional(),
        reviewNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateGeneration(id, data);
        return { success: true };
      }),
    upscale: protectedProcedure
      .input(z.object({
        id: z.number(),
        prompt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const gen = await db.getGenerationById(input.id);
        if (!gen || !gen.resultImageUrl) throw new Error("Generation not found or no image");

        // Use image generation with enhancement prompt
        const enhancePrompt = input.prompt || `Enhance and upscale this image to 4K ultra high resolution, maintain all details, sharp focus, professional quality`;
        const upscaleResult = await generateImage({
          prompt: enhancePrompt,
          originalImages: [{ url: gen.resultImageUrl, mimeType: "image/png" }],
        });
        const upscaledUrl = upscaleResult.url;
        if (!upscaledUrl) throw new Error("Upscale returned no URL");

        const response = await fetch(upscaledUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileKey = `generations/${gen.projectId}/upscaled-${nanoid()}.png`;
        const { url: storedUrl } = await storagePut(fileKey, buffer, "image/png");

        await db.updateGeneration(input.id, {
          upscaledImageUrl: storedUrl,
          upscaledImageKey: fileKey,
          stage: "upscaled",
          status: "approved",
        });

        await db.createNotification({
          userId: ctx.user.id,
          type: "generation_complete",
          title: "업스케일링 완료",
          message: "이미지가 고화질로 업스케일링되었습니다.",
          relatedProjectId: gen.projectId,
        });

        return { url: storedUrl };
      }),
  }),

  // ─── Batch Jobs ───
  batches: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getBatchJobs(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        items: z.array(z.object({
          projectId: z.number(),
          promptText: z.string(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const batch = await db.createBatchJob({
          userId: ctx.user.id,
          title: input.title,
          totalItems: input.items.length,
        });
        for (const item of input.items) {
          await db.createBatchJobItem({
            batchJobId: batch.id,
            projectId: item.projectId,
          });
        }
        return batch;
      }),
    getItems: protectedProcedure
      .input(z.object({ batchJobId: z.number() }))
      .query(async ({ input }) => {
        return db.getBatchJobItems(input.batchJobId);
      }),
  }),

  // ─── Delivery Packages ───
  deliveries: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getDeliveryPackagesByProject(input.projectId);
      }),
    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        clientId: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
        watermarkEnabled: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createDeliveryPackage(input);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["preparing", "ready", "sent", "viewed"]).optional(),
        downloadLinks: z.array(z.object({
          resolution: z.string(),
          url: z.string(),
          key: z.string(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateDeliveryPackage(id, data);
        return { success: true };
      }),
  }),

  // ─── Video Conversions ───
  videos: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getVideoConversionsByProject(input.projectId);
      }),
    create: protectedProcedure
      .input(z.object({
        generationId: z.number(),
        projectId: z.number(),
        sourceImageUrl: z.string(),
        duration: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createVideoConversion(input);
        await db.createNotification({
          userId: ctx.user.id,
          type: "system",
          title: "영상 변환 요청",
          message: "이미지에서 영상으로 변환이 요청되었습니다.",
          relatedProjectId: input.projectId,
        });
        return result;
      }),
  }),

  // ─── Photo Restorations ───
  restorations: router({
    list: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return db.getPhotoRestorationsByClient(input.clientId);
      }),
    create: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        projectId: z.number().optional(),
        originalUrl: z.string(),
        originalKey: z.string(),
        restorationType: z.enum(["face_restore", "colorize", "denoise", "upscale", "full"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createPhotoRestoration(input);

        // Use AI to restore
        try {
          const restorePrompt = input.restorationType === "colorize"
            ? "Restore and colorize this old black and white photo, add natural realistic colors, preserve all details"
            : input.restorationType === "denoise"
            ? "Remove noise and artifacts from this photo, enhance clarity and sharpness"
            : "Restore this old damaged photo, fix scratches, enhance face details, improve resolution, add natural colors if black and white";

          const restoreResult = await generateImage({
            prompt: restorePrompt,
            originalImages: [{ url: input.originalUrl, mimeType: "image/jpeg" }],
          });
          const restoredUrl = restoreResult.url;
          if (!restoredUrl) throw new Error("Restoration returned no URL");

          const response = await fetch(restoredUrl);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const fileKey = `restorations/${input.clientId}/${nanoid()}.png`;
          const { url: storedUrl } = await storagePut(fileKey, buffer, "image/png");

          await db.updatePhotoRestoration(result.id, {
            restoredUrl: storedUrl,
            restoredKey: fileKey,
            status: "completed",
          });

          await db.createNotification({
            userId: ctx.user.id,
            type: "generation_complete",
            title: "사진 복원 완료",
            message: "사진이 성공적으로 복원되었습니다.",
            relatedClientId: input.clientId,
          });

          return { id: result.id, restoredUrl: storedUrl };
        } catch (error: any) {
          await db.updatePhotoRestoration(result.id, {
            status: "failed",
            errorMessage: error.message,
          });
          throw error;
        }
      }),
  }),

  // ─── Notifications ───
  notifications: router({
    list: protectedProcedure
      .input(z.object({ unreadOnly: z.boolean().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return db.getNotifications(ctx.user.id, input?.unreadOnly);
      }),
    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.markNotificationRead(input.id);
        return { success: true };
      }),
    markAllRead: protectedProcedure
      .mutation(async ({ ctx }) => {
        await db.markAllNotificationsRead(ctx.user.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
