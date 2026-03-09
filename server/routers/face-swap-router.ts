/**
 * face-swap-router.ts
 *
 * /api/face-swap  — 얼굴 교체
 * /api/style-prompt — 스타일 사진 → MJ 프롬프트 생성
 *
 * ⛔ 절대 수정 금지: image-pipeline.ts, couple-pipeline.ts, routers.ts
 *
 * routers.ts에 아래 2줄만 추가:
 *   import faceSwapRouter from './routers/face-swap-router';
 *   app.use('/api/face-swap', faceSwapRouter);
 */

import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { runFaceSwapPipeline, swapCouplefaces } from '../services/face-swap-pipeline';
import { runStyleToPromptPipeline } from '../services/style-to-prompt-pipeline';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  },
});

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) =>
      fn(req, res, next).catch(next);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/face-swap/couple
//
// Gemini/Flux 생성 이미지 + 신부/신랑 얼굴 → 완성 커플 사진
//
// multipart/form-data:
//   target     : File  (Gemini/Flux 생성 이미지, 필수)
//   bride      : File  (신부 얼굴 원본, 선택)
//   groom      : File  (신랑 얼굴 원본, 선택)
//   faceStrength    : number (0~1, 기본 0.9)
//   restoreStrength : number (0~1, 기본 0.8)
//   useCodeFormer   : 'true' | 'false'
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/couple',
  upload.fields([
    { name: 'target', maxCount: 1 },
    { name: 'bride', maxCount: 1 },
    { name: 'groom', maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
    const files = req.files as { [key: string]: Express.Multer.File[] };

    if (!files?.target?.[0]) {
      res.status(400).json({ error: '타겟 이미지(target)가 필요합니다.' });
      return;
    }
    if (!files?.bride?.[0] && !files?.groom?.[0]) {
      res.status(400).json({ error: '신부 또는 신랑 얼굴 이미지가 하나 이상 필요합니다.' });
      return;
    }

    const hasBride = !!files?.bride?.[0];
    const hasGroom = !!files?.groom?.[0];
    const mode = hasBride && hasGroom ? 'couple' : 'single';

    let result;

    if (mode === 'couple') {
      result = await swapCouplefaces(
        files.target[0].buffer,
        files.bride[0].buffer,
        files.groom[0].buffer,
        {
          faceStrength: Number(req.body.faceStrength ?? 0.9),
          restoreStrength: Number(req.body.restoreStrength ?? 0.8),
          useCodeFormer: req.body.useCodeFormer !== 'false',
        }
      );
    } else {
      const source = hasBride ? files.bride[0] : files.groom[0];
      const role = hasBride ? 'bride' : 'groom';
      result = await runFaceSwapPipeline({
        targetImageBuffer: files.target[0].buffer,
        faceSources: [{ role, imageBuffer: source.buffer }],
        mode: 'single',
        faceStrength: Number(req.body.faceStrength ?? 0.9),
        restoreStrength: Number(req.body.restoreStrength ?? 0.8),
        useCodeFormer: req.body.useCodeFormer !== 'false',
      });
    }

    res.json({
      imageBase64: result.resultBuffer.toString('base64'),
      intermediateBase64: result.intermediateBuffer?.toString('base64'),
      processingSteps: result.processingSteps,
      falJobs: result.falJobs,
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/face-swap/single
//
// 단독 얼굴 교체
//
// multipart/form-data:
//   target  : File
//   source  : File
//   role    : 'bride' | 'groom' | 'solo'
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/single',
  upload.fields([
    { name: 'target', maxCount: 1 },
    { name: 'source', maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
    const files = req.files as { [key: string]: Express.Multer.File[] };

    if (!files?.target?.[0] || !files?.source?.[0]) {
      res.status(400).json({ error: 'target, source 이미지 모두 필요합니다.' });
      return;
    }

    const result = await runFaceSwapPipeline({
      targetImageBuffer: files.target[0].buffer,
      faceSources: [{ role: req.body.role ?? 'solo', imageBuffer: files.source[0].buffer }],
      mode: 'single',
      faceStrength: Number(req.body.faceStrength ?? 0.9),
      restoreStrength: Number(req.body.restoreStrength ?? 0.8),
      useCodeFormer: req.body.useCodeFormer !== 'false',
    });

    res.json({
      imageBase64: result.resultBuffer.toString('base64'),
      processingSteps: result.processingSteps,
      falJobs: result.falJobs,
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/face-swap/style-prompt
//
// 고객 희망 스타일 사진 → Midjourney 5개 프롬프트 자동 생성
//
// multipart/form-data:
//   style : File  (핀터레스트 등 참고 사진)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/style-prompt',
  upload.single('style'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: '스타일 참고 사진이 필요합니다.' });
      return;
    }

    const mimeType = req.file.mimetype as 'image/jpeg' | 'image/png' | 'image/webp';
    const result = await runStyleToPromptPipeline(req.file.buffer, mimeType);

    res.json(result);
  })
);

// ── 에러 핸들러 ───────────────────────────────────────────────────────────────
router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[face-swap-router]', err.message);
  res.status(500).json({ error: err.message });
});

export default router;
