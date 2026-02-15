import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { generateImage } from "./_core/imageGeneration";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { notifyOwner } from "./_core/notification";
import { nanoid } from "nanoid";
import { MERCHANDISE_FORMATS, type MerchandiseFormatKey } from "../drizzle/schema";

// ─── 프롬프트 최적화 엔진 ───
async function buildOptimizedPrompt(opts: {
  basePrompt: string;
  gender?: string;
  isCouple?: boolean;
  partnerGender?: string;
  category?: string;
  concept?: string;
  merchandiseFormat?: string;
}): Promise<string> {
  const { basePrompt, gender, isCouple, partnerGender, category, concept, merchandiseFormat } = opts;
  
  // 성별 기반 외형 설명
  const genderDesc = gender === "male" 
    ? "a handsome Korean man" 
    : "a beautiful Korean woman";
  
  const partnerDesc = partnerGender === "male"
    ? "a handsome Korean man"
    : "a beautiful Korean woman";

  // 카테고리별 스타일 가이드
  const styleGuides: Record<string, string> = {
    wedding: "professional wedding photography, romantic atmosphere, soft lighting, bokeh background, high-end studio quality",
    profile: "professional portrait photography, clean background, studio lighting, corporate headshot quality",
    kids: "bright cheerful children photography, natural light, playful atmosphere, warm tones",
    restoration: "restored vintage photograph, enhanced clarity, natural colors, preserved original composition",
    custom: "professional photography, high quality, detailed",
  };

  const style = styleGuides[category || "wedding"] || styleGuides.wedding;

  // 상품 포맷별 구도 가이드
  let compositionGuide = "";
  if (merchandiseFormat) {
    const format = MERCHANDISE_FORMATS[merchandiseFormat as MerchandiseFormatKey];
    if (format) {
      const ratio = format.aspectRatio;
      compositionGuide = `, composition optimized for ${ratio} aspect ratio, ${format.category === "mug" ? "horizontal panoramic composition" : format.category === "tshirt" ? "centered subject with clean edges" : "well-framed composition"}`;
    }
  }

  let finalPrompt: string;

  if (isCouple) {
    finalPrompt = `${basePrompt}. A romantic couple portrait: ${genderDesc} and ${partnerDesc} together, ${style}, looking natural and intimate${compositionGuide}. Ultra-realistic, photorealistic, 8K quality, professional DSLR photography, sharp focus on faces`;
  } else {
    finalPrompt = `${basePrompt}. Portrait of ${genderDesc}, ${style}${compositionGuide}. Ultra-realistic, photorealistic, 8K quality, professional DSLR photography, sharp focus on face`;
  }

  if (concept) {
    finalPrompt += `, ${concept} style`;
  }

  return finalPrompt;
}

