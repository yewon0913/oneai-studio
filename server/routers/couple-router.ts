import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { generateCouplePipeline } from "../services/couple-pipeline";

export const coupleRouter = router({
  generateCouple: publicProcedure
    .input(z.object({
      coupleImageBase64: z.string(),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
      scene: z.enum(["cherry_blossom", "chapel", "garden", "beach", "forest", "palace", "all"]).default("cherry_blossom"),
      aspectRatio: z.enum(["4:3", "16:9", "1:1"]).default("4:3"),
      promptText: z.string().optional(),
      negativePrompt: z.string().optional(),
      faceFixMode: z.boolean().default(true),
      coupleEngine: z.enum(["flux-dev", "flux-pro"]).default("flux-dev"),
      coupleComparisonMode: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      console.log("[couple-router] Starting...");
      const results = await generateCouplePipeline(
        input.coupleImageBase64,
        input.mimeType,
        input.scene,
        input.aspectRatio,
        input.promptText,
        input.negativePrompt,
        input.coupleEngine,
        input.faceFixMode,
        input.coupleComparisonMode,
      );
      return { images: results.map((r) => ({ url: r.url, log: r.log })) };
    }),

  analyzeCouple: publicProcedure
    .input(z.object({
      imageBase64: z.string(),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const clean = input.imageBase64.includes(",")
        ? input.imageBase64.split(",")[1]
        : input.imageBase64;

      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      // 15가지 카테고리 분석 (개인촬영과 동일)
      const response = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: (input.mimeType || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp", data: clean },
            },
            {
              type: "text",
              text: `이 커플 사진을 분석해서 웨딩 사진 생성에 최적화된 영어 프롬프트를 만들어줘.
Anthropic Claude가 15가지 카테고리를 분석하여 최적화된 프롬프트를 생성합니다.

JSON 형식으로만 응답해:
{
  "prompt": "웨딩 배경 합성에 쓸 영어 프롬프트 (배경, 조명, 분위기 포함, 50단어 이내)",
  "camera": "카메라 설정 (렌즈, 조리개 등)",
  "lighting": "조명 (자연광, 스튜디오 조명 등)",
  "skin": "피부톤 (따뜻한, 차가운 등)",
  "outfit": "의상 스타일",
  "pose": "포즈 (자연스러운, 정형적 등)",
  "expression": "표정 (밝은, 차분한 등)",
  "background": "배경 (실내, 실외, 자연 등)",
  "mood": "분위기 (로맨틱, 우아한 등)",
  "movement": "움직임 (정적, 동적 등)",
  "space": "공간감 (넓은, 좁은 등)",
  "time": "시간/날씨 (황금시간, 흐린 날씨 등)",
  "optical": "광학효과 (보케, 플레어 등)",
  "composition": "구도 (대칭, 비대칭 등)",
  "colorGrade": "색감 (따뜻한, 차가운 등)",
  "innerState": "내면감정 (행복, 차분 등)"
}`
            }
          ]
        }]
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("분석 파싱 실패");
      
      const analysis = JSON.parse(jsonMatch[0]);
      return {
        prompt: analysis.prompt || "",
        analysis: {
          camera: analysis.camera,
          lighting: analysis.lighting,
          skin: analysis.skin,
          outfit: analysis.outfit,
          pose: analysis.pose,
          expression: analysis.expression,
          background: analysis.background,
          mood: analysis.mood,
          movement: analysis.movement,
          space: analysis.space,
          time: analysis.time,
          optical: analysis.optical,
          composition: analysis.composition,
          colorGrade: analysis.colorGrade,
          innerState: analysis.innerState,
        }
      };
    }),
});
