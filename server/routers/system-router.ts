/**
 * System Router - 시스템 상태 및 API 키 확인
 */

import { Router } from "express";
import { checkFalKey } from "../services/fal-key-check";

const router = Router();

// GET /api/system/health - 서버 상태 확인
router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    services: {
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      fal: !!process.env.FAL_KEY,
      piapi: !!process.env.PIAPI_API_KEY,
    },
  });
});

// GET /api/system/fal-check - FAL_KEY 유효성 확인
router.get("/fal-check", async (_req, res) => {
  try {
    const result = await checkFalKey();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      isValid: false,
      keyPrefix: "",
      message: `확인 중 오류: ${err.message}`,
    });
  }
});

// GET /api/system/env-check - 환경변수 등록 여부 확인 (값 노출 없이)
router.get("/env-check", (_req, res) => {
  const envKeys = [
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "FAL_KEY",
    "PIAPI_API_KEY",
    "DATABASE_URL",
    "JWT_SECRET",
  ];

  const result: Record<string, { registered: boolean; prefix?: string }> = {};

  for (const key of envKeys) {
    const val = process.env[key];
    result[key] = {
      registered: !!val,
      prefix: val ? val.slice(0, 4) + "****" : undefined,
    };
  }

  res.json(result);
});

export default router;
