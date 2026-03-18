import Anthropic from "@anthropic-ai/sdk";

export interface AnalysisResult {
  prompt: string;
  negativePrompt: string;
  analysis: {
    camera: string;
    lighting: string;
    skin: string;
    skinDetail: string;
    outfit: string;
    pose: string;
    expression: string;
    eyeDetail: string;
    faceAngle: string;
    faceShape: string;
    bodyType: string;
    hairDetail: string;
    background: string;
    mood: string;
    movement: string;
    space: string;
    time: string;
    optical: string;
    composition: string;
    colorGrade: string;
    innerState: string;
    lensMatch: string;
    depthControl: string;
    retouchGuide: string;
    realismAnchor: string;
  };
}

const ANALYSIS_PROMPT = `You are a world-class portrait photographer AND an expert AI prompt engineer.

Analyze this photo across 25 categories with EXTREME precision. Every detail matters for generating a photo-identical AI portrait.

**ABSOLUTE RULES:**
- outfit and background MUST appear at the very top of the final prompt
- All keywords in English
- Be hyper-specific (not "smile" → "subtle closed-lip smile with slight left corner upturn")
- Measure angles in degrees where possible
- Reference real camera/lens behavior

**25 ANALYSIS CATEGORIES:**

1. camera: camera body type, focal length (mm), aperture (f-stop), shutter speed estimate, shooting distance (cm), sensor crop factor, ISO estimate
2. lighting: key light type/direction/intensity, fill light ratio, rim/hair light presence, color temperature (K), shadow hardness (soft/medium/hard), shadow direction (clock position), catchlight shape/position in eyes
3. skin: overall skin tone (Fitzpatrick scale I-VI), undertone (warm/cool/neutral), surface finish (matte/dewy/oily), overall complexion clarity
4. skinDetail: pore visibility level (invisible/subtle/visible), fine lines location, dark circles presence/severity, blemish areas, skin texture pattern, nasolabial fold depth, forehead texture, cheek surface quality, under-eye puffiness
5. outfit: garment type, fabric material, color (exact shade), fit (tight/relaxed/oversized), neckline shape, sleeve type, accessories with exact description, jewelry details [TOP PRIORITY]
6. pose: full body angle to camera (degrees), torso rotation (degrees), shoulder tilt (left/right, degrees), hand position (exact placement), finger spread/curl, weight distribution (left/right leg), spine curvature
7. expression: micro-expression type, mouth state (open/closed/parted, teeth visibility), smile type (Duchenne/social/subtle), eyebrow position (raised/neutral/furrowed, asymmetry), forehead tension
8. eyeDetail: iris color (exact shade), pupil dilation estimate, eye openness (percentage), upper/lower eyelid position, eyelash density/length/curl, double eyelid (yes/no/inner), catchlight position (clock direction), eye moisture/sparkle level, gaze vector (exact direction), eye spacing (close/average/wide)
9. faceAngle: head tilt (left/right, degrees), head turn (left/right, degrees from center — 0°=frontal, 15°=slight, 30°=three-quarter, 45°=profile-quarter, 90°=full profile), chin tilt (up/down, degrees), jaw visibility (left/right percentage)
10. faceShape: face shape (oval/round/square/heart/oblong/diamond), jawline definition (sharp/soft/rounded), chin shape (pointed/rounded/square), forehead height (high/medium/low), cheekbone prominence (high/flat), face width-to-height ratio estimate
11. bodyType: shoulder width (narrow/medium/broad), neck length (short/medium/long), upper body build (slim/medium/athletic/full), visible body proportions, frame size
12. hairDetail: hair color (exact shade with highlights), hair length, hair texture (straight/wavy/curly/coily), hair style name, parting side, bangs type (full/side/curtain/none), hair volume, flyaway presence, hair shine level, hair accessory
13. background: background type, color (exact), blur level (bokeh circle size estimate in mm), distance from subject (near/mid/far), any foreground elements, environmental details [TOP PRIORITY]
14. mood: overall atmosphere, emotional tone, style genre (editorial/casual/corporate/artistic), era/decade reference if any
15. movement: static/dynamic, wind presence (direction/strength), fabric movement, hair movement, motion blur presence
16. space: depth layers (foreground/midground/background detail), subject-to-background distance estimate, environmental depth cues
17. time: season, weather, time of day, natural vs artificial light ratio
18. optical: bokeh shape (circular/cat-eye/swirly), chromatic aberration presence, vignetting (none/subtle/strong), lens distortion (barrel/pincushion/none), lens flare
19. composition: subject placement (rule of thirds grid position), headroom amount, look space direction, crop tightness (extreme close-up/close-up/medium close-up/medium/full), aspect ratio
20. colorGrade: color grading style, overall color temperature shift, shadow color tint, highlight color tint, saturation level, contrast level, LUT style name if recognizable
21. innerState: conveyed inner emotion, psychological mood, energy level (calm/medium/vibrant), approachability rating, confidence level
22. lensMatch: RECOMMENDED optimal lens for this face shape (e.g., "round face → 85mm to elongate", "long face → 50mm to compress"), optimal shooting angle for this face (e.g., "strong jaw → shoot slightly above eye level"), optimal aperture for this depth of field
23. depthControl: focus plane placement (on eyes/nose/ears), depth of field estimate (cm in focus), background separation quality, foreground blur presence
24. retouchGuide: suggested enhancement areas (skin smoothing level 0-100, eye brightening level 0-100, teeth whitening needed yes/no, dark circle reduction level 0-100, jawline sharpening level 0-100), areas to preserve exactly as-is
25. realismAnchor: 3-5 specific micro-details that make this photo look REAL and not AI (e.g., "asymmetric nostril size", "single strand of hair crossing forehead", "slight fabric wrinkle at left elbow", "tiny mole below right ear")

**RESPOND WITH JSON ONLY (no other text):**
{
  "analysis": {
    "camera": "keywords",
    "lighting": "keywords",
    "skin": "keywords",
    "skinDetail": "keywords",
    "outfit": "keywords",
    "pose": "keywords",
    "expression": "keywords",
    "eyeDetail": "keywords",
    "faceAngle": "keywords",
    "faceShape": "keywords",
    "bodyType": "keywords",
    "hairDetail": "keywords",
    "background": "keywords",
    "mood": "keywords",
    "movement": "keywords",
    "space": "keywords",
    "time": "keywords",
    "optical": "keywords",
    "composition": "keywords",
    "colorGrade": "keywords",
    "innerState": "keywords",
    "lensMatch": "keywords",
    "depthControl": "keywords",
    "retouchGuide": "keywords",
    "realismAnchor": "keywords"
  },
  "prompt": "Complete integrated English prompt under 500 words. MUST START with outfit and background. Include ALL 25 categories. Structure: [outfit+background] → [face angle+face shape+body type] → [expression+eye detail+hair] → [skin+skin detail] → [camera+lens match+depth control] → [lighting+optical] → [pose+movement] → [composition+space] → [mood+color grade+inner state] → [realism anchor details]. End with: 'Real DSLR photograph, not AI generated, not 3D rendered.'",
  "negativePrompt": "Under 200 words. Include: wrong outfit/background/lighting/color, AI artifacts (plastic skin, symmetrical face, perfect teeth, uniform skin texture, missing pores, identical catchlights, perfectly round iris, no flyaway hair, no skin imperfections, 3D rendered look, CGI, digital art, painting, illustration, anime)"
}`;

