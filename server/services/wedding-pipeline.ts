/**
 * Wedding Pipeline v2.0 — FLUX.2 LoRA Primary + Gemini/FLUX Pro Fallback
 *
 * 4단계 프롬프트 구조:
 *   [1] 인물 정보 + CRITICAL FACE PRESERVATION
 *   [2] 컨셉 + 조명 + 카메라 + 의상
 *   [3] ENHANCEMENT — "One Natural Spoon"
 *   [4] NEGATIVE
 *
 * 파이프라인:
 *   FLUX.2 LoRA (Primary) → Gemini (Fallback #1) → FLUX Pro v1.1 (Fallback #2)
 *   → CodeFormer (fidelity 0.78) → Film Grain
 *
 * ⛔ beauty-pipeline.ts, couple-pipeline.ts, face-swap-pipeline.ts 미수정
 */

import { callGemini, extractImageBase64, type GeminiPart } from "../_core/imageGeneration";

// ── Types ─────────────────────────────────────────────────

export type WeddingMode = "solo_bride" | "solo_groom" | "couple";

export type WeddingConcept =
  | "white_studio"
  | "outdoor_garden"
  | "european_chapel"
  | "grand_hall";

export interface WeddingGenerateInput {
  mode: WeddingMode;
  /** 신부 참조이미지 (solo_bride, couple 모드) */
  brideImageBase64?: string;
  brideMimeType?: "image/jpeg" | "image/png" | "image/webp";
  /** 신랑 참조이미지 (solo_groom, couple 모드) */
  groomImageBase64?: string;
  groomMimeType?: "image/jpeg" | "image/png" | "image/webp";
  concept?: WeddingConcept;
  customPrompt?: string;
  outputCount?: number;
  /** 신부 안경 정보 */
  brideGlasses?: string;
  brideGlassesPresent?: boolean;
  /** 신랑 안경 정보 */
  groomGlasses?: string;
  groomGlassesPresent?: boolean;
}

export interface WeddingGenerateOutput {
  images: string[];
  prompt: string;
  negativePrompt: string;
  mode: WeddingMode;
  concept: string;
}

// ── FAL REST API (FLUX.2 LoRA fallback, CodeFormer) ──────

