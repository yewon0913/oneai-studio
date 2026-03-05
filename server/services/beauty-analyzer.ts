// ─────────────────────────────────────────────────────
// 뷰티 브랜딩 분석 시스템 (규칙 기반, API 없음)
// 카테고리: skincare | makeup | luxury | natural
// 4개 선택 항목 × 4개 옵션 = 256가지 프롬프트 동적 생성
// ─────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────

export type BeautyCategory = "skincare" | "makeup" | "luxury" | "natural";
export type SkinTone = "ivory" | "beige" | "warm_beige" | "golden";
export type MakeupStyle = "nomakeup" | "natural" | "glam" | "full";
export type Lighting = "soft" | "dramatic" | "natural" | "studio";

export interface BeautyAnalysisResult {
  prompt: string;
  negativePrompt: string;
  category: BeautyCategory;
  selectedOptions: {
    skinTone: SkinTone;
    makeupStyle: MakeupStyle;
    lighting: Lighting;
    mood: string;
  };
}

// ─────────────────────────────────────────────────────
// 규칙 기반 특임 데이터 (256가지 조합)
// ─────────────────────────────────────────────────────

const BEAUTY_TEMPLATES = {
  skincare: {
    skinTone: {
      ivory: "porcelain ivory skin, translucent",
      beige: "warm beige complexion, natural glow",
      warm_beige: "golden warm beige, sun-kissed",
      golden: "deep golden undertone, luminous",
    },
    makeupStyle: {
      nomakeup: "no makeup, skin-first beauty, bare face",
      natural: "natural makeup, subtle enhancement, barely-there",
      glam: "light glam makeup, dewy finish, glass skin effect",
      full: "full coverage makeup, flawless finish, editorial",
    },
    lighting: {
      soft: "soft beauty dish lighting, diffused, flattering",
      dramatic: "dramatic side lighting, sculpting shadows",
      natural: "natural window light, golden hour, soft glow",
      studio: "professional studio lighting, even, bright",
    },
    mood: {
      fresh: "fresh, dewy, water droplets, Laneige Sulwhasoo style",
      luxury: "luxury beauty brand, Chanel Dior editorial, high-end",
      serene: "serene, calm, meditative, zen beauty",
      confident: "confident, bold, powerful, commanding presence",
    },
  },
  makeup: {
    skinTone: {
      ivory: "fair ivory skin, porcelain complexion",
      beige: "medium beige skin tone, balanced",
      warm_beige: "warm beige with rosy undertone",
      golden: "golden skin tone, warm undertone",
    },
    makeupStyle: {
      nomakeup: "barely-there makeup, tinted moisturizer, fresh",
      natural: "natural makeup, 3CE Romand style, Korean beauty",
      glam: "glowing makeup, dewy skin, glass skin, glow-up",
      full: "full glam makeup, bold lips, defined eyes, editorial",
    },
    lighting: {
      soft: "soft beauty lighting, catch light in eyes, flattering",
      dramatic: "dramatic lighting, high contrast, moody makeup",
      natural: "natural daylight, soft shadows, true color",
      studio: "studio lighting, professional makeup photography",
    },
    mood: {
      playful: "playful, fun, youthful, trendy makeup look",
      elegant: "elegant, refined, sophisticated makeup",
      bold: "bold, statement, artistic makeup expression",
      fresh: "fresh, dewy, youthful glow, vitamin skin",
    },
  },
  luxury: {
    skinTone: {
      ivory: "ivory porcelain skin, pristine complexion",
      beige: "sophisticated beige tone, refined",
      warm_beige: "warm beige, luxurious undertone",
      golden: "deep golden skin, rich tone, luxe",
    },
    makeupStyle: {
      nomakeup: "no makeup luxury aesthetic, skin-focused, minimal",
      natural: "natural luxury makeup, subtle, understated elegance",
      glam: "luxury glam makeup, high-shine, precious metals",
      full: "full luxury makeup, haute couture, haute beauty",
    },
    lighting: {
      soft: "soft luxury lighting, flattering, glamorous",
      dramatic: "dramatic luxury lighting, cinematic, moody",
      natural: "natural luxury light, golden hour, timeless",
      studio: "professional luxury studio lighting, flawless",
    },
    mood: {
      timeless: "timeless luxury, classic beauty, heritage brand",
      modern: "modern luxury, contemporary, cutting-edge",
      sensual: "sensual, mysterious, alluring, seductive",
      regal: "regal, majestic, powerful, commanding luxury",
    },
  },
  natural: {
    skinTone: {
      ivory: "fair natural skin, clean complexion",
      beige: "natural beige skin tone, authentic",
      warm_beige: "warm natural beige, sun-exposed",
      golden: "golden natural skin, outdoor glow",
    },
    makeupStyle: {
      nomakeup: "no makeup, bare face, natural beauty",
      natural: "natural makeup, minimal, fresh face",
      glam: "natural glam, soft enhancement, subtle glow",
      full: "natural-looking full makeup, not overdone",
    },
    lighting: {
      soft: "soft natural light, gentle, forgiving",
      dramatic: "natural dramatic light, strong shadows, moody",
      natural: "natural daylight, outdoor, golden hour",
      studio: "studio lighting mimicking natural light",
    },
    mood: {
      organic: "organic, authentic, real beauty, no filter",
      earthy: "earthy, grounded, natural elements, botanical",
      peaceful: "peaceful, calm, serene, meditative",
      vibrant: "vibrant, energetic, alive, natural vitality",
    },
  },
};

// ─────────────────────────────────────────────────────
// 프롬프트 빌더 (256가지 조합)
// ─────────────────────────────────────────────────────

