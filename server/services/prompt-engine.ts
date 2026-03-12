/**
 * 개인촬영 프롬프트 엔진 v2.0
 *
 * 고객 정보(성별, 나이대, 컨셉, 환경)에 따라
 * 조명/카메라/표정/의상/피부/네거티브를 자동 최적화
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

export interface PromptEngineInput {
  // 고객 정보
  gender: Gender;
  ageGroup?: AgeGroup;
  partnerGender?: Gender;
  partnerAgeGroup?: AgeGroup;

  // 프로젝트 정보
  concept: Concept;
  environment?: Environment;
  isCouple?: boolean;

  // 사용자 입력
  basePrompt?: string;
  customNegative?: string;
  merchandiseFormat?: string;
  glassesFixMode?: boolean;

  // 참조 이미지
  hasReferenceImage?: boolean;
  referenceMode?: ReferenceMode;

  // 프로젝트 메모
  projectConcept?: string;
}

export interface PromptEngineOutput {
  prompt: string;
  negativePrompt: string;
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
      "hair with natural movement and soft flyaways from breeze",
    male:
      "warm confident subtle smile, relaxed brow, " +
      "direct gentle gaze with soft eye contact, " +
      "neatly styled hair with natural texture",
  },
  profile: {
    female:
      "composed confident expression, slight closed-lip smile, " +
      "direct eye contact with catchlights, " +
      "polished hair perfectly framing face",
    male:
      "confident professional expression, neutral-to-slight-smile, " +
      "direct steady gaze, strong jawline visible, " +
      "clean-cut hair with natural texture",
  },
  beauty: {
    female:
      "serene beauty expression, parted lips, " +
      "intense gaze slightly past camera, " +
      "editorial hair with controlled movement and shine",
    male:
      "chiseled composed expression, slight intensity in gaze, " +
      "clean groomed look, " +
      "styled hair with natural product texture",
  },
  outdoor: {
    female:
      "natural candid expression, mid-laugh or wind-swept smile, " +
      "eyes with genuine warmth, " +
      "hair flowing naturally with wind, loose strands catching light",
    male:
      "relaxed natural expression, easy smile, " +
      "eyes looking into distance or at camera, " +
      "hair with natural wind movement",
  },
  couple: {
    female:
      "loving genuine smile looking at partner or camera, " +
      "warm radiant expression, relaxed and happy, " +
      "hair with soft natural movement",
    male:
      "warm protective smile, relaxed happy expression, " +
      "looking at partner or camera with genuine affection, " +
      "neat styled hair",
  },
  kids: {
    female: "bright joyful natural smile, sparkling eyes, playful expression, natural hair",
    male: "bright joyful natural smile, sparkling eyes, playful expression, natural hair",
  },
  default: {
    female: "natural pleasant expression, soft smile, well-styled hair",
    male: "natural pleasant expression, composed look, neat hair",
  },
};

function getExpression(concept: Concept, gender: Gender): string {
  const conceptExpr = EXPRESSION[concept] || EXPRESSION.default;
  return conceptExpr[gender] || conceptExpr.female;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. 얼굴 일관성 & 피부 시스템
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getFaceConsistency(gender: Gender, glassesFixMode?: boolean): string {
  // 공통 얼굴 보존 기반
  let base =
    "Preserve EXACT facial identity from reference: same face shape, same jawline contour, " +
    "same eye shape and spacing, same nose bridge width and tip shape, same lip shape and fullness, " +
    "same ear shape and position. Maintain precise facial proportions and bone structure. " +
    "Do NOT idealize or modify any facial feature — reproduce the real face exactly as-is.";

  // 성별별 얼굴 보존 강화
  if (gender === "male") {
    base +=
      " MALE FACE PRESERVATION: keep the exact natural jawline angle and width (do NOT slim or sharpen), " +
      "preserve original eye shape and monolid/double-eyelid as-is (do NOT enlarge eyes), " +
      "keep nose bridge width and nostril shape unchanged (do NOT narrow or heighten nose), " +
      "maintain natural brow thickness and arch, " +
      "preserve Adam's apple visibility and neck thickness.";
  } else {
    base +=
      " FEMALE FACE PRESERVATION: keep natural cheek fullness and round cheek volume exactly (do NOT slim to V-line), " +
      "preserve original jawline width (do NOT sharpen or narrow jaw), " +
      "keep nose height and bridge width unchanged (do NOT add rhinoplasty effect or heighten nose bridge), " +
      "maintain natural lip thickness (do NOT plump), " +
      "preserve original eye size exactly (do NOT enlarge or add circle lens effect), " +
      "keep natural brow shape.";
  }

  // 헤어 보존
  base +=
    " HAIR PRESERVATION: keep exact hair color and shade from reference (do NOT change to different color), " +
    "preserve hair length precisely (long stays long, short stays short, bob stays bob), " +
    "maintain natural baby hair and flyaway strands around hairline and temples, " +
    "keep hair parting direction and bangs style identical to reference, " +
    "preserve hair volume and curl/wave pattern exactly.";

  // 안경 보존
  if (glassesFixMode) {
    base += " GLASSES: keep exact same frame style, lens shape, color, transparency, and position on nose bridge.";
  }

  return base;
}

function getSkinTexture(gender: Gender, ageGroup: AgeGroup): string {
  // 피부 과보정 방지 공통 접미사
  const antiOverCorrection =
    "NOT plastic skin, NOT porcelain skin, NOT wax figure, NOT airbrushed, NOT beauty-filtered. " +
    "Must show real human skin texture with visible pores and natural imperfections.";

  const skinBase: Record<string, Record<string, string>> = {
    "20s": {
      female:
        "youthful skin with natural healthy glow, visible pores on nose and cheeks, " +
        "subtle natural blemishes and tiny moles, dewy translucent complexion, " +
        "light natural blush on cheeks, peach-warm undertone, no visible wrinkles. " +
        "Skin must look like real 20s Korean woman skin — naturally luminous but NOT digitally smoothed. " +
        antiOverCorrection,
      male:
        "youthful clear skin with visible pores, natural oil on T-zone, " +
        "subtle razor texture on jawline, healthy natural warm skin tone, " +
        "no wrinkles, minor natural skin imperfections, " +
        "slightly thicker and rougher texture than female skin. " +
        antiOverCorrection,
    },
    "30s": {
      female:
        "mature radiant skin with visible pores, " +
        "very fine lines near eyes (early crow's feet), " +
        "natural skin texture with subtle luminosity, " +
        "light laugh lines beginning to form, natural skin elasticity, " +
        "warm golden-beige undertone. " +
        antiOverCorrection,
      male:
        "mature skin with visible pores and natural texture, " +
        "beginning forehead lines and slight crow's feet, " +
        "possible light stubble shadow on jaw and upper lip, " +
        "natural masculine warm-beige skin tone with slight weathering, " +
        "thicker skin texture with larger pores than female. " +
        antiOverCorrection,
    },
    "40s": {
      female:
        "graceful mature skin with defined expression lines, " +
        "visible crow's feet and nasolabial folds, " +
        "maintained skin radiance with natural age spots possible, " +
        "natural skin texture without artificial smoothing, " +
        "slightly less elasticity visible around jawline. " +
        antiOverCorrection,
      male:
        "distinguished mature skin with forehead lines and crow's feet, " +
        "defined nasolabial folds, visible pores, " +
        "natural masculine weathering, possible gray at temples, " +
        "deeper set wrinkles than female counterpart, rougher texture. " +
        antiOverCorrection,
    },
    "50s": {
      female:
        "elegant mature skin with graceful aging lines, " +
        "defined wrinkles around eyes and mouth, " +
        "natural skin laxity, possible age spots, " +
        "maintained warm skin tone with natural radiance, " +
        "visible neck lines and subtle jowl softening. " +
        antiOverCorrection,
      male:
        "distinguished mature skin with deep expression lines, " +
        "prominent forehead creases and crow's feet, " +
        "natural gray hair mixing, weathered distinguished look, " +
        "deeper wrinkles and sun spots, thicker rougher skin texture. " +
        antiOverCorrection,
    },
    "60s": {
      female:
        "graceful senior skin with natural deep wrinkles, " +
        "defined character lines, natural age spots and skin texture, " +
        "warm soft skin tone, dignified natural aging, " +
        "silver or gray hair with natural volume. " +
        antiOverCorrection,
      male:
        "distinguished senior skin with deep character lines, " +
        "natural wrinkles and weathering, " +
        "possible full gray or white hair, " +
        "authentic dignified masculine aging, wise expression lines, " +
        "pronounced skin texture and deeper facial creases. " +
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
        "natural clothing drape and fit on body, " +
        "realistic wrinkles at joints and movement points, " +
        "color-accurate garment with consistent dye",
      male:
        "professional suit with visible wool weave texture, " +
        "crisp collared shirt, " +
        "natural suit drape on shoulders, " +
        "realistic fabric folds at elbows, " +
        "tie with silk sheen detail",
    },
    beauty: {
      female:
        "minimal elegant top or bare shoulders, " +
        "fabric texture visible where present, " +
        "focus on skin and face rather than clothing",
      male:
        "clean minimal clothing, " +
        "visible fabric texture, " +
        "understated styling to emphasize face and skin",
    },
    outdoor: {
      female:
        env === "outdoor"
          ? "flowing dress or casual-chic outfit catching breeze, " +
            "visible linen or cotton texture, natural fabric movement, " +
            "clothing interacting naturally with wind"
          : "comfortable elegant outfit with visible fabric texture, " +
            "natural drape and movement",
      male:
        env === "outdoor"
          ? "casual-chic outfit with visible fabric texture, " +
            "natural fit, rolled sleeves or relaxed collar, " +
            "clothing moving naturally with body"
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
// 6. 네거티브 프롬프트 시스템
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getNegativePrompt(concept: Concept, gender: Gender, customNegative?: string): string {
  if (customNegative) return customNegative;

  const base = [
    // AI 티 완전 제거
    "AI-generated look, artificial plastic skin, airbrushed, smoothed-over skin, uncanny valley",
    "CGI render, 3D render, digital art, illustration, painting, anime, cartoon",
    "synthetic texture, waxy skin, porcelain doll, mannequin-like",

    // 과도한 피부 보정
    "over-retouched skin, no pores, no skin texture, blurred skin, beauty filter",
    "unnaturally smooth skin, plastic surgery look, over-whitened skin",
    "excessive glow, HDR skin, unrealistic skin perfection",
    "plastic skin, porcelain skin, wax figure skin, silicone skin",

    // 얼굴형 이상화 방지 (V라인)
    "(V-line jaw:1.5), (sharpened jawline:1.5), (slimmed face:1.5), (narrowed jaw:1.5)",
    "(face slimming:1.5), (chin reshaping:1.3), (pointed chin:1.3)",
    "(idealized face shape:1.3), (beauty-standard jaw:1.3)",
    "(facial bone structure changed:1.5), (different face shape from reference:1.5)",

    // 코 이상화 방지
    "(nose job effect:1.3), (heightened nose bridge:1.3), (narrowed nose:1.3)",
    "(rhinoplasty look:1.3), (different nose from reference:1.3)",

    // 눈 이상화 방지
    "enlarged eyes, anime eyes, disproportionate eye size, unequal eyes",
    "(circle lens effect:1.3), (bigger eyes than reference:1.3)",
    "colored contact lens glow, unrealistic iris detail, lifeless eyes",
    "no catchlights, flat dead eyes",

    // 입술 이상화 방지
    "(plumped lips:1.3), (lip filler look:1.3), (different lip shape:1.3)",

    // 헤어 변형 방지
    "(different hair color:1.5), (changed hair length:1.5), (wrong hair style:1.5)",
    "(missing baby hair:1.3), (no flyaway strands:1.3), (wig-like hair:1.3)",
    "(helmet hair:1.3), (plastic hair:1.3), (hair color shift:1.3)",

    // 손가락/신체 오류
    "extra fingers, missing fingers, fused fingers, deformed hands",
    "six fingers, wrong number of fingers, malformed hands",
    "extra limbs, missing limbs, disproportionate body",
    "anatomical errors, impossible body pose, twisted limbs",

    // 배경 왜곡
    "warped background, bent lines, distorted architecture",
    "floating objects, inconsistent perspective, impossible geometry",
    "blurry background elements, duplicated background features",

    // 일반 품질
    "low quality, low resolution, blurry, noise, grain, artifacts",
    "jpeg artifacts, pixelated, watermark, text, logo, signature",
    "cropped face, cut off body, bad framing",
  ];

  // 성별별 추가 네거티브
  const genderNeg: string[] = [];
  if (gender === "male") {
    genderNeg.push(
      "(feminized male face:1.5), (softened jawline on male:1.3), (pretty-boy filter:1.3)",
      "(reduced Adam's apple:1.3), (thinned male neck:1.3)",
      "(smoothed male skin too much:1.3), (removed facial hair texture:1.3)",
    );
  } else {
    genderNeg.push(
      "(slimmed cheeks:1.5), (removed cheek volume:1.5), (hollow cheeks:1.3)",
      "(sharpened female jaw to V-line:1.5), (double eyelid surgery look:1.3)",
      "(whitened skin beyond reference:1.3), (doll-like face:1.3)",
      "(reduced natural face width:1.3), (elongated chin:1.3)",
    );
  }

  // 컨셉별 추가
  const conceptNeg: Record<string, string[]> = {
    wedding: [
      "casual clothing, messy appearance, dark mood",
      "incorrect dress fabric texture, plastic-looking lace",
    ],
    beauty: [
      "heavy visible makeup, clown makeup, theatrical makeup",
      "completely flawless poreless skin (must show real skin texture)",
    ],
    profile: [
      "casual pose, unprofessional setting",
      "harsh unflattering shadows, double chin from bad angle",
    ],
    couple: [
      "awkward pose between subjects, unnatural interaction",
      "mismatched lighting on each person, different skin tones from lighting",
    ],
  };

  const extras = conceptNeg[concept] || [];

  return [...base, ...genderNeg, ...extras].join(", ");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 메인 프롬프트 빌더
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
    projectConcept,
  } = input;

  const genderWord = gender === "male" ? "man" : "woman";
  const partnerWord = partnerGender === "male" ? "man" : "woman";

  // ── 참조 모드별 분기 ──────────────────────────────

  if (hasReferenceImage && referenceMode === "direct_apply") {
    const faceBlock = getFaceConsistency(gender, glassesFixMode);
    const prompt = [
      faceBlock,
      "Reproduce this exact reference image with the provided face photo.",
      "Keep the exact same composition, background, lighting, clothing, pose, and every detail identical.",
      "Only replace the face with the reference face photo.",
      getSkinTexture(gender, ageGroup),
      "Photorealistic, 8K resolution.",
      basePrompt,
    ].filter(Boolean).join(" ");

    return { prompt: truncate(prompt), negativePrompt: getNegativePrompt(concept, gender, customNegative) };
  }

  if (hasReferenceImage && referenceMode === "face_swap") {
    const faceBlock = getFaceConsistency(gender, glassesFixMode);
    const prompt = [
      faceBlock,
      "Replace the face in the reference image with the face from the provided photo.",
      "Keep everything else identical — same pose, lighting, clothing, background.",
      getSkinTexture(gender, ageGroup),
      "Photorealistic, 8K resolution.",
      basePrompt,
    ].filter(Boolean).join(" ");

    return { prompt: truncate(prompt), negativePrompt: getNegativePrompt(concept, gender, customNegative) };
  }

  // ── 메인 프롬프트 조립 ─────────────────────────────

  const sections: string[] = [];

  // 0. 사용자 기본 프롬프트 (있으면 최우선)
  if (basePrompt) {
    sections.push(basePrompt);
  }

  // 1. 얼굴 일관성
  sections.push(getFaceConsistency(gender, glassesFixMode));

  // 2. 주제 설명
  if (isCouple && partnerGender) {
    sections.push(
      `A ${ageGroup} Korean ${genderWord} and ${partnerAgeGroup} Korean ${partnerWord} couple, ` +
      `professional ${concept} photography.`
    );
  } else {
    sections.push(
      `A ${ageGroup} Korean ${genderWord}, professional ${concept} photography.`
    );
  }

  // 3. 조명
  sections.push(`Lighting: ${getLighting(environment, concept)}.`);

  // 4. 카메라
  const cam = getCamera(concept);
  sections.push(
    `Camera: ${cam.lens}, ${cam.aperture}, ${cam.angle}. ${cam.extra}.`
  );

  // 5. 표정 & 머리
  sections.push(`Expression: ${getExpression(concept, gender)}.`);
  if (isCouple && partnerGender) {
    sections.push(`Partner expression: ${getExpression(concept, partnerGender)}.`);
  }

  // 6. 피부 질감
  sections.push(`Skin: ${getSkinTexture(gender, ageGroup)}.`);
  if (isCouple && partnerGender) {
    sections.push(`Partner skin: ${getSkinTexture(partnerGender, partnerAgeGroup)}.`);
  }

  // 7. 의상
  sections.push(`Attire: ${getAttire(concept, gender, environment)}.`);
  if (isCouple && partnerGender) {
    sections.push(`Partner attire: ${getAttire(concept, partnerGender, environment)}.`);
  }

  // 8. 참조 이미지 모드
  if (hasReferenceImage) {
    if (referenceMode === "background_composite") {
      sections.push("Place the subject(s) into the reference background scene, matching its lighting and color palette.");
    } else if (referenceMode === "style_transfer") {
      sections.push("Apply the visual style, color grading, and mood of the reference image to this portrait.");
    }
  }

  // 9. 컨셉 메모
  if (projectConcept) {
    sections.push(`Concept: ${projectConcept}.`);
  }

  // 10. 상품 포맷
  if (merchandiseFormat) {
    const format = MERCHANDISE_FORMATS[merchandiseFormat as MerchandiseFormatKey];
    if (format) {
      sections.push(`Composition: ${format.aspectRatio} aspect ratio, centered subject framing.`);
    }
  }

  // 11. 마무리 품질
  sections.push("Photorealistic, shot on professional camera, 8K resolution, magazine-quality.");

  const prompt = sections.join(" ");

  return {
    prompt: truncate(prompt),
    negativePrompt: getNegativePrompt(concept, gender, customNegative),
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 유틸리티
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function truncate(prompt: string, max: number = 1500): string {
  if (prompt.length <= max) return prompt;
  return prompt.substring(0, max - 3) + "...";
}
