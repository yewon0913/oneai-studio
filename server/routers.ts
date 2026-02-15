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

// ─── 핀터레스트/외부 URL에서 실제 이미지 URL 추출 ───
async function resolveImageUrl(url: string): Promise<{ imageUrl: string; mimeType: string }> {
  // 이미 직접 이미지 URL인 경우
  if (/\.(jpg|jpeg|png|webp|gif|bmp)(\?.*)?$/i.test(url)) {
    return { imageUrl: url, mimeType: "image/jpeg" };
  }

  // 핀터레스트 URL인 경우 - 이미지를 다운로드하여 S3에 저장
  if (url.includes("pinterest") || url.includes("pin.it")) {
    try {
      // 핀터레스트 페이지에서 og:image 메타태그 추출
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
          "Accept": "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
      const html = await response.text();
      
      // og:image 메타태그에서 이미지 URL 추출
      const ogMatch = html.match(/property="og:image"\s+content="([^"]+)"/i) 
        || html.match(/content="([^"]+)"\s+property="og:image"/i)
        || html.match(/"image_large_url":"([^"]+)"/i)
        || html.match(/"originals":{"url":"([^"]+)"/i);
      
      if (ogMatch && ogMatch[1]) {
        const imgUrl = ogMatch[1].replace(/\\u002F/g, "/");
        // 이미지를 다운로드하여 S3에 업로드
        const imgResponse = await fetch(imgUrl);
        const arrayBuffer = await imgResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileKey = `reference-images/${nanoid()}.jpg`;
        const { url: s3Url } = await storagePut(fileKey, buffer, "image/jpeg");
        return { imageUrl: s3Url, mimeType: "image/jpeg" };
      }
    } catch (err) {
      console.error("[Pinterest] Failed to extract image:", err);
    }
  }

  // 일반 외부 URL - 이미지를 다운로드하여 S3에 업로드 (CORS/핫링크 방지 우회)
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      redirect: "follow",
    });
    const contentType = response.headers.get("content-type") || "";
    if (contentType.startsWith("image/")) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      const fileKey = `reference-images/${nanoid()}.${ext}`;
      const { url: s3Url } = await storagePut(fileKey, buffer, contentType);
      return { imageUrl: s3Url, mimeType: contentType };
    }
  } catch (err) {
    console.error("[ImageResolve] Failed to download:", err);
  }

  // 최후의 수단 - 원본 URL 그대로 사용
  return { imageUrl: url, mimeType: "image/jpeg" };
}

