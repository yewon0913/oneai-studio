/**
 * couple-composite-pipeline.ts
 *
 * FAL AI 기반 커플 합성 파이프라인
 *
 * 처리 순서:
 *   1. BiRefNet  → 신부/신랑 배경 제거 (정밀 마스크)
 *   2. IC-Light  → 조명 방향 매칭 (신랑 front→right 보정)
 *   3. 색온도 보정 → 신랑 cool→warm amber tint (sharp)
 *   4. 포지셔닝  → 신부(우) / 신랑(좌) 또는 단독 배치
 *   5. 그림자    → 공통 그림자 레이어
 *   6. sharp composite → 최종 병합
 *   7. CodeFormer → 얼굴 선명화 (FAL AI)
 *
 * ⛔ 절대 수정 금지: image-pipeline.ts, couple-pipeline.ts, routers.ts
 *
 * 환경변수:
 *   FAL_KEY        — fal.ai API 키 (필수)
 */

import sharp from 'sharp';

// fal 클라이언트 초기화 (동적 import로 처리)
async function getFalClient() {
  const fal = await import('@fal-ai/serverless-client');
  fal.config({ credentials: process.env.FAL_KEY ?? '' });
  return fal;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type PersonRole = 'bride' | 'groom' | 'solo';

export interface PersonInput {
  role: PersonRole;
  imageBuffer: Buffer;
  /** 조명 방향 오버라이드 (분석값 우선, 없으면 자동) */
  lightingDirection?: 'left' | 'right' | 'front' | 'top';
  /** 색온도 오버라이드 */
  colorTemperature?: 'warm' | 'neutral' | 'cool';
}

export interface CoupleCompositeInput {
  bride?: PersonInput;
  groom?: PersonInput;
  backgroundImageBuffer: Buffer;
  outputWidth?: number;
  outputHeight?: number;
  shadowIntensity?: 'none' | 'soft' | 'medium' | 'strong';
  edgeFeather?: number;
  useCodeFormer?: boolean;       // 얼굴 선명화 (FAL CodeFormer)
  useIcLight?: boolean;          // 조명 매칭 (FAL IC-Light)
  coupleLayout?: 'side-by-side' | 'overlapping' | 'solo-bride' | 'solo-groom';
}

export interface CoupleCompositeOutput {
  compositeBuffer: Buffer;
  brideProcessed?: Buffer;
  groomProcessed?: Buffer;
  processingSteps: string[];
  falJobs: string[];             // FAL job IDs for tracking
}

// ── FAL AI Helpers ────────────────────────────────────────────────────────────

/** BiRefNet: 고정밀 배경 제거 */
async function removeBgBiRefNet(
  imageBuffer: Buffer,
  label: string
): Promise<{ resultBuffer: Buffer; maskBuffer: Buffer }> {
  const fal = await getFalClient();
  const base64 = imageBuffer.toString('base64');
  const mimeType = 'image/jpeg';
  const dataUri = `data:${mimeType};base64,${base64}`;

  const result = await fal.run('fal-ai/birefnet', {
    input: {
      image_url: dataUri,
      model: 'General Use (Heavy)',
      output_format: 'png',
    },
  }) as { image: { url: string }; mask: { url: string } };

  // 결과 이미지 다운로드
  const [imgRes, maskRes] = await Promise.all([
    fetch(result.image.url),
    fetch(result.mask.url),
  ]);

  const [imgBuf, maskBuf] = await Promise.all([
    imgRes.arrayBuffer().then(b => Buffer.from(b)),
    maskRes.arrayBuffer().then(b => Buffer.from(b)),
  ]);

  console.log(`[BiRefNet] ${label} 배경 제거 완료`);
  return { resultBuffer: imgBuf, maskBuffer: maskBuf };
}

/** IC-Light: 조명 방향 재조명 */
async function applyIcLight(
  subjectBuffer: Buffer,          // RGBA PNG (배경 제거 후)
  targetLighting: 'left' | 'right' | 'front' | 'top',
  label: string
): Promise<Buffer> {
  const fal = await getFalClient();
  const base64 = subjectBuffer.toString('base64');
  const dataUri = `data:image/png;base64,${base64}`;

  const lightPromptMap: Record<string, string> = {
    right:  'soft natural light from the right side, golden hour warmth, outdoor garden',
    left:   'soft natural light from the left side, warm ambient',
    front:  'soft frontal diffused light, studio quality',
    top:    'overhead soft light, natural daylight',
  };

  const result = await fal.run('fal-ai/ic-light', {
    input: {
      image_url: dataUri,
      prompt: lightPromptMap[targetLighting],
      negative_prompt: 'harsh shadow, overexposed, underexposed, unnatural',
      num_inference_steps: 28,
      guidance_scale: 1.5,
      ic_light_mode: 'FC',       // Foreground Conditioned
    },
  }) as { images: Array<{ url: string }> };

  const res = await fetch(result.images[0].url);
  const buf = Buffer.from(await res.arrayBuffer());

  console.log(`[IC-Light] ${label} 조명 보정 완료 → ${targetLighting}`);
  return buf;
}

/** CodeFormer: 얼굴 선명화 & 복원 */
async function applyCodeFormer(
  imageBuffer: Buffer
): Promise<Buffer> {
  const fal = await getFalClient();
  const base64 = imageBuffer.toString('base64');
  const dataUri = `data:image/jpeg;base64,${base64}`;

  const result = await fal.run('fal-ai/codeformer', {
    input: {
      image_url: dataUri,
      fidelity: 0.8,             // 0=품질 우선, 1=원본 충실
      upscale: 2,
      face_upsample: true,
      background_enhance: false, // 배경은 건드리지 않음
    },
  }) as { image: { url: string } };

  const res = await fetch(result.image.url);
  const buf = Buffer.from(await res.arrayBuffer());

  console.log('[CodeFormer] 얼굴 선명화 완료');
  return buf;
}

// ── 색온도 보정 ───────────────────────────────────────────────────────────────

/**
 * Cool → Warm 색온도 보정 (신랑 전용)
 * amber tint { r:255, g:230, b:200 } + brightness 1.04 + saturation 1.15
 */
async function correctColorTemperature(
  imageBuffer: Buffer,
  from: 'warm' | 'neutral' | 'cool',
  to: 'warm' | 'neutral' | 'cool'
): Promise<Buffer> {
  if (from === to) return imageBuffer;

  let pipeline = sharp(imageBuffer);

  // cool → warm: 가장 강한 보정
  if (from === 'cool' && to === 'warm') {
    pipeline = pipeline
      .tint({ r: 255, g: 230, b: 200 })          // amber tint
      .modulate({ brightness: 1.04, saturation: 1.15 });
  }
  // neutral → warm
  else if (from === 'neutral' && to === 'warm') {
    pipeline = pipeline
      .tint({ r: 255, g: 242, b: 220 })
      .modulate({ brightness: 1.02, saturation: 1.08 });
  }
  // warm → neutral (필요 시)
  else if (from === 'warm' && to === 'neutral') {
    pipeline = pipeline
      .tint({ r: 230, g: 235, b: 240 })
      .modulate({ brightness: 0.99, saturation: 0.95 });
  }

  return pipeline.toBuffer();
}

// ── 엣지 페더링 ───────────────────────────────────────────────────────────────

async function featherEdges(buf: Buffer, px: number = 3): Promise<Buffer> {
  return sharp(buf).blur(px * 0.4).toBuffer();
}

// ── 그림자 레이어 ─────────────────────────────────────────────────────────────

async function generateShadow(
  maskBuf: Buffer,
  w: number,
  h: number,
  intensity: 'none' | 'soft' | 'medium' | 'strong'
): Promise<Buffer | null> {
  if (intensity === 'none') return null;

  const blur = { soft: 18, medium: 12, strong: 7 }[intensity];
  const alpha = { soft: 0.2, medium: 0.4, strong: 0.6 }[intensity];

  const shadow = await sharp(maskBuf)
    .resize(w, h, { fit: 'fill' })
    .blur(blur)
    .ensureAlpha()
    .toBuffer();

  // 검정 컬러 적용
  return sharp(shadow)
    .composite([{
      input: { create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha } } },
      blend: 'dest-in',
    }])
    .toBuffer()
    .catch(() => shadow);
}