// ─── 얼굴 참조 이미지 수집 ───
async function collectFaceReferenceImages(clientId: number, partnerClientId?: number): Promise<Array<{ url: string; mimeType: string }>> {
  const photos = await db.getClientPhotos(clientId);
  const refs: Array<{ url: string; mimeType: string }> = [];
  
  // 정면 사진 우선, 측면 사진 보조
  const frontPhoto = photos.find(p => p.photoType === "front");
  const sidePhoto = photos.find(p => p.photoType === "side");
  
  if (frontPhoto) {
    refs.push({ url: frontPhoto.originalUrl, mimeType: frontPhoto.mimeType || "image/jpeg" });
  }
  if (sidePhoto) {
    refs.push({ url: sidePhoto.originalUrl, mimeType: sidePhoto.mimeType || "image/jpeg" });
  }
  
  // 파트너 사진도 수집 (커플 모드)
  if (partnerClientId) {
    const partnerPhotos = await db.getClientPhotos(partnerClientId);
    const partnerFront = partnerPhotos.find(p => p.photoType === "front");
    if (partnerFront) {
      refs.push({ url: partnerFront.originalUrl, mimeType: partnerFront.mimeType || "image/jpeg" });
    }
  }
  
  return refs;
}

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
        gender: z.enum(["female", "male"]).optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        consultationNotes: z.string().optional(),
        preferredConcept: z.string().optional(),
        status: z.enum(["consulting", "in_progress", "completed", "delivered"]).optional(),
        tags: z.array(z.string()).optional(),
        partnerId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createClient({ ...input, userId: ctx.user.id });
        await db.createNotification({
          userId: ctx.user.id,
          type: "system",
          title: "새 고객 등록",
          message: `${input.name} 고객이 등록되었습니다. (${input.gender === "male" ? "남성" : "여성"})`,
          relatedClientId: result.id,
        });
        return result;
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        gender: z.enum(["female", "male"]).optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        consultationNotes: z.string().optional(),
        preferredConcept: z.string().optional(),
        status: z.enum(["consulting", "in_progress", "completed", "delivered"]).optional(),
        tags: z.array(z.string()).optional(),
        partnerId: z.number().nullable().optional(),
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
    getPhotos: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return db.getClientPhotos(input.clientId);
      }),
    // 파트너 연결
    linkPartner: protectedProcedure
      .input(z.object({ clientId: z.number(), partnerId: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateClient(input.clientId, { partnerId: input.partnerId });
        await db.updateClient(input.partnerId, { partnerId: input.clientId });
        return { success: true };
      }),
    unlinkPartner: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .mutation(async ({ input }) => {
        const client = await db.getClientById(input.clientId);
        if (client?.partnerId) {
          await db.updateClient(client.partnerId, { partnerId: null });
        }
        await db.updateClient(input.clientId, { partnerId: null });
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
        partnerClientId: z.number().optional(),
        projectMode: z.enum(["single", "couple"]).optional(),
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
        partnerClientId: z.number().nullable().optional(),
        projectMode: z.enum(["single", "couple"]).optional(),
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

  // ─── AI Generation (완전 재구축) ───
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
    
    // ─── 핵심: 얼굴 일관성 이미지 생성 ───
    generate: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        promptId: z.number().optional(),
        promptText: z.string().min(1),
        negativePrompt: z.string().optional(),
        parameters: z.record(z.string(), z.unknown()).optional(),
        referenceImageUrl: z.string().optional(),
        faceFixMode: z.boolean().optional(),
        merchandiseFormat: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const startTime = Date.now();
        
        // 프로젝트 정보 조회
        const project = await db.getProjectById(input.projectId);
        if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");
        
        // 고객 정보 조회
        const client = await db.getClientById(project.clientId);
        
        // 상품 포맷 정보
        const format = input.merchandiseFormat 
          ? MERCHANDISE_FORMATS[input.merchandiseFormat as MerchandiseFormatKey]
          : undefined;

        // 생성 레코드 생성
        const gen = await db.createGeneration({
          projectId: input.projectId,
          promptId: input.promptId,
          promptText: input.promptText,
          negativePrompt: input.negativePrompt,
          parameters: { 
            ...input.parameters, 
            faceFixMode: input.faceFixMode,
            merchandiseFormat: input.merchandiseFormat,
          },
          status: "generating",
          stage: "draft",
          merchandiseFormat: input.merchandiseFormat,
          outputWidth: format?.width,
          outputHeight: format?.height,
        });

        // 프롬프트 사용 횟수 증가
        if (input.promptId) {
          await db.incrementPromptUsage(input.promptId);
        }

        try {
          // 1. 프롬프트 최적화
          const isCouple = project.projectMode === "couple" && !!project.partnerClientId;
          let partnerClient = null;
          if (isCouple && project.partnerClientId) {
            partnerClient = await db.getClientById(project.partnerClientId);
          }

          const optimizedPrompt = await buildOptimizedPrompt({
            basePrompt: input.promptText,
            gender: client?.gender || "female",
            isCouple,
            partnerGender: partnerClient?.gender || "male",
            category: project.category,
            concept: project.concept || undefined,
            merchandiseFormat: input.merchandiseFormat,
          });

          // 2. 얼굴 참조 이미지 수집
          const originalImages: Array<{ url: string; mimeType: string }> = [];
          
          if (input.faceFixMode && client) {
            const faceRefs = await collectFaceReferenceImages(
              client.id, 
              isCouple ? (project.partnerClientId ?? undefined) : undefined
            );
            originalImages.push(...faceRefs);
          }

          // 참조 이미지 추가 (스타일 참조)
          if (input.referenceImageUrl) {
            originalImages.push({ url: input.referenceImageUrl, mimeType: "image/jpeg" });
          }

          // 3. 이미지 생성 호출
          const result = await generateImage({
            prompt: optimizedPrompt,
            originalImages: originalImages.length > 0 ? originalImages : undefined,
          });

          const imageUrl = result.url;
          if (!imageUrl) throw new Error("이미지 생성 결과 URL이 없습니다.");

          // 4. S3에 저장
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
            faceConsistencyScore: input.faceFixMode ? 90 : undefined,
          });

          // 프로젝트 상태 업데이트
          await db.updateProject(input.projectId, { status: "review" });

          // 알림
          const faceInfo = input.faceFixMode ? " (얼굴 고정 모드)" : "";
          const formatInfo = format ? ` [${format.name}]` : "";
          await db.createNotification({
            userId: ctx.user.id,
            type: "generation_complete",
            title: "AI 이미지 생성 완료",
            message: `이미지가 생성되었습니다${faceInfo}${formatInfo}. (${(generationTime / 1000).toFixed(1)}초)`,
            relatedProjectId: input.projectId,
          });

          return { 
            id: gen.id, 
            imageUrl: storedUrl, 
            generationTimeMs: generationTime,
            faceConsistencyScore: input.faceFixMode ? 90 : undefined,
          };
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
        if (!gen || !gen.resultImageUrl) throw new Error("생성 이미지를 찾을 수 없습니다.");

        const enhancePrompt = input.prompt || "Enhance and upscale this image to ultra high resolution. Maintain all facial features, details, and composition exactly. Sharpen focus, improve clarity, professional retouching quality.";
        const upscaleResult = await generateImage({
          prompt: enhancePrompt,
          originalImages: [{ url: gen.resultImageUrl, mimeType: "image/png" }],
        });
        const upscaledUrl = upscaleResult.url;
        if (!upscaledUrl) throw new Error("업스케일 결과 URL이 없습니다.");

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

    // 상품 포맷 목록
    merchandiseFormats: publicProcedure.query(() => {
      return Object.entries(MERCHANDISE_FORMATS).map(([key, format]) => ({
        key,
        ...format,
      }));
    }),
  }),

  // ─── Batch Jobs (대량 생성) ───
  batches: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getBatchJobs(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        projectId: z.number(),
        prompts: z.array(z.string().min(1)).min(1).max(100),
        faceFixMode: z.boolean().optional(),
        merchandiseFormat: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const batch = await db.createBatchJob({
          userId: ctx.user.id,
          projectId: input.projectId,
          title: input.title,
          totalItems: input.prompts.length,
          batchConfig: {
            faceFixMode: input.faceFixMode,
            merchandiseFormat: input.merchandiseFormat,
          },
        });

        // 각 프롬프트에 대해 배치 아이템 생성
        for (const promptText of input.prompts) {
          await db.createBatchJobItem({
            batchJobId: batch.id,
            projectId: input.projectId,
            promptText,
          });
        }

        // 비동기로 배치 처리 시작 (첫 번째 아이템부터)
        processBatchAsync(batch.id, ctx.user.id).catch(err => {
          console.error("[Batch] Processing failed:", err);
        });

        return batch;
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const batch = await db.getBatchJobById(input.id);
        return batch;
      }),
    getItems: protectedProcedure
      .input(z.object({ batchJobId: z.number() }))
      .query(async ({ input }) => {
        return db.getBatchJobItems(input.batchJobId);
      }),
    cancel: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateBatchJob(input.id, { status: "cancelled" });
        return { success: true };
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
          if (!restoredUrl) throw new Error("복원 결과 URL이 없습니다.");

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

