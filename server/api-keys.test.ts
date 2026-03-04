import { describe, expect, it } from "vitest";
import { ENV } from "./_core/env";

describe("API Keys - Environment Variables", () => {
  it("should have FAL_KEY set and non-empty", () => {
    expect(ENV.falKey).toBeDefined();
    expect(ENV.falKey.length).toBeGreaterThan(0);
  });

  it("should have ANTHROPIC_API_KEY set and non-empty", () => {
    expect(ENV.anthropicApiKey).toBeDefined();
    expect(ENV.anthropicApiKey.length).toBeGreaterThan(0);
  });

  it("FAL_KEY should look like a valid fal.ai key", () => {
    // fal.ai keys typically start with a specific prefix
    expect(typeof ENV.falKey).toBe("string");
    expect(ENV.falKey.trim()).not.toBe("");
  });

  it("ANTHROPIC_API_KEY should look like a valid Anthropic key", () => {
    // Anthropic keys typically start with "sk-ant-"
    expect(typeof ENV.anthropicApiKey).toBe("string");
    expect(ENV.anthropicApiKey.trim()).not.toBe("");
  });
});