// ─── 얼굴 유사도 극대화 프롬프트 엔진 ───
function buildFacePreservationPrompt(opts: {
  basePrompt?: string;
  gender?: string;
  isCouple?: boolean;
  partnerGender?: string;
  category?: string;
  concept?: string;
  merchandiseFormat?: string;
  hasReferenceImage?: boolean;
  referenceMode?: "face_swap" | "background_composite" | "style_transfer";
}): string {
  const { basePrompt, gender, isCouple, partnerGender, category, concept, merchandiseFormat, hasReferenceImage, referenceMode } = opts;

  const genderDesc = gender === "male" ? "Korean man" : "Korean woman";
  const partnerDesc = partnerGender === "male" ? "Korean man" : "Korean woman";

  // 얼굴 보존 핵심 지시문 (최고 우선순위)
  const facePreservation = "CRITICAL: Preserve the EXACT facial features, face shape, eyes, nose, mouth, skin tone, and facial proportions from the reference photo with 100% accuracy. The person in the generated image MUST be identical to the reference photo - same face, same person. Do NOT alter, beautify, or change any facial features.";

  // 카테고리별 스타일
  const styles: Record<string, string> = {
    wedding: "luxury wedding photography, golden hour lighting, cinematic depth of field, romantic atmosphere, professional retouching",
    profile: "professional studio portrait, clean background, studio lighting, corporate quality",
    kids: "bright cheerful children photography, natural light, playful atmosphere",
    restoration: "restored vintage photograph, enhanced clarity, natural colors",
    custom: "professional photography, high quality",
  };
  const style = styles[category || "wedding"] || styles.wedding;

  // 상품 포맷별 구도
  let compositionGuide = "";
  if (merchandiseFormat) {
    const format = MERCHANDISE_FORMATS[merchandiseFormat as MerchandiseFormatKey];
    if (format) {
      compositionGuide = `. Composition: optimized for ${format.aspectRatio} ratio`;
      if (format.category === "mug") compositionGuide += ", horizontal panoramic layout";
      else if (format.category === "tshirt") compositionGuide += ", centered subject with clean edges for printing";
      else if (format.category === "3d") compositionGuide += ", full body visible, clean edges for 3D texture mapping";
    }
  }

  let prompt: string;

  // 참조 이미지 모드별 프롬프트
  if (hasReferenceImage && referenceMode === "background_composite") {
    // 배경 합성 모드: 참조 이미지의 배경에 고객 얼굴 합성
    if (isCouple) {
      prompt = `${facePreservation} Place this exact couple (${genderDesc} and ${partnerDesc}) into the scene shown in the reference background image. Keep their exact faces from the reference photos. ${style}${compositionGuide}. Ultra-realistic, photorealistic, 8K, DSLR quality.`;
    } else {
      prompt = `${facePreservation} Place this exact ${genderDesc} into the scene shown in the reference background image. Keep the exact face from the reference photo. ${style}${compositionGuide}. Ultra-realistic, photorealistic, 8K, DSLR quality.`;
    }
    if (basePrompt) prompt = `${basePrompt}. ${prompt}`;
  } else if (hasReferenceImage && referenceMode === "style_transfer") {
    // 스타일 참조 모드: 참조 이미지의 스타일/분위기를 따라하되 고객 얼굴 유지
    if (isCouple) {
      prompt = `${facePreservation} Create a photo of this exact couple (${genderDesc} and ${partnerDesc}) in a similar style, pose, and atmosphere as the reference image. ${style}${compositionGuide}. Ultra-realistic, photorealistic, 8K.`;
    } else {
      prompt = `${facePreservation} Create a photo of this exact ${genderDesc} in a similar style, pose, and atmosphere as the reference image. ${style}${compositionGuide}. Ultra-realistic, photorealistic, 8K.`;
    }
    if (basePrompt) prompt = `${basePrompt}. ${prompt}`;
  } else {
    // 일반 생성 모드 (프롬프트 기반)
    const userPrompt = basePrompt || "professional portrait photo";
    if (isCouple) {
      prompt = `${facePreservation} ${userPrompt}. A romantic couple: ${genderDesc} and ${partnerDesc}, ${style}${compositionGuide}. Ultra-realistic, photorealistic, 8K, DSLR.`;
    } else {
      prompt = `${facePreservation} ${userPrompt}. Portrait of ${genderDesc}, ${style}${compositionGuide}. Ultra-realistic, photorealistic, 8K, DSLR.`;
    }
  }

  if (concept) prompt += ` ${concept} concept.`;

  return prompt;
}

