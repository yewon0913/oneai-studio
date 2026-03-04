import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock db module
vi.mock("./db", () => ({
  getDashboardStats: vi.fn().mockResolvedValue({
    totalClients: 5,
    activeProjects: 3,
    completedProjects: 10,
    totalGenerations: 50,
    pendingReviews: 2,
  }),
  getClientsByUser: vi.fn().mockResolvedValue([
    { id: 1, name: "김신부", gender: "female", phone: "010-1234-5678", status: "consulting", partnerId: 2 },
    { id: 2, name: "이신랑", gender: "male", phone: "010-9876-5432", status: "consulting", partnerId: 1 },
  ]),
  getClientById: vi.fn().mockImplementation((id: number) => {
    if (id === 1) return Promise.resolve({ id: 1, name: "김신부", gender: "female", phone: "010-1234-5678", status: "consulting", partnerId: 2 });
    if (id === 2) return Promise.resolve({ id: 2, name: "이신랑", gender: "male", phone: "010-9876-5432", status: "consulting", partnerId: 1 });
    return Promise.resolve(null);
  }),
  createClient: vi.fn().mockResolvedValue({ id: 3 }),
  updateClient: vi.fn().mockResolvedValue(undefined),
  deleteClient: vi.fn().mockResolvedValue(undefined),
  getClientPhotos: vi.fn().mockImplementation((clientId: number) => {
    if (clientId === 1) return Promise.resolve([
      { id: 1, clientId: 1, photoType: "front", originalUrl: "https://s3.example.com/front.jpg", mimeType: "image/jpeg" },
      { id: 2, clientId: 1, photoType: "side", originalUrl: "https://s3.example.com/side.jpg", mimeType: "image/jpeg" },
    ]);
    if (clientId === 2) return Promise.resolve([
      { id: 3, clientId: 2, photoType: "front", originalUrl: "https://s3.example.com/partner-front.jpg", mimeType: "image/jpeg" },
    ]);
    return Promise.resolve([]);
  }),
  createClientPhoto: vi.fn().mockResolvedValue({ id: 4 }),
  deleteClientPhoto: vi.fn().mockResolvedValue(undefined),
  getProjectsByUser: vi.fn().mockResolvedValue([
    { id: 1, title: "커플 웨딩", category: "wedding", status: "draft", projectMode: "couple", partnerClientId: 2, clientId: 1 },
  ]),
  getProjectById: vi.fn().mockImplementation((id: number) => {
    if (id === 1) return Promise.resolve({ id: 1, title: "커플 웨딩", category: "wedding", status: "draft", projectMode: "couple", partnerClientId: 2, clientId: 1, concept: "유럽 가든" });
    if (id === 2) return Promise.resolve({ id: 2, title: "개인 프로필", category: "profile", status: "draft", projectMode: "single", partnerClientId: null, clientId: 1, concept: null });
    return Promise.resolve(null);
  }),
  createProject: vi.fn().mockResolvedValue({ id: 3 }),
  updateProject: vi.fn().mockResolvedValue(undefined),
  deleteProject: vi.fn().mockResolvedValue(undefined),
  deleteGenerationsByProject: vi.fn().mockResolvedValue(undefined),
  getPrompts: vi.fn().mockResolvedValue([
    { id: 1, title: "웨딩 기본", prompt: "romantic wedding", negativePrompt: "ugly", category: "wedding" },
  ]),
  getDefaultPrompts: vi.fn().mockResolvedValue([]),
  createPrompt: vi.fn().mockResolvedValue({ id: 2 }),
  updatePrompt: vi.fn().mockResolvedValue(undefined),
  deletePrompt: vi.fn().mockResolvedValue(undefined),
  incrementPromptUsage: vi.fn().mockResolvedValue(undefined),
  getGenerationsByProject: vi.fn().mockResolvedValue([]),
  getGenerationById: vi.fn().mockResolvedValue({
    id: 1, projectId: 1, resultImageUrl: "https://s3.example.com/gen.png",
    status: "completed", stage: "draft",
  }),
  createGeneration: vi.fn().mockResolvedValue({ id: 1 }),
  updateGeneration: vi.fn().mockResolvedValue(undefined),
  deleteGeneration: vi.fn().mockResolvedValue(undefined),
  getReviewQueueByProject: vi.fn().mockResolvedValue([
    { id: 1, projectId: 1, resultImageUrl: "https://s3.example.com/gen.png", status: "approved", stage: "review" },
    { id: 2, projectId: 1, resultImageUrl: "https://s3.example.com/gen2.png", status: "approved", stage: "upscaled" },
  ]),
  getBatchJobs: vi.fn().mockResolvedValue([]),
  getBatchJobById: vi.fn().mockResolvedValue({ id: 1, status: "processing", batchConfig: { faceFixMode: true } }),
  createBatchJob: vi.fn().mockResolvedValue({ id: 1 }),
  createBatchJobItem: vi.fn().mockResolvedValue({ id: 1 }),
  getBatchJobItems: vi.fn().mockResolvedValue([
    { id: 1, batchJobId: 1, projectId: 1, promptText: "test prompt 1", status: "queued" },
  ]),
  updateBatchJob: vi.fn().mockResolvedValue(undefined),
  updateBatchJobItem: vi.fn().mockResolvedValue(undefined),
  getDeliveryPackagesByProject: vi.fn().mockResolvedValue([]),
  createDeliveryPackage: vi.fn().mockResolvedValue({ id: 1 }),
  updateDeliveryPackage: vi.fn().mockResolvedValue(undefined),
  getVideoConversionsByProject: vi.fn().mockResolvedValue([]),
  createVideoConversion: vi.fn().mockResolvedValue({ id: 1 }),
  updateVideoConversion: vi.fn().mockResolvedValue(undefined),
  getPhotoRestorationsByClient: vi.fn().mockResolvedValue([]),
  createPhotoRestoration: vi.fn().mockResolvedValue({ id: 1 }),
  updatePhotoRestoration: vi.fn().mockResolvedValue(undefined),
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn().mockResolvedValue(undefined),
  markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
  createNotification: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/test.png", key: "test.png" }),
}));

vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({ url: "https://example.com/generated.png" }),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockImplementation((params: any) => {
    const content = params?.messages?.[0]?.content;
    // 이미지 분석 요청 (content가 배열이고 image_url 포함)
    if (Array.isArray(content) && content.some((c: any) => c.type === "image_url")) {
      const textPart = content.find((c: any) => c.type === "text");
      // AI 검수 요청 (JSON 응답)
      if (textPart?.text?.includes("Score each")) {
        return Promise.resolve({
          choices: [{ message: { content: '{"colorScore": 85, "compositionScore": 90, "handScore": 80, "faceScore": 88, "overallFeedback": "우수한 품질", "issues": [], "suggestions": ["조명 미세 조정 권장"]}' } }],
        });
      }
      // 참조 이미지 분석 요청
      return Promise.resolve({
        choices: [{ message: { content: "PROMPT: A beautiful wedding scene with a female standing in a sunlit European garden, wearing an elegant white lace wedding dress, soft golden hour lighting, medium format camera with 85mm lens, shallow depth of field, gentle smile expression, pearl earrings and delicate veil, romantic atmosphere, warm color grading with soft contrast\nNEGATIVE: deformed, distorted, ugly, blurry, bad anatomy" } }],
      });
    }
    // 청첩장 문구 생성 등 일반 텍스트 요청
    if (typeof content === "string" && content.includes("청첩")) {
      return Promise.resolve({
        choices: [{ message: { content: '["\ub450 \uc0ac\ub78c\uc774 \ud558\ub098\uac00 \ub418\ub294 \ub0a0", "\uc0ac\ub791\uc774 \uc644\uc131\ub418\ub294 \uc21c\uac04", "\uc124\ub808\ub294 \ub9c8\uc74c\uc73c\ub85c"]' } }],
      });
    }
    return Promise.resolve({
      choices: [{ message: { content: "optimized prompt" } }],
    });
  }),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// Mock fal.ai image pipeline
