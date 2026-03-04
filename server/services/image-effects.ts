/**
 * image-effects.ts
 * 계절 변환 및 색감 효과 서비스
 * fal.ai Flux Dev를 사용하여 이미지에 계절/색감 효과를 적용합니다.
 */
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

// ─── 계절 프롬프트 ───
const SEASON_PROMPTS = {
  spring: "cherry blossom background, pink petals falling, spring garden, soft pink light",
  summer: "lush green garden, bright natural light, summer outdoor, vivid colors",
  autumn: "autumn maple leaves, orange and red foliage, golden fall, warm amber light",
  winter: "snow covered landscape, winter wonderland, soft snowfall, cool blue tones",
} as const;

// ─── 색감 그레이딩 프롬프트 ───
const COLOR_GRADES = {
  film: "film grain, vintage color grading, faded highlights, analog photography",
  bw: "black and white, high contrast, classic monochrome, dramatic shadows",
  golden: "golden hour, warm orange tones, sunset glow, romantic atmosphere",
  blue: "blue hour, cool tones, twilight atmosphere, serene mood",
} as const;

export type Season = keyof typeof SEASON_PROMPTS;
export type ColorGrade = keyof typeof COLOR_GRADES;

/**
 * 1) 계절 변환 - 이미지의 배경을 지정된 계절로 변환
 */
export async function applySeasonTransform(
  imageUrl: string,
  season: Season
): Promise<string> {
  const result = await fal.subscribe("fal-ai/flux/dev", {
    input: {
      prompt: `Same couple, same pose, same composition, but ${SEASON_PROMPTS[season]}, photorealistic, Korean wedding photography, high quality`,
      image_url: imageUrl,
      strength: 0.55,
      num_inference_steps: 25,
      guidance_scale: 3.5,
    } as any,
  });
  const data = result.data as any;
  if (!data?.images?.[0]?.url) {
    throw new Error("계절 변환 결과 이미지를 가져올 수 없습니다");
  }
  return data.images[0].url as string;
}

/**
 * 2) 색감 그레이딩 - 이미지에 특정 색감 효과 적용
 */
export async function applyColorGrade(
  imageUrl: string,
  grade: ColorGrade
): Promise<string> {
  const result = await fal.subscribe("fal-ai/flux/dev", {
    input: {
      prompt: `Same scene, same people, same composition, but with ${COLOR_GRADES[grade]}, photorealistic, professional photography`,
      image_url: imageUrl,
      strength: 0.45,
      num_inference_steps: 25,
      guidance_scale: 3.5,
    } as any,
  });
  const data = result.data as any;
  if (!data?.images?.[0]?.url) {
    throw new Error("색감 그레이딩 결과 이미지를 가져올 수 없습니다");
  }
  return data.images[0].url as string;
}
