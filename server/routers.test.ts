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
    { id: 1, name: "김철수", phone: "010-1234-5678", status: "consulting" },
  ]),
  getClientById: vi.fn().mockResolvedValue({
    id: 1, name: "김철수", phone: "010-1234-5678", status: "consulting",
  }),
  createClient: vi.fn().mockResolvedValue({ id: 1 }),
  updateClient: vi.fn().mockResolvedValue(undefined),
  deleteClient: vi.fn().mockResolvedValue(undefined),
  getClientPhotos: vi.fn().mockResolvedValue([]),
  createClientPhoto: vi.fn().mockResolvedValue({ id: 1 }),
  deleteClientPhoto: vi.fn().mockResolvedValue(undefined),
  getProjectsByUser: vi.fn().mockResolvedValue([]),
  getProjectById: vi.fn().mockResolvedValue({ id: 1, title: "Test", status: "draft" }),
  createProject: vi.fn().mockResolvedValue({ id: 1 }),
  updateProject: vi.fn().mockResolvedValue(undefined),
  deleteProject: vi.fn().mockResolvedValue(undefined),
  getPrompts: vi.fn().mockResolvedValue([]),
  getDefaultPrompts: vi.fn().mockResolvedValue([]),
  createPrompt: vi.fn().mockResolvedValue({ id: 1 }),
  updatePrompt: vi.fn().mockResolvedValue(undefined),
  deletePrompt: vi.fn().mockResolvedValue(undefined),
  incrementPromptUsage: vi.fn().mockResolvedValue(undefined),
  getGenerationsByProject: vi.fn().mockResolvedValue([]),
  getGenerationById: vi.fn().mockResolvedValue(null),
  createGeneration: vi.fn().mockResolvedValue({ id: 1 }),
  updateGeneration: vi.fn().mockResolvedValue(undefined),
  getBatchJobs: vi.fn().mockResolvedValue([]),
  createBatchJob: vi.fn().mockResolvedValue({ id: 1 }),
  createBatchJobItem: vi.fn().mockResolvedValue({ id: 1 }),
  getBatchJobItems: vi.fn().mockResolvedValue([]),
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

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

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
  it("lists clients", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const clients = await caller.clients.list();
    expect(Array.isArray(clients)).toBe(true);
  });

  it("creates a client", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.clients.create({
      name: "테스트 고객",
      phone: "010-1234-5678",
      email: "test@test.com",
      status: "consulting",
    });
    expect(result).toHaveProperty("id");
  });

  it("gets client by id", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const client = await caller.clients.getById({ id: 1 });
    expect(client).toHaveProperty("name", "김철수");
  });

  it("updates a client", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.clients.update({ id: 1, name: "Updated" });
    expect(result).toEqual({ success: true });
  });

  it("deletes a client", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.clients.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

describe("Projects Router", () => {
  it("lists projects", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const projects = await caller.projects.list();
    expect(Array.isArray(projects)).toBe(true);
  });

  it("creates a project", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.projects.create({
      clientId: 1,
      title: "테스트 프로젝트",
      category: "wedding",
      priority: "normal",
    });
    expect(result).toHaveProperty("id");
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
      title: "테스트 프롬프트",
      prompt: "A beautiful wedding scene",
    });
    expect(result).toHaveProperty("id");
  });
});

describe("Batches Router", () => {
  it("lists batch jobs", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const batches = await caller.batches.list();
    expect(Array.isArray(batches)).toBe(true);
  });

  it("creates a batch job", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.batches.create({
      title: "테스트 배치",
      items: [{ projectId: 1, promptText: "test prompt" }],
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
      title: "테스트 전달 패키지",
    });
    expect(result).toHaveProperty("id");
  });
});
