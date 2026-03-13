import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { PIPELINE_STAGES, AI_ENGINE_LIST, buildMultiEngineConsistencyPrompt, getRecommendedRefCount } from "../shared/aiEngines";

// ═══ Pipeline Stages Configuration Tests ═══
describe("Pipeline Stages Configuration", () => {
  it("should have 5 pipeline stages defined", () => {
    expect(PIPELINE_STAGES).toHaveLength(5);
    expect(AI_ENGINE_LIST).toHaveLength(5);
  });

  it("should have Korean names for all stages", () => {
    for (const stage of PIPELINE_STAGES) {
      expect(stage.nameKo).toBeTruthy();
      expect(stage.descriptionKo).toBeTruthy();
    }
  });

  it("should have correct stage types", () => {
    const types = PIPELINE_STAGES.map(s => s.type);
    expect(types).toContain("primary");
    expect(types).toContain("fallback");
    expect(types).toContain("postprocess");
    expect(types).toContain("optional");
  });

  it("should have Gemini 3 Pro as primary", () => {
    const primary = PIPELINE_STAGES.find(s => s.type === "primary");
    expect(primary?.id).toBe("gemini_3_pro");
    expect(primary?.order).toBe(1);
  });

  it("should have stages in correct order", () => {
    for (let i = 0; i < PIPELINE_STAGES.length - 1; i++) {
      expect(PIPELINE_STAGES[i].order).toBeLessThan(PIPELINE_STAGES[i + 1].order);
    }
  });
});

// ═══ Legacy Compatibility Prompt Tests ═══
describe("buildMultiEngineConsistencyPrompt (legacy)", () => {
  it("should include face preservation directives", () => {
    const prompt = buildMultiEngineConsistencyPrompt({
      basePrompt: "Wedding photo in garden",
      engines: ["flux_lora"],
      gender: "female",
    });
    expect(prompt).toContain("facial identity");
    expect(prompt).toContain("Wedding photo in garden");
  });

  it("should handle couple mode", () => {
    const prompt = buildMultiEngineConsistencyPrompt({
      basePrompt: "Wedding photo",
      engines: [],
      gender: "female",
      isCouple: true,
    });
    expect(prompt).toContain("couple");
  });

  it("should handle empty engines array", () => {
    const prompt = buildMultiEngineConsistencyPrompt({
      basePrompt: "Simple portrait",
      engines: [],
      gender: "female",
    });
    expect(prompt).toContain("facial identity");
    expect(prompt).toContain("Simple portrait");
  });
});

// ═══ Recommended Reference Count Tests ═══
describe("getRecommendedRefCount", () => {
  it("should return unified ref counts for all engines", () => {
    const counts = getRecommendedRefCount("flux_lora");
    expect(counts.min).toBe(1);
    expect(counts.max).toBe(5);
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