// ─── 배치 비동기 처리 ───
async function processBatchAsync(batchJobId: number, userId: number) {
  try {
    await db.updateBatchJob(batchJobId, { status: "processing" });
    const items = await db.getBatchJobItems(batchJobId);
    const batch = await db.getBatchJobById(batchJobId);
    if (!batch) return;

    let completedCount = 0;
    let failedCount = 0;

    for (const item of items) {
      if (!item.promptText || !item.projectId) continue;
      
      // 배치 상태 확인 (취소 여부)
      const currentBatch = await db.getBatchJobById(batchJobId);
      if (currentBatch?.status === "cancelled") break;

      try {
        await db.updateBatchJobItem(item.id, { status: "processing" });
        
        const project = await db.getProjectById(item.projectId);
        if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");
        
        const client = await db.getClientById(project.clientId);
        const isCouple = project.projectMode === "couple" && !!project.partnerClientId;
        let partnerClient = null;
        if (isCouple && project.partnerClientId) {
          partnerClient = await db.getClientById(project.partnerClientId);
        }

        const optimizedPrompt = await buildOptimizedPrompt({
          basePrompt: item.promptText,
          gender: client?.gender || "female",
          isCouple,
          partnerGender: partnerClient?.gender || "male",
          category: project.category,
          concept: project.concept || undefined,
          merchandiseFormat: batch.batchConfig?.merchandiseFormat,
        });

        // 얼굴 참조 이미지 수집
        const originalImages: Array<{ url: string; mimeType: string }> = [];
        if (batch.batchConfig?.faceFixMode && client) {
          const faceRefs = await collectFaceReferenceImages(
            client.id,
            isCouple ? (project.partnerClientId ?? undefined) : undefined
          );
          originalImages.push(...faceRefs);
        }

        const result = await generateImage({
          prompt: optimizedPrompt,
          originalImages: originalImages.length > 0 ? originalImages : undefined,
        });

        if (!result.url) throw new Error("이미지 생성 실패");

        const response = await fetch(result.url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileKey = `generations/${item.projectId}/batch-${nanoid()}.png`;
        const { url: storedUrl } = await storagePut(fileKey, buffer, "image/png");

        const gen = await db.createGeneration({
          projectId: item.projectId,
          promptText: item.promptText,
          status: "completed",
          stage: "draft",
          resultImageUrl: storedUrl,
          resultImageKey: fileKey,
          faceConsistencyScore: batch.batchConfig?.faceFixMode ? 90 : undefined,
          merchandiseFormat: batch.batchConfig?.merchandiseFormat,
        });

        await db.updateBatchJobItem(item.id, { 
          status: "completed", 
          generationId: gen.id,
        });
        completedCount++;
      } catch (err: any) {
        await db.updateBatchJobItem(item.id, { 
          status: "failed", 
          errorMessage: err.message,
        });
        failedCount++;
      }

      // 진행률 업데이트
      await db.updateBatchJob(batchJobId, { 
        completedItems: completedCount, 
        failedItems: failedCount,
      });
    }

    // 배치 완료
    await db.updateBatchJob(batchJobId, { 
      status: failedCount === items.length ? "failed" : "completed",
      completedItems: completedCount,
      failedItems: failedCount,
    });

    await db.createNotification({
      userId,
      type: "batch_complete",
      title: "배치 생성 완료",
      message: `배치 처리가 완료되었습니다. (성공: ${completedCount}, 실패: ${failedCount})`,
    });
  } catch (error: any) {
    await db.updateBatchJob(batchJobId, { status: "failed" });
    console.error("[Batch] Fatal error:", error);
  }
}

export type AppRouter = typeof appRouter;
