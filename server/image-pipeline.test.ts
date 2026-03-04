import { describe, expect, it } from "vitest";
import {
  generateBaseImage,
  applyFace,
  upscale4K,
  removeBackground,
  runSinglePipeline,
  runCouplePipeline,
  applyFaceEnsemble,
  faceSwapSingle,
  faceSwapMulti,
  generateWithPuLID,
  generateWithFluxLora,
  runPipeline,
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

  it("should export applyFaceEnsemble function", () => {
    expect(typeof applyFaceEnsemble).toBe("function");
  });

  it("should export faceSwapSingle function", () => {
    expect(typeof faceSwapSingle).toBe("function");
  });

  it("should export faceSwapMulti function", () => {
    expect(typeof faceSwapMulti).toBe("function");
  });

  it("should export generateWithPuLID function", () => {
    expect(typeof generateWithPuLID).toBe("function");
  });

  it("should export generateWithFluxLora function", () => {
    expect(typeof generateWithFluxLora).toBe("function");
  });

  it("should export runPipeline function", () => {
    expect(typeof runPipeline).toBe("function");
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

  it("applyFaceEnsemble accepts baseImageUrl and faceImageUrls array", () => {
    expect(applyFaceEnsemble.length).toBe(2);
  });
});

describe("image-pipeline - applyFaceEnsemble logic", () => {
  it("should return baseImageUrl when faceImageUrls is empty", async () => {
    const result = await applyFaceEnsemble("https://example.com/base.jpg", []);
    expect(result).toBe("https://example.com/base.jpg");
  });
});

describe("image-pipeline - 3-step pipeline architecture", () => {
  it("faceSwapSingle accepts targetImageUrl and sourceFaceUrl", () => {
    expect(faceSwapSingle.length).toBe(2);
  });

  it("faceSwapMulti accepts targetImageUrl, face1Url, face1Gender, and optional face2", () => {
    expect(faceSwapMulti.length).toBeGreaterThanOrEqual(3);
  });

  it("runPipeline accepts single opts object", () => {
    expect(runPipeline.length).toBe(1);
  });

  it("pipeline architecture: generateBase → faceSwap → upscale functions all exist", () => {
    expect(typeof generateBaseImage).toBe("function");
    expect(typeof faceSwapSingle).toBe("function");
    expect(typeof faceSwapMulti).toBe("function");
    expect(typeof upscale4K).toBe("function");
  });
});
