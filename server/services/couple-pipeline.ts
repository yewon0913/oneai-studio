import { fal } from "@fal-ai/client";
fal.config({ credentials: process.env.FAL_KEY });

export async function generateCouplePipeline(
  prompt: string,
  bridePhotoUrl: string,
  groomPhotoUrl: string,
  attempts: number = 3
): Promise<string[]> {
  const results: string[] = [];

  for (let i = 0; i < attempts; i++) {
    try {
      // 1단계: 커플 배경 생성
      const baseResult = await fal.subscribe("fal-ai/flux/dev", {
        input: {
          prompt: `RAW photo, photorealistic, Korean wedding couple, two people, groom left bride right, ${prompt}, 8K, cinematic`,
          num_inference_steps: 28,
          guidance_scale: 3.5,
          image_size: "portrait_4_3",
          enable_safety_checker: false,
        },
      });
      const baseUrl = (baseResult as any).data.images[0].url;
      console.log("1단계 완료:", baseUrl);

      // 2단계: 신부 얼굴 교체
      const brideResult = await fal.subscribe(
        "fal-ai/face-swap" as any,
        {
          input: {
            base_image_url: baseUrl,
            swap_image_url: bridePhotoUrl,
          },
        }
      );
      const brideUrl = (brideResult as any).data?.image?.url 
        || (brideResult as any).data?.images?.[0]?.url
        || baseUrl;
      console.log("2단계 완료:", brideUrl);

      // 3단계: 신랑 얼굴 교체
      const groomResult = await fal.subscribe(
        "fal-ai/face-swap" as any,
        {
          input: {
            base_image_url: brideUrl,
            swap_image_url: groomPhotoUrl,
          },
        }
      );
      const groomUrl = (groomResult as any).data?.image?.url
        || (groomResult as any).data?.images?.[0]?.url
        || brideUrl;
      console.log("3단계 완료:", groomUrl);

      // 4단계: 업스케일
      const upscaleResult = await fal.subscribe("fal-ai/esrgan", {
        input: {
          image_url: groomUrl,
          scale: 2,
          face: true,
        },
      });
      const finalUrl = (upscaleResult as any).data.image.url;
      console.log("4단계 완료:", finalUrl);

      results.push(finalUrl);

    } catch (err: any) {
      console.error(`커플 생성 ${i+1}회 실패:`, err?.message || err);
    }
  }

  return results;
}
