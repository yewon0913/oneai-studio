/**
 * ONE AI STUDIO - Face DNA Analyzer
 * 
 * 참조 사진 → Gemini Vision 분석 → 맞춤 프롬프트 자동 생성
 * 
 * 흐름:
 *   1. 고객 사진 업로드
 *   2. Gemini Vision이 얼굴 DNA 추출
 *   3. DNA → Positive/Negative 프롬프트 자동 변환
 *   4. InstantID + 맞춤 프롬프트 = 95점!
 */

import { callGemini, type GeminiPart } from "../_core/imageGeneration";

// === 얼굴 DNA 타입 ===
export interface FaceDNA {
  // 기본 정보
  gender: "male" | "female";
  ageRange: string;        // "late 20s", "early 30s", "mid 40s" 등
  
  // 얼굴형
  faceShape: string;       // "oval", "round", "square", "heart", "oblong"
  jawline: string;         // "defined angular", "soft round", "V-line", "wide square"
  
  // 눈
  eyeShape: string;        // "narrow elongated", "round large", "almond", "monolid"
  eyeSize: string;         // "small", "medium", "large"
  eyelid: string;          // "double eyelid", "inner double eyelid", "monolid"
  
  // 코
  noseShape: string;       // "straight high", "natural medium", "flat wide", "button"
  
  // 입/미소
  smileStyle: string;      // "closed-mouth subtle", "slight teeth showing", "wide open smile"
  lipShape: string;        // "thin", "medium", "full"
  
  // 헤어
  hairColor: string;       // "jet black", "dark brown", "brown with highlights", "gray mixed"
  hairLength: string;      // "very short", "short", "medium", "long"
  hairTexture: string;     // "straight", "wavy", "curly", "textured"
  hairVolume: string;      // "flat", "normal", "voluminous"
  
  // 피부
  skinTone: string;        // "fair", "light", "medium", "tan", "dark"
  skinTexture: string;     // "smooth", "natural with pores", "textured"
  
  // 체형 (얼굴 주변)
  neckThickness: string;   // "thin", "medium", "thick"
  shoulderWidth: string;   // "narrow", "medium", "broad"
  
  // 특이사항
  glasses: boolean;
  facialHair: string;      // "none", "light stubble", "mustache", "beard"
  distinctFeatures: string; // 특이 특징 (점, 흉터 등)
}