function parseResponse(text: string): AnalysisResult {
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("JSON 파싱 실패: 응답에서 JSON을 찾을 수 없습니다");
  const parsed = JSON.parse(match[0]);
  return {
    prompt: parsed.prompt || "",
    negativePrompt: parsed.negativePrompt || "",
    analysis: parsed.analysis || {},
  };
}

/**
 * URL 이미지를 다운로드해서 base64로 변환 후 Claude로 분석
 */
async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`이미지 다운로드 실패: ${res.status}`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return {
    base64: buffer.toString("base64"),
    mimeType: contentType.split(";")[0],
  };
}

/**
 * Anthropic Claude로 이미지 분석 (ANTHROPIC_API_KEY 사용)
 */
async function analyzeWithClaude(
  base64Data: string,
  mimeType: string
): Promise<AnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다");

  const client = new Anthropic({ apiKey });
  const clean = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 6000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as "image/jpeg" | "image/png" | "image/webp",
              data: clean,
            },
          },
          { type: "text", text: ANALYSIS_PROMPT },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return parseResponse(text);
}

/**
 * Gemini로 이미지 분석 (GEMINI_API_KEY 사용, Anthropic 실패 시 폴백)
 */
async function analyzeWithGemini(
  base64Data: string,
  mimeType: string
): Promise<AnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다");

  const clean = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: clean,
                },
              },
              { text: ANALYSIS_PROMPT },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 6000,
        },
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gemini API 실패 (${response.status}): ${detail}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return parseResponse(text);
}

/**
 * Claude → Gemini 폴백 순서로 이미지 분석
 */
async function analyzeImage(base64Data: string, mimeType: string): Promise<AnalysisResult> {
  // 1차: Anthropic Claude
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await analyzeWithClaude(base64Data, mimeType);
    } catch (err: any) {
      console.warn(`[image-analyzer] Claude 분석 실패: ${err.message?.slice(0, 100)} → Gemini 폴백`);
    }
  }

  // 2차: Google Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      return await analyzeWithGemini(base64Data, mimeType);
    } catch (err: any) {
      console.warn(`[image-analyzer] Gemini 분석 실패: ${err.message?.slice(0, 100)}`);
    }
  }

  throw new Error("이미지 분석 불가: ANTHROPIC_API_KEY 또는 GEMINI_API_KEY가 필요합니다");
}

export async function analyzeImageToPrompt(imageUrl: string): Promise<AnalysisResult> {
  try {
    const { base64, mimeType } = await fetchImageAsBase64(imageUrl);
    return await analyzeImage(base64, mimeType);
  } catch (err: any) {
    throw new Error(`이미지 분석 실패: ${err.message}`);
  }
}

export async function analyzeBase64ImageToPrompt(
  base64Data: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg"
): Promise<AnalysisResult> {
  try {
    return await analyzeImage(base64Data, mimeType);
  } catch (err: any) {
    throw new Error(`이미지 분석 실패: ${err.message}`);
  }
}
