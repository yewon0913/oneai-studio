/**
 * ONE AI STUDIO - RunPod ComfyUI Pipeline
 * Railway → RunPod Pod ComfyUI 직접 연결
 * 
 * 확정 파라미터 (분석실 검증 완료):
 * - 모델: Juggernaut XL v9
 * - InstantID weight: 0.90
 * - cfg: 4.5 / sampler: dpmpp_2m / scheduler: karras / steps: 35
 * - 후처리: Film Grain + 밝기보정 + 샤프닝 + 업스케일
 * - 점수: 88점 (단일 최고) / 86점 (평균) / 87점 (일관성)
 */

const COMFY_URL = process.env.RUNPOD_COMFY_URL || "";

// === 컨셉별 프롬프트 (분석실 확정본) ===
const CONCEPTS: Record<string, { positive: string; negative: string }> = {
  male_suit: {
    positive: "portrait of a Korean man in his late 30s, navy blue blazer with light blue dress shirt and white pocket square, no necktie, slim oval face with defined jawline, narrow elongated eyes with subtle inner double eyelid, subtle closed-mouth smile with upturned corners, warm brown-tinted textured wavy hair with volume on top, natural Korean male skin with visible pores fair tone, single key light from upper left at 45 degrees, soft fill light from right, 2:1 lighting ratio, neutral gray seamless background, photorealistic natural depth of field, authentic natural expression, clean background, no watermark, no text",
    negative: "deformed, ugly, blurry, cartoon, anime, stock photo, getty images, smooth porcelain skin, airbrushed, plastic skin, heavy makeup, glossy skin, round face, chubby cheeks, wide jaw, large round eyes, double eyelid surgery look, open mouth smile, teeth showing, wide grin, forced smile, jet black hair, straight flat hair, westernized features, enlarged eyes, different person than reference, watermark, text overlay, logo, signature, necktie, bow tie, scarf, turtleneck",
  },
  male_casual: {
    positive: "portrait of a Korean man in his late 30s, cream knit sweater, relaxed natural pose, slim oval face with defined jawline, narrow elongated eyes, subtle closed-mouth smile, warm brown-tinted textured wavy hair, natural Korean male skin with visible pores, soft natural window light, neutral background, photorealistic, clean background, no watermark, no text",
    negative: "deformed, ugly, blurry, cartoon, anime, stock photo, smooth porcelain skin, airbrushed, plastic skin, heavy makeup, round face, chubby cheeks, large round eyes, open mouth smile, teeth showing, jet black hair, straight flat hair, westernized features, watermark, text overlay, logo, signature",
  },
  female_elegant: {
    positive: "portrait of a Korean woman, elegant cream blouse, natural beauty, slim face with soft jawline, natural Korean female skin with visible pores, subtle closed-mouth smile, single key light from upper left at 45 degrees, soft fill light from right, 2:1 lighting ratio, neutral gray seamless background, photorealistic natural depth of field, authentic natural expression, clean background, no watermark, no text",
    negative: "deformed, ugly, blurry, cartoon, anime, stock photo, smooth porcelain skin, airbrushed, plastic skin, heavy makeup, glossy skin, large round eyes, double eyelid surgery look, open mouth smile, teeth showing, wide grin, forced smile, westernized features, enlarged eyes, different person than reference, watermark, text overlay, logo, signature",
  },
  female_casual: {
    positive: "portrait of a Korean woman, soft cream knit sweater, natural relaxed pose, natural Korean female skin with visible pores, subtle gentle smile, soft natural window light, neutral background, photorealistic, clean background, no watermark, no text",
    negative: "deformed, ugly, blurry, cartoon, anime, stock photo, smooth porcelain skin, airbrushed, plastic skin, heavy makeup, large round eyes, open mouth smile, teeth showing, westernized features, watermark, text overlay, logo, signature",
  },
};

// === ComfyUI 헬스체크 ===
export async function checkRunPodHealth(): Promise<{ ok: boolean; message: string }> {
  if (!COMFY_URL) {
    return { ok: false, message: "RUNPOD_COMFY_URL 환경변수가 설정되지 않았습니다." };
  }
  try {
    const resp = await fetch(`${COMFY_URL}/system_stats`, {
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      return { ok: true, message: "RunPod ComfyUI 서버 정상" };
    }
    return { ok: false, message: `서버 응답 오류: ${resp.status}` };
  } catch (e: any) {
    return { ok: false, message: `RunPod 서버 연결 실패: Pod가 꺼져있을 수 있습니다. (${e.message})` };
  }
}

// === 이미지 업로드 ===
async function uploadToComfyUI(imageBuffer: Buffer, filename: string): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([imageBuffer], { type: "image/jpeg" });
  formData.append("image", blob, filename);

  const resp = await fetch(`${COMFY_URL}/upload/image`, {
    method: "POST",
    body: formData,
  });

  if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
  const data = (await resp.json()) as { name: string };
  return data.name;
}