// ── 인물 단독 처리 파이프라인 ─────────────────────────────────────────────────

async function processPerson(
  person: PersonInput,
  targetHeight: number,
  targetColorTemp: 'warm',       // 배경이 항상 warm이므로 통일
  useIcLight: boolean,
  steps: string[],
  falJobs: string[]
): Promise<{ processed: Buffer; mask: Buffer; targetWidth: number }> {
  const label = person.role === 'bride' ? '신부' : '신랑';

  // 1. BiRefNet 배경 제거
  steps.push(`[${label}] BiRefNet 배경 제거 중...`);
  const { resultBuffer: bgRemoved, maskBuffer } = await removeBgBiRefNet(
    person.imageBuffer,
    label
  );
  falJobs.push(`birefnet-${person.role}`);

  // 2. IC-Light 조명 보정 (신랑: front→right)
  let lightAdjusted = bgRemoved;
  if (useIcLight) {
    const targetLight = person.role === 'groom' ? 'right' : (person.lightingDirection ?? 'right');
    steps.push(`[${label}] IC-Light 조명 방향 보정 → ${targetLight}`);
    lightAdjusted = await applyIcLight(bgRemoved, targetLight, label);
    falJobs.push(`ic-light-${person.role}`);
  }

  // 3. 색온도 보정 (신랑: cool→warm)
  const fromTemp = person.colorTemperature ?? (person.role === 'groom' ? 'cool' : 'warm');
  steps.push(`[${label}] 색온도 보정: ${fromTemp} → ${targetColorTemp}`);
  const colorCorrected = await correctColorTemperature(lightAdjusted, fromTemp, targetColorTemp);

  // 4. 엣지 페더링
  steps.push(`[${label}] 엣지 페더링 적용`);
  const feathered = await featherEdges(colorCorrected, 3);

  // 5. 타겟 높이에 맞게 리사이즈
  const meta = await sharp(feathered).metadata();
  const aspect = (meta.width ?? 1) / (meta.height ?? 1);
  const targetWidth = Math.round(targetHeight * aspect);

  const resized = await sharp(feathered)
    .resize(targetWidth, targetHeight, { fit: 'fill' })
    .toBuffer();

  const resizedMask = await sharp(maskBuffer)
    .resize(targetWidth, targetHeight, { fit: 'fill' })
    .toBuffer();

  return { processed: resized, mask: resizedMask, targetWidth };
}