export function buildBeautyPrompt(
  category: BeautyCategory,
  skinTone: SkinTone,
  makeupStyle: MakeupStyle,
  lighting: Lighting,
  mood: string
): { prompt: string; negativePrompt: string } {
  const templates = BEAUTY_TEMPLATES[category];
  const skinToneText = templates.skinTone[skinTone] || templates.skinTone.beige;
  const makeupText = templates.makeupStyle[makeupStyle] || templates.makeupStyle.natural;
  const lightingText = templates.lighting[lighting] || templates.lighting.soft;
  
  let moodText = "fresh, dewy, water droplets, Laneige Sulwhasoo style";
  if (mood && mood in templates.mood) {
    moodText = (templates.mood as any)[mood];
  }

  // ══════════════════════════════════════════
  // POSITIVE PROMPT
  // ══════════════════════════════════════════

  const basePrompt = [
    "Korean beauty model, 20s, professional headshot",
    `(${skinToneText}:1.2)`,
    "skin pores visible, natural skin texture, subsurface scattering",
    `(${makeupText}:1.1)`,
    `(${lightingText}:1.1)`,
    "catch light in eyes, specular highlight on nose bridge",
    "Hasselblad X2D, 120mm macro f/2.8, natural optical bokeh",
    `(${moodText}:1.0)`,
    "photorealistic, 8K ultra detail, RAW photo, medium format",
    "beauty campaign, film grain ISO 200",
    "upper body portrait, centered composition",
    "professional beauty photography, editorial style",
  ].join(", ");

  // ══════════════════════════════════════════
  // NEGATIVE PROMPT (5단계 방어)
  // ══════════════════════════════════════════

  const negativePrompt = [
    // 1. 피부 방어
    "(plastic skin:1.6), (airbrushed:1.6), (smooth skin:1.5)",
    "(porcelain skin:1.5), (wax skin:1.5), (beauty filter:1.5)",
    "(no pores:1.5), (blurred skin:1.4), (overly smooth:1.4)",

    // 2. 메이크업 방어
    "(overdone makeup:1.5), (cakey makeup:1.4), (clown makeup:1.5)",

    // 3. 조명 방어
    "(flat lighting:1.4), (harsh lighting:1.4), (overexposed:1.3)",

    // 4. 해부학 방어
    "(mutated hands:1.5), (merged fingers:1.5), (extra fingers:1.5)",
    "(bad hands:1.4), (bad teeth:1.4), (deformed face:1.4)",

    // 5. 스타일 방어
    "(cartoon:1.5), (anime:1.5), (illustration:1.5), (painting:1.5)",
    "(CGI:1.4), (3D render:1.4), (fake:1.4), (artificial:1.4)",
  ].join(", ");

  return {
    prompt: basePrompt,
    negativePrompt,
  };
}

// ─────────────────────────────────────────────────────
// 메인 분석 함수
// ─────────────────────────────────────────────────────

export async function analyzeBeautyImage(
  _imageBase64: string,
  category: BeautyCategory,
  skinTone: SkinTone,
  makeupStyle: MakeupStyle,
  lighting: Lighting,
  mood: string
): Promise<BeautyAnalysisResult> {
  try {
    // 규칙 기반 분석 (이미지 처리 없음, API 호출 없음)
    const { prompt, negativePrompt } = buildBeautyPrompt(
      category,
      skinTone,
      makeupStyle,
      lighting,
      mood
    );

    return {
      prompt,
      negativePrompt,
      category,
      selectedOptions: {
        skinTone,
        makeupStyle,
        lighting,
        mood,
      },
    };
  } catch (err: any) {
    console.error("뷰티 분석 실패:", err);
    throw new Error(`뷰티 분석 실패: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────
// 옵션 목록 (UI에서 사용)
// ─────────────────────────────────────────────────────

export const BEAUTY_OPTIONS = {
  skinTone: [
    { value: "ivory", label: "Ivory (밝은 톤)" },
    { value: "beige", label: "Beige (자연 톤)" },
    { value: "warm_beige", label: "Warm Beige (따뜻한 톤)" },
    { value: "golden", label: "Golden (황금 톤)" },
  ] as const,
  makeupStyle: [
    { value: "nomakeup", label: "No Makeup (노메이크업)" },
    { value: "natural", label: "Natural (내추럴)" },
    { value: "glam", label: "Glam (글로우)" },
    { value: "full", label: "Full (풀메이크업)" },
  ] as const,
  lighting: [
    { value: "soft", label: "Soft (부드러운)" },
    { value: "dramatic", label: "Dramatic (극적)" },
    { value: "natural", label: "Natural (자연광)" },
    { value: "studio", label: "Studio (스튜디오)" },
  ] as const,
  mood: {
    skincare: [
      { value: "fresh", label: "Fresh (신선)" },
      { value: "luxury", label: "Luxury (럭셔리)" },
      { value: "serene", label: "Serene (고요)" },
      { value: "confident", label: "Confident (자신감)" },
    ] as const,
    makeup: [
      { value: "playful", label: "Playful (장난스러운)" },
      { value: "elegant", label: "Elegant (우아한)" },
      { value: "bold", label: "Bold (대담한)" },
      { value: "fresh", label: "Fresh (신선한)" },
    ] as const,
    luxury: [
      { value: "timeless", label: "Timeless (클래식)" },
      { value: "modern", label: "Modern (현대적)" },
      { value: "sensual", label: "Sensual (관능적)" },
      { value: "regal", label: "Regal (우아한 왕족)" },
    ] as const,
    natural: [
      { value: "organic", label: "Organic (유기적)" },
      { value: "earthy", label: "Earthy (자연스러운)" },
      { value: "peaceful", label: "Peaceful (평화로운)" },
      { value: "vibrant", label: "Vibrant (생생한)" },
    ] as const,
  },
};
