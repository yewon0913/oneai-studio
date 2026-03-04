import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { generateImage } from "./_core/imageGeneration";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { notifyOwner } from "./_core/notification";
import { nanoid } from "nanoid";
import { MERCHANDISE_FORMATS, type MerchandiseFormatKey } from "../drizzle/schema";

// ─── 핀터레스트/외부 URL에서 실제 이미지를 다운로드하여 base64로 변환 ───
async function resolveImageToBase64(url: string): Promise<{ b64Json: string; mimeType: string } | null> {
  try {
    let imageUrl = url;
    
    // 핀터레스트 URL인 경우 - og:image 추출
    if (url.includes("pinterest") || url.includes("pin.it")) {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
      const html = await response.text();
      
      // og:image 메타태그에서 이미지 URL 추출 (여러 패턴 시도)
      const ogMatch = html.match(/property="og:image"\s+content="([^"]+)"/i) 
        || html.match(/content="([^"]+)"\s+property="og:image"/i)
        || html.match(/"image_large_url"\s*:\s*"([^"]+)"/i)
        || html.match(/"originals"\s*:\s*\{\s*"url"\s*:\s*"([^"]+)"/i)
        || html.match(/"url"\s*:\s*"(https:\/\/i\.pinimg\.com\/[^"]+)"/i);
      
      if (ogMatch && ogMatch[1]) {
        imageUrl = ogMatch[1].replace(/\\u002F/g, "/").replace(/\\/g, "");
      } else {
        console.error("[Pinterest] Could not extract image URL from page");
        return null;
      }
    }

    // 이미지를 다운로드하여 base64로 변환
    const imgResponse = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      redirect: "follow",
    });
    
    const contentType = imgResponse.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      console.error("[ImageResolve] Not an image content type:", contentType);
      return null;
    }
    
    const arrayBuffer = await imgResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 파일 크기 체크 (10MB 이하)
    if (buffer.length > 10 * 1024 * 1024) {
      console.error("[ImageResolve] Image too large:", buffer.length);
      return null;
    }
    
    const b64Json = buffer.toString("base64");
    const mimeType = contentType.includes("png") ? "image/png" 
      : contentType.includes("webp") ? "image/webp" 
      : "image/jpeg";
    
    return { b64Json, mimeType };
  } catch (err) {
    console.error("[ImageResolve] Failed:", err);
    return null;
  }
}

// ─── 이미지 URL을 base64로 변환 (S3 URL 등) ───
async function imageUrlToBase64(url: string): Promise<{ b64Json: string; mimeType: string } | null> {
  try {
    const response = await fetch(url, { redirect: "follow" });
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > 10 * 1024 * 1024) return null;
    return { b64Json: buffer.toString("base64"), mimeType: contentType.startsWith("image/") ? contentType : "image/jpeg" };
  } catch {
    return null;
  }
}

