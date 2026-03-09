/**
 * couple-composite-router.ts
 *
 * Express 라우터: /api/couple-composite
 *
 * 엔드포인트:
 *   POST /api/couple-composite/run          — 커플 합성 (신부+신랑+배경)
 *   POST /api/couple-composite/solo         — 단독 합성 (신부 또는 신랑)
 *   POST /api/couple-composite/preview      — 배경 제거만 (미리보기용)
 *   GET  /api/couple-composite/layouts      — 레이아웃 옵션 목록
 *
 * ⛔ 절대 수정 금지: image-pipeline.ts, couple-pipeline.ts, routers.ts
 */

import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import {
  runCoupleCompositePipeline,
  runSoloCompositePipeline,
  CoupleCompositeInput,
  PersonInput,
} from '../services/couple-composite-pipeline';

const router = express.Router();

// ── Multer 설정 ───────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) =>
      fn(req, res, next).catch(next);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/couple-composite/run
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

    if (!files?.background?.[0]) {
      res.status(400).json({ error: '배경 이미지(background)는 필수입니다.' });
      return;
    }

    if (!files?.bride?.[0] && !files?.groom?.[0]) {
      res.status(400).json({ error: '신부 또는 신랑 이미지 중 하나 이상 필요합니다.' });
      return;
    }

    const brideInput: PersonInput | undefined = files?.bride?.[0]
      ? {
          role: 'bride',
          imageBuffer: files.bride[0].buffer,
          lightingDirection: 'right',
          colorTemperature: 'warm',
        }
      : undefined;

    const groomInput: PersonInput | undefined = files?.groom?.[0]
      ? {
          role: 'groom',
          imageBuffer: files.groom[0].buffer,
          lightingDirection: 'front',   // → right로 IC-Light 보정
          colorTemperature: req.body.groomColorTemp ?? 'cool',
        }
      : undefined;

    const pipelineInput: CoupleCompositeInput = {
      bride: brideInput,
      groom: groomInput,
      backgroundImageBuffer: files.background[0].buffer,
      coupleLayout: req.body.layout ?? 'side-by-side',
      shadowIntensity: req.body.shadowIntensity ?? 'soft',
      useCodeFormer: req.body.useCodeFormer !== 'false',
      useIcLight: req.body.useIcLight !== 'false',
      outputWidth: Number(req.body.outputWidth ?? 1620),
      outputHeight: Number(req.body.outputHeight ?? 1080),
    };

    const result = await runCoupleCompositePipeline(pipelineInput);

    res.json({
      imageBase64: result.compositeBuffer.toString('base64'),
      brideBase64: result.brideProcessed?.toString('base64'),
      groomBase64: result.groomProcessed?.toString('base64'),
      processingSteps: result.processingSteps,
      falJobs: result.falJobs,
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/couple-composite/solo
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/solo',
  upload.fields([
    { name: 'subject', maxCount: 1 },
    { name: 'background', maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
    const files = req.files as { [key: string]: Express.Multer.File[] };

    if (!files?.subject?.[0] || !files?.background?.[0]) {
      res.status(400).json({ error: 'subject, background 이미지 모두 필요합니다.' });
      return;
    }

    const role = (req.body.role as 'bride' | 'groom') ?? 'bride';

    const person: PersonInput = {
      role,
      imageBuffer: files.subject[0].buffer,
      lightingDirection: role === 'groom' ? 'front' : 'right',
      colorTemperature: req.body.colorTemp ?? (role === 'groom' ? 'cool' : 'warm'),
    };

    const result = await runSoloCompositePipeline(
      person,
      files.background[0].buffer,
      {
        shadowIntensity: req.body.shadowIntensity ?? 'soft',
        useCodeFormer: req.body.useCodeFormer !== 'false',
        useIcLight: req.body.useIcLight !== 'false',
      }
    );

    res.json({
      imageBase64: result.compositeBuffer.toString('base64'),
      processingSteps: result.processingSteps,
      falJobs: result.falJobs,
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/couple-composite/preview
// BiRefNet 배경 제거만 실행 (미리보기용)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/preview',
  upload.single('subject'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: '이미지가 필요합니다.' });
      return;
    }

    if (!process.env.FAL_KEY) {
      res.status(500).json({ error: 'FAL_KEY 환경변수가 설정되지 않았습니다.' });
      return;
    }

    const fal = await import('@fal-ai/serverless-client');
    fal.config({ credentials: process.env.FAL_KEY });

    const base64 = req.file.buffer.toString('base64');
    const dataUri = `data:image/jpeg;base64,${base64}`;

    const result = await fal.run('fal-ai/birefnet', {
      input: { image_url: dataUri, model: 'General Use (Heavy)', output_format: 'png' },
    }) as { image: { url: string } };

    const imgRes = await fetch(result.image.url);
    const imgBuf = Buffer.from(await imgRes.arrayBuffer());

    res.json({
      imageBase64: imgBuf.toString('base64'),
      contentType: 'image/png',
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/couple-composite/layouts
// ─────────────────────────────────────────────────────────────────────────────
router.get('/layouts', (_req, res) => {
  res.json([
    {
      value: 'side-by-side',
      label: '나란히 (기본)',
      description: '신랑 좌측, 신부 우측 나란히 배치',
      outputSize: '1620×1080 (가로)',
      icon: '👫',
    },
    {
      value: 'overlapping',
      label: '자연스럽게 겹치기',
      description: '신랑이 약간 뒤, 신부가 앞으로 자연스럽게 겹침',
      outputSize: '1620×1080 (가로)',
      icon: '💑',
    },
    {
      value: 'solo-bride',
      label: '신부 단독',
      description: '신부만 중앙 배치',
      outputSize: '1080×1620 (세로)',
      icon: '👰',
    },
    {
      value: 'solo-groom',
      label: '신랑 단독',
      description: '신랑만 중앙 배치',
      outputSize: '1080×1620 (세로)',
      icon: '🤵',
    },
  ]);
});

// ── 에러 핸들러 ───────────────────────────────────────────────────────────────
router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[couple-composite-router]', err.message);
  res.status(500).json({ error: err.message ?? '서버 오류가 발생했습니다.' });
});

export default router;