vi.mock("./services/image-pipeline", () => ({
  runSinglePipeline: vi.fn().mockResolvedValue("https://fal.ai/result/single.png"),
  runCouplePipeline: vi.fn().mockResolvedValue("https://fal.ai/result/couple.png"),
  upscale4K: vi.fn().mockResolvedValue("https://fal.ai/result/upscaled.png"),
  generateBaseImage: vi.fn().mockResolvedValue("https://fal.ai/result/base.png"),
  removeBackground: vi.fn().mockResolvedValue("https://fal.ai/result/nobg.png"),
  applyFaceEnsemble: vi.fn().mockResolvedValue("https://fal.ai/result/ensemble.png"),
  generateWithFaceId: vi.fn().mockResolvedValue("https://fal.ai/result/face-id.png"),
}));

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "PROMPT: A beautiful Korean wedding couple standing in a sunlit European garden with golden hour lighting, soft bokeh background, romantic atmosphere, cinematic color grading\nNEGATIVE: deformed, distorted, ugly, blurry" }],
        }),
      },
    })),
  };
});

// Mock global fetch for image download and Pinterest scraping
const mockFetch = vi.fn().mockImplementation((url: string) => {
  if (url.includes("pinterest") || url.includes("pin.it")) {
    return Promise.resolve({
      text: () => Promise.resolve('<meta property="og:image" content="https://i.pinimg.com/originals/test.jpg" />'),
      ok: true,
      headers: new Map([["content-type", "text/html"]]),
    });
  }
  return Promise.resolve({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    ok: true,
    headers: new Map([["content-type", "image/jpeg"]]),
  });
});
vi.stubGlobal("fetch", mockFetch);

function createTestContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("Dashboard Router", () => {
  it("returns dashboard stats", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.dashboard.stats();
    expect(stats).toHaveProperty("totalClients");
    expect(stats).toHaveProperty("activeProjects");
    expect(stats).toHaveProperty("completedProjects");
  });
});

describe("Clients Router", () => {
  it("lists clients with gender info", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const clients = await caller.clients.list();
    expect(Array.isArray(clients)).toBe(true);
    expect(clients.length).toBe(2);
    expect(clients[0]).toHaveProperty("gender", "female");
    expect(clients[1]).toHaveProperty("gender", "male");
  });

  it("creates a female client (신부)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.clients.create({
      name: "테스트 신부",
      gender: "female",
      phone: "010-1234-5678",
    });
    expect(result).toHaveProperty("id");
  });

  it("creates a male client (신랑)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.clients.create({
      name: "테스트 신랑",
      gender: "male",
      phone: "010-9876-5432",
    });
    expect(result).toHaveProperty("id");
  });

  it("links partner (커플 연결)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.clients.linkPartner({ clientId: 1, partnerId: 2 });
    expect(result).toEqual({ success: true });
  });

  it("unlinks partner (커플 해제)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.clients.unlinkPartner({ clientId: 1 });
    expect(result).toEqual({ success: true });
  });

  it("gets client by id with gender and partner info", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const client = await caller.clients.getById({ id: 1 });
    expect(client).toHaveProperty("name", "김신부");
    expect(client).toHaveProperty("gender", "female");
    expect(client).toHaveProperty("partnerId", 2);
  });
});