// ─── 얼굴 유사도 극대화 프롬프트 엔진 (간결 버전 - API 제한 대응) ───
function buildFacePreservationPrompt(opts: {
  basePrompt?: string;
  gender?: string;
  isCouple?: boolean;
  partnerGender?: string;
  category?: string;
  concept?: string;
  merchandiseFormat?: string;
  hasReferenceImage?: boolean;
  referenceMode?: "face_swap" | "background_composite" | "style_transfer" | "direct_apply";
}): string {
  const { basePrompt, gender, isCouple, partnerGender, category, concept, merchandiseFormat, hasReferenceImage, referenceMode } = opts;

  const genderDesc = gender === "male" ? "man" : "woman";
  const partnerDesc = partnerGender === "male" ? "man" : "woman";

  // 핵심 지시문 (간결하게)
  const faceCore = "Preserve EXACT facial features from reference photo with 100% accuracy. Same face, same person.";

  const styles: Record<string, string> = {
    wedding: "luxury wedding photo, golden hour, cinematic",
    profile: "professional studio portrait, clean background",
    kids: "bright cheerful children photo, natural light",
    restoration: "restored vintage photo, enhanced clarity",
    custom: "professional photography",
  };
  const style = styles[category || "wedding"] || styles.wedding;

  let compositionGuide = "";
  if (merchandiseFormat) {
    const format = MERCHANDISE_FORMATS[merchandiseFormat as MerchandiseFormatKey];
    if (format) {
      compositionGuide = `, ${format.aspectRatio} ratio`;
    }
  }

  let prompt: string;

  if (hasReferenceImage && referenceMode === "background_composite") {
    if (isCouple) {
      prompt = `${faceCore} Place this couple (${genderDesc} and ${partnerDesc}) into the reference background scene. ${style}${compositionGuide}. Photorealistic, 8K.`;
    } else {
      prompt = `${faceCore} Place this ${genderDesc} into the reference background scene. ${style}${compositionGuide}. Photorealistic, 8K.`;
    }
    if (basePrompt) prompt = `${basePrompt}. ${prompt}`;
  } else if (hasReferenceImage && referenceMode === "style_transfer") {
    if (isCouple) {
      prompt = `${faceCore} Photo of this couple (${genderDesc} and ${partnerDesc}) in similar style as reference. ${style}${compositionGuide}. Photorealistic, 8K.`;
    } else {
      prompt = `${faceCore} Photo of this ${genderDesc} in similar style as reference. ${style}${compositionGuide}. Photorealistic, 8K.`;
    }
    if (basePrompt) prompt = `${basePrompt}. ${prompt}`;
  } else if (hasReferenceImage && referenceMode === "face_swap") {
    prompt = `${faceCore} Replace the face in the reference image with the face from the provided photo. Keep everything else identical. Photorealistic, 8K.`;
    if (basePrompt) prompt = `${basePrompt}. ${prompt}`;
  } else if (hasReferenceImage && referenceMode === "direct_apply") {
    // 원본 직접 적용 모드: 참조 이미지를 그대로 적용, 프롬프트 변환 최소화
    prompt = `${faceCore} Reproduce this exact reference image with the provided face photo. Keep the exact same composition, background, lighting, clothing, pose, and every detail identical. Only replace the face. Photorealistic, 8K.`;
    if (basePrompt) prompt = `${basePrompt}. ${prompt}`;
  } else {
    const userPrompt = basePrompt || "professional portrait photo";
    if (isCouple) {
      prompt = `${faceCore} ${userPrompt}. Couple: ${genderDesc} and ${partnerDesc}, ${style}${compositionGuide}. Photorealistic, 8K.`;
    } else {
      prompt = `${faceCore} ${userPrompt}. ${genderDesc}, ${style}${compositionGuide}. Photorealistic, 8K.`;
    }
  }

  if (concept) prompt += ` ${concept}.`;

  // 프롬프트 길이 제한 (800자) - BAD_REQUEST 방지
  if (prompt.length > 800) {
    prompt = prompt.substring(0, 797) + "...";
  }

  return prompt;
}

