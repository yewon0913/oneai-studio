/**
 * RunPod Serverless 클라이언트
 * 자동 켜짐/꺼짐, 초 단위 과금
 */

const RUNPOD_ENDPOINT = process.env.RUNPOD_SERVERLESS_ENDPOINT || "";
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || "";

interface GenerateRequest {
  gear: 1 | 3 | 4;
  prompt: string;
  reference_image?: string;
  preset?: string;
  pose?: string;
}

interface GenerateResponse {
  status: "success" | "error";
  image_url?: string;
  image_base64?: string;
  similarity_score?: number;
  gear?: number;
  preset?: string;
  message?: string;
}

export function isRunPodAvailable(): boolean {
  return !!(RUNPOD_ENDPOINT && RUNPOD_API_KEY);
}

export async function generateImage(req: GenerateRequest): Promise<GenerateResponse> {
  if (!isRunPodAvailable()) {
    return { status: "error", message: "RunPod 미설정 — RUNPOD_SERVERLESS_ENDPOINT + RUNPOD_API_KEY 필요" };
  }

  try {
    // 작업 제출
    const runRes = await fetch(`${RUNPOD_ENDPOINT}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RUNPOD_API_KEY}` },
      body: JSON.stringify({ input: { action: "generate", ...req } }),
    });
    if (!runRes.ok) return { status: "error", message: `RunPod ${runRes.status}` };
    const { id: jobId } = await runRes.json();

    // 결과 폴링 (최대 120초)
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(`${RUNPOD_ENDPOINT}/status/${jobId}`, {
        headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
      });
      const data = await statusRes.json();
      if (data.status === "COMPLETED") return data.output as GenerateResponse;
      if (data.status === "FAILED") return { status: "error", message: "생성 실패" };
    }
    return { status: "error", message: "타임아웃 (120초)" };
  } catch (e) {
    return { status: "error", message: String(e) };
  }
}

export async function generateDonSignalBatch(referenceImage: string) {
  const presets = ["news_anchor", "signal_alert", "profile_power", "casual_friendly", "godfather"] as const;
  const gearMap: Record<string, 1 | 3 | 4> = { news_anchor: 4, signal_alert: 4, profile_power: 4, casual_friendly: 3, godfather: 1 };

  const results = await Promise.all(
    presets.map((preset) =>
      generateImage({ gear: gearMap[preset], prompt: "", reference_image: referenceImage, preset }),
    ),
  );
  return presets.map((preset, i) => ({ preset, ...results[i] }));
}
