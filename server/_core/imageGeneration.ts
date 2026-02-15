/**
 * Image generation helper using internal ImageService
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 *
 * For editing:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "Add a rainbow to this landscape",
 *     originalImages: [{
 *       url: "https://example.com/original.jpg",
 *       mimeType: "image/jpeg"
 *     }]
 *   });
 */
import { storagePut } from "server/storage";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
};

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  if (!ENV.forgeApiUrl) {
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }

  // Build the full URL by appending the service path to the base URL
  const baseUrl = ENV.forgeApiUrl.endsWith("/")
    ? ENV.forgeApiUrl
    : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL(
    "images.v1.ImageService/GenerateImage",
    baseUrl
  ).toString();

  // Convert originalImages to snake_case format expected by the API
  const originalImagesPayload = (options.originalImages || []).map(img => {
    const item: Record<string, string> = {};
    if (img.url) item.url = img.url;
    if (img.b64Json) item.b64_json = img.b64Json;
    if (img.mimeType) item.mime_type = img.mimeType;
    return item;
  });

  // Truncate prompt to prevent BAD_REQUEST from overly long prompts
  let prompt = options.prompt;
  if (prompt.length > 1000) {
    prompt = prompt.substring(0, 997) + "...";
  }

  console.log(`[ImageGen] Prompt length: ${prompt.length}, Images: ${originalImagesPayload.length}`);

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({
      prompt,
      original_images: originalImagesPayload,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[ImageGen] API Error ${response.status}: ${detail.substring(0, 500)}`);
    
    // If BAD_REQUEST with original images, retry without them
    if (response.status === 400 && originalImagesPayload.length > 0) {
      console.warn("[ImageGen] Retrying without original images...");
      const retryResponse = await fetch(fullUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "connect-protocol-version": "1",
          authorization: `Bearer ${ENV.forgeApiKey}`,
        },
        body: JSON.stringify({
          prompt,
          original_images: [],
        }),
      });

      if (!retryResponse.ok) {
        const retryDetail = await retryResponse.text().catch(() => "");
        throw new Error(
          `Image generation request failed (${retryResponse.status} ${retryResponse.statusText})${retryDetail ? `: ${retryDetail}` : ""}`
        );
      }

      const retryResult = (await retryResponse.json()) as {
        image: { b64Json: string; mimeType: string };
      };
      const retryBase64 = retryResult.image.b64Json;
      const retryBuffer = Buffer.from(retryBase64, "base64");
      const { url: retryUrl } = await storagePut(
        `generated/${Date.now()}.png`,
        retryBuffer,
        retryResult.image.mimeType
      );
      return { url: retryUrl };
    }

    throw new Error(
      `Image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const result = (await response.json()) as {
    image: {
      b64Json: string;
      mimeType: string;
    };
  };
  const base64Data = result.image.b64Json;
  const buffer = Buffer.from(base64Data, "base64");

  // Save to S3
  const { url } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    result.image.mimeType
  );
  return {
    url,
  };
}
