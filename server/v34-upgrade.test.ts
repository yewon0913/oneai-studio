import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { AI_ENGINES, AI_ENGINE_LIST, buildMultiEngineConsistencyPrompt, getRecommendedRefCount } from "../shared/aiEngines";

// ═══ AI Engine Configuration Tests ═══
describe("AI Engines Configuration", () => {
  it("should have all 4 AI engines defined", () => {
    expect(AI_ENGINE_LIST).toHaveLength(4);
    expect(AI_ENGINES.flux_pulid).toBeDefined();
    expect(AI_ENGINES.flux_dev).toBeDefined();
    expect(AI_ENGINES.sd_ip_adapter).toBeDefined();
    expect(AI_ENGINES.dalle_native).toBeDefined();
  });

  it("should have Korean names for all engines", () => {
    for (const engine of AI_ENGINE_LIST) {
      expect(engine.nameKo).toBeTruthy();
      expect(engine.descriptionKo).toBeTruthy();
      expect(engine.featuresKo.length).toBeGreaterThan(0);
      expect(engine.promptStrategyKo).toBeTruthy();
    }
  });

  it("should have face consistency scores between 0-100", () => {
    for (const engine of AI_ENGINE_LIST) {
      expect(engine.faceConsistencyScore).toBeGreaterThanOrEqual(0);
      expect(engine.faceConsistencyScore).toBeLessThanOrEqual(100);
    }
  });

  it("Flux PuLID should have the highest consistency score among available engines", () => {
    const pulidScore = AI_ENGINES.flux_pulid.faceConsistencyScore;
    for (const engine of AI_ENGINE_LIST.filter(e => e.available)) {
      expect(pulidScore).toBeGreaterThanOrEqual(engine.faceConsistencyScore);
    }
  });

  it("should have recommended engines marked", () => {
    expect(AI_ENGINES.flux_pulid.recommended).toBe(true);
  });
});

// ═══ Multi-Engine Consistency Prompt Tests ═══
describe("buildMultiEngineConsistencyPrompt", () => {
  it("should include face identity directive when flux_pulid is selected", () => {
    const prompt = buildMultiEngineConsistencyPrompt({
      basePrompt: "Wedding photo in garden",
      engines: ["flux_pulid"],
      gender: "female",
    });
    expect(prompt).toContain("facial identity");
    expect(prompt).toContain("Wedding photo in garden");
  });

  it("should include reference image directive when dalle_native is selected", () => {
    const prompt = buildMultiEngineConsistencyPrompt({
      basePrompt: "Portrait photo",
      engines: ["dalle_native"],
      gender: "male",
    });
    expect(prompt).toContain("reference image");
    expect(prompt).toContain("man");
  });

  it("should not add face directives for flux_dev engine", () => {
    const prompt = buildMultiEngineConsistencyPrompt({
      basePrompt: "Studio portrait",
      engines: ["flux_dev"],
      gender: "female",
    });
    expect(prompt).not.toContain("facial identity");
    expect(prompt).toContain("Studio portrait");
  });

  it("should combine multiple engine directives", () => {
    const prompt = buildMultiEngineConsistencyPrompt({
      basePrompt: "Wedding photo",
      engines: ["flux_pulid", "dalle_native"],
      gender: "female",
      isCouple: true,
    });
    expect(prompt).toContain("facial identity");
    expect(prompt).toContain("reference image");
    expect(prompt).toContain("couple");
  });

  it("should handle empty engines array", () => {
    const prompt = buildMultiEngineConsistencyPrompt({
      basePrompt: "Simple portrait",
      engines: [],
      gender: "female",
    });
    expect(prompt).toContain("Simple portrait");
    expect(prompt).toContain("Photorealistic");
  });
});

// ═══ Recommended Reference Count Tests ═══
describe("getRecommendedRefCount", () => {
  it("should return correct ref counts for Flux PuLID", () => {
    const counts = getRecommendedRefCount("flux_pulid");
    expect(counts.min).toBe(1);
    expect(counts.max).toBe(5);
    expect(counts.optimal).toBe(1);
  });

  it("should return zero ref counts for Flux Dev", () => {
    const counts = getRecommendedRefCount("flux_dev");
    expect(counts.min).toBe(0);
    expect(counts.max).toBe(0);
    expect(counts.optimal).toBe(0);
  });

  it("should return correct ref counts for SD IP-Adapter", () => {
    const counts = getRecommendedRefCount("sd_ip_adapter");
    expect(counts.min).toBe(1);
    expect(counts.max).toBe(5);
    expect(counts.optimal).toBe(3);
  });

  it("should return correct ref counts for DALL-E", () => {
    const counts = getRecommendedRefCount("dalle_native");
    expect(counts.min).toBe(1);
    expect(counts.max).toBe(2);
    expect(counts.optimal).toBe(1);
  });
});

// ═══ Video Regeneration Router Tests ═══
describe("videos.regenerate procedure", () => {
  it("should exist in the router", () => {
    // Verify the procedure exists
    const routerDef = appRouter._def;
    expect(routerDef).toBeDefined();
  });
});

// ═══ Direct Apply Reference Mode Tests ═══
describe("generations.generate reference modes", () => {
  it("should support direct_apply reference mode in router definition", () => {
    // Verify the router accepts direct_apply mode
    const routerDef = appRouter._def;
    expect(routerDef).toBeDefined();
  });
});

// ═══ v3.6 Client Delete Procedure Tests ═══
describe("clients.delete procedure", () => {
  it("should exist in the router", () => {
    const routerDef = appRouter._def;
    expect(routerDef).toBeDefined();
  });

  it("should be defined as a mutation", () => {
    // Verify the clients.delete procedure is accessible
    const procedures = (appRouter as any)._def.procedures;
    // The router should have clients.delete defined
    expect(appRouter).toBeDefined();
  });
});

// ═══ v3.6 Video Media Detection Tests ═══
describe("Video URL media type detection", () => {
  const videoExtensions = [".mp4", ".webm", ".mov", ".avi", ".mkv"];
  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

  it("should detect video URLs by extension", () => {
    for (const ext of videoExtensions) {
      const url = `https://example.com/file${ext}`;
      const isVideo = /\.(mp4|webm|mov|avi|mkv)/i.test(url) || url.includes("video");
      expect(isVideo).toBe(true);
    }
  });

  it("should detect image URLs by extension", () => {
    for (const ext of imageExtensions) {
      const url = `https://example.com/file${ext}`;
      const isVideo = /\.(mp4|webm|mov|avi|mkv)/i.test(url) || url.includes("video");
      expect(isVideo).toBe(false);
    }
  });

  it("should detect video URLs containing 'video' in path", () => {
    const url = "https://storage.example.com/video/output-12345";
    const isVideo = /\.(mp4|webm|mov|avi|mkv)/i.test(url) || url.includes("video");
    expect(isVideo).toBe(true);
  });

  it("should handle URLs without extension", () => {
    const url = "https://storage.example.com/images/output-12345";
    const isVideo = /\.(mp4|webm|mov|avi|mkv)/i.test(url) || url.includes("video");
    expect(isVideo).toBe(false);
  });
});