// === Gemini Vision으로 얼굴 DNA 추출 ===
export async function analyzeFaceDNA(imageBuffer: Buffer, mimeType: string = "image/jpeg"): Promise<FaceDNA> {
  console.log("[FaceDNA] Gemini Vision 얼굴 분석 시작...");

  const parts: GeminiPart[] = [
    {
      inlineData: {
        mimeType,
        data: imageBuffer.toString("base64"),
      },
    },
    {
      text: `Analyze this person's face with extreme precision. Return ONLY a JSON object with these exact fields, no other text:

{
  "gender": "male" or "female",
  "ageRange": "late 20s" / "early 30s" / "mid 30s" / "late 30s" / "early 40s" / "mid 40s" / "late 40s" / "early 50s",
  "faceShape": "oval" / "round" / "square" / "heart" / "oblong" / "diamond",
  "jawline": describe the jawline precisely (e.g. "defined angular", "soft round", "wide square", "slim V-line", "natural moderate"),
  "eyeShape": describe eye shape (e.g. "narrow elongated", "round large", "almond shaped", "slightly upturned"),
  "eyeSize": "small" / "medium" / "large",
  "eyelid": "double eyelid" / "inner double eyelid" / "monolid" / "subtle double eyelid",
  "noseShape": describe nose (e.g. "straight high bridge", "natural medium height", "slightly flat", "button nose"),
  "smileStyle": describe their smile (e.g. "closed-mouth subtle smile", "gentle smile with teeth slightly showing", "wide open smile", "neutral no smile"),
  "lipShape": "thin" / "medium" / "full",
  "hairColor": describe hair color precisely (e.g. "jet black", "dark brown", "warm brown with highlights", "brown with gray mixed", "light brown"),
  "hairLength": "very short buzz" / "short" / "medium" / "long" / "very long",
  "hairTexture": "straight" / "slightly wavy" / "wavy" / "curly" / "textured tousled",
  "hairVolume": "flat" / "normal" / "voluminous on top",
  "skinTone": "very fair" / "fair" / "light" / "medium" / "tan" / "dark",
  "skinTexture": "smooth" / "natural with visible pores" / "textured with fine lines",
  "neckThickness": "thin" / "medium" / "thick",
  "shoulderWidth": "narrow" / "medium" / "broad",
  "glasses": true or false,
  "facialHair": "none" / "light stubble" / "mustache" / "full beard" / "goatee",
  "distinctFeatures": describe any moles, scars, dimples, or other distinctive features. "none" if nothing notable
}

Be extremely precise about the ACTUAL features you see. Do NOT idealize or beautify. Report exactly what you observe. For Korean/Asian faces, pay special attention to: eye shape (narrow vs round), eyelid type, jawline definition, and skin tone accuracy.`,
    },
  ];

  const response = await callGemini(parts);
  
  // Gemini 응답에서 JSON 추출
  const candidates = response.candidates;
  if (!candidates?.length) throw new Error("Gemini 응답 없음");
  
  const textPart = candidates[0].content?.parts?.find(p => p.text);
  if (!textPart?.text) throw new Error("Gemini 텍스트 응답 없음");
  
  // JSON 파싱 (markdown 코드블록 제거)
  let jsonText = textPart.text.trim();
  jsonText = jsonText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  
  try {
    const dna = JSON.parse(jsonText) as FaceDNA;
    console.log(`[FaceDNA] 분석 완료: ${dna.gender}, ${dna.ageRange}, ${dna.faceShape} face, ${dna.eyeShape} eyes`);
    return dna;
  } catch (e) {
    console.error(`[FaceDNA] JSON 파싱 실패: ${jsonText.slice(0, 200)}`);
    throw new Error("얼굴 DNA 분석 실패: JSON 파싱 오류");
  }
}

// === DNA → Positive 프롬프트 변환 ===
export function dnaToPositivePrompt(dna: FaceDNA, concept: string = "suit"): string {
  const genderWord = dna.gender === "male" ? "man" : "woman";
  
  // 컨셉별 의상
  const outfitMap: Record<string, string> = {
    male_suit: "navy blue blazer with light blue dress shirt and white pocket square, no necktie",
    male_casual: "cream knit sweater, relaxed natural pose",
    male_wedding: "black tuxedo with white dress shirt and bow tie, elegant",
    male_business: "charcoal gray suit with burgundy tie, professional CEO look",
    female_elegant: "elegant cream silk blouse, pearl earrings",
    female_casual: "soft cream knit sweater, natural relaxed pose",
    female_wedding: "white wedding dress, elegant bridal look",
    female_business: "navy blazer with white blouse, professional look",
  };
  
  const outfit = outfitMap[concept] || outfitMap[`${dna.gender}_suit`] || "professional attire";
  
  // 얼굴 DNA → 프롬프트 조합
  const parts = [
    `portrait of a Korean ${genderWord} in ${dna.gender === "male" ? "his" : "her"} ${dna.ageRange}`,
    outfit,
    `${dna.faceShape} face with ${dna.jawline} jawline`,
    `${dna.eyeShape} eyes with ${dna.eyelid}`,
    `${dna.noseShape}`,
    `${dna.smileStyle}`,
    `${dna.hairColor} ${dna.hairTexture} hair ${dna.hairLength} length with ${dna.hairVolume} volume`,
    `natural Korean ${dna.gender === "male" ? "male" : "female"} skin ${dna.skinTone} tone with ${dna.skinTexture}`,
  ];
  
  // 안경 추가
  if (dna.glasses) {
    parts.push("wearing glasses, glasses preserved exactly");
  }
  
  // 수염 추가
  if (dna.facialHair && dna.facialHair !== "none") {
    parts.push(`${dna.facialHair}`);
  }
  
  // 특이사항 추가
  if (dna.distinctFeatures && dna.distinctFeatures !== "none") {
    parts.push(dna.distinctFeatures);
  }
  
  // 조명 + 기술 프롬프트
  parts.push(
    "single key light from upper left at 45 degrees",
    "soft fill light from right, 2:1 lighting ratio",
    "neutral gray seamless background",
    "photorealistic natural depth of field",
    "authentic natural expression",
    "clean background, no watermark, no text"
  );
  
  return parts.join(", ");
}

