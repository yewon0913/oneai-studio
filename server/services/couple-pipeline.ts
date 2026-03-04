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
  console.log("[couple-pipeline] brideUrl:", cleanBrideUrl.substring(0, 80) + "...");
  console.log("[couple-pipeline] groomUrl:", cleanGroomUrl.substring(0, 80) + "...");

  const results: string[] = [];

  for (let i = 0; i < attempts; i++) {
    try {
      // 1단계: 커플 배경 생성
      console.log(`[couple-pipeline] ${i+1}회차 1단계 시작: flux/dev 배경 생성`);
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
      console.log(`[couple-pipeline] ${i+1}회차 1단계 완료:`, baseUrl.substring(0, 80));

      // 2단계: 신부 얼굴 교체
      console.log(`[couple-pipeline] ${i+1}회차 2단계 시작: 신부 face-swap`);
      let brideUrl = baseUrl;
      try {
        const brideResult = await fal.subscribe(
          "fal-ai/face-swap" as any,
          {
            input: {
              base_image_url: baseUrl,
              swap_image_url: cleanBrideUrl,
            },
          }
        );
        brideUrl = (brideResult as any).data?.image?.url 
          || (brideResult as any).data?.images?.[0]?.url
          || baseUrl;
        console.log(`[couple-pipeline] ${i+1}회차 2단계 완료:`, brideUrl.substring(0, 80));
      } catch (swapErr: any) {
        console.error(`[couple-pipeline] ${i+1}회차 2단계(신부 face-swap) 실패:`, swapErr?.message || swapErr);
        console.error(`[couple-pipeline] 2단계 에러 상세:`, JSON.stringify(swapErr?.body || swapErr?.status || "unknown"));
        // 신부 교체 실패 시 원본 배경 사용하여 계속 진행
      }

      // 3단계: 신랑 얼굴 교체
      console.log(`[couple-pipeline] ${i+1}회차 3단계 시작: 신랑 face-swap`);
      let groomUrl = brideUrl;
      try {
        const groomResult = await fal.subscribe(
          "fal-ai/face-swap" as any,
          {
            input: {
              base_image_url: brideUrl,
              swap_image_url: cleanGroomUrl,
            },
          }
        );
        groomUrl = (groomResult as any).data?.image?.url
          || (groomResult as any).data?.images?.[0]?.url
          || brideUrl;
        console.log(`[couple-pipeline] ${i+1}회차 3단계 완료:`, groomUrl.substring(0, 80));
      } catch (swapErr: any) {
        console.error(`[couple-pipeline] ${i+1}회차 3단계(신랑 face-swap) 실패:`, swapErr?.message || swapErr);
        console.error(`[couple-pipeline] 3단계 에러 상세:`, JSON.stringify(swapErr?.body || swapErr?.status || "unknown"));
        // 신랑 교체 실패 시 이전 단계 결과 사용하여 계속 진행
      }

      // 4단계: 업스케일
      console.log(`[couple-pipeline] ${i+1}회차 4단계 시작: esrgan 업스케일`);
      const upscaleResult = await fal.subscribe("fal-ai/esrgan", {
        input: {
          image_url: groomUrl,
          scale: 2,
          face: true,
        },
      });
      const finalUrl = (upscaleResult as any).data.image.url;
      console.log(`[couple-pipeline] ${i+1}회차 4단계 완료:`, finalUrl.substring(0, 80));

      results.push(finalUrl);

    } catch (err: any) {
      console.error(`[couple-pipeline] ${i+1}회차 전체 실패:`, err?.message || err);
      console.error(`[couple-pipeline] 에러 스택:`, err?.stack?.substring(0, 300) || "no stack");
      console.error(`[couple-pipeline] 에러 body:`, JSON.stringify(err?.body || err?.status || "unknown"));
    }
  }

  console.log(`[couple-pipeline] 완료 - ${results.length}/${attempts}장 성공`);
  return results;
}