// === 워크플로우 빌드 ===
function buildInstantIDWorkflow(imageName: string, concept: string, seed: number) {
  const prompts = CONCEPTS[concept] || CONCEPTS.male_suit;

  const w: Record<string, any> = {};
  w["3"] = { class_type: "LoadImage", inputs: { image: imageName } };
  w["4"] = { class_type: "InstantIDModelLoader", inputs: { instantid_file: "ip-adapter.bin" } };
  w["5"] = { class_type: "InstantIDFaceAnalysis", inputs: { provider: "CUDA" } };
  w["6"] = { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors" } };
  w["14"] = { class_type: "ControlNetLoader", inputs: { control_net_name: "instantid_controlnet.safetensors" } };
  w["10"] = { class_type: "CLIPTextEncode", inputs: { text: prompts.positive, clip: ["6", 1] } };
  w["11"] = { class_type: "CLIPTextEncode", inputs: { text: prompts.negative, clip: ["6", 1] } };
  w["7"] = {
    class_type: "ApplyInstantID",
    inputs: {
      instantid: ["4", 0], insightface: ["5", 0], control_net: ["14", 0],
      image: ["3", 0], model: ["6", 0], positive: ["10", 0], negative: ["11", 0],
      weight: 0.90, start_at: 0.0, end_at: 1.0,
    },
  };
  w["9"] = { class_type: "EmptyLatentImage", inputs: { width: 1024, height: 1024, batch_size: 1 } };
  w["8"] = {
    class_type: "KSampler",
    inputs: {
      model: ["7", 0], positive: ["7", 1], negative: ["7", 2],
      latent_image: ["9", 0], seed, steps: 35, cfg: 4.5,
      sampler_name: "dpmpp_2m", scheduler: "karras", denoise: 1.0,
    },
  };
  w["12"] = { class_type: "VAEDecode", inputs: { samples: ["8", 0], vae: ["6", 2] } };
  w["13"] = { class_type: "SaveImage", inputs: { images: ["12", 0], filename_prefix: "oneai_result" } };

  return w;
}

// === 워크플로우 실행 + 결과 대기 ===
async function executeAndWait(workflow: Record<string, any>): Promise<string> {
  const resp = await fetch(`${COMFY_URL}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
  });

  const data = (await resp.json()) as any;
  if (data.error) {
    throw new Error(`ComfyUI: ${JSON.stringify(data.error)}`);
  }

  const promptId = data.prompt_id;

  // 최대 5분 대기
  for (let i = 0; i < 150; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const h = await fetch(`${COMFY_URL}/history/${promptId}`);
      const hist = (await h.json()) as any;
      if (promptId in hist) {
        const status = hist[promptId]?.status;
        if (status?.status_str === "error") throw new Error("Generation failed");
        const imgs = hist[promptId]?.outputs?.["13"]?.images;
        if (imgs?.[0]) return imgs[0].filename;
      }
    } catch (e: any) {
      if (e.message === "Generation failed") throw e;
    }
  }
  throw new Error("Generation timeout (5min)");
}

// === 결과 이미지 다운로드 ===
async function downloadResult(filename: string): Promise<Buffer> {
  const resp = await fetch(`${COMFY_URL}/view?filename=${encodeURIComponent(filename)}&type=output`);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

// === 메인 생성 함수 ===
export interface ComfyGenerateInput {
  faceImageBuffer: Buffer;
  concept?: string;
  seed?: number;
}

export interface ComfyGenerateResult {
  imageBuffer: Buffer;
  seed: number;
  concept: string;
  elapsed: number;
}

export async function generateWithComfyUI(input: ComfyGenerateInput): Promise<ComfyGenerateResult> {
  const {
    faceImageBuffer,
    concept = "male_suit",
    seed = Math.floor(Math.random() * 999999),
  } = input;

  const startTime = Date.now();
  console.log(`[RunPod ComfyUI] Starting: concept=${concept}, seed=${seed}`);

  // 1. 헬스체크
  const health = await checkRunPodHealth();
  if (!health.ok) throw new Error(health.message);

  // 2. 업로드
  const uploadName = await uploadToComfyUI(faceImageBuffer, `face_${Date.now()}.jpg`);
  console.log(`[RunPod ComfyUI] Uploaded: ${uploadName}`);

  // 3. 생성
  const workflow = buildInstantIDWorkflow(uploadName, concept, seed);
  const resultFile = await executeAndWait(workflow);
  console.log(`[RunPod ComfyUI] Generated: ${resultFile}`);

  // 4. 다운로드
  const imageBuffer = await downloadResult(resultFile);
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`[RunPod ComfyUI] Done in ${elapsed}s, size: ${imageBuffer.length}`);

  return { imageBuffer, seed, concept, elapsed };
}

// === 사용 가능한 컨셉 목록 ===
export function getComfyConcepts() {
  return [
    { id: "male_suit", label: "남성 정장", gender: "male" },
    { id: "male_casual", label: "남성 캐주얼", gender: "male" },
    { id: "female_elegant", label: "여성 엘레강스", gender: "female" },
    { id: "female_casual", label: "여성 캐주얼", gender: "female" },
  ];
}
