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
      // 1단계: flux/dev로 커플 배경+구도 생성 (얼굴 참조 없이)
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
      console.log(`커플 ${i+1}회 - 1단계 배경 생성 완료:`, baseUrl);

      // 2단계: fal-ai/face-swap으로 신부 얼굴 교체
      const brideResult = await fal.subscribe("fal-ai/face-swap" as any, {
        input: {
          base_image_url: baseUrl,           // 1단계 배경 이미지
          swap_image_url: bridePhotoUrl,     // 신부 얼굴 사진
        } as any,
      });
      const brideUrl = (brideResult as any).data.image.url;
      console.log(`커플 ${i+1}회 - 2단계 신부 얼굴 교체 완료:`, brideUrl);

      // 3단계: fal-ai/face-swap으로 신랑 얼굴 교체
      const groomResult = await fal.subscribe("fal-ai/face-swap" as any, {
        input: {
          base_image_url: brideUrl,          // 2단계 결과 이미지
          swap_image_url: groomPhotoUrl,     // 신랑 얼굴 사진
        } as any,
      });
      const groomUrl = (groomResult as any).data.image.url;
      console.log(`커플 ${i+1}회 - 3단계 신랑 얼굴 교체 완료:`, groomUrl);

      // 4단계: 4K 업스케일
      const upscaleResult = await fal.subscribe("fal-ai/esrgan", {
        input: {
          image_url: groomUrl,
          scale: 4,
          face: true,
        },
      });
      const finalUrl = (upscaleResult as any).data.image.url;
      console.log(`커플 ${i+1}회 - 4단계 업스케일 완료:`, finalUrl);
      results.push(finalUrl);

    } catch (err) {
      console.error(`커플 생성 ${i+1}회 실패:`, err);
    }
  }

  return results; // 여러 장 반환 → 고르게
}
