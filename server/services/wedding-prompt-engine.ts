/**
 * WEDDING PROMPT ENGINE v3.0
 * 수천 개 웨딩 사진 데이터 기반 최강 프롬프트 엔진
 * Gemini 2.0 Flash 최적화
 */

interface AnalysisResult {
  skinTone: string;
  skinTexture: string;
  faceShape: string;
  eyeShape: string;
  eyeColor?: string;
  eyeSize?: string;
  eyebrowShape?: string;
  noseShape?: string;
  mouthShape?: string;
  cheekbones?: string;
  hasGlasses: boolean;
  glassesStyle: string;
  hasBear: boolean;
  bearStyle: string;
  hairStyle: string;
  hairColor: string;
  hairLength?: string;
  hairTexture?: string;
  pose: string;
  gaze: string;
  expression: string;
  makeupLevel: string;
  lightingType: string;
  lightingDirection: string;
  shadowPresence: string;
  background: string;
  outfit: string;
  mood: string;
  generatedPrompt: string;
  generatedNegative: string;
}

// ─── 피부톤별 최적 조명 매핑 ─────────────────────────────

const SKIN_TO_LIGHTING: Record<string, string> = {
  ivory:    "soft diffused light with warm 5600K color temperature, subtle golden fill, catchlight at 11 o'clock position",
  beige:    "beauty dish main light, warm 5200K, soft shadow ratio 2:1, natural skin luminosity",
  warm:     "golden hour warmth at 4800K, side rim light to enhance warmth, honeyed skin glow",
  golden:   "dramatic Rembrandt setup, 4500K, strong side key light, deep shadow on contralateral cheek",
  rosy:     "cool 6000K overhead diffused, desaturated fill, preserves natural rosy undertone",
  neutral:  "classic butterfly lighting, 5500K daylight balanced, even front illumination",
  default:  "professional beauty dish, 5500K, 3:1 ratio, specular highlight on nose bridge",
};

function getLightingForSkin(skinTone: string): string {
  const key = Object.keys(SKIN_TO_LIGHTING).find(k => skinTone.toLowerCase().includes(k));
  return key ? SKIN_TO_LIGHTING[key] : SKIN_TO_LIGHTING.default;
}

// ─── 드레스 스타일 엔진 ──────────────────────────────────

const DRESS_STYLES = [
  {
    name: "A-line",
    desc: "elegant A-line wedding dress, fitted bodice with delicate lace appliqué, sweetheart neckline, cathedral-length skirt flowing gracefully, subtle tulle underlayer, pearl button details along the back, chapel train",
  },
  {
    name: "ballgown",
    desc: "dramatic ballgown wedding dress, corseted bodice with intricate beadwork and Swarovski crystals, off-shoulder design, voluminous organza skirt with multiple tulle layers, cathedral train, royal silhouette",
  },
  {
    name: "minimal",
    desc: "minimalist sleek wedding dress, clean-cut crepe fabric, modern column silhouette, subtle cowl neckline, low open back with delicate thin straps, contemporary Korean bridal aesthetic, floor-length clean lines",
  },
  {
    name: "romantic",
    desc: "romantic floral wedding dress, soft chiffon fabric with 3D floral embroidery, flutter sleeves, V-neckline, empire waist, dreamy ethereal quality, blush undertones in ivory fabric",
  },
];

const TUXEDO_STYLES = [
  {
    name: "classic",
    desc: "classic black tuxedo, peak lapel with satin trim, white dress shirt with pleated bib, black silk bow tie, single-breasted one-button closure, tapered trousers with satin stripe, black patent leather Oxford shoes, white pocket square",
  },
  {
    name: "modern",
    desc: "modern slim-fit black tuxedo, notch lapel, no tie open collar white shirt, contemporary tailoring with structured shoulders, tapered ankle-length trousers, black Chelsea boots, minimalist aesthetic",
  },
  {
    name: "navy",
    desc: "midnight navy blue tuxedo, shawl lapel with satin finish, crisp white shirt, silver tie, double-breasted closure, perfectly tailored slim fit, black leather shoes, white boutonniere",
  },
];

// ─── 배경/장소 엔진 ──────────────────────────────────────

