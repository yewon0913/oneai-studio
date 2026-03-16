/**
 * ONE AI STUDIO - RunPod ComfyUI Pipeline
 * Railway → RunPod Pod ComfyUI 직접 연결
 * customPrompt/customNegative 지원
 */

const COMFY_URL = process.env.RUNPOD_COMFY_URL || "";

const CONCEPTS: Record<string, { positive: string; negative: string }> = {
  male_suit: {
    positive: "portrait of a Korean man in his late 30s, navy blue blazer with light blue dress shirt, natural skin with visible pores, soft studio lighting, photorealistic, clean background, no watermark",
    negative: "deformed, ugly, blurry, cartoon, anime, stock photo, airbrushed, plastic skin, watermark, logo",
  },
  female_elegant: {
    positive: "portrait of a Korean woman, elegant cream blouse, natural skin with visible pores, soft studio lighting, photorealistic, clean background, no watermark",
    negative: "deformed, ugly, blurry, cartoon, anime, stock photo, airbrushed, plastic skin, watermark, logo",
  },
};

export async function checkRunPodHealth(): Promise<{ ok: boolean; message: string }> {
  if (!COMFY_URL) return { ok: false, message: "RUNPOD_COMFY_URL not set" };
  try {
    const resp = await fetch(`${COMFY_URL}/system_stats`, { signal: AbortSignal.timeout(10000) });
    if (resp.ok) return { ok: true, message: "ok" };
    return { ok: false, message: `Error: ${resp.status}` };
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
}

async function uploadToComfyUI(imageBuffer: Buffer, filename: string): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([imageBuffer], { type: "image/jpeg" });
  formData.append("image", blob, filename);
  const resp = await fetch(`${COMFY_URL}/upload/image`, { method: "POST", body: formData });
  if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
  const data = (await resp.json()) as { name: string };
  return data.name;
}

function buildWorkflow(imageName: string, positive: string, negative: string, seed: number) {
  const w: Record<string, any> = {};
  w["3"] = { class_type: "LoadImage", inputs: { image: imageName } };
  w["4"] = { class_type: "InstantIDModelLoader", inputs: { instantid_file: "ip-adapter.bin" } };
  w["5"] = { class_type: "InstantIDFaceAnalysis", inputs: { provider: "CUDA" } };
  w["6"] = { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors" } };
  w["14"] = { class_type: "ControlNetLoader", inputs: { control_net_name: "instantid_controlnet.safetensors" } };
  w["10"] = { class_type: "CLIPTextEncode", inputs: { text: positive, clip: ["6", 1] } };
  w["11"] = { class_type: "CLIPTextEncode", inputs: { text: negative, clip: ["6", 1] } };
  w["7"] = {