// ─── 얼굴 참조 이미지 수집 (base64로 변환) ───
async function collectFaceReferenceBase64(clientId: number, partnerClientId?: number): Promise<Array<{ b64Json: string; mimeType: string }>> {
  const photos = await db.getClientPhotos(clientId);
  const refs: Array<{ b64Json: string; mimeType: string }> = [];
  
  // 정면 사진만 사용 (API 제한 대응 - 최대 1장)
  const frontPhoto = photos.find(p => p.photoType === "front");
  if (frontPhoto) {
    const b64 = await imageUrlToBase64(frontPhoto.originalUrl);
    if (b64) refs.push(b64);
  }
  
  // 파트너 사진 (커플 모드)
  if (partnerClientId && refs.length < 2) {
    const partnerPhotos = await db.getClientPhotos(partnerClientId);
    const partnerFront = partnerPhotos.find(p => p.photoType === "front");
    if (partnerFront) {
      const b64 = await imageUrlToBase64(partnerFront.originalUrl);
      if (b64) refs.push(b64);
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
          message: `${input.name} 고객이 등록되었습니다.`,
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
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateClient(id, data);
        return { success: true };
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
          await db.updateClient(client.partnerId, { partnerId: null as any });
        }
        await db.updateClient(input.clientId, { partnerId: null as any });
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
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64Data, "base64");
        const fileKey = `client-photos/${input.clientId}/${nanoid()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        return db.createClientPhoto({
          clientId: input.clientId,
          photoType: input.photoType,
          originalUrl: url,
          fileKey,
          fileName: input.fileName,
          mimeType: input.mimeType,
          fileSize: buffer.length,
        });
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
      .input(z.object({ clientId: z.number() }).optional())
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
        title: z.string().min(1),
        clientId: z.number(),
        category: z.enum(["wedding", "restoration", "kids", "profile", "video", "custom"]),
        concept: z.string().optional(),
        notes: z.string().optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        projectMode: z.enum(["single", "couple"]).optional(),
        partnerClientId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createProject({ ...input, userId: ctx.user.id, status: "draft" });
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        status: z.enum(["draft", "generating", "review", "revision", "upscaling", "completed", "delivered"]).optional(),
        concept: z.string().optional(),
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
        // 프로젝트 관련 생성물도 함께 삭제
        await db.deleteGenerationsByProject(input.id);
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
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        prompt: z.string().min(1),
        negativePrompt: z.string().optional(),
        category: z.enum(["wedding", "restoration", "kids", "profile", "video", "custom"]).optional(),
        subcategory: z.string().optional(),
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

  // ─── AI Generation (v3.2 - base64 직접 전달 + 프롬프트 간결화) ───
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
    
    // ─── 핵심: base64 직접 전달 + 프롬프트 간결화 ───
    generate: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        promptId: z.number().optional(),
        promptText: z.string().optional(),
        negativePrompt: z.string().optional(),
        parameters: z.record(z.string(), z.unknown()).optional(),
        referenceImageUrl: z.string().optional(),
        faceFixMode: z.boolean().optional(),
        merchandiseFormat: z.string().optional(),
        referenceMode: z.enum(["face_swap", "background_composite", "style_transfer", "direct_apply"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const startTime = Date.now();
        
        const project = await db.getProjectById(input.projectId);
        if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");
        
        const client = await db.getClientById(project.clientId);
        
        const format = input.merchandiseFormat 
          ? MERCHANDISE_FORMATS[input.merchandiseFormat as MerchandiseFormatKey]
          : undefined;

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

          // 1. 참조 이미지를 base64로 변환 (핀터레스트 포함)
          let refBase64: { b64Json: string; mimeType: string } | null = null;
          if (input.referenceImageUrl?.trim()) {
            refBase64 = await resolveImageToBase64(input.referenceImageUrl.trim());
            if (!refBase64) {
              // S3에 업로드 후 URL로 시도
              console.warn("[Generate] Could not convert reference to base64, trying URL directly");
            }
          }

          // 2. 참조 모드 결정
          const refMode = input.referenceMode || (refBase64 ? "background_composite" : "face_swap");

          // 3. 프롬프트 생성 (간결하게)
          const optimizedPrompt = buildFacePreservationPrompt({
            basePrompt: promptText || undefined,
            gender: client?.gender || "female",
            isCouple,
            partnerGender: partnerClient?.gender || "male",
            category: project.category,
            concept: project.concept || undefined,
            merchandiseFormat: input.merchandiseFormat,
            hasReferenceImage: !!refBase64,
            referenceMode: refMode,
          });

          // 4. originalImages 구성 (최대 2개 - API 제한)
          // 전략: 얼굴 참조 1장 + 배경/스타일 참조 1장 = 최대 2장
          const originalImages: Array<{ url?: string; b64Json?: string; mimeType?: string }> = [];
          
          if (input.faceFixMode && client) {
            // 얼굴 참조 (정면 사진 1장만 - base64)
            const faceRefs = await collectFaceReferenceBase64(
              client.id, 
              isCouple ? (project.partnerClientId ?? undefined) : undefined
            );
            if (faceRefs.length > 0) {
              // 커플이 아닌 경우 1장만, 커플인 경우 최대 2장
              const maxFace = isCouple ? 2 : 1;
              for (let i = 0; i < Math.min(faceRefs.length, maxFace); i++) {
                originalImages.push({ b64Json: faceRefs[i].b64Json, mimeType: faceRefs[i].mimeType });
              }
            }
          }

          // 배경/스타일 참조 이미지 (남은 슬롯에 추가)
          if (refBase64 && originalImages.length < 2) {
            originalImages.push({ b64Json: refBase64.b64Json, mimeType: refBase64.mimeType });
          }

          // 5. 이미지 생성 (최대 2개 이미지만 전달)
          const result = await generateImage({
            prompt: optimizedPrompt,
            originalImages: originalImages.length > 0 ? originalImages : undefined,
          });

          const imageUrl = result.url;
          if (!imageUrl) throw new Error("이미지 생성 결과 URL이 없습니다.");

          // 6. 결과 저장
          const generationTime = Date.now() - startTime;
          await db.updateGeneration(gen.id, {
            resultImageUrl: imageUrl,
            status: "completed",
            generationTimeMs: generationTime,
            faceConsistencyScore: input.faceFixMode ? 95 : undefined,
          });

          await db.updateProject(input.projectId, { status: "review" });

          await db.createNotification({
            userId: ctx.user.id,
            type: "generation_complete",
            title: "AI 이미지 생성 완료",
            message: `이미지가 생성되었습니다. (${(generationTime / 1000).toFixed(1)}초)`,
            relatedProjectId: input.projectId,
          });

          return { 
            id: gen.id, 
            imageUrl, 
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

    // 최종 검수 승인 (출고 전 최종 확인)
    finalApprove: protectedProcedure
      .input(z.object({
        id: z.number(),
        reviewNotes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateGeneration(input.id, {
          status: "approved",
          stage: "final",
          reviewNotes: input.reviewNotes || "최종 검수 승인",
        });
        
        const gen = await db.getGenerationById(input.id);
        await db.createNotification({
          userId: ctx.user.id,
          type: "generation_complete",
          title: "최종 검수 승인",
          message: "이미지가 최종 검수를 통과하여 출고 준비가 완료되었습니다.",
          relatedProjectId: gen?.projectId,
        });
        
        return { success: true };
      }),

    // 최종 검수 반려
    finalReject: protectedProcedure
      .input(z.object({
        id: z.number(),
        reviewNotes: z.string().min(1, "반려 사유를 입력해주세요."),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateGeneration(input.id, {
          status: "rejected",
          stage: "review",
          reviewNotes: input.reviewNotes,
        });
        return { success: true };
      }),

    // 최종 검수 대상 목록 (승인된 이미지 중 final이 아닌 것)
    reviewQueue: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getReviewQueueByProject(input.projectId);
      }),

    upscale: protectedProcedure
      .input(z.object({
        id: z.number(),
        prompt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const gen = await db.getGenerationById(input.id);
        if (!gen || !gen.resultImageUrl) throw new Error("생성 이미지를 찾을 수 없습니다.");

        // 원본 이미지를 base64로 변환
        const origBase64 = await imageUrlToBase64(gen.resultImageUrl);
        
        const enhancePrompt = "Enhance and upscale this image to ultra high resolution. Maintain ALL facial features exactly. Sharpen focus, improve clarity. Keep every detail identical.";
        const upscaleResult = await generateImage({
          prompt: enhancePrompt,
          originalImages: origBase64 ? [{ b64Json: origBase64.b64Json, mimeType: origBase64.mimeType }] : [{ url: gen.resultImageUrl, mimeType: "image/png" }],
        });
        const upscaledUrl = upscaleResult.url;
        if (!upscaledUrl) throw new Error("업스케일 결과 URL이 없습니다.");

        await db.updateGeneration(input.id, {
          upscaledImageUrl: upscaledUrl,
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

        return { url: upscaledUrl };
      }),

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

    // ─── AI Vision 프롬프트 자동 생성 (참조 이미지 분석) ───
    analyzeReferenceImages: protectedProcedure
      .input(z.object({
        imageUrls: z.array(z.string()).min(1).max(10),
        category: z.enum(["wedding", "restoration", "kids", "profile", "video", "custom"]).optional(),
        gender: z.enum(["female", "male"]).optional(),
        isCouple: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          // 이미지 URL들을 LLM Vision에 전달하여 정밀 프롬프트 생성
          const imageContents: Array<{ type: "image_url"; image_url: { url: string; detail: "high" } }> = [];
          
          for (const url of input.imageUrls) {
            // 핀터레스트 URL인 경우 실제 이미지 URL 추출
            let imageUrl = url;
            if (url.includes("pinterest") || url.includes("pin.it")) {
              const resolved = await resolveImageToBase64(url);
              if (resolved) {
                // base64를 data URL로 변환
                imageUrl = `data:${resolved.mimeType};base64,${resolved.b64Json}`;
              }
            } else {
              // 일반 URL도 접근 가능한지 확인, 불가능하면 base64로 변환
              try {
                const resolved = await imageUrlToBase64(url);
                if (resolved) {
                  imageUrl = `data:${resolved.mimeType};base64,${resolved.b64Json}`;
                }
              } catch {
                // URL 그대로 사용
              }
            }
            
            imageContents.push({
              type: "image_url",
              image_url: { url: imageUrl, detail: "high" },
            });
          }

          const categoryContext: Record<string, string> = {
            wedding: "웨딩 사진 촬영",
            profile: "프로필 사진 촬영",
            kids: "아동 사진 촬영",
            restoration: "사진 복원",
            video: "영상 제작",
            custom: "커스텀 사진 촬영",
          };

          const context = categoryContext[input.category || "wedding"] || "사진 촬영";
          const genderHint = input.gender === "male" ? "남성" : "여성";
          const coupleHint = input.isCouple ? "커플(남녀)" : genderHint;

          const systemPrompt = `You are an expert AI image generation prompt engineer specializing in photorealistic portrait photography.
Your task is to analyze reference images and create a detailed prompt that will reproduce the EXACT same scene, composition, lighting, and style.

IMPORTANT RULES:
1. Describe the scene in extreme detail: background, lighting direction, color temperature, time of day, weather
2. Describe the pose, body position, camera angle, focal length
3. Describe clothing, accessories, hair style in detail
4. Describe the mood, atmosphere, color grading
5. Do NOT describe facial features - those will come from the client's reference photo
6. Write the prompt in English only
7. Keep the prompt under 600 characters
8. Focus on making the output photorealistic and cinematic
9. The subject is: ${coupleHint} for ${context}`;

          const userContent: Array<any> = [
            ...imageContents,
            {
              type: "text" as const,
              text: `Analyze these ${input.imageUrls.length} reference image(s) and create a single detailed image generation prompt that will reproduce the exact same scene, composition, lighting, style, and atmosphere. The subject will be ${coupleHint}. Remember: do NOT describe facial features, only the scene, pose, clothing, lighting, and atmosphere. Output ONLY the prompt text, nothing else.`,
            },
          ];

          const result = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userContent },
            ],
          });

          const generatedPrompt = typeof result.choices[0]?.message?.content === "string" 
            ? result.choices[0].message.content.trim()
            : "";

          if (!generatedPrompt) {
            throw new Error("프롬프트 생성에 실패했습니다.");
          }

          return {
            prompt: generatedPrompt,
            negativePrompt: "(deformed, distorted, disfigured:1.3), poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, (mutated hands and fingers:1.4), disconnected limbs, mutation, mutated, ugly, disgusting, blurry, amputation, plastic skin, cartoon, anime, illustration, painting, drawing, sketch",
            imageCount: input.imageUrls.length,
          };
        } catch (error: any) {
          throw new Error(`이미지 분석 실패: ${error.message}`);
        }
      }),

    // ─── 커플 전용 파이프라인 (v3.9) ───
    generateCouple: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        promptText: z.string(),
        brideClientId: z.number(),
        groomClientId: z.number().nullable(),
        attempts: z.number().default(3),
      }))
      .mutation(async ({ ctx, input }) => {
        // 신랑 고객 연결 확인
        if (!input.groomClientId) {
          throw new Error("신랑 고객을 먼저 연결해주세요");
        }

        // 신부 사진 (front 우선, 없으면 첫 번째 사진)
        const bridePhotos = await db.getClientPhotos(input.brideClientId);
        const bridePhoto = bridePhotos.find(p => p.photoType === "front") || bridePhotos[0];
        if (!bridePhoto) throw new Error("신부 사진이 없습니다. 사진을 먼저 업로드해주세요.");

        // 신랑 사진 (front 우선, 없으면 첫 번째 사진)
        const groomPhotos = await db.getClientPhotos(input.groomClientId);
        const groomPhoto = groomPhotos.find(p => p.photoType === "front") || groomPhotos[0];
        if (!groomPhoto) throw new Error("신랑 사진이 없습니다. 사진을 먼저 업로드해주세요.");

        // 커플 파이프라인 실행 (3장 생성)
        const { generateCouplePipeline } = await import(
          './services/couple-pipeline'
        );
        const resultUrls = await generateCouplePipeline(
          input.promptText,
          bridePhoto.originalUrl,
          groomPhoto.originalUrl,
          input.attempts,
        );

        // 각 결과를 generation으로 저장
        const saved = [];
        for (const url of resultUrls) {
          const gen = await db.createGeneration({
            projectId: input.projectId,
            promptText: input.promptText,
            resultImageUrl: url,
            status: "completed",
            stage: "draft",
            faceConsistencyScore: 75,
          });
          saved.push(gen);
        }

        return {
          count: saved.length,
          generations: saved,
          message: `${saved.length}장 생성됨. 가장 잘 나온 걸 선택하세요.`,
        };
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
        motionType: z.enum(["zoom_in", "zoom_out", "pan_left", "pan_right", "slow_zoom", "cinematic"]).optional(),
        customPrompt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createVideoConversion({
          generationId: input.generationId,
          projectId: input.projectId,
          sourceImageUrl: input.sourceImageUrl,
          duration: input.duration,
          motionType: input.motionType,
          customPrompt: input.customPrompt,
        });
        
        processVideoAsync(result.id, input, ctx.user.id).catch(err => {
          console.error("[Video] Processing failed:", err);
        });

        return result;
      }),
    // 영상 재생성 (커스텀 프롬프트로)
    regenerate: protectedProcedure
      .input(z.object({
        videoId: z.number(),
        customPrompt: z.string().min(1),
        motionType: z.enum(["zoom_in", "zoom_out", "pan_left", "pan_right", "slow_zoom", "cinematic"]).optional(),
        duration: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const existingVideo = await db.getVideoConversionById(input.videoId);
        if (!existingVideo) throw new Error("영상을 찾을 수 없습니다.");

        await db.updateVideoConversion(input.videoId, {
          status: "queued",
          customPrompt: input.customPrompt,
          motionType: input.motionType || existingVideo.motionType,
          videoUrl: null,
          errorMessage: null,
        });

        processVideoAsync(
          input.videoId,
          {
            sourceImageUrl: existingVideo.sourceImageUrl,
            duration: input.duration || existingVideo.duration || 5,
            motionType: input.motionType || existingVideo.motionType || "cinematic",
            projectId: existingVideo.projectId,
            customPrompt: input.customPrompt,
          },
          ctx.user.id
        ).catch((err: any) => {
          console.error("[Video Regen] Processing failed:", err);
        });

        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteVideoConversion(input.id);
        return { success: true };
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
          const restorePrompt = "Restore this photo. Enhance clarity, fix damage, improve resolution. Preserve all facial features exactly.";
          const origBase64 = await imageUrlToBase64(input.originalUrl);
          const restoreResult = await generateImage({
            prompt: restorePrompt,
            originalImages: origBase64 ? [{ b64Json: origBase64.b64Json, mimeType: origBase64.mimeType }] : [{ url: input.originalUrl, mimeType: "image/jpeg" }],
          });
          const restoredUrl = restoreResult.url;
          if (!restoredUrl) throw new Error("복원 결과 URL이 없습니다.");
          await db.updatePhotoRestoration(result.id, { restoredUrl, status: "completed" });
          return { id: result.id, restoredUrl };
        } catch (error: any) {
          await db.updatePhotoRestoration(result.id, { status: "failed", errorMessage: error.message });
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

  // ─── Preview (고객 미리보기 - 퍼블릭) ───
  preview: router({
    verify: publicProcedure
      .input(z.object({
        clientId: z.number(),
        token: z.string(),
        birthdate: z.string(),
      }))
      .mutation(async ({ input }) => {
        const client = await db.getClientById(input.clientId);
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "고객 정보를 찾을 수 없습니다" });

        // 토큰 검증
        const expectedToken = `preview-${input.clientId}`;
        if (input.token !== expectedToken) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "유효하지 않은 링크입니다" });
        }

        // 생년월일 검증: phone 뒤 6자리 또는 consultationNotes에서 확인
        const phone = client.phone || "";
        const phoneLast6 = phone.replace(/[^0-9]/g, "").slice(-6);
        const notes = client.consultationNotes || "";
        
        // phone 뒤 6자리 매칭 또는 consultationNotes에 birthdate 포함 여부
        if (phoneLast6 && input.birthdate === phoneLast6) {
          return { success: true, clientName: client.name };
        }
        if (notes.includes(input.birthdate)) {
          return { success: true, clientName: client.name };
        }
        
        throw new TRPCError({ code: "UNAUTHORIZED", message: "생년월일이 일치하지 않습니다" });
      }),

    getGallery: publicProcedure
      .input(z.object({
        clientId: z.number(),
        token: z.string(),
      }))
      .query(async ({ input }) => {
        const client = await db.getClientById(input.clientId);
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "고객 없음" });

        const expectedToken = `preview-${input.clientId}`;
        if (input.token !== expectedToken) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "유효하지 않은 링크입니다" });
        }

        const projects = await db.getProjectsByClient(input.clientId);
        const images: any[] = [];
        for (const proj of projects) {
          const gens = await db.getGenerationsByProject(proj.id);
          const approved = gens.filter((g: any) =>
            g.status === "completed" || g.status === "approved"
          );
          images.push(...approved.map((g: any) => ({
            id: g.id,
            imageUrl: g.imageUrl,
            prompt: g.prompt,
            status: g.status,
            projectId: proj.id,
            projectName: proj.title,
            createdAt: g.createdAt,
          })));
        }
        return { images, clientName: client.name };
      }),

    submitFeedback: publicProcedure
      .input(z.object({
        clientId: z.number(),
        token: z.string(),
        generationId: z.number(),
        liked: z.boolean().optional(),
        revisionCategories: z.array(z.string()).optional(),
        revisionNote: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const expectedToken = `preview-${input.clientId}`;
        if (input.token !== expectedToken) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "유효하지 않은 링크입니다" });
        }

        if (input.liked !== undefined) {
          // 좋아요/좋아요 취소
          await db.updateGeneration(input.generationId, {
            reviewNotes: input.liked ? "[고객 좋아요]" : "",
          });
        }

        if (input.revisionNote || (input.revisionCategories && input.revisionCategories.length > 0)) {
          const categories = input.revisionCategories?.join(", ") || "";
          await db.updateGeneration(input.generationId, {
            status: "reviewed",
            reviewNotes: `[고객 수정요청] ${categories}: ${input.revisionNote || ""}`,
          });
        }
        return { success: true };
      }),
  }),

  // ─── Invitations (청첩장 영상) ───
  invitations: router({
    generateText: protectedProcedure
      .input(z.object({
        groomName: z.string(),
        brideName: z.string(),
        weddingDate: z.string(),
        venue: z.string(),
        style: z.string(),
      }))
      .mutation(async ({ input }) => {
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          messages: [{
            role: "user",
            content: `${input.groomName}과 ${input.brideName}의 웨딩 청첩 문구를
${input.style} 스타일로 3가지 만들어줘.
예식일: ${input.weddingDate}, 장소: ${input.venue}
각각 40자 내외, 한국어, 감성적으로.
JSON 배열로만 답해 (다른 텍스트 없이):
["\ubb38\uad6c1", "\ubb38\uad6c2", "\ubb38\uad6c3"]`,
          }],
        });

        const text = (response.content[0] as any).text;
        const match = text.match(/\[[\s\S]*\]/);
        const texts = match ? JSON.parse(match[0]) : [
          "두 사람이 하나가 되는 날, 함께해 주세요.",
          "사랑이 완성되는 순간에 초대합니다.",
          "설레는 마음으로 기다리겠습니다.",
        ];
        return { texts };
      }),
  }),
});

// ─── 영상 생성 비동기 처리 ───
async function processVideoAsync(
  videoId: number, 
  input: { sourceImageUrl: string; duration?: number; motionType?: string; projectId: number; customPrompt?: string },
  userId: number
) {
  try {
    await db.updateVideoConversion(videoId, { status: "processing" });
    
    const motionPrompts: Record<string, string> = {
      cinematic: "cinematic wedding video, smooth gentle motion, romantic atmosphere, soft camera drift",
      zoom_in: "slow cinematic zoom in, romantic wedding, dreamy",
      zoom_out: "slow cinematic zoom out, ethereal wedding moment",
      pan_left: "smooth pan left, elegant wedding photography",
      pan_right: "smooth pan right, cinematic wedding",
      slow_zoom: "very slow gentle zoom with parallax for dreamy feel, romantic",
    };

    const motionType = input.motionType || "cinematic";
    const prompt = input.customPrompt || motionPrompts[motionType] || motionPrompts.cinematic;

    const { fal } = await import("@fal-ai/client");
    fal.config({ credentials: process.env.FAL_KEY || "" });

    const result = await fal.subscribe(
      "fal-ai/kling-video/v1.6/standard/image-to-video",
      {
        input: {
          image_url: input.sourceImageUrl,
          prompt,
          duration: (input.duration || 5) <= 5 ? "5" : "10",
        },
      }
    );

    const videoUrl = (result as any).data?.video?.url;
    if (videoUrl) {
      await db.updateVideoConversion(videoId, { videoUrl, status: "completed" });
      await db.createNotification({ userId, type: "generation_complete", title: "영상 변환 완료", message: "이미지가 영상으로 변환되었습니다." });
    } else {
      throw new Error("영상 생성 결과가 없습니다.");
    }
  } catch (error: any) {
    await db.updateVideoConversion(videoId, { status: "failed", errorMessage: error.message });
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

        const originalImages: Array<{ b64Json?: string; url?: string; mimeType?: string }> = [];
        if (batch.batchConfig?.faceFixMode && client) {
          const faceRefs = await collectFaceReferenceBase64(
            client.id,
            isCouple ? (project.partnerClientId ?? undefined) : undefined
          );
          if (faceRefs.length > 0) {
            originalImages.push({ b64Json: faceRefs[0].b64Json, mimeType: faceRefs[0].mimeType });
          }
        }

        const result = await generateImage({
          prompt: optimizedPrompt,
          originalImages: originalImages.length > 0 ? originalImages : undefined,
        });

        if (!result.url) throw new Error("이미지 생성 실패");

        const gen = await db.createGeneration({
          projectId: item.projectId,
          promptText: item.promptText,
          status: "completed",
          stage: "draft",
          resultImageUrl: result.url,
          faceConsistencyScore: batch.batchConfig?.faceFixMode ? 95 : undefined,
          merchandiseFormat: batch.batchConfig?.merchandiseFormat,
        });

        await db.updateBatchJobItem(item.id, { status: "completed", generationId: gen.id });
        completedCount++;
      } catch (err: any) {
        await db.updateBatchJobItem(item.id, { status: "failed", errorMessage: err.message });
        failedCount++;
      }

      await db.updateBatchJob(batchJobId, { completedItems: completedCount, failedItems: failedCount });
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
      message: `배치 처리 완료. (성공: ${completedCount}, 실패: ${failedCount})`,
    });
  } catch (error: any) {
    await db.updateBatchJob(batchJobId, { status: "failed" });
    console.error("[Batch] Fatal error:", error);
  }
}

export type AppRouter = typeof appRouter;
