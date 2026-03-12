/**
 * 개인촬영 프롬프트 엔진 v4.0 — 4단계 구조
 *
 * [1단계] 인물 정보 + 얼굴 보존 (CRITICAL FACE PRESERVATION)
 * [2단계] 컨셉 + 조명 + 카메라 + 의상
 * [3단계] ENHANCEMENT — "One Natural Spoon" (공통 + 성별)
 * [4단계] NEGATIVE — Do NOT generate
 *
 * 순서 고정: 1 → 2 → 3 → 4
 */

import { MERCHANDISE_FORMATS, type MerchandiseFormatKey } from "../../drizzle/schema";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type Gender = "male" | "female";
export type AgeGroup = "20s" | "30s" | "40s" | "50s" | "60s";
export type Concept = "wedding" | "profile" | "beauty" | "outdoor" | "couple" | "kids" | "restoration" | "custom" | "video";
export type Environment = "studio" | "outdoor" | "indoor";
export type ReferenceMode = "face_swap" | "background_composite" | "style_transfer" | "direct_apply";

/** 컨셉별 프리셋 키 */
export type ConceptPreset =
  // 남성
  | "male_studio_black" | "male_outdoor_camera" | "male_winter_street" | "male_casual_daily"
  // 여성
  | "female_studio_profile" | "female_casual_outdoor" | "female_glasses" | "female_white_studio" | "female_color_knit";

export interface PromptEngineInput {
  gender: Gender;
  ageGroup?: AgeGroup;
  partnerGender?: Gender;
  partnerAgeGroup?: AgeGroup;

  concept: Concept;
  environment?: Environment;
  isCouple?: boolean;

  basePrompt?: string;
  customNegative?: string;
  merchandiseFormat?: string;
  glassesFixMode?: boolean;

  hasReferenceImage?: boolean;
  referenceMode?: ReferenceMode;
  /** 정면+측면 참조 이미지 장수 (1 or 2) */
  referenceImageCount?: number;

  projectConcept?: string;
  /** 컨셉 프리셋 직접 지정 */
  conceptPreset?: ConceptPreset;
}

