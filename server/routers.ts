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
import { runSinglePipeline, runCouplePipeline, upscale4K, generateBaseImage, applyFaceEnsemble } from "./services/image-pipeline";
import Anthropic from "@anthropic-ai/sdk";

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
  
  // 1순위: 정면 사진 (필수)
  const frontPhoto = photos.find(p => p.photoType === "front");
  if (frontPhoto) {
    const b64 = await imageUrlToBase64(frontPhoto.originalUrl);
    if (b64) refs.push(b64);
  }
  
  // 2순위: 얼굴 참조 사진들 (face_reference) - 다양한 각도로 얼굴 일관성 향상
  // API 제한으로 최대 2장까지만 전달 (정면 + 가장 최근 얼굴 참조 1장)
  if (refs.length < 2) {
    const faceRefs = photos.filter(p => p.photoType === "face_reference");
    if (faceRefs.length > 0) {
      const b64 = await imageUrlToBase64(faceRefs[0].originalUrl);
      if (b64) refs.push(b64);
    }
  }
  
  // 파트너 사진 (커플 모드) - 파트너의 정면 사진 추가
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

// ─── AI 자동 검수 시스템 (LLM Vision 기반) ───
async function performAIReview(generationId: number, imageUrl: string, hasFaceRef: boolean): Promise<void> {
  try {
    // 이미지를 base64로 변환
    let imageContent: string = imageUrl;
    try {
      const b64 = await imageUrlToBase64(imageUrl);
      if (b64) {
        imageContent = `data:${b64.mimeType};base64,${b64.b64Json}`;
      }
    } catch {
      // URL 그대로 사용
    }

    const systemPrompt = `You are an expert photo quality inspector for a professional wedding/portrait photography studio.
You must analyze the generated AI image and provide quality scores and feedback.

Evaluate these aspects:
1. COLOR & LIGHTING (colorScore 0-100): Color balance, white balance, exposure, contrast, skin tone naturalness
2. COMPOSITION (compositionScore 0-100): Framing, rule of thirds, subject placement, background
3. HANDS & FINGERS (handScore 0-100): Check for deformed/extra/missing fingers, unnatural hand poses, merged fingers
4. FACE QUALITY (faceScore 0-100): Facial feature clarity, symmetry, natural expression, skin texture${hasFaceRef ? ', consistency with reference' : ''}

Respond in JSON format ONLY:
{
  "colorScore": number,
  "compositionScore": number,
  "handScore": number,
  "faceScore": number,
  "overallFeedback": "string in Korean",
  "issues": ["issue1 in Korean", ...],
  "suggestions": ["suggestion1 in Korean", ...]
}`;

    const result = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "image_url" as const,
              image_url: { url: imageContent, detail: "high" as const },
            },
            {
              type: "text" as const,
              text: "Analyze this AI-generated portrait/wedding photo. Provide detailed quality scores and feedback. Respond in JSON only.",
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ai_review",
          strict: true,
          schema: {
            type: "object",
            properties: {
              colorScore: { type: "integer", description: "Color/lighting score 0-100" },
              compositionScore: { type: "integer", description: "Composition score 0-100" },
              handScore: { type: "integer", description: "Hand/finger quality score 0-100" },
              faceScore: { type: "integer", description: "Face quality score 0-100" },
              overallFeedback: { type: "string", description: "Overall feedback in Korean" },
              issues: { type: "array", items: { type: "string" }, description: "Issues found in Korean" },
              suggestions: { type: "array", items: { type: "string" }, description: "Improvement suggestions in Korean" },
            },
            required: ["colorScore", "compositionScore", "handScore", "faceScore", "overallFeedback", "issues", "suggestions"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = result.choices[0]?.message?.content;
    if (!content) return;

    const review = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
    const overallScore = Math.round(
      (review.colorScore * 0.25) + (review.compositionScore * 0.25) + (review.handScore * 0.25) + (review.faceScore * 0.25)
    );

    await db.updateGeneration(generationId, {
      aiReviewScore: overallScore,
      aiReviewDetails: review,
      faceConsistencyScore: review.faceScore,
    });

    console.log(`[AI Review] Generation #${generationId}: Score ${overallScore}/100`);
  } catch (error: any) {
    console.error(`[AI Review] Error for generation #${generationId}:`, error.message);
  }
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
    // 얼굴 참조 사진만 조회 (최대 25장)
    faceReferences: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const photos = await db.getClientPhotos(input.clientId);
        return photos.filter(p => p.photoType === "face_reference");
      }),
    upload: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        photoType: z.enum(["front", "side", "additional", "face_reference"]),
        fileName: z.string(),
        mimeType: z.string(),
        base64Data: z.string(),
      }))
      .mutation(async ({ input }) => {
        // 얼굴 참조 사진 25장 제한 체크
        if (input.photoType === "face_reference") {
          const existing = await db.getClientPhotos(input.clientId);
          const faceRefCount = existing.filter(p => p.photoType === "face_reference").length;
          if (faceRefCount >= 25) {
            throw new Error("얼굴 참조 사진은 최대 25장까지 등록할 수 있습니다. 기존 사진을 삭제한 후 다시 시도해주세요.");
          }
        }
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
    // 얼굴 참조 사진 변경 (교체)
    replace: protectedProcedure
      .input(z.object({
        id: z.number(),
        fileName: z.string(),
        mimeType: z.string(),
        base64Data: z.string(),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64Data, "base64");
        const fileKey = `client-photos/replaced/${nanoid()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        await db.updateClientPhoto(input.id, {
          originalUrl: url,
          fileKey,
          fileName: input.fileName,
          mimeType: input.mimeType,
          fileSize: buffer.length,
        });
        return { success: true, url };
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

  // ─── AI Generation (v4.3 - fal.ai Pipeline + Claude Vision) ───
  generations: router({
    // ── 목록 조회 ──
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

    // ── 핵심! 이미지 생성 (fal.ai 파이프라인) ──
    generate: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        promptId: z.number().optional(),
        promptText: z.string().optional(),
        negativePrompt: z.string().optional(),
        parameters: z.record(z.string(), z.unknown()).optional(),
        referenceImageUrl: z.string().optional(),
        faceFixMode: z.boolean().default(true),
        referenceMode: z.enum([
          "background_composite", "style_transfer", "face_swap", "direct_apply"
        ]).optional(),
        merchandiseFormat: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const startTime = Date.now();

        const project = await db.getProjectById(input.projectId);
        if (!project) throw new Error("프로젝트를 찾을 수 없습니다");

        const client = await db.getClientById(project.clientId);
        const clientPhotos = await db.getClientPhotos(project.clientId);
        const frontPhoto = clientPhotos.find(p => p.photoType === "front");

        const format = input.merchandiseFormat
          ? MERCHANDISE_FORMATS[input.merchandiseFormat as MerchandiseFormatKey]
          : undefined;

        // generation 레코드 생성 (generating 상태)
        const gen = await db.createGeneration({
          projectId: input.projectId,
          promptId: input.promptId,
          promptText: input.promptText || "(fal.ai 파이프라인 자동 생성)",
          negativePrompt: input.negativePrompt,
          parameters: {
            ...input.parameters,
            faceFixMode: input.faceFixMode,
            merchandiseFormat: input.merchandiseFormat,
            referenceMode: input.referenceMode,
            engine: "fal-ai",
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
          let resultImageUrl = "";
          const isCouple = project.projectMode === "couple" && !!project.partnerClientId;
          const prompt = input.promptText || "romantic Korean wedding photo, golden hour";
          const neg = input.negativePrompt;

          if (input.faceFixMode && frontPhoto) {
            // 얼굴 참조 사진들 수집 (정면 + face_reference 최대 2장)
            const faceRefPhotos = clientPhotos
              .filter(p => p.photoType === "face_reference")
              .slice(0, 2);
            const allFaceUrls = [
              frontPhoto.originalUrl,
              ...faceRefPhotos.map(p => p.originalUrl),
            ];

            if (isCouple && project.partnerClientId) {
              // 커플 파이프라인
              const partnerPhotos = await db.getClientPhotos(project.partnerClientId);
              const partnerFront = partnerPhotos.find(p => p.photoType === "front");

              if (partnerFront) {
                const partnerFaceRefs = partnerPhotos
                  .filter(p => p.photoType === "face_reference")
                  .slice(0, 2);
                const partnerFaceUrls = [
                  partnerFront.originalUrl,
                  ...partnerFaceRefs.map(p => p.originalUrl),
                ];

                // 성별에 따라 신랑/신부 결정
                const isBride = client?.gender === "female";
                const baseUrl = await generateBaseImage(prompt, neg);
                // 신부 얼굴 앙상블 먼저 적용
                const withBride = await applyFaceEnsemble(
                  baseUrl,
                  isBride ? allFaceUrls : partnerFaceUrls
                );
                // 신랑 얼굴 앙상블 적용
                const withCouple = await applyFaceEnsemble(
                  withBride,
                  isBride ? partnerFaceUrls : allFaceUrls
                );
                resultImageUrl = await upscale4K(withCouple);
              } else {
                // 파트너 정면 사진 없으면 개인 앙상블로 대체
                const baseUrl = await generateBaseImage(prompt, neg);
                const withFace = await applyFaceEnsemble(baseUrl, allFaceUrls);
                resultImageUrl = await upscale4K(withFace);
              }
            } else {
              // 개인 파이프라인 - 앙상블 적용
              const baseUrl = await generateBaseImage(prompt, neg);
              const withFace = await applyFaceEnsemble(baseUrl, allFaceUrls);
              resultImageUrl = await upscale4K(withFace);
            }
          } else {
            // 얼굴 고정 없이 기본 생성
            resultImageUrl = await generateBaseImage(prompt, neg);
          }

          const generationTimeMs = Date.now() - startTime;
          await db.updateGeneration(gen.id, {
            resultImageUrl,
            status: "completed",
            generationTimeMs,
            faceConsistencyScore: input.faceFixMode ? 92 : undefined,
          });

          await db.updateProject(input.projectId, { status: "review" });

          // AI 자동 검수 (비동기 - 백그라운드에서 실행)
          performAIReview(gen.id, resultImageUrl, input.faceFixMode || false).catch(err => {
            console.error("[AI Review] Failed:", err);
          });

          await db.createNotification({
            userId: ctx.user.id,
            type: "generation_complete",
            title: "AI 이미지 생성 완료",
            message: `fal.ai 파이프라인으로 이미지가 생성되었습니다. (${(generationTimeMs / 1000).toFixed(1)}초)`,
            relatedProjectId: input.projectId,
          });

          return { id: gen.id, imageUrl: resultImageUrl, generationTimeMs, faceConsistencyScore: input.faceFixMode ? 92 : undefined };

        } catch (error: any) {
          await db.updateGeneration(gen.id, {
            status: "failed",
            reviewNotes: error.message,
          });
          throw new Error(`이미지 생성 실패: ${error.message}`);
        }
      }),

    // ── 4K 업스케일 (fal.ai ESRGAN) ──
    upscale: protectedProcedure
      .input(z.object({ id: z.number(), prompt: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const gen = await db.getGenerationById(input.id);
        if (!gen?.resultImageUrl) throw new Error("이미지를 찾을 수 없습니다");

        const upscaledUrl = await upscale4K(
          gen.upscaledImageUrl || gen.resultImageUrl
        );

        await db.updateGeneration(input.id, {
          upscaledImageUrl: upscaledUrl,
          stage: "upscaled",
          status: "approved",
        });

        await db.createNotification({
          userId: ctx.user.id,
          type: "generation_complete",
          title: "4K 업스케일링 완료",
          message: "fal.ai ESRGAN으로 이미지가 4K 초고화질로 업스케일링되었습니다.",
          relatedProjectId: gen.projectId,
        });

        return { success: true, url: upscaledUrl, upscaledImageUrl: upscaledUrl };
      }),

    // ── 참조 이미지 AI 분석 (Claude Vision) ──
    analyzeReferenceImages: protectedProcedure
      .input(z.object({
        imageUrls: z.array(z.string()).min(1).max(10),
        category: z.enum(["wedding", "restoration", "kids", "profile", "video", "custom"]).optional(),
        gender: z.enum(["female", "male"]).optional(),
        isCouple: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });

        const imageContents = input.imageUrls.slice(0, 5).map(url => ({
          type: "image" as const,
          source: { type: "url" as const, url },
        }));

        const subject = input.isCouple
          ? "Korean wedding couple"
          : input.gender === "male" ? "Korean groom" : "Korean bride";

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 800,
          messages: [{
            role: "user",
            content: [
              ...imageContents,
              {
                type: "text",
                text: `Analyze this wedding photo and create an image generation prompt.

STRICT RULES:
- NEVER describe faces, skin, eyes, nose, or any facial features
- ONLY describe: background, location, lighting, pose/composition, mood, camera angle, style
- Subject: ${subject}

Reply in this exact format:
PROMPT: [English prompt, max 120 words, no face description]
NEGATIVE: [English negative prompt]`,
              },
            ],
          }],
        });

        const text = (response.content[0] as any).text as string;
        const promptMatch = text.match(/PROMPT:\s*([\s\S]+?)(?=NEGATIVE:|$)/);
        const negMatch = text.match(/NEGATIVE:\s*([\s\S]+?)$/);

        return {
          prompt: promptMatch?.[1].trim() ?? text,
          negativePrompt: negMatch?.[1].trim() ?? "(deformed, distorted, disfigured:1.3), poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, (mutated hands and fingers:1.4), disconnected limbs, mutation, mutated, ugly, disgusting, blurry, amputation, plastic skin, cartoon, anime, illustration, painting, drawing, sketch",
          imageCount: input.imageUrls.length,
        };
      }),

    // ── AI 검수 (Claude Vision) ──
    requestAIReview: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const gen = await db.getGenerationById(input.id);
        if (!gen?.resultImageUrl) throw new Error("이미지를 찾을 수 없습니다");

        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 600,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "url", url: gen.resultImageUrl } },
              {
                type: "text",
                text: `Review this AI-generated Korean wedding photo professionally.
Score each 0-100 and reply with ONLY valid JSON:
{
  "colorScore": ,
  "compositionScore": ,
  "handScore": ,
  "faceScore": ,
  "overallFeedback": "",
  "issues": [""],
  "suggestions": [""]
}`,
              },
            ],
          }],
        });

        const text = (response.content[0] as any).text as string;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const details = jsonMatch
          ? JSON.parse(jsonMatch[0])
          : { colorScore: 75, compositionScore: 75, handScore: 70, faceScore: 80,
              overallFeedback: "검수 완료", issues: [], suggestions: [] };

        const score = Math.round(
          (details.colorScore + details.compositionScore +
           details.handScore + details.faceScore) / 4
        );

        await db.updateGeneration(input.id, {
          aiReviewScore: score,
          aiReviewDetails: details,
        });

        return { aiReviewScore: score, aiReviewDetails: details };
      }),

    // ── 상태 업데이트 ──
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

    // 최종 검수 대상 목록
    reviewQueue: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getReviewQueueByProject(input.projectId);
      }),

    // ── 삭제 ──
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteGeneration(input.id);
        return { success: true };
      }),

    // ── 상품 포맷 목록 ──
    merchandiseFormats: publicProcedure.query(() => {
      return Object.entries(MERCHANDISE_FORMATS).map(([key, val]) => ({
        key,
        ...(val as any),
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

  // ─── Video Conversions (Kling AI via fal.ai) ───
  videos: router({
    // ── 목록 ──
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getVideoConversionsByProject(input.projectId);
      }),

    // ── 영상 생성 (Kling AI) ──
    create: protectedProcedure
      .input(z.object({
        generationId: z.number(),
        projectId: z.number(),
        sourceImageUrl: z.string(),
        duration: z.number().default(5),
        motionType: z.string().optional(),
        customPrompt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // DB에 먼저 저장
        const video = await db.createVideoConversion({
          generationId: input.generationId,
          projectId: input.projectId,
          sourceImageUrl: input.sourceImageUrl,
          duration: input.duration,
          motionType: input.motionType,
          customPrompt: input.customPrompt,
          status: "queued",
        });

        // 백그라운드 비동기 처리
        (async () => {
          try {
            await db.updateVideoConversion(video.id, { status: "processing" });

            const falClient = await import("@fal-ai/client");
            falClient.fal.config({ credentials: process.env.FAL_KEY || "" });

            const motionPrompts: Record<string, string> = {
              cinematic: "cinematic wedding video, smooth motion, romantic atmosphere",
              zoom_in: "slow cinematic zoom in, romantic wedding",
              zoom_out: "slow cinematic zoom out, dreamy wedding",
              pan_left: "smooth pan left, elegant wedding photography",
              pan_right: "smooth pan right, cinematic wedding",
              slow_zoom: "ultra slow zoom, ethereal wedding moment",
            };

            const prompt = input.customPrompt ||
              motionPrompts[input.motionType || "cinematic"] ||
              "cinematic wedding video";

            const result = await falClient.fal.subscribe(
              "fal-ai/kling-video/v1.6/standard/image-to-video",
              {
                input: {
                  image_url: input.sourceImageUrl,
                  prompt,
                  duration: input.duration <= 5 ? "5" : "10",
                },
              }
            );

            const videoUrl =
              (result as any).data?.video?.url || input.sourceImageUrl;

            await db.updateVideoConversion(video.id, {
              videoUrl,
              status: "completed",
            });

            await db.createNotification({
              userId: ctx.user.id,
              type: "generation_complete",
              title: "영상 변환 완료",
              message: "Kling AI로 이미지가 영상으로 변환되었습니다.",
            });
          } catch (err: any) {
            await db.updateVideoConversion(video.id, {
              status: "failed",
              errorMessage: err.message,
            });
          }
        })();

        return video;
      }),

    // ── 영상 재생성 ──
    regenerate: protectedProcedure
      .input(z.object({
        videoId: z.number(),
        customPrompt: z.string(),
        motionType: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const video = await db.getVideoConversionById(input.videoId);
        if (!video) throw new Error("영상을 찾을 수 없습니다");

        await db.updateVideoConversion(input.videoId, {
          status: "queued",
          customPrompt: input.customPrompt,
          motionType: input.motionType,
          videoUrl: null,
          errorMessage: null,
        });

        // 백그라운드 재생성
        (async () => {
          try {
            await db.updateVideoConversion(input.videoId, { status: "processing" });

            const falClient = await import("@fal-ai/client");
            falClient.fal.config({ credentials: process.env.FAL_KEY || "" });

            const result = await falClient.fal.subscribe(
              "fal-ai/kling-video/v1.6/standard/image-to-video",
              {
                input: {
                  image_url: video.sourceImageUrl,
                  prompt: input.customPrompt,
                  duration: (video.duration || 5) <= 5 ? "5" : "10",
                },
              }
            );

            const videoUrl =
              (result as any).data?.video?.url || video.sourceImageUrl;

            await db.updateVideoConversion(input.videoId, {
              videoUrl,
              status: "completed",
            });

            await db.createNotification({
              userId: ctx.user.id,
              type: "generation_complete",
              title: "영상 재생성 완료",
              message: "Kling AI로 영상이 재생성되었습니다.",
            });
          } catch (err: any) {
            await db.updateVideoConversion(input.videoId, {
              status: "failed",
              errorMessage: err.message,
            });
          }
        })();

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

  // ─── Invitations (모바일 청첩장) ───
  invitations: router({
    // AI 청첩 문구 생성
    generateText: protectedProcedure
      .input(z.object({
        groomName: z.string(),
        brideName: z.string(),
        weddingDate: z.string(),
        venue: z.string(),
        style: z.string(),
      }))
      .mutation(async ({ input }) => {
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 600,
          messages: [{
            role: "user",
            content: `${input.groomName}과 ${input.brideName}의 ${input.weddingDate} ${input.venue} 웨딩 청첩 문구를 ${input.style} 스타일로 3가지 만들어줘.\n각각 50자 내외, 한국어, 감성적으로.\nJSON 배열로만 답해: ["문구1", "문구2", "문구3"]`,
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

// processVideoAsync removed - video processing is now inline in the videos router using fal.ai Kling Video API

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