async function falRun(
  modelId: string,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error("FAL_KEY not set");

  const res = await fetch(`https://fal.run/${modelId}`, {
    method: "POST",
    headers: {
      "Authorization": `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`${modelId} failed ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// ── 컨셉별 설정 ──────────────────────────────────────────

interface ConceptConfig {
  background: string;
  lighting: string;
  camera: string;
}

const CONCEPTS: Record<WeddingConcept, ConceptConfig> = {
  white_studio: {
    background: "clean white seamless studio backdrop with luminous gradient, minimalist elegant",
    lighting: "soft window backlight creating ethereal glow, butterfly beauty lighting with large octabox, white bounce below chin, subtle hair rim light",
    camera: "Shot on Canon EOS R5, 85mm f/1.8, shallow depth of field, creamy bokeh, 8K",
  },
  outdoor_garden: {
    background: "beautiful outdoor garden at golden hour, cherry blossom trees, warm golden sunlight filtering through leaves, soft bokeh greenery, romantic spring atmosphere",
    lighting: "golden hour natural backlight at 15-degree angle, warm rim light on hair, soft directional shadows, gentle breeze moving veil and hair",
    camera: "Shot on Nikon Z9, 85mm f/1.4, golden hour warmth, environmental bokeh, 8K",
  },
  european_chapel: {
    background: "historic European stone chapel interior, vaulted ceiling, stained glass windows casting jewel-toned light, white lilies along aisle, candlelit ambiance, sacred intimate atmosphere",
    lighting: "warm stained glass window light mixed with candlelight, dramatic directional illumination, soft shadows, warm color temperature 4500K",
    camera: "Shot on Sony A7R V, 85mm f/2.0, cinematic depth, architectural framing, 8K",
  },
  grand_hall: {
    background: "opulent grand hotel ballroom, 10-meter crystal chandeliers, white marble floors reflecting light, ivory floral installations, luxury editorial interior",
    lighting: "crystal chandelier warm prismatic light, high-key elegant illumination, subtle reflections from marble floor, even front fill",
    camera: "Shot on Hasselblad X2D, 80mm f/2.8, medium format quality, extraordinary dynamic range, 8K",
  },
};

// ── [1단계] 인물 정보 + 얼굴 보존 ────────────────────────

function buildGlassesLockBlock(glassesType: string): string {
  return `

ACCESSORIES IDENTITY LOCK:
This person wears ${glassesType} glasses.
Glasses are a CORE part of their identity.
ALWAYS include glasses in EVERY single shot.
REGARDLESS of outfit, background, or concept:
Glasses must be present and clearly visible.
Same frame shape and color as reference photo.
Do NOT remove glasses for any reason.
Do NOT replace with sunglasses unless specified.`;
}

function buildStage1(
  mode: WeddingMode,
  opts?: { brideGlasses?: string; brideGlassesPresent?: boolean; groomGlasses?: string; groomGlassesPresent?: boolean },
): string {
  if (mode === "solo_bride") {
    let result = `Korean woman (BRIDE) — from the reference photo.

CRITICAL FACE PRESERVATION:
- Face shape — preserve exactly, do NOT slim to V-line. Keep natural round cheek fullness.
- Hair — preserve exact color, length, bangs style, baby hair. Smooth glossy version — NEVER change this.
- Eyes — do NOT enlarge beyond reference. Natural Korean eye shape preserved.
- Nose — keep exactly as reference — NOT westernized, NOT heightened.
- Natural skin texture — NOT plastic. Subtle healthy glow with natural pores.
- Same person always. Outfit changes, person NEVER changes.`;
    if (opts?.brideGlassesPresent) {
      result += buildGlassesLockBlock(opts.brideGlasses || "prescription");
    }
    return result;
  }

  if (mode === "solo_groom") {
    let result = `Korean man (GROOM) — from the reference photo.

CRITICAL FACE PRESERVATION:
- Face shape — preserve exact jawline angle and width — do NOT slim, sharpen, or V-line.
- Hair — preserve exact black hair color, wave pattern, volume, baby hair — NEVER change this.
- Eyes — preserve eye corner angle exactly — do NOT round or enlarge beyond reference.
- Nose — keep natural Korean nose — NOT westernized, NOT heightened.
- Natural skin texture — NOT plastic. Visible pores, natural masculine texture.
- Same person always. Outfit changes, person NEVER changes.`;
    if (opts?.groomGlassesPresent) {
      result += buildGlassesLockBlock(opts.groomGlasses || "prescription");
    }
    return result;
  }

  // couple
  let result = `Korean woman (BRIDE) and Korean man (GROOM) — from the reference photos.

CRITICAL FACE PRESERVATION:
- BRIDE: face shape — preserve exactly, do NOT slim. Hair — preserve exact color, length, bangs — NEVER change. Eyes — do NOT enlarge. Nose — NOT westernized. Natural skin — NOT plastic.
- GROOM: face shape — preserve exact jawline width. Hair — preserve exact color, volume, baby hair — NEVER change. Eyes — preserve eye corner angle. Nose — NOT westernized. Natural skin — NOT plastic.
- Same person always. Environment changes, person NEVER changes.`;
  if (opts?.brideGlassesPresent) {
    result += buildGlassesLockBlock(opts.brideGlasses || "prescription");
  }
  if (opts?.groomGlassesPresent) {
    result += buildGlassesLockBlock(opts.groomGlasses || "prescription");
  }
  return result;
}

// ── [2단계] 컨셉 + 조명 + 의상 ──────────────────────────

function buildStage2(mode: WeddingMode, concept: WeddingConcept): string {
  const cfg = CONCEPTS[concept];
  const parts: string[] = [];

  // 솔로 모드별 조명 오버라이드
  if (mode === "solo_bride") {
    const brideLighting = concept === "white_studio"
      ? "soft window backlight creating ethereal glow, butterfly beauty lighting with large octabox, white bounce below chin, subtle hair rim light"
      : cfg.lighting;
    parts.push(`Lighting: ${brideLighting}`);
    parts.push(`Background: ${cfg.background}`);
    parts.push("Bride outfit: white wedding gown, pearl hairpiece, flowing veil, delicate lace details, fitted bodice");
  } else if (mode === "solo_groom") {
    const groomLighting = concept === "white_studio"
      ? "soft diffused studio lighting with subtle backlight, Rembrandt side light bringing out masculine bone structure, clean even fill"
      : cfg.lighting;
    parts.push(`Lighting: ${groomLighting}`);
    parts.push(`Background: ${cfg.background}`);
    parts.push("Groom outfit: classic black tuxedo, bow tie, white pocket square, crisp white dress shirt, tailored fit");
  } else {
    // couple
    parts.push(`Lighting: ${cfg.lighting}`);
    parts.push(`Background: ${cfg.background}`);
    parts.push("Bride outfit: white wedding gown, pearl hairpiece, flowing veil, delicate lace details, fitted bodice");
    parts.push("Groom outfit: classic black tuxedo, bow tie, white pocket square, crisp white dress shirt, tailored fit");
    parts.push("Both subjects equally in frame, natural intimate moment, genuine warmth between them");
  }

  parts.push(cfg.camera);

  return parts.join("\n");
}

// ── [3단계] ENHANCEMENT ──────────────────────────────────

function buildStage3(mode: WeddingMode): string {
  const common = `BEAUTY ENHANCEMENT — One Natural Spoon:
SKIN: Remove all blemishes and dark circles. Even out skin tone with warm healthy glow. Subtle luminosity — like "best skin day ever". Keep natural pores and texture — NOT plastic.
EYES: Add one natural catchlight in each eye. Slightly brighten the iris. Subtle definition to lashes — natural, NOT dramatic. Eyes must look alive, warm, and sparkling.
HAIR: Smooth, glossy, freshly-styled version of their exact hairstyle. Same cut, same color — just the best version of it.
LIGHTING ENHANCEMENT: Place light at the most flattering angle for their specific face structure. Add subtle highlight on cheekbones. Soft shadow that defines without aging.
Enhance by maximum 20~30% — no more. Same person. Better version. That's all.`;

  const female = `BRIDE ENHANCEMENT — BEST VERSION OF HERSELF:
FACE: Same shape always — butterfly light creates natural slimming illusion WITHOUT changing structure.
SKIN — NATURAL KOREAN WOMAN:
Natural even warm skin tone.
Remove blemishes and dark circles only.
Subtle healthy complexion — NO rosy flush, NO pink cheeks.
NO artificial color on cheeks whatsoever.
Natural sebum texture preserved.
Micro pores slightly visible — NOT porcelain smooth.
Real DSLR photo skin reproduction — not 3D rendered skin.
EYES: Natural catchlight + subtle lash definition. Warm, inviting, alive. Do NOT enlarge — just sparkle.
LIPS: Naturally defined, slightly moisturized. Same color family as reference — just richer.
HAIR: Glossy, smooth, voluminous version of her exact cut. Bangs must fall naturally.
The goal: "I want to look like this every day" — not "I wish I looked like her."`;

  const male = `GROOM ENHANCEMENT — BEST VERSION OF HIMSELF:
JAW: Keep natural jawline — subtle shadow definition only. Do NOT slim or sharpen beyond reference.
SKIN — NATURAL KOREAN MAN:
Clean even natural skin tone, remove blemishes only.
Natural male skin texture with subtle pores visible.
NO over-smoothing, NO plastic finish, NO artificial flush.
Natural outdoor ruddiness only if outdoor shot —
NOT artificial pink or red color grading.
Real DSLR photo skin — NOT CGI or rendered.
EYES: Strong natural eye contact. Slight definition to brow shape — same shape, just cleaner.
HAIR: Same style, maximum volume and shine. Natural movement preserved.
LIGHTING: Side Rembrandt — brings out masculine bone structure without changing it.
The goal: "Damn, I look good" — not "who is this model?"`;

  const quality = "Photorealistic. Skin pores visible, subsurface scattering, film grain ISO 200. NOT illustration, NOT digital art, NOT AI generated look. Magazine cover quality.";

  const skinEyes = `PHOTOREALISTIC SKIN — CRITICAL:
Natural skin texture with subtle pores visible.
Micro skin texture preserved — NOT smoothed out.
Natural sebum and light interaction on skin.
Skin must look like DSLR photo, NOT 3D render.
Shot on Sony A7III, 85mm f/1.8, RAW file, natural skin reproduction.
AVOID: plastic skin, porcelain finish, over-smoothed AI texture, perfectly uniform skin tone.

NATURAL EYES — CRITICAL:
Catchlight must be irregular and natural — reflection of actual light source shape.
NOT perfectly round or perfectly placed.
Iris texture: natural with subtle depth.
"Real DSLR captured eyes" not "rendered eyes"`;

  const realismCore = `REALISM CORE — MANDATORY:
skin pores visible under catchlight,
natural skin texture with subsurface scattering,
fine hair strands individually rendered,
fabric texture and weight visible,
micro-wrinkles in clothing fabric,
natural shadow gradients,
ambient occlusion in facial contours,
slight chromatic aberration at image edges,
subtle lens vignette,
film grain structure ISO 200,
NOT illustration, NOT digital painting,
NOT CGI render, NOT AI generated aesthetic,
photographed not generated`;

  if (mode === "solo_bride") return [common, female, quality, skinEyes, realismCore].join("\n\n");
  if (mode === "solo_groom") return [common, male, quality, skinEyes, realismCore].join("\n\n");
  return [common, female, male, quality, skinEyes, realismCore].join("\n\n");
}

// ── [4단계] NEGATIVE ──────────────────────────────────────

const STAGE4_NEGATIVE =
  "Do NOT generate: V-line or slim the face, westernized facial features, overly enlarged eyes, high nose bridge, plastic or porcelain skin, change hair color or length, different person than reference, style bangs back or up. " +
  "(plastic skin:1.9), (airbrushed skin:1.9), " +
  "(smooth poreless skin:1.8), (wax mannequin skin:1.8), " +
  "(beauty filter:1.8), (instagram filter:1.7), " +
  "(oversaturated:1.6), (illustration:1.9), " +
  "(digital art:1.9), (anime:1.9), (cartoon:1.8), " +
  "(CGI:1.8), (3D render:1.8), (painting:1.8), " +
  "(AI generated look:1.7), " +
  "(stiff unnatural pose:1.8), (mannequin pose:1.8), " +
  "(standing at attention:1.8), " +
  "(expressionless face:1.7), (blank stare:1.7), " +
  "(dead eyes:1.7), (flat lighting:1.6), " +
  "(no shadows:1.6), " +
  "(wrong number of fingers:1.9), " +
  "(deformed hands:1.9), (bad anatomy:1.8), " +
  "(distorted face:1.8), (asymmetrical eyes:1.7), " +
  "(different person:2.0), " +
  "(rosy cheeks:1.8), (pink flush:1.8), " +
  "(artificial color on cheeks:1.8), " +
  "(plastic or porcelain skin:1.9), " +
  "(perfectly round catchlight:1.7), " +
  "(watermark:1.9), (text overlay:1.9), " +
  "(low resolution:1.8), (blurry:1.7)";

// ── [Primary] FLUX.2 LoRA 이미지 생성 ────────────────────

async function generateWithFluxPrimary(
  prompt: string,
  negativePrompt: string,
  refImageDataUrl: string,
): Promise<string | null> {
  try {
    console.log("[wedding-v2] FLUX.2 LoRA (Primary) 생성 중...");
    const result = await falRun("fal-ai/flux-2/lora", {
      prompt,
      negative_prompt: negativePrompt,
      image_url: refImageDataUrl,
      strength: 0.75,
      num_inference_steps: 28,
      guidance_scale: 7.5,
      image_size: { width: 1024, height: 1024 },
      enable_safety_checker: false,
      seed: Math.floor(Math.random() * 999999),
    });

    const imageUrl = (result?.images as Array<{ url: string }>)?.[0]?.url;
    if (imageUrl) {
      const res = await fetch(imageUrl);
      const buffer = Buffer.from(await res.arrayBuffer());
      console.log("[wedding-v2] FLUX.2 LoRA 성공");
      return buffer.toString("base64");
    }
    return null;
  } catch (err: any) {
    console.warn(`[wedding-v2] FLUX.2 LoRA 실패: ${err.message?.slice(0, 100)}`);
    return null;
  }
}

// ── [Fallback #1] Gemini ─────────────────────────────────

async function generateWithGeminiFallback(
  prompt: string,
  refImages: { base64: string; mimeType: string }[],
): Promise<string | null> {
  try {
    console.log("[wedding-v2] Gemini (Fallback #1) 시도...");
    const parts: GeminiPart[] = [];

    // 참조 이미지 먼저 (얼굴 인식 최적화)
    for (const img of refImages) {
      const clean = img.base64.includes(",") ? img.base64.split(",")[1] : img.base64;
      parts.push({ inlineData: { mimeType: img.mimeType, data: clean } });
    }

    parts.push({ text: prompt });

    const response = await callGemini(parts);
    const { data } = extractImageBase64(response);
    console.log("[wedding-v2] Gemini 성공");
    return data;
  } catch (err: any) {
    console.warn(`[wedding-v2] Gemini 실패: ${err.message?.slice(0, 100)}`);
    return null;
  }
}

// ── [Fallback #2] FLUX Pro v1.1 ─────────────────────────

async function generateWithFluxProFallback(
  prompt: string,
  negativePrompt: string,
  refImageDataUrl: string,
): Promise<string | null> {
  try {
    console.log("[wedding-v2] FLUX Pro v1.1 (Fallback #2) 시도...");
    const result = await falRun("fal-ai/flux-pro/v1.1", {
      prompt,
      negative_prompt: negativePrompt,
      image_url: refImageDataUrl,
      strength: 0.70,
      num_inference_steps: 28,
      guidance_scale: 7.0,
      image_size: { width: 1024, height: 1024 },
      enable_safety_checker: false,
      seed: Math.floor(Math.random() * 999999),
    });

    const imageUrl = (result?.images as Array<{ url: string }>)?.[0]?.url;
    if (imageUrl) {
      const res = await fetch(imageUrl);
      const buffer = Buffer.from(await res.arrayBuffer());
      console.log("[wedding-v2] FLUX Pro v1.1 성공");
      return buffer.toString("base64");
    }
    return null;
  } catch (err: any) {
    console.warn(`[wedding-v2] FLUX Pro v1.1 실패: ${err.message?.slice(0, 80)}`);
    return null;
  }
}

// ── CodeFormer 선명화 (fidelity 0.78) ────────────────────

async function runCodeFormer(imageBase64: string): Promise<string> {
  try {
    console.log("[wedding] CodeFormer 선명화...");
    const falKey = process.env.FAL_KEY;
    if (!falKey) return imageBase64;

    // base64 → FAL Storage URL
    const clean = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const buffer = Buffer.from(clean, "base64");

    const initiateRes = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate", {
      method: "POST",
      headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content_type: "image/jpeg", file_name: "wedding-cf.jpg" }),
    });
    if (!initiateRes.ok) throw new Error("initiate failed");
    const { upload_url, file_url } = await initiateRes.json();

    const s3Res = await fetch(upload_url, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: buffer,
    });
    if (!s3Res.ok) throw new Error("S3 upload failed");

    const result = await falRun("fal-ai/codeformer", {
      image_url: file_url,
      fidelity: 0.78,
      upscale: 2,
      face_upsample: true,
      background_enhance: false,
    });

    const url = (result?.image as Record<string, unknown>)?.url as string;
    if (url) {
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      console.log("[wedding] CodeFormer 완료");
      return buf.toString("base64");
    }

    return imageBase64;
  } catch (err: any) {
    console.warn(`[wedding] CodeFormer 실패 (원본 유지): ${err.message?.slice(0, 80)}`);
    return imageBase64;
  }
}

