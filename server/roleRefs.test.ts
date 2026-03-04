import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock storagePut
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://mock-s3.com/test-image.png", key: "test-key" }),
  storageGet: vi.fn().mockResolvedValue({ url: "https://mock-s3.com/test-image.png", key: "test-key" }),
}));

// In-memory project store
const mockProjects: Record<number, any> = {};
let projectIdCounter = 100;
let uploadCounter = 0;

// Mock db as namespace import (import * as db from "./db")
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  createClient: vi.fn(),
  getClientsByUser: vi.fn().mockResolvedValue([]),
  getClientById: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
  createClientPhoto: vi.fn(),
  getClientPhotos: vi.fn().mockResolvedValue([]),
  updateClientPhoto: vi.fn(),
  deleteClientPhoto: vi.fn(),
  createProject: vi.fn().mockImplementation(async (data: any) => {
    const id = projectIdCounter++;
    const project = { id, ...data, roleReferenceImages: null, familyMembers: data.familyMembers || null };
    mockProjects[id] = project;
    return project;
  }),
  getProjectsByUser: vi.fn().mockResolvedValue([]),
  getProjectById: vi.fn().mockImplementation(async (id: number) => mockProjects[id] || null),
  updateProject: vi.fn().mockImplementation(async (id: number, data: any) => {
    if (mockProjects[id]) {
      Object.assign(mockProjects[id], data);
    }
    return { success: true };
  }),
  deleteProject: vi.fn().mockResolvedValue({ success: true }),
  deleteGenerationsByProject: vi.fn().mockResolvedValue({ success: true }),
  createPrompt: vi.fn(),
  getPrompts: vi.fn().mockResolvedValue([]),
  getDefaultPrompts: vi.fn().mockResolvedValue([]),
  updatePrompt: vi.fn(),
  deletePrompt: vi.fn(),
  createGeneration: vi.fn(),
  getGenerationsByProject: vi.fn().mockResolvedValue([]),
  getGenerationById: vi.fn(),
  updateGeneration: vi.fn(),
  deleteGeneration: vi.fn(),
  createBatchJob: vi.fn(),
  getBatchJobsByUser: vi.fn().mockResolvedValue([]),
  getBatchJobById: vi.fn(),
  updateBatchJob: vi.fn(),
  createBatchJobItem: vi.fn(),
  getBatchJobItems: vi.fn().mockResolvedValue([]),
  updateBatchJobItem: vi.fn(),
  createDeliveryPackage: vi.fn(),
  getDeliveryPackagesByUser: vi.fn().mockResolvedValue([]),
  getDeliveryPackageById: vi.fn(),
  updateDeliveryPackage: vi.fn(),
  createVideoConversion: vi.fn(),
  getVideoConversionsByProject: vi.fn().mockResolvedValue([]),
  getVideoConversionById: vi.fn(),
  updateVideoConversion: vi.fn(),
  createPhotoRestoration: vi.fn(),
  getPhotoRestorationsByProject: vi.fn().mockResolvedValue([]),
  updatePhotoRestoration: vi.fn(),
  createNotification: vi.fn(),
  getNotificationsByUser: vi.fn().mockResolvedValue([]),
  getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  getDashboardStats: vi.fn().mockResolvedValue({ totalClients: 0, activeProjects: 0, completedProjects: 0, totalGenerations: 0, pendingBatches: 0 }),
}));