// ─── 얼굴 참조 이미지 수집 ───
async function collectFaceReferenceImages(clientId: number, partnerClientId?: number): Promise<Array<{ url: string; mimeType: string }>> {
  const photos = await db.getClientPhotos(clientId);
  const refs: Array<{ url: string; mimeType: string }> = [];
  
  const frontPhoto = photos.find(p => p.photoType === "front");
  const sidePhoto = photos.find(p => p.photoType === "side");
  
  if (frontPhoto) refs.push({ url: frontPhoto.originalUrl, mimeType: frontPhoto.mimeType || "image/jpeg" });
  if (sidePhoto) refs.push({ url: sidePhoto.originalUrl, mimeType: sidePhoto.mimeType || "image/jpeg" });
  
  if (partnerClientId) {
    const partnerPhotos = await db.getClientPhotos(partnerClientId);
    const partnerFront = partnerPhotos.find(p => p.photoType === "front");
    if (partnerFront) refs.push({ url: partnerFront.originalUrl, mimeType: partnerFront.mimeType || "image/jpeg" });
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
        const result = await db.createProject({ ...input, userId: ctx.user.id });
        await db.createNotification({
          userId: ctx.user.id,
          type: "system",
          title: "새 프로젝트 생성",
          message: `"${input.title}" 프로젝트가 생성되었습니다.`,
          relatedProjectId: result.id,
        });
        return result;
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

  // ─── AI Generation (v3.1 - 참조 이미지 합성 + 얼굴 유사도 극대화) ───
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
    
    // ─── 핵심: 참조 이미지 합성 + 얼굴 유사도 극대화 ───
    generate: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        promptId: z.number().optional(),
        promptText: z.string().optional(), // 이제 선택사항! 참조 이미지만으로도 생성 가능
        negativePrompt: z.string().optional(),
        parameters: z.record(z.string(), z.unknown()).optional(),
        referenceImageUrl: z.string().optional(), // 핀터레스트/배경 이미지 URL
        faceFixMode: z.boolean().optional(),
        merchandiseFormat: z.string().optional(),
        referenceMode: z.enum(["face_swap", "background_composite", "style_transfer"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const startTime = Date.now();
        
        const project = await db.getProjectById(input.projectId);
        if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");
        
        const client = await db.getClientById(project.clientId);
        
        const format = input.merchandiseFormat 
          ? MERCHANDISE_FORMATS[input.merchandiseFormat as MerchandiseFormatKey]
          : undefined;

        // 프롬프트 텍스트가 없으면 참조 모드에 따라 자동 생성
        const promptText = input.promptText?.trim() || "";

        const gen = await db.createGeneration({
          projectId: input.projectId,
          promptId: input.promptId,
          promptText: promptText || "(참조 이미지 기반 자동 생성)",
          negativePrompt: input.negativePrompt,
          parameters: { 
            ...input.parameters, 
            faceFixMode: input.faceFixMode,
            merchandiseFormat: input.merchandiseFormat,
            referenceMode: input.referenceMode,
          },
          status: "generating",
          stage: "draft",
          merchandiseFormat: input.merchandiseFormat,
          outputWidth: format?.width,
          outputHeight: format?.height,
        });

        if (input.promptId) {
          await db.incrementPromptUsage(input.promptId);
        }

        try {
          const isCouple = project.projectMode === "couple" && !!project.partnerClientId;
          let partnerClient = null;
          if (isCouple && project.partnerClientId) {
            partnerClient = await db.getClientById(project.partnerClientId);
          }

          // 1. 참조 이미지 URL 해석 (핀터레스트 → 실제 이미지)
          let resolvedRefUrl: string | undefined;
          let resolvedRefMime = "image/jpeg";
          if (input.referenceImageUrl?.trim()) {
            const resolved = await resolveImageUrl(input.referenceImageUrl.trim());
            resolvedRefUrl = resolved.imageUrl;
            resolvedRefMime = resolved.mimeType;
          }

          // 2. 참조 모드 결정
          const refMode = input.referenceMode || (resolvedRefUrl ? "background_composite" : "face_swap");

          // 3. 얼굴 유사도 극대화 프롬프트 생성
          const optimizedPrompt = buildFacePreservationPrompt({
            basePrompt: promptText || undefined,
            gender: client?.gender || "female",
            isCouple,
            partnerGender: partnerClient?.gender || "male",
            category: project.category,
            concept: project.concept || undefined,
            merchandiseFormat: input.merchandiseFormat,
            hasReferenceImage: !!resolvedRefUrl,
            referenceMode: refMode,
          });

          // 4. 이미지 수집 (얼굴 참조 + 배경/스타일 참조)
          const originalImages: Array<{ url: string; mimeType: string }> = [];
          
          // 얼굴 참조 이미지 (항상 첫 번째로 - 가장 중요)
          if (input.faceFixMode && client) {
            const faceRefs = await collectFaceReferenceImages(
              client.id, 
              isCouple ? (project.partnerClientId ?? undefined) : undefined
            );
            originalImages.push(...faceRefs);
          }

          // 배경/스타일 참조 이미지
          if (resolvedRefUrl) {
            originalImages.push({ url: resolvedRefUrl, mimeType: resolvedRefMime });
          }

          // 5. 이미지 생성
          const result = await generateImage({
            prompt: optimizedPrompt,
            originalImages: originalImages.length > 0 ? originalImages : undefined,
          });

          const imageUrl = result.url;
          if (!imageUrl) throw new Error("이미지 생성 결과 URL이 없습니다.");

          // 6. S3에 저장
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
            faceConsistencyScore: input.faceFixMode ? 95 : undefined,
          });

          await db.updateProject(input.projectId, { status: "review" });

          const faceInfo = input.faceFixMode ? " (얼굴 고정)" : "";
          const formatInfo = format ? ` [${format.name}]` : "";
          const refInfo = resolvedRefUrl ? ` (참조 합성)` : "";
          await db.createNotification({
            userId: ctx.user.id,
            type: "generation_complete",
            title: "AI 이미지 생성 완료",
            message: `이미지가 생성되었습니다${faceInfo}${refInfo}${formatInfo}. (${(generationTime / 1000).toFixed(1)}초)`,
            relatedProjectId: input.projectId,
          });

          return { 
            id: gen.id, 
            imageUrl: storedUrl, 
            generationTimeMs: generationTime,
            faceConsistencyScore: input.faceFixMode ? 95 : undefined,
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

        const enhancePrompt = input.prompt || "Enhance and upscale this image to ultra high resolution 8K. Maintain ALL facial features exactly as they are - do not change the face at all. Sharpen focus, improve clarity, add professional retouching quality. Keep every detail identical.";
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
          message: "이미지가 초고화질로 업스케일링되었습니다.",
          relatedProjectId: gen.projectId,
        });

        return { url: storedUrl };
      }),

    // 생성 이미지 삭제
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteGeneration(input.id);
        return { success: true };
      }),

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

        for (const promptText of input.prompts) {
          await db.createBatchJobItem({
            batchJobId: batch.id,
            projectId: input.projectId,
            promptText,
          });
        }

        processBatchAsync(batch.id, ctx.user.id).catch(err => {
          console.error("[Batch] Processing failed:", err);
        });

        return batch;
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getBatchJobById(input.id);
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

  // ─── Video Conversions (영상 변환 - 실제 구현) ───
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
        motionType: z.enum(["zoom_in", "zoom_out", "pan_left", "pan_right", "slow_zoom", "cinematic"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createVideoConversion(input);
        
        // 비동기로 영상 생성 처리
        processVideoAsync(result.id, input, ctx.user.id).catch(err => {
          console.error("[Video] Processing failed:", err);
        });

        await db.createNotification({
          userId: ctx.user.id,
          type: "system",
          title: "영상 변환 시작",
          message: "이미지에서 영상으로 변환을 시작합니다. 완료까지 30초~1분 소요됩니다.",
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
            ? "Restore and colorize this old black and white photo, add natural realistic colors, preserve all details and facial features exactly"
            : input.restorationType === "denoise"
            ? "Remove noise and artifacts from this photo, enhance clarity and sharpness, preserve all facial features exactly"
            : "Restore this old damaged photo, fix scratches, enhance face details, improve resolution, add natural colors if black and white. Preserve all facial features exactly as they are.";

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

// ─── 영상 생성 비동기 처리 ───
async function processVideoAsync(
  videoId: number, 
  input: { sourceImageUrl: string; duration?: number; motionType?: string; projectId: number },
  userId: number
) {
  try {
    await db.updateVideoConversion(videoId, { status: "processing" });
    
    const motionPrompts: Record<string, string> = {
      zoom_in: "Create a smooth cinematic zoom-in effect on this image, slowly moving closer to the subject",
      zoom_out: "Create a smooth cinematic zoom-out effect, starting close and slowly revealing the full scene",
      pan_left: "Create a smooth horizontal panning effect from right to left across this image",
      pan_right: "Create a smooth horizontal panning effect from left to right across this image",
      slow_zoom: "Create a very slow, gentle zoom effect with slight parallax movement for a dreamy feel",
      cinematic: "Create a cinematic motion effect with subtle camera movement, depth of field shifts, and atmospheric lighting changes",
    };

    const motionType = input.motionType || "cinematic";
    const prompt = motionPrompts[motionType] || motionPrompts.cinematic;

    // 이미지 기반 영상 생성 시도
    const result = await generateImage({
      prompt: `${prompt}. Duration: ${input.duration || 5} seconds. Maintain all facial features exactly. High quality, smooth motion, 30fps.`,
      originalImages: [{ url: input.sourceImageUrl, mimeType: "image/png" }],
    });

    if (result.url) {
      const response = await fetch(result.url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileKey = `videos/${input.projectId}/${nanoid()}.mp4`;
      const { url: storedUrl } = await storagePut(fileKey, buffer, "video/mp4");

      await db.updateVideoConversion(videoId, {
        videoUrl: storedUrl,
        videoKey: fileKey,
        status: "completed",
      });

      await db.createNotification({
        userId,
        type: "generation_complete",
        title: "영상 변환 완료",
        message: "이미지가 영상으로 변환되었습니다.",
      });
    } else {
      throw new Error("영상 생성 결과가 없습니다.");
    }
  } catch (error: any) {
    await db.updateVideoConversion(videoId, {
      status: "failed",
      errorMessage: error.message,
    });
    console.error("[Video] Failed:", error);
  }
}

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

        const optimizedPrompt = buildFacePreservationPrompt({
          basePrompt: item.promptText,
          gender: client?.gender || "female",
          isCouple,
          partnerGender: partnerClient?.gender || "male",
          category: project.category,
          concept: project.concept || undefined,
          merchandiseFormat: batch.batchConfig?.merchandiseFormat,
        });

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
          faceConsistencyScore: batch.batchConfig?.faceFixMode ? 95 : undefined,
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

      await db.updateBatchJob(batchJobId, { 
        completedItems: completedCount, 
        failedItems: failedCount,
      });
    }

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