// ── Film Grain 후처리 ───────────────────────────────────

async function applyFilmGrain(imageBase64: string): Promise<string> {
  try {
    console.log("[wedding] Film Grain 후처리...");
    const falKey = process.env.FAL_KEY;
    if (!falKey) return imageBase64;

    const clean = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const buffer = Buffer.from(clean, "base64");

    const initiateRes = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate", {
      method: "POST",
      headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content_type: "image/jpeg", file_name: "wedding-grain.jpg" }),
    });
    if (!initiateRes.ok) throw new Error("initiate failed");
    const { upload_url, file_url } = await initiateRes.json();

    const s3Res = await fetch(upload_url, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: buffer,
    });
    if (!s3Res.ok) throw new Error("S3 upload failed");

    const result = await falRun("fal-ai/image-editing", {
      image_url: file_url,
      prompt: "add subtle film grain, natural photo texture",
      strength: 0.08,
    });

    const url = (result?.image as Record<string, unknown>)?.url as string
      || (result?.images as Array<{ url: string }>)?.[0]?.url;
    if (url) {
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      console.log("[wedding] Film Grain 완료");
      return buf.toString("base64");
    }
    return imageBase64;
  } catch (err: any) {
    console.warn(`[wedding] Film Grain 실패 (원본 유지): ${err.message?.slice(0, 80)}`);
    return imageBase64;
  }
}

