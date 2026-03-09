/**
 * gemini-faceswap-router.ts
 *
 * Gemini 웨딩 생성 + face-swap 자동 연결 라우터
 *
 * ⛔ 절대 수정 금지: image-pipeline.ts, couple-pipeline.ts, routers.ts
 */

import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { runGeminiWeddingWithFaceSwap } from '../services/gemini-wedding-faceswap-pipeline';

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
// POST /api/gemini-faceswap/run
//
// Gemini 웨딩 생성 + 자동 face-swap
//
// multipart/form-data:
//   bride          : File  (신부 얼굴 원본, 필수)
//   groom          : File  (신랑 얼굴 원본, 필수)
//   background     : File  (배경 사진, 선택)
//   backgroundDesc : string (배경 설명, 선택)
//   style          : string (스타일, 선택)
//   faceStrength   : number (0~1, 기본 0.85)
//   restoreFidelity: number (0~1, 기본 0.75)
//   useCodeFormer  : 'true' | 'false' (기본 true)
//   autoFaceSwap   : 'true' | 'false' (기본 true)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/run',
  upload.fields([
    { name: 'bride', maxCount: 1 },
    { name: 'groom', maxCount: 1 },
    { name: 'background', maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
    const files = req.files as { [key: string]: Express.Multer.File[] };

    if (!files?.bride?.[0] || !files?.groom?.[0]) {
      res.status(400).json({ error: '신부(bride)와 신랑(groom) 이미지가 모두 필요합니다.' });
      return;
    }

    const brideBuffer = files.bride[0].buffer;
    const groomBuffer = files.groom[0].buffer;
    const brideBase64 = `data:${files.bride[0].mimetype};base64,${brideBuffer.toString('base64')}`;
    const groomBase64 = `data:${files.groom[0].mimetype};base64,${groomBuffer.toString('base64')}`;

    // 배경 이미지 base64 (선택)
    let backgroundImageBase64: string | undefined;
    let backgroundMimeType: string | undefined;
    if (files?.background?.[0]) {
      backgroundMimeType = files.background[0].mimetype;
      backgroundImageBase64 = `data:${backgroundMimeType};base64,${files.background[0].buffer.toString('base64')}`;
    }

    const result = await runGeminiWeddingWithFaceSwap({
      brideImageBase64: brideBase64,
      brideMimeType: files.bride[0].mimetype,
      groomImageBase64: groomBase64,
      groomMimeType: files.groom[0].mimetype,
      backgroundImageBase64,
      backgroundMimeType,
      backgroundDescription: req.body.backgroundDesc,
      customPrompt: req.body.customPrompt,
      style: req.body.style,
      autoFaceSwap: req.body.autoFaceSwap !== 'false',
      brideImageBuffer: brideBuffer,
      groomImageBuffer: groomBuffer,
      faceStrength: Number(req.body.faceStrength ?? 0.85),
      restoreFidelity: Number(req.body.restoreFidelity ?? 0.75),
      useCodeFormer: req.body.useCodeFormer !== 'false',
    });

    res.json({
      // 최종 이미지 (face-swap 적용)
      images: result.images,
      // 비교용 Gemini 원본
      originalGeminiImages: result.originalGeminiImages,
      // 처리 로그
      faceSwapSteps: result.faceSwapSteps,
      faceSwapSuccess: result.faceSwapSuccess,
      faceSwapError: result.faceSwapError,
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/gemini-faceswap/existing
//
// 기존에 생성된 Gemini 이미지에 face-swap만 적용
//
// multipart/form-data:
//   bride        : File  (신부 얼굴 원본)
//   groom        : File  (신랑 얼굴 원본)
//   targetImage  : File  (기존 Gemini 생성 이미지)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/existing',
  upload.fields([
    { name: 'bride', maxCount: 1 },
    { name: 'groom', maxCount: 1 },
    { name: 'targetImage', maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
    const files = req.files as { [key: string]: Express.Multer.File[] };

    if (!files?.targetImage?.[0]) {
      res.status(400).json({ error: 'targetImage(기존 생성 이미지)가 필요합니다.' });
      return;
    }
    if (!files?.bride?.[0] && !files?.groom?.[0]) {
      res.status(400).json({ error: '신부 또는 신랑 이미지가 하나 이상 필요합니다.' });
      return;
    }

    // face-swap 파이프라인 직접 호출 (Gemini 스킵)
    const { runFaceSwapPipeline } = await import('../services/face-swap-pipeline');

    const faceSources: Array<{ role: 'bride' | 'groom'; imageBuffer: Buffer }> = [];
    if (files?.groom?.[0]) faceSources.push({ role: 'groom', imageBuffer: files.groom[0].buffer });
    if (files?.bride?.[0]) faceSources.push({ role: 'bride', imageBuffer: files.bride[0].buffer });

    const result = await runFaceSwapPipeline({
      targetImageBuffer: files.targetImage[0].buffer,
      faceSources,
      mode: faceSources.length === 2 ? 'couple' : 'single',
      faceStrength: Number(req.body.faceStrength ?? 0.85),
      restoreStrength: Number(req.body.restoreFidelity ?? 0.75),
      useCodeFormer: req.body.useCodeFormer !== 'false',
    });

    res.json({
      imageBase64: result.resultBuffer.toString('base64'),
      intermediateBase64: result.intermediateBuffer?.toString('base64'),
      processingSteps: result.processingSteps,
    });
  })
);

// 에러 핸들러
router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[gemini-faceswap-router]', err.message);
  res.status(500).json({ error: err.message });
});

export default router;
