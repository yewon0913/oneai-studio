import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(): TrpcContext {
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
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("clientPhotos - face_reference management", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    const ctx = createTestContext();
    caller = appRouter.createCaller(ctx);
  });

  it("should list all photos for a client (empty initially)", async () => {
    const client = await caller.clients.create({
      name: "테스트 고객",
      gender: "female",
    });

    const photos = await caller.clientPhotos.list({ clientId: client.id });
    expect(Array.isArray(photos)).toBe(true);
    expect(photos.length).toBe(0);
  });

  it("should list face reference photos separately via faceReferences", async () => {
    const client = await caller.clients.create({
      name: "참조사진 테스트",
      gender: "female",
    });

    const faceRefs = await caller.clientPhotos.faceReferences({ clientId: client.id });
    expect(Array.isArray(faceRefs)).toBe(true);
    expect(faceRefs.length).toBe(0);
  });

  it("should upload a face_reference photo and verify it", async () => {
    const client = await caller.clients.create({
      name: "업로드 테스트",
      gender: "female",
    });

    // Upload a small test image (1x1 pixel PNG in base64)
    const testBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const result = await caller.clientPhotos.upload({
      clientId: client.id,
      photoType: "face_reference",
      fileName: "test_face_ref.png",
      mimeType: "image/png",
      base64Data: testBase64,
    });

    expect(result).toHaveProperty("id");

    // Verify it shows up in face reference list
    const faceRefs = await caller.clientPhotos.faceReferences({ clientId: client.id });
    expect(faceRefs.length).toBe(1);
    expect(faceRefs[0].photoType).toBe("face_reference");
  });

  it("should delete a face_reference photo", async () => {
    const client = await caller.clients.create({
      name: "삭제 테스트",
      gender: "female",
    });

    const testBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const uploaded = await caller.clientPhotos.upload({
      clientId: client.id,
      photoType: "face_reference",
      fileName: "to_delete.png",
      mimeType: "image/png",
      base64Data: testBase64,
    });

    // Delete it
    const deleteResult = await caller.clientPhotos.delete({ id: uploaded.id });
    expect(deleteResult.success).toBe(true);

    // Verify it's gone
    const faceRefs = await caller.clientPhotos.faceReferences({ clientId: client.id });
    expect(faceRefs.length).toBe(0);
  });

  it("should replace a face_reference photo", async () => {
    const client = await caller.clients.create({
      name: "교체 테스트",
      gender: "female",
    });

    const testBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const uploaded = await caller.clientPhotos.upload({
      clientId: client.id,
      photoType: "face_reference",
      fileName: "original.png",
      mimeType: "image/png",
      base64Data: testBase64,
    });

    // Replace it
    const replaceResult = await caller.clientPhotos.replace({
      id: uploaded.id,
      fileName: "replaced.png",
      mimeType: "image/png",
      base64Data: testBase64,
    });

    expect(replaceResult.success).toBe(true);
    expect(replaceResult).toHaveProperty("url");
  });
});

describe("generations - AI review system", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    const ctx = createTestContext();
    caller = appRouter.createCaller(ctx);
  });

  it("should have requestAIReview procedure available", () => {
    expect(caller.generations.requestAIReview).toBeDefined();
    expect(typeof caller.generations.requestAIReview).toBe("function");
  });

  it("should reject AI review for non-existent generation", async () => {
    await expect(
      caller.generations.requestAIReview({ id: 999999 })
    ).rejects.toThrow();
  });
});

describe("merchandise formats", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    const ctx = createTestContext();
    caller = appRouter.createCaller(ctx);
  });

  it("should return merchandise format list", async () => {
    const formats = await caller.generations.merchandiseFormats();
    expect(Array.isArray(formats)).toBe(true);
    expect(formats.length).toBeGreaterThan(0);

    const first = formats[0];
    expect(first).toHaveProperty("key");
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("width");
    expect(first).toHaveProperty("height");
    expect(first).toHaveProperty("aspectRatio");
  });
});