const VENUE_PROMPTS: Record<string, string> = {
  // 야외
  golden_hour_garden:
    "sun-drenched private garden estate, 6:30pm golden hour, long shadows cast across manicured lawn, white rose arches in soft bokeh background, warm 4200K ambient light, lens flare from setting sun at camera left",

  cherry_blossom:
    "Gyeongbokgung Palace grounds at peak cherry blossom season, pale pink petals drifting in gentle breeze, ancient stone pathway, dappled sunlight through canopy, romantic spring haze, petals caught mid-fall",

  european_estate:
    "grand European manor estate, centuries-old stone architecture, formal French garden with manicured hedges, gravel courtyard, overcast diffused light like Tuscany in October, timeless aristocratic atmosphere",

  rooftop_city:
    "luxury rooftop venue at dusk, Seoul city skyline glittering below, magic hour sky transitioning from amber to deep violet, modern glass and steel architecture, sophisticated urban romance",

  forest_cathedral:
    "ancient cedar forest, natural cathedral of towering trees, shafts of golden light breaking through canopy, moss-covered stone path, mystical woodland atmosphere, fairy tale quality",

  // 실내
  grand_ballroom:
    "opulent grand ballroom, 10-meter crystal chandeliers casting warm prismatic light, white marble floors reflecting the light, ivory floral installations floor to ceiling, editorial Vogue-quality interior",

  chapel_interior:
    "historic chapel interior, vaulted stone ceiling, stained glass windows casting jewel-toned light, white lilies along the aisle, candlelit ambiance, sacred intimate atmosphere, architectural grandeur",

  modern_studio:
    "high-end photography studio, 4-meter seamless white backdrop, professional Profoto strobe setup with large octabox at 45 degrees, subtle gradient shadow on floor, clean editorial aesthetic",
};

// ─── 앵글/구도 엔진 ─────────────────────────────────────

const COMPOSITION_STYLES = [
  "eye-level medium shot, subjects occupying golden ratio thirds, slight environmental context on periphery",
  "slight high angle (15 degrees above eye level), full length shot showing complete attire, leading lines from venue architecture",
  "intimate close-up portrait, faces at 3/4 angle to camera, shallow depth of field f/1.8, background completely separated",
  "full length environmental portrait, subjects small within grand venue, scale emphasizing architectural grandeur",
  "over-the-shoulder connection shot, one subject facing camera one facing away, intimate authentic moment",
];

// ─── 감정/순간 포착 엔진 ─────────────────────────────────

const EMOTIONAL_MOMENTS = [
  "genuine laughter mid-conversation, teeth showing naturally, eyes crinkled with authentic joy, completely unposed candid energy",
  "tender forehead touch, eyes closed, intimate whispered moment, profound emotional connection, stillness and intimacy",
  "groom looking at bride with expression of complete adoration, bride slightly shy smile, stolen glance caught on camera",
  "synchronized walking, natural arm-in-arm, confident stride, both smiling forward, movement and vitality",
  "bride and groom facing each other, holding both hands, eyes locked, about to exchange vows, electric anticipation",
  "natural embrace, heads tilted together, relaxed comfortable intimacy of two people deeply in love",
];

// ─── 카메라/기술 설정 ────────────────────────────────────

const CAMERA_SETUPS = [
  "Nikon Z9, NIKKOR 85mm f/1.4 S, ISO 100, 1/200s, f/2.0, RAW capture, professional color calibration",
  "Canon EOS R5, RF 85mm f/1.2L USM, ISO 200, 1/160s, f/1.8, ultra sharp, medium format quality",
  "Sony A7R V, Zeiss 85mm f/1.4, ISO 64, 1/250s, f/2.8, cinema-grade color science, film emulation",
  "Hasselblad X2D 100C, 80mm f/2.8, ISO 100, medium format sensor, extraordinary dynamic range, studio precision",
];

// ─── 실사감 강화 키워드 ──────────────────────────────────

const REALISM_CORE = `skin pores visible under catchlight, natural skin texture with subsurface scattering, fine hair strands individually rendered, fabric texture and weight visible, micro-wrinkles in clothing fabric, natural shadow gradients, ambient occlusion in facial contours, slight chromatic aberration at image edges, subtle lens vignette, film grain structure ISO 200, NOT illustration, NOT digital painting, NOT CGI render, NOT AI generated aesthetic, photographed not generated`;

// ─── 네거티브 프롬프트 마스터 ────────────────────────────

