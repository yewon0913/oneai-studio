import { fal } from "@fal-ai/client";
fal.config({ credentials: process.env.FAL_KEY });

/**
 * 참조 이미지 기반 이미지 생성 (flux/dev/image-to-image)
 * 
 * 기존 flux/dev(텍스트→이미지) 대신, 참조 이미지의 구도를 유지하면서
 * 프롬프트에 맞게 변형하는 image-to-image 방식
 * 
 * strength 값 가이드:
 * - 0.5 = 원본 구도 80% 유지 (미세 변형)
 * - 0.7 = 원본 구도 60% 유지 + 얼굴 교체 여지
 * - 0.85 = 원본 구도 40% 유지 (대폭 변형)
 */
export async function generateFromReference(
  prompt: string,
  referenceImageUrl: string,
  strength: number = 0.75
): Promise<string> {
  const result = await fal.subscribe("fal-ai/flux/dev/image-to-image" as any, {
    input: {
      prompt: prompt,
      image_url: referenceImageUrl,
      strength: strength,
      num_inference_steps: 28,
      guidance_scale: 3.5,
      enable_safety_checker: false,
    } as any,
  });
  return (result as any).data.images[0].url;
}
