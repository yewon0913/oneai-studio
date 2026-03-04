import { describe, expect, it, vi } from "vitest";
import { applySeasonTransform, applyColorGrade } from "./services/image-effects";
import type { Season, ColorGrade } from "./services/image-effects";

// Mock fal.ai client
vi.mock("@fal-ai/client", () => {
  const mockSubscribe = vi.fn().mockResolvedValue({
    data: { images: [{ url: "https://fal.ai/result/transformed.png" }] },
  });
  return {
    fal: {
      config: vi.fn(),
      subscribe: mockSubscribe,
    },
    createFalClient: vi.fn(() => ({
      subscribe: mockSubscribe,
    })),
  };
});

describe("image-effects - module exports", () => {
  it("should export applySeasonTransform function", () => {
    expect(typeof applySeasonTransform).toBe("function");
  });

  it("should export applyColorGrade function", () => {
    expect(typeof applyColorGrade).toBe("function");
  });
});

describe("image-effects - applySeasonTransform", () => {
  it("accepts imageUrl and season parameter", () => {
    expect(applySeasonTransform.length).toBe(2);
  });

  it("supports all four seasons", async () => {
    const seasons: Season[] = ["spring", "summer", "autumn", "winter"];
    for (const season of seasons) {
      const result = await applySeasonTransform("https://example.com/test.jpg", season);
      expect(typeof result).toBe("string");
      expect(result).toContain("https://");
    }
  });
});

describe("image-effects - applyColorGrade", () => {
  it("accepts imageUrl and grade parameter", () => {
    expect(applyColorGrade.length).toBe(2);
  });

  it("supports all four color grades", async () => {
    const grades: ColorGrade[] = ["film", "bw", "golden", "blue"];
    for (const grade of grades) {
      const result = await applyColorGrade("https://example.com/test.jpg", grade);
      expect(typeof result).toBe("string");
      expect(result).toContain("https://");
    }
  });
});

describe("image-effects - effects router integration", () => {
  it("seasonTransform procedure exists in appRouter", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("effects.seasonTransform");
  });

  it("colorGrade procedure exists in appRouter", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("effects.colorGrade");
  });
});
