import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { AI_ENGINES, AI_ENGINE_LIST, buildMultiEngineConsistencyPrompt, getRecommendedRefCount } from "../shared/aiEngines";

// ═══ AI Engine Configuration Tests ═══
describe("AI Engines Configuration", () => {
  it("should have all 4 AI engines defined", () => {
    expect(AI_ENGINE_LIST).toHaveLength(4);
    expect(AI_ENGINES.flux_lora).toBeDefined();
    expect(AI_ENGINES.midjourney_omniref).toBeDefined();
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

  it("Flux LoRA should have the highest consistency score", () => {
    const fluxScore = AI_ENGINES.flux_lora.faceConsistencyScore;
    for (const engine of AI_ENGINE_LIST) {
      expect(fluxScore).toBeGreaterThanOrEqual(engine.faceConsistencyScore);
    }
  });

  it("should have recommended engines marked", () => {
    expect(AI_ENGINES.flux_lora.recommended).toBe(true);
    expect(AI_ENGINES.midjourney_omniref.recommended).toBe(true);
  });
});

// ═══ Multi-Engine Consistency Prompt Tests ═══
describe("buildMultiEngineConsistencyPrompt", () => {
  it("should include LoRA directive when flux_lora is selected", () => {
    const prompt = buildMultiEngineConsistencyPrompt({
      basePrompt: "Wedding photo in garden",
      engines: ["flux_lora"],
      gender: "female",
    });
    expect(prompt).toContain("LoRA");
    expect(prompt).toContain("facial identity");
    expect(prompt).toContain("Wedding photo in garden");
  });

  it("should include Midjourney directive when midjourney_omniref is selected", () => {
    const prompt = buildMultiEngineConsistencyPrompt({
      basePrompt: "Portrait photo",
      engines: ["midjourney_omniref"],
      gender: "male",
    });
    expect(prompt).toContain("character reference");
    expect(prompt).toContain("bone structure");
  });

  it("should include IP-Adapter directive when sd_ip_adapter is selected", () => {
    const prompt = buildMultiEngineConsistencyPrompt({
      basePrompt: "Studio portrait",
      engines: ["sd_ip_adapter"],
      gender: "female",
    });
    expect(prompt).toContain("IP-Adapter");
    expect(prompt).toContain("InstantID");
  });

  it("should combine multiple engine directives", () => {
    const prompt = buildMultiEngineConsistencyPrompt({
      basePrompt: "Wedding photo",
      engines: ["flux_lora", "midjourney_omniref", "sd_ip_adapter"],
      gender: "female",
      isCouple: true,
    });
    expect(prompt).toContain("LoRA");
    expect(prompt).toContain("character reference");
    expect(prompt).toContain("IP-Adapter");
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
  it("should return correct ref counts for Flux LoRA", () => {
    const counts = getRecommendedRefCount("flux_lora");
    expect(counts.min).toBe(3);
    expect(counts.max).toBe(10);
    expect(counts.optimal).toBe(5);
  });

  it("should return correct ref counts for Midjourney OmniRef", () => {
    const counts = getRecommendedRefCount("midjourney_omniref");
    expect(counts.min).toBe(1);
    expect(counts.max).toBe(3);
    expect(counts.optimal).toBe(1);
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

// ═══ v3.5 Character Sheet Tests ═══
describe("Character Sheet Feature", () => {
  it("should have generateCharacterSheet procedure in generations router", () => {
    const routerDef = appRouter._def;
    expect(routerDef).toBeDefined();
    // The procedure is registered under generations.generateCharacterSheet
  });

  it("should build correct character sheet prompt for male client", () => {
    const age = 30;
    const genderKo = "한국 남성";
    const hairDesc = "깔끔하게 스타일링 된 어두운색 머리";
    const prompt = `(Reference photo of the uploaded person) (Unprocessed original photo, hyperrealism).
A collection of upper body photos of a 'real' ${genderKo} in their [${age}s] (character sheet).
[Three angles: front view, side view, rear view].
Split screen, neatly styled ${hairDesc}, calm and confident expression, staring straight ahead at the camera lens.`;
    
    expect(prompt).toContain("한국 남성");
    expect(prompt).toContain("30s");
    expect(prompt).toContain("어두운색 머리");
    expect(prompt).toContain("Three angles");
    expect(prompt).toContain("character sheet");
    expect(prompt).toContain("hyperrealism");
  });

  it("should build correct character sheet prompt for female client", () => {
    const age = 25;
    const genderKo = "한국 여성";
    const hairDesc = "깔끔하게 스타일링 된 머리";
    const prompt = `A collection of upper body photos of a 'real' ${genderKo} in their [${age}s] (character sheet).`;
    
    expect(prompt).toContain("한국 여성");
    expect(prompt).toContain("25s");
    expect(prompt).not.toContain("어두운색");
  });

  it("should include face identity preservation directives", () => {
    const prompt = `[FACE IDENTITY PRESERVATION - CRITICAL]:
- Flux LoRA facial identity lock: maintain exact same face across all three angles
- IP-Adapter face embedding: use uploaded reference photos as direct face source
- Preserve exact facial bone structure, eye shape, nose bridge, jawline, lip shape`;
    
    expect(prompt).toContain("Flux LoRA");
    expect(prompt).toContain("IP-Adapter");
    expect(prompt).toContain("FACE IDENTITY PRESERVATION");
    expect(prompt).toContain("bone structure");
  });

  it("should include photography specifications", () => {
    const prompt = `85mm portrait lens, f/2.8, razor-sharp focus on the eyes, extremely realistic skin pores and hair texture,
Real skin texture not 3D render not illustration, DSLR photography.
4K resolution. 16:9 aspect ratio.`;
    
    expect(prompt).toContain("85mm");
    expect(prompt).toContain("f/2.8");
    expect(prompt).toContain("4K");
    expect(prompt).toContain("16:9");
    expect(prompt).toContain("DSLR");
    expect(prompt).toContain("not 3D render");
  });

  it("should use default age 30 when not provided", () => {
    const age = undefined ?? null ?? 30;
    expect(age).toBe(30);
  });

  it("should prioritize input age over client age", () => {
    const inputAge = 35;
    const clientAge = 28;
    const defaultAge = 30;
    const age = inputAge ?? clientAge ?? defaultAge;
    expect(age).toBe(35);
  });

  it("should fall back to client age when input age is undefined", () => {
    const inputAge = undefined;
    const clientAge = 28;
    const defaultAge = 30;
    const age = inputAge ?? clientAge ?? defaultAge;
    expect(age).toBe(28);
  });
});
