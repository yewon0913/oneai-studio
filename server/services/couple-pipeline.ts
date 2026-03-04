import { fal } from "@fal-ai/client";

// fal.config를 함수 호출 시점에 실행 (배포 환경 env 주입 타이밍 이슈 방지)
let falConfigured = false;
function ensureFalConfig() {
  if (falConfigured) return;
  const key = process.env.FAL_KEY;
  if (!key || key.trim().length === 0) {
    throw new Error("FAL_KEY 환경변수가 설정되지 않았습니다. Settings > Secrets에서 FAL_KEY를 확인해주세요.");
  }
  fal.config({ credentials: key.trim() });
  falConfigured = true;
  console.log("[couple-pipeline] fal.config 완료, key length:", key.trim().length);
}

export async function generateCouplePipeline(
  prompt: string,
  bridePhotoUrl: string,
  groomPhotoUrl: string,
  attempts: number = 3
): Promise<string[]> {
  // 함수 호출 시점에 fal 설정
  ensureFalConfig();

  // URL 공백/개행 제거
  const cleanBrideUrl = bridePhotoUrl.trim();
  const cleanGroomUrl = groomPhotoUrl.trim();

  console.log("[couple-pipeline] 시작 - attempts:", attempts);
  console.log("[couple-pipeline] brideUrl:", cleanBrideUrl.substring(0, 80));
  console.log("[couple-pipeline] groomUrl:", cleanGroomUrl.substring(0, 80));

  const results: string[] = [];

  for (let i = 0; i < attempts; i++) {
    try {
      // 1단계: 커플 배경 생성
      console.log(`[couple-pipeline] ${i+1}회차 1단계: flux/dev 배경 생성`);
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
      console.log(`[couple-pipeline] ${i+1}회차 1단계 완료`);

      // 2단계: 신부 얼굴 교체 (필수 - 실패 시 이 회차 스킵)
      console.log(`[couple-pipeline] ${i+1}회차 2단계: 신부 face-swap`);
      const brideResult = await fal.subscribe(
        "fal-ai/face-swap" as any,
        {
          input: {
            base_image_url: baseUrl,
            swap_image_url: cleanBrideUrl,
          },
        }
      );
      const brideUrl = (brideResult as any).data?.image?.url;
      if (!brideUrl) {
        console.error(`[couple-pipeline] ${i+1}회차 2단계: 신부 face-swap 응답에 image.url 없음`);
        console.error(`[couple-pipeline] 응답:`, JSON.stringify((brideResult as any).data).substring(0, 300));
        throw new Error("신부 얼굴 교체 실패: 응답에 이미지 URL이 없습니다");
      }
      console.log(`[couple-pipeline] ${i+1}회차 2단계 완료`);

      // 3단계: 신랑 얼굴 교체 (필수 - 실패 시 이 회차 스킵)
      console.log(`[couple-pipeline] ${i+1}회차 3단계: 신랑 face-swap`);
      const groomResult = await fal.subscribe(
        "fal-ai/face-swap" as any,
        {
          input: {
            base_image_url: brideUrl,
            swap_image_url: cleanGroomUrl,
          },
        }
      );
      const groomUrl = (groomResult as any).data?.image?.url;
      if (!groomUrl) {
        console.error(`[couple-pipeline] ${i+1}회차 3단계: 신랑 face-swap 응답에 image.url 없음`);
        console.error(`[couple-pipeline] 응답:`, JSON.stringify((groomResult as any).data).substring(0, 300));
        throw new Error("신랑 얼굴 교체 실패: 응답에 이미지 URL이 없습니다");
      }
      console.log(`[couple-pipeline] ${i+1}회차 3단계 완료`);

      // 4단계: 업스케일
      console.log(`[couple-pipeline] ${i+1}회차 4단계: esrgan 업스케일`);
      const upscaleResult = await fal.subscribe("fal-ai/esrgan", {
        input: {
          image_url: groomUrl,
          scale: 2,
          face: true,
        },
      });
      const finalUrl = (upscaleResult as any).data.image.url;
      if (!finalUrl) {
        throw new Error("업스케일 실패: 응답에 이미지 URL이 없습니다");
      }
      console.log(`[couple-pipeline] ${i+1}회차 4단계 완료 - 성공!`);

      results.push(finalUrl);

    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const errBody = err?.body ? JSON.stringify(err.body).substring(0, 200) : "no body";
      console.error(`[couple-pipeline] ${i+1}회차 실패: ${errMsg}`);
      console.error(`[couple-pipeline] 에러 body: ${errBody}`);
      // face-swap 실패 시 폴백으로 저장하지 않음 - 다음 회차로 재시도
    }
  }

  if (results.length === 0) {
    throw new Error(`커플 사진 생성에 ${attempts}회 모두 실패했습니다. 고객 사진이 정면 얼굴인지 확인해주세요.`);
  }

  console.log(`[couple-pipeline] 완료 - ${results.length}/${attempts}장 성공`);
  return results;
}
