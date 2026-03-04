import { describe, expect, it } from "vitest";
import {
  generateBaseImage,
  applyFace,
  upscale4K,
  removeBackground,
  runSinglePipeline,
  runCouplePipeline,
} from "./services/image-pipeline";

describe("image-pipeline - module exports", () => {
  it("should export generateBaseImage function", () => {
    expect(typeof generateBaseImage).toBe("function");
  });

  it("should export applyFace function", () => {
    expect(typeof applyFace).toBe("function");
  });

  it("should export upscale4K function", () => {
    expect(typeof upscale4K).toBe("function");
  });

  it("should export removeBackground function", () => {
    expect(typeof removeBackground).toBe("function");
  });

  it("should export runSinglePipeline function", () => {
    expect(typeof runSinglePipeline).toBe("function");
  });

  it("should export runCouplePipeline function", () => {
    expect(typeof runCouplePipeline).toBe("function");
  });
});

describe("image-pipeline - function signatures", () => {
  it("generateBaseImage accepts prompt and optional negativePrompt", () => {
    // function.length counts params before the first default value
    expect(generateBaseImage.length).toBeGreaterThanOrEqual(1);
  });

  it("applyFace accepts baseImageUrl, faceImageUrl, and optional weight", () => {
    expect(applyFace.length).toBeGreaterThanOrEqual(2);
  });

  it("upscale4K accepts imageUrl", () => {
    expect(upscale4K.length).toBe(1);
  });

  it("removeBackground accepts imageUrl", () => {
    expect(removeBackground.length).toBe(1);
  });

  it("runSinglePipeline accepts prompt, faceImageUrl, and optional negativePrompt", () => {
    expect(runSinglePipeline.length).toBeGreaterThanOrEqual(2);
  });

  it("runCouplePipeline accepts prompt, brideFaceUrl, groomFaceUrl, and optional negativePrompt", () => {
    expect(runCouplePipeline.length).toBeGreaterThanOrEqual(3);
  });
});
