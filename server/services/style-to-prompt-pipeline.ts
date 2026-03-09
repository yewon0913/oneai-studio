/**
 * style-to-prompt-pipeline.ts
 *
 * 고객 희망 사진 → Midjourney 최적화 프롬프트 자동 생성
 *
 * 처리 순서:
 *   1. Claude Vision → 스타일 사진 상세 분석
 *      (배경, 조명, 색감, 드레스, 포즈, 구도, 분위기)
 *   2. Wedding Prompt Engine → Midjourney v6.1 최적화 프롬프트 조합
 *   3. 5개 변형 프롬프트 생성 (감정/구도 변주)
 *
 * ⛔ 절대 수정 금지: image-pipeline.ts, couple-pipeline.ts, routers.ts
 *
 * 환경변수:
 *   ANTHROPIC_API_KEY — Claude API 키 (필수)
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StyleAnalysis {
  // 배경/장소
  venue: string;                  // "outdoor garden", "indoor ballroom" 등
  venueDetail: string;            // 구체적 묘사
  // 조명
  lightingType: string;           // "golden hour", "soft studio", "overcast" 등
  lightingDirection: string;      // "backlit", "side lit", "frontal"
  colorTemperature: 'warm' | 'neutral' | 'cool';
  // 색감
  colorPalette: string[];         // ["ivory", "sage green", "dusty rose"] 등
  overallMood: string;            // "romantic", "minimalist", "editorial" 등
  // 의상
  dressStyle: string;             // "A-line", "ball gown", "mermaid", "minimal" 등
  dressColor: string;
  groomStyle: string;             // "classic black tuxedo", "ivory suit" 등
  // 구도/포즈
  composition: string;            // "full body", "close-up", "mid-shot"
  poseStyle: string;              // "natural candid", "formal portrait", "dancing"
  cameraAngle: string;            // "eye level", "low angle", "overhead"
  // 계절/시간
  season: string;
  timeOfDay: string;
  // 스타일 태그
  styleKeywords: string[];        // ["cinematic", "film", "ethereal"] 등
  // MJ 파라미터 추천
  suggestedAspectRatio: string;   // "--ar 2:3", "--ar 16:9" 등
  suggestedVersion: string;       // "--v 6.1"
  suggestedQuality: string;       // "--q 2"
  suggestedStyle: string;         // "--style raw", "--style scenic" 등
}

export interface GeneratedPrompts {
  analysis: StyleAnalysis;
  prompts: MidjourneyPrompt[];
}

export interface MidjourneyPrompt {
  title: string;           // "로맨틱 가든 커플", "클로즈업 신부" 등
  prompt: string;          // 완성된 MJ 프롬프트
  fluxPrompt: string;      // Flux/FAL용 프롬프트 (파라미터 없이)
  negativePrompt: string;
  useCase: string;         // 어떤 용도에 적합한지
  emotionVariant: string;  // 감정 변주
}

// ── Claude Vision 분석 ────────────────────────────────────────────────────────

const STYLE_ANALYSIS_SYSTEM = `You are a world-class wedding photography director and AI prompt engineer.
Analyze the provided wedding/style reference photo with extreme precision.
Extract every detail needed to recreate or inspire a similar shot with AI.

Respond ONLY with a valid JSON object. No preamble, no markdown, no explanation.
Follow this exact schema:
{
  "venue": string,
  "venueDetail": string,
  "lightingType": string,
  "lightingDirection": string,
  "colorTemperature": "warm" | "neutral" | "cool",
  "colorPalette": string[],
  "overallMood": string,
  "dressStyle": string,
  "dressColor": string,
  "groomStyle": string,
  "composition": string,
  "poseStyle": string,
  "cameraAngle": string,
  "season": string,
  "timeOfDay": string,
  "styleKeywords": string[],
  "suggestedAspectRatio": string,
  "suggestedVersion": string,
  "suggestedQuality": string,
  "suggestedStyle": string
}`;

export async function analyzeStylePhoto(
  imageBuffer: Buffer,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
): Promise<StyleAnalysis> {
  const base64 = imageBuffer.toString('base64');

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1500,
    system: STYLE_ANALYSIS_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64 },
          },
          {
            type: 'text',
            text: 'Analyze this wedding/style photo and return ONLY the JSON object with all fields filled in English.',
          },
        ],
      },
    ],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean) as StyleAnalysis;
}

// ── Midjourney 프롬프트 빌더 ──────────────────────────────────────────────────

const EMOTION_VARIANTS = [
  { label: '로맨틱 & 감성적', en: 'deeply romantic, tender gaze, intimate moment, soft smile' },
  { label: '밝고 행복한', en: 'joyful laughter, candid happiness, bright smiles, celebratory' },
  { label: '우아하고 클래식', en: 'elegant and composed, timeless grace, sophisticated poise' },
  { label: '드라마틱 & 시네마틱', en: 'cinematic drama, bold composition, editorial fashion shot' },
  { label: '자연스럽고 편안한', en: 'natural candid moment, relaxed and genuine, unposed intimacy' },
];

const QUALITY_BASE = [
  'professional wedding photography',
  'shot on Canon EOS R5',
  '85mm f/1.4 lens',
  'RAW photo',
  'photorealistic',
  '8k resolution',
  'award-winning photography',
].join(', ');

const COUPLE_SUBJECT_BASE = 'Korean couple bride and groom, Asian features, natural skin tone';

function buildMidjourneyPrompt(
  analysis: StyleAnalysis,
  emotion: { label: string; en: string },
  compositionOverride?: string
): MidjourneyPrompt {
  const composition = compositionOverride ?? analysis.composition;

  // 핵심 씬 구성
  const sceneCore = [
    COUPLE_SUBJECT_BASE,
    `${analysis.dressStyle} wedding dress in ${analysis.dressColor}`,
    analysis.groomStyle,
    emotion.en,
  ].join(', ');

  // 배경/장소
  const venueBlock = [
    analysis.venueDetail,
    analysis.season,
    analysis.timeOfDay,
  ].join(', ');

  // 조명/색감
  const lightingBlock = [
    analysis.lightingType,
    analysis.lightingDirection,
    `${analysis.colorTemperature} color temperature`,
    analysis.colorPalette.slice(0, 3).join(' and ') + ' color palette',
  ].join(', ');

  // 구도
  const compositionBlock = [
    composition,
    analysis.poseStyle,
    analysis.cameraAngle,
  ].join(', ');

  // 스타일 키워드
  const styleBlock = analysis.styleKeywords.slice(0, 5).join(', ');

  // 전체 조합
  const promptCore = [
    sceneCore,
    venueBlock,
    lightingBlock,
    compositionBlock,
    styleBlock,
    QUALITY_BASE,
  ].join(', ');

  // MJ 파라미터
  const mjParams = [
    analysis.suggestedAspectRatio ?? '--ar 2:3',
    analysis.suggestedVersion ?? '--v 6.1',
    analysis.suggestedQuality ?? '--q 2',
    analysis.suggestedStyle ?? '--style raw',
  ].join(' ');

  const midjourneyPrompt = `${promptCore} ${mjParams}`;

  // Flux용 (파라미터 없이)
  const fluxPrompt = [
    promptCore,
    'empty background suitable for compositing',
    'no text, no watermark',
  ].join(', ');

  // 네거티브 프롬프트
  const negativePrompt = [
    'ugly, deformed, disfigured',
    'bad anatomy, extra limbs',
    'blurry, low quality, pixelated',
    'western features, non-Asian',
    'text, watermark, logo',
    'overexposed, underexposed',
    'unnatural skin, plastic look',
  ].join(', ');

  return {
    title: `${emotion.label} — ${composition}`,
    prompt: midjourneyPrompt,
    fluxPrompt,
    negativePrompt,
    useCase: getUseCase(composition, emotion.label),
    emotionVariant: emotion.label,
  };
}

function getUseCase(composition: string, emotion: string): string {
  if (composition.includes('close')) return '웨딩 앨범 클로즈업 페이지';
  if (composition.includes('full')) return '전신 메인 웨딩 사진';
  if (emotion.includes('드라마틱')) return 'SNS / 포트폴리오용 포스터 컷';
  if (emotion.includes('자연스')) return '스냅 스타일 캔디드 컷';
  return '웨딩 앨범 메인 컷';
}

// ── 메인 파이프라인 ───────────────────────────────────────────────────────────

export async function runStyleToPromptPipeline(
  styleImageBuffer: Buffer,
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp',
  compositionOverrides?: string[]  // 원하는 구도 직접 지정 (선택)
): Promise<GeneratedPrompts> {

  // 1. Claude Vision 분석
  const analysis = await analyzeStylePhoto(styleImageBuffer, mimeType);

  // 2. 5개 감정 변형 프롬프트 생성
  const compositions = compositionOverrides ?? [
    analysis.composition,           // 원본 구도 유지
    'full body portrait',           // 전신
    'mid-shot waist up',            // 반신
    'close-up portrait',            // 클로즈업
    analysis.composition,           // 원본 구도 + 다른 감정
  ];

  const prompts: MidjourneyPrompt[] = EMOTION_VARIANTS.map((emotion, i) =>
    buildMidjourneyPrompt(analysis, emotion, compositions[i])
  );

  return { analysis, prompts };
}

// ── 단일 프롬프트 빠른 생성 ───────────────────────────────────────────────────

export async function quickStylePrompt(
  styleImageBuffer: Buffer,
  emotionIndex: number = 0
): Promise<MidjourneyPrompt> {
  const { prompts } = await runStyleToPromptPipeline(styleImageBuffer);
  return prompts[emotionIndex] ?? prompts[0];
}
