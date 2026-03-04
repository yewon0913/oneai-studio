import { createFalClient } from "@fal-ai/client";

const fal = createFalClient({ credentials: process.env.FAL_KEY! });

async function testFaceSwap() {
  console.log("=== Test 1: flux/dev base image generation ===");
  try {
    const baseResult = await fal.subscribe("fal-ai/flux/dev", {
      input: {
        prompt: "A beautiful Korean woman in a white wedding dress, outdoor garden, golden hour, soft natural lighting, professional photography, 8k quality, shallow depth of field",
        image_size: "landscape_16_9",
        num_images: 1,
      } as any,
    });
    const baseUrl = (baseResult.data as any).images?.[0]?.url;
    console.log("Base image URL:", baseUrl);

    if (baseUrl) {
      console.log("\n=== Test 2: face-swap on base image ===");
      // Use a sample face image URL
      const faceUrl = "https://fal.media/files/elephant/8kVOO0vBMYMzigOf2CSQY_test.png";
      
      try {
        const swapResult = await fal.subscribe("fal-ai/face-swap", {
          input: {
            base_image_url: baseUrl,
            swap_image_url: faceUrl,
          } as any,
        });
        console.log("Face-swap result:", JSON.stringify(swapResult.data, null, 2).substring(0, 500));
      } catch (e: any) {
        console.log("face-swap error:", e.message?.substring(0, 300));
        
        // Try alternative: flux-kontext for face editing
        console.log("\n=== Test 3: flux-kontext-pro for face editing ===");
        try {
          const kontextResult = await fal.subscribe("fal-ai/flux-kontext/pro/v1", {
            input: {
              prompt: "Keep the exact same scene, pose, clothing, and background. Only change the face to match the reference person's face exactly.",
              image_url: baseUrl,
            } as any,
          });
          console.log("kontext result:", JSON.stringify(kontextResult.data, null, 2).substring(0, 500));
        } catch (e2: any) {
          console.log("kontext error:", e2.message?.substring(0, 300));
        }
      }
    }
  } catch (e: any) {
    console.log("Base generation error:", e.message?.substring(0, 300));
  }
}

testFaceSwap();
