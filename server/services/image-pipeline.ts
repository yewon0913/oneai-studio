/**
 * 참조 이미지 기반 이미지 생성
 * 
 * 1순위: RunPod ComfyUI (InstantID + Juggernaut XL) — 88점
 * 2순위: Gemini Nano Banana Pro (폴백)
 * 3순위: FLUX.2 LoRA (폴백)
 */
import { callGemini, extractImageUrl, type GeminiPart } from "../_core/imageGeneration";
import { generateWithComfyUI, checkRunPodHealth } from "./runpod-comfyui-pipeline";

async function falRun(
  modelId: string,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error("FAL_KEY not set");
  const res = await fetch(`https://fal.run/${modelId}`, {
    method: "POST",
    headers: {
      "Authorization": `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${modelId} failed ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

export async function generateFromReference(
  prompt: string,
  referenceImageUrl: string,
  strength: number = 0.75
): Promise<string> {

  // === 1순위: RunPod ComfyUI (InstantID 88점) ===
  try {
    const health = await checkRunPodHealth();
    if (health.ok) {
      console.log("[image-pipeline] RunPod ComfyUI 시도...");
      const refRes = await fetch(referenceImageUrl);
      if (refRes.ok) {
        const buffer = Buffer.from(await refRes.arrayBuffer());
        const gender = prompt.toLowerCase().includes("woman") || prompt.toLowerCase().includes("female") ? "female" : "male";
        const concept = gender === "male" ? "male_suit" : "female_elegant";
        
        const result = await generateWithComfyUI({
          faceImageBuffer: buffer,
          concept,
          seed: Math.floor(Math.random() * 999999),
        });

        // 결과를 FAL Storage에 업로드해서 URL로 반환
        const falKey = process.env.FAL_KEY;
        if (falKey) {
          const uploadRes = await fetch("https://fal.run/fal-ai/workflows/storage", {
            method: "POST",
            headers: {
              "Authorization": `Key ${falKey}`,
              "Content-Type": "image/jpeg",
            },
            body: result.imageBuffer,
          });
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json() as { url: string };
            console.log(`[image-pipeline] ComfyUI 성공! ${result.elapsed}s, seed:${result.seed}`);
            return uploadData.url;
          }
        }

        // FAL Storage 실패시 base64 data URL로 반환
        const b64 = result.imageBuffer.toString("base64");
        console.log(`[image-pipeline] ComfyUI 성공 (base64)! ${result.elapsed}s`);
        return `data:image/jpeg;base64,${b64}`;
      }
    } else {
      console.log(`[image-pipeline] RunPod 오프라인: ${health.message}`);
    }
  } catch (err: any) {
    console.warn(`[image-pipeline] ComfyUI 실패: ${err.message?.slice(0, 150)}`);
  }

  // === 2순위: Gemini Nano Banana Pro ===
  console.log("[image-pipeline] Gemini 폴백...");
  try {
    const refRes = await fetch(referenceImageUrl);
    if (refRes.ok) {
      const buffer = Buffer.from(await refRes.arrayBuffer());
      const mime = refRes.headers.get("content-type") || "image/jpeg";
      const parts: GeminiPart[] = [
        { inlineData: { mimeType: mime, data: buffer.toString("base64") } },
        { text: `Transform this image while preserving the composition and structure (strength: ${strength}). ${prompt}` },
      ];
      const response = await callGemini(parts);
      const url = await extractImageUrl(response);
      console.log("[image-pipeline] Gemini 성공:", url.slice(0, 80));
      return url;
    }
  } catch (err: any) {
    console.warn(`[image-pipeline] Gemini 실패: ${err.message?.slice(0, 100)}`);
  }

  // === 3순위: FLUX.2 LoRA ===
  const models = ["fal-ai/flux-2/lora", "fal-ai/flux/dev/image-to-image"];
  for (const modelId of models) {
    try {
      console.log(`[image-pipeline] ${modelId} 폴백...`);
      const result = await falRun(modelId, {
        prompt,
        image_url: referenceImageUrl,
        strength,
        num_inference_steps: 28,
        guidance_scale: 3.5,
        enable_safety_checker: false,
      });
      const url = (result?.images as Array<{ url: string }>)?.[0]?.url;
      if (url) {
        console.log(`[image-pipeline] ${modelId} 성공:`, url.slice(0, 80));
        return url;
      }
    } catch (err: any) {
      console.warn(`[image-pipeline] ${modelId} 실패: ${err.message?.slice(0, 80)}`);
      continue;
    }
  }

  throw new Error("모든 이미지 생성 모델 실패");
}
```

4. **"Commit changes" 클릭!**

**이렇게 하면:**
```
RunPod Pod 켜져있으면 → ComfyUI 88점 생성!
RunPod Pod 꺼져있으면 → Gemini/FLUX 폴백 (기존 방식)
}