describe("Client Photos - Upload & Delete", () => {
  it("uploads a photo", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.clientPhotos.upload({
      clientId: 1,
      photoType: "front",
      base64Data: "data:image/jpeg;base64,/9j/4AAQ",
      fileName: "front.jpg",
      mimeType: "image/jpeg",
    });
    expect(result).toHaveProperty("id");
  });

  it("deletes a photo", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.clientPhotos.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });

  it("lists photos for a client", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const photos = await caller.clientPhotos.list({ clientId: 1 });
    expect(Array.isArray(photos)).toBe(true);
    expect(photos.length).toBe(2);
    expect(photos[0]).toHaveProperty("photoType", "front");
  });
});

describe("Projects Router - CRUD with Delete", () => {
  it("creates a couple project", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.projects.create({
      clientId: 1,
      title: "커플 웨딩 촬영",
      category: "wedding",
      projectMode: "couple",
      partnerClientId: 2,
    });
    expect(result).toHaveProperty("id");
  });

  it("creates a single project", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.projects.create({
      clientId: 1,
      title: "개인 프로필 촬영",
      category: "profile",
      projectMode: "single",
    });
    expect(result).toHaveProperty("id");
  });

  it("lists projects with projectMode", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const projects = await caller.projects.list();
    expect(Array.isArray(projects)).toBe(true);
    expect(projects[0]).toHaveProperty("projectMode", "couple");
  });

  it("deletes a project and its generations", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.projects.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

describe("AI Generation - Face Consistency Engine v3.2", () => {
  it("generates image with face fix mode (single)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    
    const { getProjectById } = await import("./db");
    (getProjectById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 2, title: "개인 프로필", category: "profile", status: "draft",
      projectMode: "single", partnerClientId: null, clientId: 1, concept: null,
    });

    const result = await caller.generations.generate({
      projectId: 2,
      promptText: "Professional portrait photo in studio",
      faceFixMode: true,
    });
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("imageUrl");
    expect(result).toHaveProperty("generationTimeMs");
    expect(result).toHaveProperty("faceConsistencyScore", 92);
  });

  it("generates image with face fix mode (couple)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generations.generate({
      projectId: 1,
      promptText: "Romantic wedding couple in European garden",
      faceFixMode: true,
    });
    expect(result).toHaveProperty("imageUrl");
    expect(result).toHaveProperty("faceConsistencyScore", 92);
  });

  it("generates image without face fix mode", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generations.generate({
      projectId: 1,
      promptText: "Abstract wedding background",
      faceFixMode: false,
    });
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("imageUrl");
    expect(result.faceConsistencyScore).toBeUndefined();
  });

  it("generates image with reference image URL (background composite)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generations.generate({
      projectId: 1,
      referenceImageUrl: "https://example.com/background.jpg",
      referenceMode: "background_composite",
      faceFixMode: true,
    });
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("imageUrl");
    expect(result).toHaveProperty("faceConsistencyScore", 92);
  });

  it("generates image with reference image URL (style transfer)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generations.generate({
      projectId: 1,
      referenceImageUrl: "https://example.com/style-ref.jpg",
      referenceMode: "style_transfer",
      faceFixMode: true,
    });
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("imageUrl");
  });

  it("generates image with only reference URL (no prompt text)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generations.generate({
      projectId: 1,
      referenceImageUrl: "https://example.com/wedding-scene.jpg",
      referenceMode: "background_composite",
      faceFixMode: true,
    });
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("imageUrl");
  });

  it("generates image with Pinterest URL (핀터레스트 링크 지원)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generations.generate({
      projectId: 1,
      referenceImageUrl: "https://www.pinterest.com/pin/12345/",
      referenceMode: "background_composite",
      faceFixMode: true,
    });
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("imageUrl");
  });

  it("generates image with pin.it short URL", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generations.generate({
      projectId: 1,
      referenceImageUrl: "https://pin.it/6DxxHIrup",
      referenceMode: "face_swap",
      faceFixMode: true,
    });
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("imageUrl");
  });

  it("generates image with merchandise format (acrylic)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generations.generate({
      projectId: 1,
      promptText: "Wedding portrait for acrylic frame",
      faceFixMode: true,
      merchandiseFormat: "acrylic_8x10",
    });
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("imageUrl");
  });

  it("generates image with merchandise format (tshirt)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generations.generate({
      projectId: 1,
      promptText: "Wedding couple illustration for t-shirt",
      merchandiseFormat: "tshirt_front",
    });
    expect(result).toHaveProperty("id");
  });

  it("generates image with merchandise format (mug)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generations.generate({
      projectId: 1,
      promptText: "Panoramic wedding scene for mug",
      merchandiseFormat: "mug_standard",
    });
    expect(result).toHaveProperty("id");
  });

  it("generates image with merchandise format (3D)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generations.generate({
      projectId: 1,
      promptText: "3D figurine texture of wedding couple",
      merchandiseFormat: "print_3d_figurine",
    });
    expect(result).toHaveProperty("id");
  });

  it("deletes a generation", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.generations.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

describe("Final Review System (최종 검수)", () => {
  it("gets review queue for a project", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const queue = await caller.generations.reviewQueue({ projectId: 1 });
    expect(Array.isArray(queue)).toBe(true);
    expect(queue.length).toBe(2);
    expect(queue[0]).toHaveProperty("status", "approved");
  });

  it("approves an image for final delivery (최종 검수 승인)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.generations.finalApprove({
      id: 1,
      reviewNotes: "완벽한 품질, 출고 승인",
    });
    expect(result).toEqual({ success: true });
  });

  it("rejects an image in final review (최종 검수 반려)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.generations.finalReject({
      id: 1,
      reviewNotes: "얼굴 유사도 부족, 재생성 필요",
    });
    expect(result).toEqual({ success: true });
  });

  it("requires review notes for rejection", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.generations.finalReject({ id: 1, reviewNotes: "" })
    ).rejects.toThrow();
  });

  it("updates generation status and stage", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.generations.updateStatus({
      id: 1,
      status: "approved",
      stage: "review",
      qualityScore: 95,
      reviewNotes: "Good quality",
    });
    expect(result).toEqual({ success: true });
  });
});