// === DNA → Negative 프롬프트 변환 ===
export function dnaToNegativePrompt(dna: FaceDNA): string {
  const parts = [
    "deformed, ugly, blurry, cartoon, anime",
    "stock photo, getty images",
    "smooth porcelain skin, airbrushed, plastic skin",
    "heavy makeup, glossy skin",
    "different person than reference",
    "watermark, text overlay, logo, signature",
  ];
  
  // 얼굴형 반대 특성 네거티브
  if (dna.faceShape === "oval" || dna.faceShape === "oblong") {
    parts.push("round face, chubby cheeks");
  } else if (dna.faceShape === "round") {
    parts.push("angular face, sharp jawline, V-line jaw");
  } else if (dna.faceShape === "square") {
    parts.push("V-line jaw, slim face, narrow chin");
  }
  
  // 눈 반대 특성
  if (dna.eyeSize === "small" || dna.eyeShape.includes("narrow")) {
    parts.push("large round eyes, double eyelid surgery look, enlarged eyes");
  } else if (dna.eyeSize === "large") {
    parts.push("narrow small eyes, squinting");
  }
  
  // 미소 반대 특성
  if (dna.smileStyle.includes("closed-mouth") || dna.smileStyle.includes("subtle")) {
    parts.push("open mouth smile, teeth showing, wide grin, toothy grin");
  } else if (dna.smileStyle.includes("wide") || dna.smileStyle.includes("teeth")) {
    parts.push("closed mouth, no smile, stern face");
  }
  
  // 헤어 반대 특성
  if (dna.hairColor.includes("brown") || dna.hairColor.includes("highlight")) {
    parts.push("jet black hair");
  }
  if (dna.hairTexture === "straight") {
    parts.push("curly hair, wavy hair");
  } else if (dna.hairTexture.includes("wavy") || dna.hairTexture.includes("curly")) {
    parts.push("straight flat hair");
  }
  
  // 안경
  if (!dna.glasses) {
    // 안경 안 낀 사람이면 안경 방지
    // (프롬프트에 추가하지 않음 — 불필요한 강조 방지)
  } else {
    parts.push("no glasses, removed glasses");
  }
  
  // 나이 방지
  parts.push("younger than reference, older than reference");
  parts.push("westernized features");
  
  // 의상 변형 방지
  parts.push("necktie, bow tie, scarf, turtleneck");
  
  return parts.join(", ");
}

// === 통합 함수: 사진 → 맞춤 프롬프트 자동 생성 ===
export async function generateCustomPrompts(
  imageBuffer: Buffer,
  concept: string = "male_suit",
  mimeType: string = "image/jpeg"
): Promise<{ positive: string; negative: string; dna: FaceDNA }> {
  
  const dna = await analyzeFaceDNA(imageBuffer, mimeType);
  
  // DNA에서 성별 기반 컨셉 자동 결정
  const finalConcept = concept.startsWith(dna.gender) ? concept : `${dna.gender}_suit`;
  
  const positive = dnaToPositivePrompt(dna, finalConcept);
  const negative = dnaToNegativePrompt(dna);
  
  console.log(`[FaceDNA] Positive: ${positive.slice(0, 100)}...`);
  console.log(`[FaceDNA] Negative: ${negative.slice(0, 100)}...`);
  
  return { positive, negative, dna };
}