// Mock other server dependencies
vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({ url: "https://mock.com/image.png" }),
}));
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({ choices: [{ message: { content: "test" } }] }),
}));
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// Override storagePut to return unique URLs
import { storagePut } from "./storage";
const mockStoragePut = storagePut as unknown as ReturnType<typeof vi.fn>;
mockStoragePut.mockImplementation(async () => {
  uploadCounter++;
  return { url: `https://mock-s3.com/image-${uploadCounter}.png`, key: `key-${uploadCounter}` };
});

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("projects.uploadRoleRefImage", () => {
  beforeEach(() => {
    Object.keys(mockProjects).forEach(k => delete mockProjects[Number(k)]);
    projectIdCounter = 100;
    uploadCounter = 0;
  });

  it("should upload a role reference image for bride", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      title: "Test Wedding",
      clientId: 1,
      category: "wedding",
      projectMode: "couple",
    });

    const result = await caller.projects.uploadRoleRefImage({
      projectId: project.id,
      role: "bride",
      fileName: "bride-face.jpg",
      mimeType: "image/jpeg",
      base64Data: "dGVzdA==",
    });

    expect(result.success).toBe(true);
    expect(result.url).toBeDefined();
    expect(result.roleReferenceImages).toBeDefined();
    expect(result.roleReferenceImages!.bride).toHaveLength(1);
  });

  it("should upload separate images for bride and groom", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      title: "Couple Wedding",
      clientId: 1,
      category: "wedding",
      projectMode: "couple",
    });

    await caller.projects.uploadRoleRefImage({
      projectId: project.id,
      role: "bride",
      fileName: "bride.jpg",
      mimeType: "image/jpeg",
      base64Data: "dGVzdA==",
    });

    const result = await caller.projects.uploadRoleRefImage({
      projectId: project.id,
      role: "groom",
      fileName: "groom.jpg",
      mimeType: "image/jpeg",
      base64Data: "dGVzdA==",
    });

    expect(result.roleReferenceImages!.bride).toHaveLength(1);
    expect(result.roleReferenceImages!.groom).toHaveLength(1);
  });

  it("should reject when role has 5 images already", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      title: "Full Bride",
      clientId: 1,
      category: "wedding",
      projectMode: "couple",
    });

    for (let i = 0; i < 5; i++) {
      await caller.projects.uploadRoleRefImage({
        projectId: project.id,
        role: "bride",
        fileName: `bride-${i}.jpg`,
        mimeType: "image/jpeg",
        base64Data: "dGVzdA==",
      });
    }

    await expect(
      caller.projects.uploadRoleRefImage({
        projectId: project.id,
        role: "bride",
        fileName: "bride-6.jpg",
        mimeType: "image/jpeg",
        base64Data: "dGVzdA==",
      })
    ).rejects.toThrow("최대 5장");
  });
});

describe("projects.removeRoleRefImage", () => {
  beforeEach(() => {
    Object.keys(mockProjects).forEach(k => delete mockProjects[Number(k)]);
    projectIdCounter = 200;
    uploadCounter = 0;
  });

  it("should remove a specific role reference image", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      title: "Remove Test",
      clientId: 1,
      category: "wedding",
      projectMode: "couple",
    });

    const result1 = await caller.projects.uploadRoleRefImage({
      projectId: project.id,
      role: "bride",
      fileName: "bride-1.jpg",
      mimeType: "image/jpeg",
      base64Data: "dGVzdA==",
    });

    await caller.projects.uploadRoleRefImage({
      projectId: project.id,
      role: "bride",
      fileName: "bride-2.jpg",
      mimeType: "image/jpeg",
      base64Data: "dGVzdA==",
    });

    const removeResult = await caller.projects.removeRoleRefImage({
      projectId: project.id,
      role: "bride",
      imageUrl: result1.url,
    });

    expect(removeResult.success).toBe(true);
    expect(removeResult.roleReferenceImages!.bride).toHaveLength(1);
  });
});

describe("projects.updateFamilyMembers", () => {
  beforeEach(() => {
    Object.keys(mockProjects).forEach(k => delete mockProjects[Number(k)]);
    projectIdCounter = 300;
  });

  it("should add family members to a project", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      title: "Family Photo",
      clientId: 1,
      category: "wedding",
      projectMode: "family",
    });

    const result = await caller.projects.updateFamilyMembers({
      projectId: project.id,
      familyMembers: [
        { role: "father", label: "아버지" },
        { role: "mother", label: "어머니" },
        { role: "son", label: "아들" },
      ],
    });

    expect(result.success).toBe(true);
    expect(mockProjects[project.id].familyMembers).toHaveLength(3);
  });

  it("should update family members (add/remove)", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      title: "Family Update",
      clientId: 1,
      category: "wedding",
      projectMode: "family",
    });

    await caller.projects.updateFamilyMembers({
      projectId: project.id,
      familyMembers: [
        { role: "father", label: "아버지" },
        { role: "mother", label: "어머니" },
      ],
    });

    const result = await caller.projects.updateFamilyMembers({
      projectId: project.id,
      familyMembers: [
        { role: "mother", label: "어머니" },
        { role: "daughter", label: "딸" },
      ],
    });

    expect(result.success).toBe(true);
    expect(mockProjects[project.id].familyMembers).toHaveLength(2);
    expect(mockProjects[project.id].familyMembers[0].role).toBe("mother");
    expect(mockProjects[project.id].familyMembers[1].role).toBe("daughter");
  });
});

describe("projects.create with family mode", () => {
  beforeEach(() => {
    Object.keys(mockProjects).forEach(k => delete mockProjects[Number(k)]);
    projectIdCounter = 400;
  });

  it("should create a project with family mode", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      title: "Family Wedding",
      clientId: 1,
      category: "wedding",
      projectMode: "family",
      familyMembers: [
        { role: "father", label: "아버지" },
        { role: "mother", label: "어머니" },
      ],
    });

    expect(project.id).toBeDefined();
    expect(mockProjects[project.id]).toBeDefined();
  });
});
