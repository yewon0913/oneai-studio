import { fal } from "@fal-ai/client";
fal.config({ credentials: process.env.FAL_KEY });

export async function generateCouplePipeline(
  prompt: string,
  bridePhotoUrl: string,
  groomPhotoUrl: string,
  attempts: number = 3  // 여러 장 생성
): Promise<string[]> {
  const results: string[] = [];

  for (let i = 0; i < attempts; i++) {
    try {
      // 1단계: 커플 배경 생성
      const baseResult = await fal.subscribe("fal-ai/flux/dev", {
        input: {
          prompt: `RAW photo, photorealistic, 
                   Korean wedding couple, 
                   two people standing together, 
                   groom on left bride on right,
                   ${prompt},
                   Canon EOS R5, 8K, cinematic`,
          num_inference_steps: 28,
          guidance_scale: 3.5,
          image_size: "portrait_4_3",
          enable_safety_checker: false,
        },
      });
      const baseUrl = (baseResult as any).data.images[0].url;

      // 2단계: 신부 얼굴 합성 (PuLID: reference_image_url = 얼굴 사진)
      const brideResult = await fal.subscribe("fal-ai/flux-pulid", {
        input: {
          prompt: `same scene, same composition, same lighting, Korean bride face`,
          reference_image_url: bridePhotoUrl,
          num_inference_steps: 20,
          start_step: 4,
          guidance_scale: 4.0,
          id_weight: 0.95,
        },
      });
      const brideUrl = (brideResult as any).data.images[0].url;

      // 3단계: 신랑 얼굴 합성
      const groomResult = await fal.subscribe("fal-ai/flux-pulid", {
        input: {
          prompt: `same scene, same composition, same lighting, Korean groom face`,
          reference_image_url: groomPhotoUrl,
          num_inference_steps: 20,
          start_step: 4,
          guidance_scale: 4.0,
          id_weight: 0.85,
        },
      });
      const groomUrl = (groomResult as any).data.images[0].url;

      // 4단계: 4K 업스케일
      const upscaleResult = await fal.subscribe("fal-ai/esrgan", {
        input: {
          image_url: groomUrl,
          scale: 4,
          face: true,
        },
      });
      const finalUrl = (upscaleResult as any).data.image.url;
      results.push(finalUrl);

    } catch (err) {
      console.error(`커플 생성 ${i+1}회 실패:`, err);
    }
  }

  return results; // 여러 장 반환 → 고르게
}