describe("Upscale", () => {
  it("upscales a generated image", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.generations.upscale({ id: 1 });
    expect(result).toHaveProperty("url");
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("upscaledImageUrl");
  });
});

describe("Merchandise Formats", () => {
  it("returns all merchandise formats", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const formats = await caller.generations.merchandiseFormats();
    expect(Array.isArray(formats)).toBe(true);
    expect(formats.length).toBeGreaterThan(10);
    
    const acrylicFormats = formats.filter(f => f.category === "acrylic");
    expect(acrylicFormats.length).toBeGreaterThanOrEqual(4);
    
    const tshirtFormats = formats.filter(f => f.category === "tshirt");
    expect(tshirtFormats.length).toBeGreaterThanOrEqual(2);
    
    const mugFormats = formats.filter(f => f.category === "mug");
    expect(mugFormats.length).toBeGreaterThanOrEqual(2);
    
    const towelFormats = formats.filter(f => f.category === "towel");
    expect(towelFormats.length).toBeGreaterThanOrEqual(2);
    
    const threeDFormats = formats.filter(f => f.category === "3d");
    expect(threeDFormats.length).toBeGreaterThanOrEqual(2);

    const format = formats[0];
    expect(format).toHaveProperty("key");
    expect(format).toHaveProperty("name");
    expect(format).toHaveProperty("width");
    expect(format).toHaveProperty("height");
    expect(format).toHaveProperty("aspectRatio");
    expect(format).toHaveProperty("dpi");
    expect(format).toHaveProperty("category");
  });
});