// ── 커플 레이아웃 계산 ────────────────────────────────────────────────────────

function calculateLayout(
  layout: CoupleCompositeInput['coupleLayout'],
  canvasW: number,
  canvasH: number,
  brideW?: number,
  groomW?: number,
  personH?: number
): { brideLeft?: number; groomLeft?: number; personTop: number } {
  const personTop = canvasH - (personH ?? canvasH * 0.85);

  if (layout === 'solo-bride' || layout === 'solo-groom') {
    return {
      brideLeft: Math.round((canvasW - (brideW ?? 0)) / 2),
      groomLeft: Math.round((canvasW - (groomW ?? 0)) / 2),
      personTop,
    };
  }

  if (layout === 'overlapping') {
    // 신부 중앙 약간 우측, 신랑 중앙 약간 좌측 (겹침)
    return {
      groomLeft: Math.round(canvasW * 0.15),
      brideLeft: Math.round(canvasW * 0.42),
      personTop,
    };
  }

  // side-by-side (기본): 신랑 좌, 신부 우
  const gap = Math.round(canvasW * 0.04);
  const totalW = (groomW ?? 0) + (brideW ?? 0) + gap;
  const startX = Math.round((canvasW - totalW) / 2);
  return {
    groomLeft: startX,
    brideLeft: startX + (groomW ?? 0) + gap,
    personTop,
  };
}

// ── 메인 파이프라인 ───────────────────────────────────────────────────────────

