const { fal } = require('@fal-ai/client');

async function test() {
  // FAL_KEY 없는 상태
  console.log("=== FAL_KEY undefined 테스트 ===");
  fal.config({ credentials: undefined });
  try {
    const r = await fal.subscribe("fal-ai/flux/dev", {
      input: { prompt: "test", num_inference_steps: 10 }
    });
    console.log("OK");
  } catch (e) {
    console.log("에러:", e.message);
  }

  // FAL_KEY 빈 문자열
  console.log("\n=== FAL_KEY 빈 문자열 테스트 ===");
  fal.config({ credentials: "" });
  try {
    const r = await fal.subscribe("fal-ai/flux/dev", {
      input: { prompt: "test", num_inference_steps: 10 }
    });
    console.log("OK");
  } catch (e) {
    console.log("에러:", e.message);
  }

  // FAL_KEY 잘못된 형식
  console.log("\n=== FAL_KEY 잘못된 형식 테스트 ===");
  fal.config({ credentials: "invalid-key" });
  try {
    const r = await fal.subscribe("fal-ai/flux/dev", {
      input: { prompt: "test", num_inference_steps: 10 }
    });
    console.log("OK");
  } catch (e) {
    console.log("에러:", e.message);
  }
}

test();
