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
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "optimized prompt" } }],
  }),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// Mock global fetch for image download
const mockFetch = vi.fn().mockResolvedValue({
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
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

describe("Projects Router", () => {
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
});

describe("AI Generation - Face Consistency Engine", () => {
  it("generates image with face fix mode (single)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    
    // Use projectId=2 for single mode
    const { getProjectById } = await import("./db");
    (getProjectById as any).mockResolvedValueOnce({
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
    expect(result).toHaveProperty("faceConsistencyScore", 90);
  });

  it("generates image with face fix mode (couple)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generations.generate({
      projectId: 1,
      promptText: "Romantic wedding couple in European garden",
      faceFixMode: true,
    });
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("imageUrl");
    expect(result).toHaveProperty("faceConsistencyScore", 90);
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
});

describe("Upscale", () => {
  it("upscales a generated image", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.generations.upscale({ id: 1 });
    expect(result).toHaveProperty("url");
  });
});

describe("Merchandise Formats", () => {
  it("returns all merchandise formats", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const formats = await caller.generations.merchandiseFormats();
    expect(Array.isArray(formats)).toBe(true);
    expect(formats.length).toBeGreaterThan(10);
    
    // Check acrylic formats
    const acrylicFormats = formats.filter(f => f.category === "acrylic");
    expect(acrylicFormats.length).toBeGreaterThanOrEqual(4);
    
    // Check tshirt formats
    const tshirtFormats = formats.filter(f => f.category === "tshirt");
    expect(tshirtFormats.length).toBeGreaterThanOrEqual(2);
    
    // Check mug formats
    const mugFormats = formats.filter(f => f.category === "mug");
    expect(mugFormats.length).toBeGreaterThanOrEqual(2);
    
    // Check towel formats
    const towelFormats = formats.filter(f => f.category === "towel");
    expect(towelFormats.length).toBeGreaterThanOrEqual(2);
    
    // Check 3D formats
    const threeDFormats = formats.filter(f => f.category === "3d");
    expect(threeDFormats.length).toBeGreaterThanOrEqual(2);

    // Check format structure
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