export async function runCoupleCompositePipeline(
  input: CoupleCompositeInput
): Promise<CoupleCompositeOutput> {
  const {
    bride,
    groom,
    backgroundImageBuffer,
    outputWidth = 1620,
    outputHeight = 1080,
    shadowIntensity = 'soft',
    useCodeFormer = true,
    useIcLight = true,
    coupleLayout = 'side-by-side',
  } = input;

  const steps: string[] = [];
  const falJobs: string[] = [];

  // 배경 이미지 리사이즈
  steps.push('배경 이미지 준비 중...');
  const bgBuffer = await sharp(backgroundImageBuffer)
    .resize(outputWidth, outputHeight, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 95 })
    .toBuffer();

  const personTargetHeight = Math.round(outputHeight * 0.88);

  // ── 신부 / 신랑 개별 처리 ──────────────────────────────────────────────────
  let brideResult: Awaited<ReturnType<typeof processPerson>> | undefined;
  let groomResult: Awaited<ReturnType<typeof processPerson>> | undefined;

  if (bride && coupleLayout !== 'solo-groom') {
    steps.push('── 신부 처리 시작 ──');
    brideResult = await processPerson(bride, personTargetHeight, 'warm', useIcLight, steps, falJobs);
  }

  if (groom && coupleLayout !== 'solo-bride') {
    steps.push('── 신랑 처리 시작 ──');
    groomResult = await processPerson(groom, personTargetHeight, 'warm', useIcLight, steps, falJobs);
  }

  // ── 레이아웃 계산 ──────────────────────────────────────────────────────────
  steps.push('커플 레이아웃 계산 중...');
  const { brideLeft, groomLeft, personTop } = calculateLayout(
    coupleLayout,
    outputWidth,
    outputHeight,
    brideResult?.targetWidth,
    groomResult?.targetWidth,
    personTargetHeight
  );

  // ── 그림자 레이어 생성 ─────────────────────────────────────────────────────
  // z-order: 배경 → 신랑 그림자 → 신부 그림자 → 신랑 → 신부
  steps.push(`그림자 레이어 생성 (${shadowIntensity})...`);
  const compositeLayers: sharp.OverlayOptions[] = [];

  // 신랑 그림자 (먼저 = 더 아래 레이어)
  if (groomResult && groomLeft !== undefined) {
    const groomShadow = await generateShadow(
      groomResult.mask,
      groomResult.targetWidth,
      personTargetHeight,
      shadowIntensity
    );
    if (groomShadow) {
      compositeLayers.push({
        input: groomShadow,
        left: groomLeft + 6,
        top: personTop + 14,
        blend: 'multiply',
      });
    }
  }

  // 신부 그림자 (신랑 그림자 위)
  if (brideResult && brideLeft !== undefined) {
    const brideShadow = await generateShadow(
      brideResult.mask,
      brideResult.targetWidth,
      personTargetHeight,
      shadowIntensity
    );
    if (brideShadow) {
      compositeLayers.push({
        input: brideShadow,
        left: brideLeft + 6,
        top: personTop + 14,
        blend: 'multiply',
      });
    }
  }

  // ── 인물 레이어 합성 (신랑 먼저 → 신부가 최상위) ──────────────────────────
  steps.push('인물 레이어 합성 중...');

  if (groomResult && groomLeft !== undefined) {
    compositeLayers.push({
      input: groomResult.processed,
      left: groomLeft,
      top: personTop,
      blend: 'over',
    });
  }

  // 신부가 최상위 레이어
  if (brideResult && brideLeft !== undefined) {
    compositeLayers.push({
      input: brideResult.processed,
      left: brideLeft,
      top: personTop,
      blend: 'over',
    });
  }

  // ── sharp 최종 합성 ────────────────────────────────────────────────────────
  steps.push('최종 합성 실행...');
  let composited = await sharp(bgBuffer)
    .composite(compositeLayers)
    .jpeg({ quality: 95, progressive: true })
    .toBuffer();

  // ── CodeFormer 얼굴 선명화 ─────────────────────────────────────────────────
  if (useCodeFormer) {
    steps.push('CodeFormer 얼굴 선명화 적용 중...');
    composited = await applyCodeFormer(composited);
    falJobs.push('codeformer-final');
  }

  // ── 최종 색 그레이딩 ───────────────────────────────────────────────────────
  steps.push('최종 색 그레이딩 적용...');
  const finalBuffer = await sharp(composited)
    .modulate({ brightness: 1.02, saturation: 1.06 })
    .sharpen({ sigma: 0.6 })
    .jpeg({ quality: 96, progressive: true })
    .toBuffer();

  steps.push('✅ 커플 합성 완료');

  return {
    compositeBuffer: finalBuffer,
    brideProcessed: brideResult?.processed,
    groomProcessed: groomResult?.processed,
    processingSteps: steps,
    falJobs,
  };
}

// ── 단독 합성 래퍼 ────────────────────────────────────────────────────────────

export async function runSoloCompositePipeline(
  person: PersonInput,
  backgroundImageBuffer: Buffer,
  options?: Partial<CoupleCompositeInput>
): Promise<CoupleCompositeOutput> {
  const layout = person.role === 'bride' ? 'solo-bride' : 'solo-groom';
  return runCoupleCompositePipeline({
    bride: person.role === 'bride' ? person : undefined,
    groom: person.role === 'groom' ? person : undefined,
    backgroundImageBuffer,
    coupleLayout: layout,
    outputWidth: 1080,
    outputHeight: 1620,  // 세로 단독샷
    ...options,
  });
}