const MASTER_NEGATIVE = `(plastic skin:1.9), (airbrushed skin:1.9), (smooth poreless skin:1.8), (wax mannequin skin:1.8), (beauty filter:1.8), (instagram filter:1.7), (oversaturated:1.6), (illustration:1.9), (digital art:1.9), (anime:1.9), (cartoon:1.8), (CGI:1.8), (3D render:1.8), (painting:1.8), (AI generated look:1.7), (stiff unnatural pose:1.8), (mannequin pose:1.8), (standing at attention:1.8), (symmetrical robot pose:1.7), (expressionless face:1.7), (blank stare:1.7), (dead eyes:1.7), (flat lighting:1.6), (no shadows:1.6), (overexposed blown highlights:1.5), (complete background blur:1.5), (extreme bokeh separation:1.5), (wrong number of fingers:1.9), (deformed hands:1.9), (bad anatomy:1.8), (distorted face:1.8), (asymmetrical eyes:1.7), (watermark:1.9), (text overlay:1.9), (logo:1.9), (low resolution:1.8), (blurry:1.7), (noise artifacts:1.6), (jpeg compression:1.6)`;

// ─── 4단계 웨딩 프롬프트 빌더 ──────────────────────────────────

export function buildWeddingPrompt(
  bride: AnalysisResult,
  groom: AnalysisResult,
  options?: {
    dressStyle?: "A-line" | "ballgown" | "minimal" | "romantic";
    tuxStyle?: "classic" | "modern" | "navy";
    venue?: keyof typeof VENUE_PROMPTS;
    composition?: number;   // 0-4
    emotion?: number;       // 0-5
    cameraIdx?: number;     // 0-3
  }
): { prompt: string; negativePrompt: string } {

  // 옵션 기본값
  const dressIdx   = ["A-line","ballgown","minimal","romantic"].indexOf(options?.dressStyle || "A-line");
  const dress      = DRESS_STYLES[dressIdx >= 0 ? dressIdx : 0];
  const tuxIdx     = ["classic","modern","navy"].indexOf(options?.tuxStyle || "classic");
  const tux        = TUXEDO_STYLES[tuxIdx >= 0 ? tuxIdx : 0];
  const venueKey   = options?.venue || "golden_hour_garden";
  const venue      = VENUE_PROMPTS[venueKey] || VENUE_PROMPTS.golden_hour_garden;
  const comp       = COMPOSITION_STYLES[options?.composition ?? Math.floor(Math.random() * COMPOSITION_STYLES.length)];
  const emotion    = EMOTIONAL_MOMENTS[options?.emotion ?? Math.floor(Math.random() * EMOTIONAL_MOMENTS.length)];
  const camera     = CAMERA_SETUPS[options?.cameraIdx ?? Math.floor(Math.random() * CAMERA_SETUPS.length)];
  const lighting   = getLightingForSkin(bride.skinTone);

  // 신부 특징
  const brideDesc = [
    `${bride.skinTone} skin tone`, `${bride.skinTexture}`, `${bride.faceShape} face shape`,
    `${bride.eyeShape} eyes`, bride.eyeColor ? `${bride.eyeColor} eye color` : "",
    bride.eyeSize ? `${bride.eyeSize} eye size` : "", bride.eyebrowShape ? `${bride.eyebrowShape} eyebrows` : "",
    bride.noseShape ? `${bride.noseShape} nose` : "", bride.mouthShape ? `${bride.mouthShape}` : "",
    bride.hairLength ? `${bride.hairLength} hair` : "", bride.hairTexture ? `${bride.hairTexture}` : "",
    `${bride.hairColor} hair color`,
    bride.hasGlasses ? `wearing ${bride.glassesStyle} glasses (PRESERVE EXACTLY)` : "",
  ].filter(Boolean).join(", ");

  // 신랑 특징
  const groomDesc = [
    `${groom.skinTone} skin tone`, `${groom.skinTexture}`, `${groom.faceShape} face shape`,
    `${groom.eyeShape} eyes`, groom.eyeColor ? `${groom.eyeColor} eye color` : "",
    groom.eyeSize ? `${groom.eyeSize} eye size` : "", groom.eyebrowShape ? `${groom.eyebrowShape} eyebrows` : "",
    groom.noseShape ? `${groom.noseShape} nose` : "", groom.mouthShape ? `${groom.mouthShape}` : "",
    groom.hairLength ? `${groom.hairLength} hair` : "", groom.hairTexture ? `${groom.hairTexture}` : "",
    `${groom.hairColor} hair color`,
    groom.hasGlasses ? `wearing ${groom.glassesStyle} glasses (PRESERVE EXACTLY)` : "",
    groom.hasBear ? `${groom.bearStyle} beard (PRESERVE EXACTLY)` : "clean-shaven",
  ].filter(Boolean).join(", ");

  // ═══ [1단계] 인물 정보 + 얼굴 보존 ═══
  const stage1 = `Korean woman (BRIDE) and Korean man (GROOM).

BRIDE — ${brideDesc}.
GROOM — ${groomDesc}.

CRITICAL FACE PRESERVATION:
- BRIDE face shape: preserve exact face shape, cheek fullness — do NOT slim to V-line. Hair: ${bride.hairColor} ${bride.hairLength || ""} — NEVER change this. Eyes: do NOT enlarge beyond reference. Nose: NOT westernized. Natural skin texture — NOT plastic.
- GROOM face shape: preserve exact jawline width — do NOT slim or sharpen. Hair: ${groom.hairColor} ${groom.hairLength || ""} — NEVER change this. Eyes: preserve eye corner angle exactly. Nose: NOT westernized. Natural skin texture — NOT plastic.
- Same person always. Environment changes, person NEVER changes.`;

  // ═══ [2단계] 컨셉 + 조명 + 카메라 + 의상 ═══
  const stage2 = `Lighting: ${lighting}. Fill light from opposite side at 1/4 intensity. Both subjects equally lit.
Background: ${venue}
Outfit — Bride: ${dress.desc}. Groom: ${tux.desc}.
Moment: ${emotion}
${comp}
Shot on ${camera}`;

  // ═══ [3단계] ENHANCEMENT ═══
  const stage3 = `BEAUTY ENHANCEMENT — One Natural Spoon:
SKIN: Remove all blemishes and dark circles. Even out skin tone with warm healthy glow. Subtle luminosity — like "best skin day ever". Keep natural pores and texture — NOT plastic.
EYES: Add one natural catchlight in each eye. Slightly brighten the iris. Subtle definition to lashes — natural, NOT dramatic. Eyes must look alive, warm, and sparkling.
HAIR: Smooth, glossy, freshly-styled version of their exact hairstyle. Same cut, same color — just the best version of it.
LIGHTING ENHANCEMENT: Place light at the most flattering angle for their specific face structure. Add subtle highlight on cheekbones. Soft shadow that defines without aging.
Enhance by maximum 20~30% — no more. Same person. Better version. That's all.

BRIDE ENHANCEMENT — Natural Spoon:
FACE: Same shape always — butterfly light creates natural slimming illusion WITHOUT changing structure.
SKIN: Porcelain-free natural glow. Slight rosy bloom on cheeks. Under-eye: brighten only.
EYES: Natural catchlight + subtle lash definition. Do NOT enlarge — just sparkle.
LIPS: Naturally defined, slightly moisturized. ${bride.makeupLevel} bridal makeup with dewy finish.
HAIR: Glossy, smooth, voluminous. Bangs must fall naturally.

GROOM ENHANCEMENT — Natural Spoon:
JAW: Keep natural jawline — subtle shadow definition only.
SKIN: Clean pores, even tone, slight healthy ruddiness. Subtle texture — NOT porcelain smooth.
EYES: Strong natural eye contact. Slight brow definition — same shape, just cleaner.
HAIR: Same style, maximum volume and shine. Natural movement preserved.

${REALISM_CORE}.
Korean luxury wedding photography. Vogue Korea editorial quality. Magazine cover worthy.`;

  const prompt = [stage1, stage2, stage3].join("\n\n");

  // ═══ [4단계] NEGATIVE ═══
  const negativePrompt = "Do NOT generate: V-line or slim the face, westernized facial features, overly enlarged eyes, high nose bridge, plastic or porcelain skin, change hair color or length, different person than reference, style bangs back or up. " + MASTER_NEGATIVE;

  return { prompt, negativePrompt };
}

// ─── 2장 변주 (같은 분석, 다른 스타일) ─────────────────

export function buildWeddingPromptPair(
  bride: AnalysisResult,
  groom: AnalysisResult
): { prompt1: string; prompt2: string; negativePrompt: string } {

  // 1장: 감성적 야외
  const p1 = buildWeddingPrompt(bride, groom, {
    dressStyle: "A-line",
    tuxStyle: "classic",
    venue: "golden_hour_garden",
    composition: 0,
    emotion: 0,
    cameraIdx: 1,
  });

  // 2장: 고급 실내
  const p2 = buildWeddingPrompt(bride, groom, {
    dressStyle: "minimal",
    tuxStyle: "modern",
    venue: "grand_ballroom",
    composition: 2,
    emotion: 5,
    cameraIdx: 3,
  });

  return {
    prompt1: p1.prompt,
    prompt2: p2.prompt,
    negativePrompt: MASTER_NEGATIVE,
  };
}

export { VENUE_PROMPTS, MASTER_NEGATIVE, DRESS_STYLES, TUXEDO_STYLES };
