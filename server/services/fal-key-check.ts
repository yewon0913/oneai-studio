/**
 * FAL Key Check - FAL_KEY 유효성 검증
 */

export interface FalKeyCheckResult {
  isValid: boolean;
  keyPrefix: string;
  message: string;
  models?: string[];
}

export async function checkFalKey(): Promise<FalKeyCheckResult> {
  const falKey = process.env.FAL_KEY;

  if (!falKey) {
    return {
      isValid: false,
      keyPrefix: "",
      message: "FAL_KEY 환경변수가 설정되지 않았습니다.",
    };
  }

  const keyPrefix = falKey.slice(0, 4) + "****";

  try {
    // FAL API 테스트 호출 (가벼운 엔드포인트)
    const res = await fetch("https://fal.run/fal-ai/flux/dev", {
      method: "POST",
      headers: {
        "Authorization": `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: "test",
        num_inference_steps: 1,
        image_size: "square_hd",
      }),
    });

    if (res.status === 401 || res.status === 403) {
      return {
        isValid: false,
        keyPrefix,
        message: "FAL_KEY가 유효하지 않습니다 (인증 실패).",
      };
    }

    // 200 또는 다른 에러 (422 등)는 키 자체는 유효
    return {
      isValid: true,
      keyPrefix,
      message: "FAL_KEY가 유효합니다.",
      models: [
        "fal-ai/flux/dev/image-to-image",
        "fal-ai/birefnet",
        "fal-ai/face-swap",
        "fal-ai/codeformer",
        "fal-ai/ic-light",
      ],
    };
  } catch (err: any) {
    return {
      isValid: false,
      keyPrefix,
      message: `FAL API 연결 실패: ${err.message?.slice(0, 100)}`,
    };
  }
}