describe("Batch Jobs (대량 생성)", () => {
  it("creates a batch job with up to 100 prompts", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.batches.create({
      title: "웨딩 배치 생성",
      projectId: 1,
      prompts: ["prompt 1", "prompt 2", "prompt 3"],
      faceFixMode: true,
      merchandiseFormat: "acrylic_8x10",
    });
    expect(result).toHaveProperty("id");
  });

  it("lists batch jobs", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const batches = await caller.batches.list();
    expect(Array.isArray(batches)).toBe(true);
  });

  it("cancels a batch job", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.batches.cancel({ id: 1 });
    expect(result).toEqual({ success: true });
  });

  it("gets batch items", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const items = await caller.batches.getItems({ batchJobId: 1 });
    expect(Array.isArray(items)).toBe(true);
  });
});

describe("Video Conversions (영상 변환)", () => {
  it("creates a video conversion with motion type", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.videos.create({
      generationId: 1,
      projectId: 1,
      sourceImageUrl: "https://s3.example.com/gen.png",
      duration: 5,
      motionType: "cinematic",
    });
    expect(result).toHaveProperty("id");
  });

  it("lists video conversions", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const videos = await caller.videos.list({ projectId: 1 });
    expect(Array.isArray(videos)).toBe(true);
  });
});

describe("Prompts Router", () => {
  it("lists prompts", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const prompts = await caller.prompts.list();
    expect(Array.isArray(prompts)).toBe(true);
  });

  it("creates a prompt", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.prompts.create({
      category: "wedding",
      title: "웨딩 가든 스타일",
      prompt: "A beautiful wedding in European garden",
      negativePrompt: "ugly, deformed",
    });
    expect(result).toHaveProperty("id");
  });
});

describe("Notifications Router", () => {
  it("lists notifications", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const notifications = await caller.notifications.list();
    expect(Array.isArray(notifications)).toBe(true);
  });

  it("marks notification as read", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.markRead({ id: 1 });
    expect(result).toEqual({ success: true });
  });

  it("marks all notifications as read", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.markAllRead();
    expect(result).toEqual({ success: true });
  });
});

describe("Delivery Packages Router", () => {
  it("lists delivery packages", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const packages = await caller.deliveries.list({ projectId: 1 });
    expect(Array.isArray(packages)).toBe(true);
  });

  it("creates a delivery package", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.deliveries.create({
      projectId: 1,
      clientId: 1,
      title: "최종 전달 패키지",
    });
    expect(result).toHaveProperty("id");
  });
});

describe("AI Vision Prompt Generation (참조 이미지 분석)", () => {
  it("analyzes reference images and generates a prompt", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.generations.analyzeReferenceImages({
      imageUrls: ["https://example.com/wedding-ref.jpg"],
      category: "wedding",
      gender: "female",
      isCouple: false,
    });
    expect(result).toHaveProperty("prompt");
    expect(result).toHaveProperty("negativePrompt");
    expect(result).toHaveProperty("imageCount", 1);
    expect(typeof result.prompt).toBe("string");
    expect(result.prompt.length).toBeGreaterThan(0);
  });

  it("analyzes multiple reference images", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.generations.analyzeReferenceImages({
      imageUrls: [
        "https://example.com/ref1.jpg",
        "https://example.com/ref2.jpg",
        "https://example.com/ref3.jpg",
      ],
      category: "wedding",
      isCouple: true,
    });
    expect(result.imageCount).toBe(3);
    expect(result.prompt.length).toBeGreaterThan(0);
  });

  it("handles Pinterest URLs in analysis", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.generations.analyzeReferenceImages({
      imageUrls: ["https://pin.it/test123"],
      category: "wedding",
      gender: "female",
    });
    expect(result).toHaveProperty("prompt");
    expect(result.imageCount).toBe(1);
  });

  it("rejects empty image array", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.generations.analyzeReferenceImages({
        imageUrls: [],
        category: "wedding",
      })
    ).rejects.toThrow();
  });

  it("rejects more than 10 images", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const urls = Array.from({ length: 11 }, (_, i) => `https://example.com/img${i}.jpg`);
    await expect(
      caller.generations.analyzeReferenceImages({
        imageUrls: urls,
        category: "wedding",
      })
    ).rejects.toThrow();
  });
});
