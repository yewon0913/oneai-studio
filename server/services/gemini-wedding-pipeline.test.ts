import { describe, it, expect, vi, beforeEach } from "vitest";

// sharp 모킹: 테스트 환경에서 실제 이미지 처리 없이 통과
vi.mock("sharp", () => {
  const mockSharp = vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(
      Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64")
    ),
  }));
  return { default: mockSharp };
});

import { generateGeminiWedding } from "./gemini-wedding-pipeline";

// Mock fetch
global.fetch = vi.fn();

describe("gemini-wedding-pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("should handle missing GEMINI_API_KEY gracefully", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await generateGeminiWedding("bride", "image/jpeg", "groom", "image/jpeg", "cherry_blossom");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].log).toContain("실패");
  });

  it("should handle API error responses gracefully", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({
        error: {
          code: 404,
          message: "Model not found"
        }
      })
    });

    const result = await generateGeminiWedding("bride", "image/jpeg", "groom", "image/jpeg", "cherry_blossom");
    // Should return at least one result with error log
    expect(result.length).toBeGreaterThan(0);
    // At least one should have failed
    const hasError = result.some(r => r.log.includes("실패"));
    expect(hasError).toBe(true);
  });

  it("should use correct model endpoint", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              inline_data: {
                mime_type: "image/png",
                data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
              }
            }]
          }
        }]
      })
    });

    await generateGeminiWedding("bride", "image/jpeg", "groom", "image/jpeg", "cherry_blossom");
    
    // Check that at least one call was made
    expect((global.fetch as any).mock.calls.length).toBeGreaterThan(0);
    // Check the URL contains the correct model
    const callUrl = (global.fetch as any).mock.calls[0][0];
    expect(callUrl).toContain("gemini-2.0-flash-exp-image-generation");
  });

  it("should handle different scene types", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              inline_data: {
                mime_type: "image/png",
                data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
              }
            }]
          }
        }]
      })
    });

    const scenes = ["cherry_blossom", "chapel", "garden", "beach", "studio"];
    for (const scene of scenes) {
      const result = await generateGeminiWedding("bride", "image/jpeg", "groom", "image/jpeg", scene as any);
      expect(result.length).toBeGreaterThan(0);
    }
  });
});
