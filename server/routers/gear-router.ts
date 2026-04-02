/**
 * 🎨 기어 시스템 API 라우터
 */
import { Router, Request, Response } from "express";
import { executeGear, executeBatch, getAllGears } from "../services/gear-system";
import { getAllPresets, getPreset, DON_SIGNAL_PRESETS } from "../services/don-signal-presets";

const router = Router();

// POST /api/gear/generate — 단일 이미지 생성
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { referenceImage, gear, prompt, pose, preset } = req.body;

    if (!referenceImage) {
      return res.status(400).json({ error: "referenceImage 필수" });
    }

    // 프리셋 사용 시
    if (preset) {
      const p = getPreset(preset);
      if (!p) return res.status(400).json({ error: `프리셋 '${preset}' 없음` });

      const result = await executeGear({
        referenceImage,
        gear: p.gear,
        prompt: p.prompt,
        pose: p.pose,
      });
      return res.json({ success: true, preset: p.name, ...result });
    }

    // 직접 지정 시
    if (!gear || !prompt) {
      return res.status(400).json({ error: "gear + prompt 필수 (또는 preset)" });
    }

    const result = await executeGear({ referenceImage, gear, prompt, pose });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("[gear/generate] 에러:", error);
    return res.status(500).json({ error: "이미지 생성 실패. 다시 시도해주세요." });
  }
});

// POST /api/gear/batch — 배치 생성 (돈시그널 5종 등)
router.post("/batch", async (req: Request, res: Response) => {
  try {
    const { referenceImage, presetNames } = req.body;

    if (!referenceImage) {
      return res.status(400).json({ error: "referenceImage 필수" });
    }

    const names: string[] = presetNames || DON_SIGNAL_PRESETS.map((p) => p.name);
    const presets = names.map((n) => getPreset(n)).filter(Boolean) as NonNullable<ReturnType<typeof getPreset>>[];

    if (presets.length === 0) {
      return res.status(400).json({ error: "유효한 프리셋 없음" });
    }

    const results = await executeBatch(
      referenceImage,
      presets.map((p) => ({ name: p.name, gear: p.gear, prompt: p.prompt, pose: p.pose })),
    );

    return res.json({ success: true, total: results.length, results });
  } catch (error) {
    console.error("[gear/batch] 에러:", error);
    return res.status(500).json({ error: "배치 생성 실패" });
  }
});

// GET /api/gear/presets — 프리셋 목록
router.get("/presets", (_req: Request, res: Response) => {
  return res.json({ presets: getAllPresets() });
});

// GET /api/gear/config — 기어 설정 목록
router.get("/config", (_req: Request, res: Response) => {
  return res.json({ gears: getAllGears() });
});

// GET /api/gear/status — 서버 상태
router.get("/status", (_req: Request, res: Response) => {
  return res.json({
    status: "ok",
    falKey: !!process.env.FAL_KEY,
    gears: [1, 3, 4],
    presets: DON_SIGNAL_PRESETS.length,
    timestamp: new Date().toISOString(),
  });
});

export default router;