export interface PromptEngineOutput {
  prompt: string;
  negativePrompt: string;
  /** Omni Reference 가중치 (0.0~1.0) */
  omniWeight: number;
  /** Omni Reference 구성 힌트 */
  omniHint: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. 조명 시스템
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const LIGHTING: Record<string, Record<string, string>> = {
  studio: {
    wedding:
      "butterfly lighting with large octabox overhead at 45-degree angle, " +
      "fill light from silver reflector below chin, " +
      "warm hair light from behind at 3/4 position, " +
      "white seamless backdrop with soft gradient falloff",
    profile:
      "Rembrandt lighting with key softbox at 45 degrees camera-left, " +
      "subtle fill from white V-flat camera-right at 1:3 ratio, " +
      "rim light from gridded strip box behind subject, " +
      "neutral gray backdrop",
    beauty:
      "ring light centered on axis with diffusion panel, " +
      "two strip softboxes at 90 degrees for cheekbone highlights, " +
      "white bounce below for under-eye fill, " +
      "clean white background with luminous glow",
    couple:
      "dual softbox cross-lighting at 45 degrees each side, " +
      "overhead boom with silk diffusion, " +
      "warm backlight for hair separation, " +
      "ivory seamless background",
    default:
      "three-point lighting setup, key softbox at 45 degrees, " +
      "fill reflector opposite, hair light from above-behind, " +
      "neutral background",
  },
  outdoor: {
    wedding:
      "golden hour natural light, sun low at 15-degree angle behind subjects, " +
      "warm rim light creating hair glow, " +
      "soft directional shadows falling forward-left, " +
      "gentle breeze moving veil and hair naturally",
    profile:
      "open shade with directional natural light from camera-left, " +
      "catchlights in eyes from sky, " +
      "subtle bokeh background from environmental depth",
    beauty:
      "magic hour diffused golden light, " +
      "sun through thin clouds creating wrap-around illumination, " +
      "warm skin glow with no harsh shadows",
    outdoor:
      "golden hour backlight with sun flare, " +
      "warm directional light creating long shadows, " +
      "natural wind movement in hair and clothing, " +
      "atmospheric haze for depth separation",
    couple:
      "golden hour side-light at 30 degrees, " +
      "warm backlight separating subjects from background, " +
      "natural wind creating dynamic movement, " +
      "sunset bokeh in background",
    default:
      "soft overcast natural light, even illumination, " +
      "subtle directional quality from sun position, " +
      "open shade catchlights",
  },
  indoor: {
    wedding:
      "warm window light from large floor-to-ceiling windows camera-left, " +
      "chandelier ambient fill, " +
      "subtle reflection from marble floor",
    profile:
      "large window diffused daylight, " +
      "white wall bounce fill, " +
      "clean natural indoor illumination",
    default:
      "soft window light with ambient fill, " +
      "warm interior color temperature, " +
      "natural indoor illumination",
  },
};

function getLighting(env: Environment, concept: Concept): string {
  const envLighting = LIGHTING[env] || LIGHTING.studio;
  return envLighting[concept] || envLighting.default || LIGHTING.studio.default;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. 카메라 설정
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface CameraSettings {
  lens: string;
  aperture: string;
  angle: string;
  extra: string;
}

const CAMERA: Record<string, CameraSettings> = {
  wedding: {
    lens: "85mm prime lens",
    aperture: "f/1.8",
    angle: "eye-level slightly below chin",
    extra: "shallow depth of field, creamy bokeh background, shot on Canon R5",
  },
  profile: {
    lens: "85mm portrait lens",
    aperture: "f/2.8",
    angle: "eye-level direct",
    extra: "medium depth of field, sharp focus on eyes, shot on Sony A7IV",
  },
  beauty: {
    lens: "100mm macro portrait lens",
    aperture: "f/2.0",
    angle: "eye-level to slight high angle",
    extra: "razor-sharp focus on face, skin texture visible, shot on Hasselblad X2D",
  },
  outdoor: {
    lens: "50mm prime lens",
    aperture: "f/1.8",
    angle: "eye-level",
    extra: "environmental bokeh, natural depth separation, shot on Nikon Z8",
  },
  couple: {
    lens: "35mm prime lens",
    aperture: "f/2.0",
    angle: "eye-level to slight low angle",
    extra: "both subjects in focus, environmental context, shot on Canon R5",
  },
  kids: {
    lens: "50mm prime lens",
    aperture: "f/2.0",
    angle: "child's eye-level (low angle)",
    extra: "fast shutter speed, bright natural tones, candid moment",
  },
  default: {
    lens: "85mm lens",
    aperture: "f/2.8",
    angle: "eye-level",
    extra: "sharp focus, professional quality",
  },
};

function getCamera(concept: Concept): CameraSettings {
  return CAMERA[concept] || CAMERA.default;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. 표정 & 머리 시스템
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const EXPRESSION: Record<string, Record<string, string>> = {
  wedding: {
    female:
      "gentle authentic smile with eyes slightly crinkled (Duchenne smile), " +
      "soft gaze slightly past camera, relaxed jaw, " +
      "hair with natural movement and soft flyaways from breeze, " +
      "preserve exact bangs style and fringe from reference",
    male:
      "warm confident subtle smile, relaxed brow, " +
      "direct gentle gaze with soft eye contact, " +
      "preserve exact original eye corner angle from reference, " +
      "black wavy hair with natural volume and baby hair around forehead preserved",
  },
  profile: {
    female:
      "composed confident expression, slight closed-lip smile, " +
      "direct eye contact with catchlights, " +
      "polished hair perfectly framing face, bangs style preserved from reference, " +
      "natural warm cheek flush visible",
    male:
      "confident professional expression, neutral-to-slight-smile, " +
      "direct steady gaze with original eye corner angle preserved, strong jawline visible, " +
      "clean-cut black hair with natural texture and volume, baby hair visible at temples",
  },
  beauty: {
    female:
      "serene beauty expression, parted lips, " +
      "intense gaze slightly past camera, original eye size preserved exactly, " +
      "editorial hair with controlled movement and shine, bangs preserved, " +
      "natural peach cheek flush, button nose preserved",
    male:
      "composed expression with slight intensity in gaze, " +
      "original eye corner angle and eye shape preserved, " +
      "styled black hair with natural product texture, " +
      "natural Korean nose shape preserved, jawline natural width maintained",
  },
  outdoor: {
    female:
      "natural candid expression, mid-laugh or wind-swept smile, " +
      "eyes with genuine warmth, original eye size exactly, " +
      "hair flowing naturally with wind including loose baby hair and flyaways catching light, " +
      "warm natural cheek color",
    male:
      "relaxed natural expression, easy smile, " +
      "eyes looking into distance or at camera, original eye angle preserved, " +
      "black hair with natural wind movement, volume and wave pattern preserved, " +
      "baby hair around temples visible",
  },
  couple: {
    female:
      "loving genuine smile looking at partner or camera, " +
      "warm radiant expression, natural cheek flush, " +
      "hair with soft natural movement, bangs and flyaways preserved",
    male:
      "warm protective smile, relaxed happy expression, " +
      "looking at partner or camera with genuine affection, " +
      "neat styled black hair with natural volume",
  },
  kids: {
    female: "bright joyful natural smile, sparkling eyes, playful expression, natural hair with flyaways",
    male: "bright joyful natural smile, sparkling eyes, playful expression, natural hair with flyaways",
  },
  default: {
    female: "natural pleasant expression, soft smile, well-styled hair with bangs preserved, warm cheek flush",
    male: "natural pleasant expression, composed look, neat black hair with natural volume",
  },
};

function getExpression(concept: Concept, gender: Gender): string {
  const conceptExpr = EXPRESSION[concept] || EXPRESSION.default;
  return conceptExpr[gender] || conceptExpr.female;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. [1단계] 인물 정보 + 얼굴 보존 (CRITICAL FACE PRESERVATION)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildStage1_PersonAndFace(
  gender: Gender,
  ageGroup: AgeGroup,
  glassesFixMode?: boolean
): string {
  const genderWord = gender === "male" ? "man" : "woman";
  const pronoun = gender === "male" ? "his" : "her";

  let stage = `Korean ${genderWord} in ${pronoun} ${ageGroup}.\n\n`;

  stage += "CRITICAL FACE PRESERVATION:\n";

  if (gender === "male") {
    stage +=
      "- Face shape: preserve exact natural jawline angle and width — do NOT slim, sharpen, or narrow to V-line. " +
      "Same face shape always. Do NOT westernize facial structure.\n" +
      "- Hair: preserve exact black hair color shade, natural wave pattern, volume, " +
      "baby hair (잔머리) around forehead and temples visible, " +
      "same length and parting direction — NEVER change this.\n" +
      "- Eyes: preserve original eye corner angle (눈꼬리 각도) exactly — do NOT round or enlarge beyond reference. " +
      "Keep natural Korean eye shape.\n" +
      "- Nose: keep natural Korean nose — same bridge width and height — NOT westernized, NOT heightened.\n" +
      "- Natural skin texture — NOT plastic. Visible pores, natural masculine texture.\n" +
      "- Maintain natural brow thickness, Adam's apple visibility, natural neck width.\n";
  } else {
    stage +=
      "- Face shape: keep natural round cheek fullness and cheek volume exactly — do NOT slim to V-line, " +
      "do NOT reduce cheek width, preserve soft round face shape.\n" +
      "- Hair: preserve exact hair color and shade, " +
      "bangs (앞머리/뱅) style identical — straight, see-through, or side-swept as-is, " +
      "baby hair (잔머리) and flyaway strands at hairline, " +
      "same length, volume, curl/wave pattern — NEVER change this.\n" +
      "- Eyes: maintain original eye size EXACTLY — do NOT enlarge beyond reference, " +
      "no circle lens effect. Keep natural Korean eye shape.\n" +
      "- Nose: keep button nose (코 높이) exactly — NOT westernized, NOT heightened.\n" +
      "- Natural skin texture — NOT plastic. Subtle healthy glow with natural pores.\n" +
      "- Keep natural lip thickness, preserve natural brow shape.\n";
  }

  stage += "- Same person always. Environment changes, person NEVER changes.";

  if (glassesFixMode) {
    stage += "\n- GLASSES: keep exact same frame style, lens shape, color, transparency, and position on nose bridge.";
  }

  return stage;
}

// Legacy wrapper — used by beauty-analyzer, face-swap, etc. (외부 호출 호환)
function getFaceConsistency(gender: Gender, glassesFixMode?: boolean): string {
  return buildStage1_PersonAndFace(gender, "30s", glassesFixMode);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4b. [3단계] ENHANCEMENT — "One Natural Spoon"
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ENHANCEMENT_COMMON = `BEAUTY ENHANCEMENT — One Natural Spoon:
SKIN: Remove all blemishes and dark circles. Even out skin tone with warm healthy glow. Subtle luminosity — like "best skin day ever". Keep natural pores and texture — NOT plastic.
EYES: Add one natural catchlight in each eye. Slightly brighten the iris. Subtle definition to lashes — natural, NOT dramatic. Eyes must look alive, warm, and sparkling.
HAIR: Smooth, glossy, freshly-styled version of their exact hairstyle. Same cut, same color — just the best version of it.
LIGHTING ENHANCEMENT: Place light at the most flattering angle for their specific face structure. Add subtle highlight on cheekbones. Soft shadow that defines without aging.
RESULT MUST FEEL: "Oh wow — that's exactly me, but on my best day." NOT "That's a prettier stranger."
Enhance by maximum 20~30% — no more. Same person. Better version. That's all.`;

const ENHANCEMENT_FEMALE = `FEMALE ENHANCEMENT — Natural Spoon:
FACE: Same shape always — butterfly light placement creates natural slimming illusion WITHOUT changing structure.
SKIN: Porcelain-free natural glow. Slight rosy bloom on cheeks — preserve this always. Under-eye: brighten only, no structure change.
EYES: Natural catchlight + subtle lash definition. Warm, inviting, alive. Do NOT enlarge — just make them sparkle.
LIPS: Naturally defined, slightly moisturized. Same color family as reference — just richer.
HAIR: Glossy, smooth, voluminous version of her exact cut. Bangs must fall naturally.
The goal: "I want to look like this every day" — not "I wish I looked like her."`;

const ENHANCEMENT_MALE = `MALE ENHANCEMENT — Natural Spoon:
JAW: Keep natural jawline — subtle shadow definition only. Do NOT slim or sharpen beyond reference.
SKIN: Clean pores, even tone, slight healthy ruddiness. Men look best with subtle texture — NOT porcelain smooth.
EYES: Strong natural eye contact. Slight definition to brow shape — same shape, just cleaner.
HAIR: Same style, maximum volume and shine. Natural movement preserved.
LIGHTING: Side Rembrandt — brings out masculine bone structure without changing it.
The goal: "Damn, I look good" — not "who is this model?"`;

function buildStage3_Enhancement(gender: Gender): string {
  return gender === "male"
    ? `${ENHANCEMENT_COMMON}\n\n${ENHANCEMENT_MALE}`
    : `${ENHANCEMENT_COMMON}\n\n${ENHANCEMENT_FEMALE}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4c. [4단계] NEGATIVE — Do NOT generate (고정)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STAGE4_NEGATIVE_CORE =
  "Do NOT generate: " +
  "V-line or slim the face, " +
  "westernized facial features, " +
  "overly enlarged eyes, " +
  "high nose bridge, " +
  "plastic or porcelain skin, " +
  "change hair color or length, " +
  "different person than reference, " +
  "style bangs back or up";

function getSkinTexture(gender: Gender, ageGroup: AgeGroup): string {
  const antiOverCorrection =
    "NOT plastic skin, NOT porcelain skin, NOT over-smoothed, NOT wax figure, NOT airbrushed. " +
    "Natural skin texture with subtle pores visible. " +
    "Must show real human skin — not digitally perfected.";

  const skinBase: Record<string, Record<string, string>> = {
    "20s": {
      female:
        "youthful Korean skin with natural healthy glow, visible pores on nose and cheeks, " +
        "subtle natural blemishes and tiny moles, dewy translucent complexion, " +
        "natural peach-pink cheek flush (볼 홍조), warm undertone. " +
        antiOverCorrection,
      male:
        "youthful Korean skin with visible pores especially around nose, natural oil on T-zone, " +
        "subtle razor texture on jawline, healthy warm skin tone, " +
        "slightly thicker texture than female with larger visible pores, " +
        "natural minor imperfections. " +
        antiOverCorrection,
    },
    "30s": {
      female:
        "radiant Korean skin with visible pores, " +
        "very fine lines near eyes (early crow's feet), " +
        "natural luminosity with warm golden-beige undertone, " +
        "light laugh lines beginning to form, " +
        "subtle natural cheek warmth. " +
        antiOverCorrection,
      male:
        "mature Korean skin with visible pores and natural texture, " +
        "beginning forehead lines and slight crow's feet, " +
        "possible light stubble shadow on jaw and upper lip, " +
        "warm-beige tone, thicker texture with larger pores. " +
        antiOverCorrection,
    },
    "40s": {
      female:
        "graceful mature Korean skin with defined expression lines, " +
        "visible crow's feet and nasolabial folds, " +
        "maintained warm radiance, possible natural age spots, " +
        "slightly less elasticity around jawline, " +
        "natural skin texture preserved. " +
        antiOverCorrection,
      male:
        "distinguished mature Korean skin with forehead lines and crow's feet, " +
        "defined nasolabial folds, visible pores, " +
        "possible gray at temples, rougher texture, " +
        "natural masculine weathering. " +
        antiOverCorrection,
    },
    "50s": {
      female:
        "elegant mature Korean skin with graceful aging lines, " +
        "defined wrinkles around eyes and mouth, " +
        "natural skin laxity, possible age spots, " +
        "warm tone with natural radiance, visible neck lines. " +
        antiOverCorrection,
      male:
        "distinguished mature Korean skin with deep expression lines, " +
        "prominent forehead creases and crow's feet, " +
        "natural gray mixing, weathered look, thicker rougher texture. " +
        antiOverCorrection,
    },
    "60s": {
      female:
        "graceful senior Korean skin with natural deep wrinkles, " +
        "defined character lines, natural age spots, " +
        "warm soft tone, dignified aging, silver/gray hair. " +
        antiOverCorrection,
      male:
        "distinguished senior Korean skin with deep character lines, " +
        "natural wrinkles, possible full gray/white hair, " +
        "authentic dignified aging, pronounced texture. " +
        antiOverCorrection,
    },
  };

  const ageMap = skinBase[ageGroup] || skinBase["30s"];
  return ageMap[gender] || ageMap.female;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. 의상 디테일
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getAttire(concept: Concept, gender: Gender, env: Environment): string {
  const attire: Record<string, Record<string, string>> = {
    wedding: {
      female:
        "exquisite wedding dress with fine French lace overlay, visible thread texture, " +
        "delicate beading catching light, natural fabric drape with realistic wrinkles, " +
        "sheer tulle veil with soft edges, fitted bodice with natural body contour",
      male:
        "tailored black tuxedo with crisp wool texture, " +
        "white dress shirt with visible cotton weave, " +
        "silk bow tie with subtle sheen, " +
        "precise suit fit with natural shoulder drape, " +
        "boutonnière on lapel",
    },
    profile: {
      female:
        "professional attire with visible fabric texture, " +
        "natural clothing drape and fit, " +
        "realistic wrinkles at joints, " +
        "color-accurate garment",
      male:
        "professional suit with visible wool weave, " +
        "crisp collared shirt, " +
        "natural suit drape on shoulders, " +
        "tie with silk sheen detail",
    },
    beauty: {
      female:
        "minimal elegant top or bare shoulders, " +
        "fabric texture visible, focus on skin and face",
      male:
        "clean minimal clothing, visible fabric texture, " +
        "understated styling to emphasize face",
    },
    outdoor: {
      female:
        env === "outdoor"
          ? "flowing dress or casual-chic outfit catching breeze, " +
            "visible linen or cotton texture, natural fabric movement"
          : "comfortable elegant outfit with visible fabric texture",
      male:
        env === "outdoor"
          ? "casual-chic outfit with visible fabric texture, " +
            "natural fit, rolled sleeves or relaxed collar"
          : "smart casual with visible fabric weave, natural fit",
    },
    default: {
      female: "appropriate attire with visible fabric texture and natural drape",
      male: "appropriate attire with visible fabric texture and natural fit",
    },
  };

  const conceptAttire = attire[concept] || attire.default;
  return conceptAttire[gender] || conceptAttire.female;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. 컨셉별 프리셋 모듈
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ConceptPresetData {
  scene: string;
  lighting: string;
  camera: string;
  attireOverride: string;
  mood: string;
}

const CONCEPT_PRESETS: Record<ConceptPreset, ConceptPresetData> = {
  // ── 남성 4종 ──
  male_studio_black: {
    scene: "professional studio with pure black seamless backdrop",
    lighting:
      "dramatic Rembrandt lighting with key softbox at 45 degrees camera-left, " +
      "strong rim light from behind creating shoulder and hair edge separation, " +
      "minimal fill for dramatic shadow contrast on face",
    camera: "85mm f/2.0, eye-level direct, sharp focus on eyes, shot on Sony A7RV",
    attireOverride:
      "black turtleneck or black dress shirt with visible cotton knit texture, " +
      "clothing blending into dark background for face-focused composition",
    mood: "confident sophisticated masculine portrait, editorial quality",
  },
  male_outdoor_camera: {
    scene: "urban street or park with natural greenery bokeh background",
    lighting:
      "golden hour side-light at 30 degrees, warm rim light on hair, " +
      "natural fill from open sky, soft shadows",
    camera: "50mm f/1.8, eye-level, shallow depth of field, shot on Nikon Z8",
    attireOverride:
      "casual jacket or denim with visible fabric texture, " +
      "natural outdoor styling, relaxed collar",
    mood: "relaxed natural masculine portrait with environmental context",
  },
  male_winter_street: {
    scene: "winter urban street, bare trees, cold atmosphere with visible breath possible",
    lighting:
      "overcast winter daylight with soft cool directional light from sky, " +
      "subtle warm reflection from buildings, natural winter color palette",
    camera: "35mm f/2.0, slight low angle, environmental framing, shot on Canon R5",
    attireOverride:
      "wool overcoat or padded jacket with visible texture, " +
      "knit scarf with fiber detail, winter layers with natural bulkiness",
    mood: "cinematic winter street portrait, cool-tone atmospheric",
  },
  male_casual_daily: {
    scene: "bright café interior or minimalist indoor space",
    lighting:
      "large window soft daylight from camera-left, " +
      "warm ambient interior fill, natural catchlights",
    camera: "50mm f/1.8, eye-level, medium close-up, shot on Fujifilm X-T5",
    attireOverride:
      "casual t-shirt or hoodie with visible cotton texture, " +
      "relaxed everyday fit, natural fabric drape",
    mood: "warm approachable daily life portrait, natural candid feel",
  },

  // ── 여성 5종 ──
  female_studio_profile: {
    scene: "professional studio with neutral gray seamless backdrop",
    lighting:
      "butterfly beauty lighting with large octabox above, " +
      "white bounce below chin for under-eye fill, " +
      "subtle rim light for hair separation",
    camera: "85mm f/2.8, eye-level direct, razor-sharp focus on eyes, shot on Sony A7IV",
    attireOverride:
      "professional blouse or elegant minimal top, " +
      "visible fabric texture, clean neckline framing face",
    mood: "confident polished professional portrait, LinkedIn/business quality",
  },
  female_casual_outdoor: {
    scene: "sunlit park path with green bokeh, cherry blossoms or autumn leaves",
    lighting:
      "golden hour backlight with warm rim glow on hair, " +
      "natural fill from open sky, dappled light through leaves",
    camera: "50mm f/1.8, eye-level, shallow depth of field with environmental bokeh, shot on Nikon Z8",
    attireOverride:
      "flowing casual dress or blouse with cardigan, visible cotton/linen texture, " +
      "clothing catching gentle breeze naturally",
    mood: "warm bright natural feminine portrait, candid lifestyle feel",
  },
  female_glasses: {
    scene: "bright indoor café or library with warm ambient tones",
    lighting:
      "large window soft daylight with warm interior fill, " +
      "careful lighting to minimize glasses reflection, " +
      "soft catchlights visible through lenses",
    camera: "85mm f/2.0, eye-level, sharp focus on eyes through glasses, shot on Canon R5",
    attireOverride:
      "casual-smart outfit — knit sweater or collar shirt, " +
      "visible fabric texture, intellectual styling",
    mood:
      "intelligent warm personality portrait with glasses as identity feature, " +
      "glasses frames preserved exactly from reference",
  },
  female_white_studio: {
    scene: "clean white studio backdrop with luminous gradient",
    lighting:
      "high-key beauty lighting with dual softboxes at 45 degrees, " +
      "large white bounce below, " +
      "subtle warm hair light from behind, " +
      "bright clean illumination emphasizing skin",
    camera: "100mm f/2.0, slight high angle for flattering perspective, shot on Hasselblad X2D",
    attireOverride:
      "white or cream minimal top or bare shoulders, " +
      "clean styling to emphasize face and skin quality",
    mood: "bright clean ethereal beauty portrait, K-beauty editorial quality",
  },
  female_color_knit: {
    scene: "warm-toned indoor or studio with soft neutral backdrop",
    lighting:
      "soft window-style key light with warm color temperature, " +
      "gentle fill creating soft shadows, cozy intimate atmosphere",
    camera: "85mm f/1.8, eye-level slightly below chin, soft bokeh, shot on Sony A7IV",
    attireOverride:
      "colorful oversized knit sweater with visible yarn and cable-knit texture, " +
      "soft chunky wool fabric, warm autumnal or pastel color, " +
      "natural fit with fabric weight visible",
    mood: "warm cozy intimate portrait with tactile knit texture contrast, editorial quality",
  },
};

function getConceptPreset(preset: ConceptPreset): ConceptPresetData {
  return CONCEPT_PRESETS[preset];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. 네거티브 프롬프트 시스템
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getNegativePrompt(concept: Concept, gender: Gender, customNegative?: string): string {
  if (customNegative) return customNegative;

  // [4단계] NEGATIVE — Do NOT generate (고정 핵심 먼저)
  const parts: string[] = [STAGE4_NEGATIVE_CORE];

  // 기술적 네거티브
  parts.push(
    "AI-generated look, uncanny valley, synthetic texture, mannequin-like",
    "CGI render, 3D render, digital art, illustration, painting, anime, cartoon",
    "(westernized Korean face:1.8), (V-line jaw:1.5), (sharpened jawline:1.5), (slimmed face:1.5)",
    "(heightened nose bridge:1.5), (narrowed nose:1.5), (westernized nose:1.5)",
    "(enlarged eyes:1.5), (bigger eyes than reference:1.5), (circle lens effect:1.3)",
    "(different hair color:1.8), (changed hair length:1.5), (bangs removed:1.5), (bangs changed:1.5)",
    "(plastic skin:1.5), (porcelain skin:1.5), (over-smoothed skin:1.5), (airbrushed:1.5)",
    "(different person:1.8), (different face shape from reference:1.5)",
    "extra fingers, deformed hands, bad anatomy",
    "low quality, blurry, watermark, text, logo",
  );

  // 성별별
  if (gender === "male") {
    parts.push(
      "(feminized male face:1.5), (softened jawline on male:1.5), (pretty-boy filter:1.3)",
      "(over-smoothed male skin:1.5), (narrowed male jaw:1.5), (male nose bridge heightened:1.5)",
    );
  } else {
    parts.push(
      "(slimmed cheeks:1.5), (removed cheek volume:1.5), (V-line surgery look:1.5)",
      "(nose bridge heightened:1.5), (button nose removed:1.5), (eyes enlarged beyond reference:1.5)",
      "(cheek flush removed:1.3), (bangs removed or changed:1.5)",
    );
  }

  // 컨셉별
  const conceptNeg: Record<string, string[]> = {
    wedding: ["casual clothing, messy appearance", "plastic-looking lace"],
    beauty: ["heavy visible makeup", "completely flawless poreless skin"],
    profile: ["casual pose, unprofessional setting"],
    couple: ["awkward pose between subjects"],
  };
  parts.push(...(conceptNeg[concept] || []));

  return parts.join(", ");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 8. Omni Reference 가중치 최적화
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getOmniSettings(referenceImageCount: number, concept: Concept, gender: Gender): { weight: number; hint: string } {
  // 기본: 정면 1장 → 0.50
  // 정면+측면 2장 → 0.48 (참조 이미지가 많을수록 약간 낮춰서 자연스러운 블렌딩)
  let weight: number;
  let hint: string;

  if (referenceImageCount >= 2) {
    // 정면 + 측면 2장
    weight = 0.48;
    hint = "front + side reference: weight 0.48 for natural multi-angle blending. " +
      "Front image provides facial identity, side image provides jaw/nose profile accuracy.";
  } else {
    // 정면 1장
    weight = 0.50;
    hint = "single front reference: weight 0.50 for balanced identity preservation.";
  }

  // 얼굴 보존이 중요한 컨셉은 가중치 상향
  if (concept === "beauty" || concept === "profile") {
    weight = Math.min(weight + 0.02, 0.52);
    hint += " (+0.02 for face-critical concept)";
  }

  return { weight, hint };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 메인 프롬프트 빌더 — 4단계 구조
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function buildPrompt(input: PromptEngineInput): PromptEngineOutput {
  const {
    gender,
    ageGroup = "30s",
    partnerGender,
    partnerAgeGroup = "30s",
    concept,
    environment = concept === "outdoor" ? "outdoor" : "studio",
    isCouple = false,
    basePrompt,
    customNegative,
    merchandiseFormat,
    glassesFixMode,
    hasReferenceImage,
    referenceMode,
    referenceImageCount = 1,
    projectConcept,
    conceptPreset,
  } = input;

  const genderWord = gender === "male" ? "man" : "woman";
  const partnerWord = partnerGender === "male" ? "man" : "woman";

  // Omni Reference 설정
  const omni = getOmniSettings(referenceImageCount, concept, gender);

  // ── 참조 모드별 분기 (direct_apply, face_swap) ──────────────
  if (hasReferenceImage && (referenceMode === "direct_apply" || referenceMode === "face_swap")) {
    const stage1 = buildStage1_PersonAndFace(gender, ageGroup, glassesFixMode);
    const instruction = referenceMode === "direct_apply"
      ? "Reproduce this exact reference image with the provided face photo. Keep the exact same composition, background, lighting, clothing, pose, and every detail identical. Only replace the face."
      : "Replace the face in the reference image with the face from the provided photo. Keep everything else identical — same pose, lighting, clothing, background.";

    const prompt = [
      stage1,
      instruction,
      buildStage3_Enhancement(gender),
      basePrompt,
    ].filter(Boolean).join("\n\n");

    return {
      prompt: truncate(prompt, 2500),
      negativePrompt: getNegativePrompt(concept, gender, customNegative),
      omniWeight: omni.weight,
      omniHint: omni.hint,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 4단계 구조 조립: [1] → [2] → [3] → [4 = negativePrompt]
  // ═══════════════════════════════════════════════════════════

  // ── [1단계] 인물 정보 + 얼굴 보존 ──────────────────────────
  let stage1: string;
  if (isCouple && partnerGender) {
    stage1 = buildStage1_PersonAndFace(gender, ageGroup, glassesFixMode) +
      "\n\n" + buildStage1_PersonAndFace(partnerGender, partnerAgeGroup);
  } else {
    stage1 = buildStage1_PersonAndFace(gender, ageGroup, glassesFixMode);
  }

  // ── [2단계] 컨셉 + 조명 + 카메라 + 의상 ─────────────────────
  let stage2: string;

  if (conceptPreset) {
    // 프리셋 모드
    const preset = getConceptPreset(conceptPreset);
    stage2 = [
      `Lighting: ${preset.lighting}`,
      `Background: ${preset.scene}`,
      `Outfit: ${preset.attireOverride}`,
      `Camera: ${preset.camera}`,
      `Mood: ${preset.mood}`,
      `Expression: ${getExpression(concept, gender)}`,
    ].join("\n");
  } else {
    // 일반 모드
    const cam = getCamera(concept);
    const stage2Parts: string[] = [];

    stage2Parts.push(`Lighting: ${getLighting(environment, concept)}`);

    if (projectConcept) {
      stage2Parts.push(`Background: ${projectConcept}`);
    }

    stage2Parts.push(`Outfit: ${getAttire(concept, gender, environment)}`);
    if (isCouple && partnerGender) {
      stage2Parts.push(`Partner outfit: ${getAttire(concept, partnerGender, environment)}`);
    }

    stage2Parts.push(`Expression: ${getExpression(concept, gender)}`);
    if (isCouple && partnerGender) {
      stage2Parts.push(`Partner expression: ${getExpression(concept, partnerGender)}`);
    }

    stage2Parts.push(`Shot on ${cam.extra}, ${cam.lens}, ${cam.aperture}`);

    // 참조 이미지 모드
    if (hasReferenceImage) {
      if (referenceMode === "background_composite") {
        stage2Parts.push("Place the subject(s) into the reference background scene, matching its lighting and color palette.");
      } else if (referenceMode === "style_transfer") {
        stage2Parts.push("Apply the visual style, color grading, and mood of the reference image to this portrait.");
      }
    }

    // 상품 포맷
    if (merchandiseFormat) {
      const format = MERCHANDISE_FORMATS[merchandiseFormat as MerchandiseFormatKey];
      if (format) {
        stage2Parts.push(`Composition: ${format.aspectRatio} aspect ratio, centered subject framing`);
      }
    }

    stage2 = stage2Parts.join("\n");
  }

  // ── [3단계] ENHANCEMENT ───────────────────────────────────
  const stage3 = buildStage3_Enhancement(gender);

  // ── 조립: [1] + [2] + [3] ────────────────────────────────
  const promptParts: string[] = [];
  if (basePrompt) promptParts.push(basePrompt);
  promptParts.push(stage1);
  promptParts.push(stage2);
  promptParts.push(stage3);

  const prompt = promptParts.join("\n\n");

  // ── [4단계] NEGATIVE — 별도 negativePrompt 필드 ──────────
  return {
    prompt: truncate(prompt, 2500),
    negativePrompt: getNegativePrompt(concept, gender, customNegative),
    omniWeight: omni.weight,
    omniHint: omni.hint,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 유틸리티
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function truncate(prompt: string, max: number = 1500): string {
  if (prompt.length <= max) return prompt;
  return prompt.substring(0, max - 3) + "...";
}