// ── 메인 생성 함수 ───────────────────────────────────────

export async function generateWeddingImages(
  input: WeddingGenerateInput
): Promise<WeddingGenerateOutput> {
  const {
    mode,
    brideImageBase64,
    brideMimeType = "image/jpeg",
    groomImageBase64,
    groomMimeType = "image/jpeg",
    concept = "white_studio",
    customPrompt,
    outputCount = 2,
  } = input;

  console.log(`[wedding-v2] 시작 (FLUX.2 Primary): mode=${mode}, concept=${concept}, count=${outputCount}`);

  // 참조 이미지 준비
  const refImages: { base64: string; mimeType: string }[] = [];
  if ((mode === "solo_bride" || mode === "couple") && brideImageBase64) {
    refImages.push({ base64: brideImageBase64, mimeType: brideMimeType });
  }
  if ((mode === "solo_groom" || mode === "couple") && groomImageBase64) {
    refImages.push({ base64: groomImageBase64, mimeType: groomMimeType });
  }

  if (refImages.length === 0) {
    throw new Error("참조 이미지가 필요합니다 (신부 또는 신랑)");
  }

  // 참조 이미지 data URL 준비 (FLUX용)
  const firstRef = refImages[0];
  const refDataUrl = firstRef.base64.startsWith("data:")
    ? firstRef.base64
    : `data:${firstRef.mimeType};base64,${firstRef.base64}`;

  // 4단계 프롬프트 조립
  const stage1 = buildStage1(mode, {
    brideGlasses: input.brideGlasses,
    brideGlassesPresent: input.brideGlassesPresent,
    groomGlasses: input.groomGlasses,
    groomGlassesPresent: input.groomGlassesPresent,
  });
  const stage2 = buildStage2(mode, concept);
  const stage3 = buildStage3(mode);
  const fullPrompt = customPrompt
    ? [stage1, customPrompt, stage3].join("\n\n")
    : [stage1, stage2, stage3].join("\n\n");

  const images: string[] = [];

  // 병렬 생성
  const generateOne = async (i: number): Promise<string | null> => {
    try {
      console.log(`[wedding-v2] ${i + 1}/${outputCount} 생성 중...`);

      // [Primary] FLUX.2 LoRA
      let base64 = await generateWithFluxPrimary(fullPrompt, STAGE4_NEGATIVE, refDataUrl);

      // [Fallback #1] Gemini
      if (!base64) {
        console.log("[wedding-v2] FLUX.2 실패, Gemini로 폴백");
        base64 = await generateWithGeminiFallback(fullPrompt, refImages);
      }

      // [Fallback #2] FLUX Pro v1.1
      if (!base64) {
        console.log("[wedding-v2] Gemini 실패, FLUX Pro로 폴백");
        base64 = await generateWithFluxProFallback(fullPrompt, STAGE4_NEGATIVE, refDataUrl);
      }

      if (!base64) {
        console.warn(`[wedding-v2] ${i + 1}번 이미지 생성 실패 (모든 모델 실패)`);
        return null;
      }

      // CodeFormer 선명화
      base64 = await runCodeFormer(base64);

      // Film Grain 후처리
      base64 = await applyFilmGrain(base64);

      console.log(`[wedding-v2] ${i + 1}번 완료`);
      return `data:image/jpeg;base64,${base64}`;
    } catch (err) {
      console.error(`[wedding-v2] ${i + 1}번 에러:`, err);
      return null;
    }
  };

  const tasks = Array.from({ length: outputCount }, (_, i) => generateOne(i));
  const results = await Promise.all(tasks);
  for (const r of results) {
    if (r) images.push(r);
  }

  if (images.length === 0) throw new Error("모든 웨딩 이미지 생성 실패");

  console.log(`[wedding-v2] 완료: ${images.length}/${outputCount}`);

  return {
    images,
    prompt: fullPrompt,
    negativePrompt: STAGE4_NEGATIVE,
    mode,
    concept,
  };
}
