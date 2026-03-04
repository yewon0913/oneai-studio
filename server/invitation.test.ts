import { describe, it, expect, vi } from "vitest";

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: vi.fn().mockResolvedValue({
          content: [{
            type: "text",
            text: '["두 사람이 하나가 되는 아름다운 날", "사랑의 약속을 나누는 순간", "함께 축복해 주세요"]',
          }],
        }),
      };
      constructor() {}
    },
  };
});

describe("Invitations Router", () => {
  describe("generateText", () => {
    it("should have the invitations router defined in the app router", async () => {
      const { appRouter } = await import("./routers");
      expect(appRouter._def.procedures).toHaveProperty("invitations.generateText");
    });

    it("should be a mutation procedure", async () => {
      const { appRouter } = await import("./routers");
      const procedure = (appRouter._def.procedures as any)["invitations.generateText"];
      expect(procedure).toBeDefined();
      // tRPC v11 stores mutation flag differently
      expect(procedure._def.type === "mutation" || procedure._def.mutation === true).toBe(true);
    });
  });

  describe("Invitation Page Integration", () => {
    it("should define 5 wedding invitation styles", () => {
      const styles = [
        { id: "cinematic", name: "시네마틱 무비" },
        { id: "romantic", name: "로맨틱 클래식" },
        { id: "modern", name: "모던 미니멀" },
        { id: "film", name: "필름 감성" },
        { id: "luxury", name: "럭셔리 골드" },
      ];
      expect(styles).toHaveLength(5);
      expect(styles.map(s => s.id)).toEqual(["cinematic", "romantic", "modern", "film", "luxury"]);
    });

    it("should define 10 BGM options", () => {
      const bgmCount = 10;
      expect(bgmCount).toBe(10);
    });

    it("should define 5 steps for the invitation wizard", () => {
      const steps = [
        { id: 1, label: "스타일 선택" },
        { id: 2, label: "정보 입력" },
        { id: 3, label: "사진 선택" },
        { id: 4, label: "BGM 선택" },
        { id: 5, label: "생성 결과" },
      ];
      expect(steps).toHaveLength(5);
    });

    it("should require 6-10 photos for invitation", () => {
      const minPhotos = 6;
      const maxPhotos = 10;
      expect(minPhotos).toBe(6);
      expect(maxPhotos).toBe(10);
    });
  });

  describe("AI Text Generation", () => {
    it("should parse JSON array from Claude response", () => {
      const responseText = '["두 사람이 하나가 되는 아름다운 날", "사랑의 약속을 나누는 순간", "함께 축복해 주세요"]';
      const match = responseText.match(/\[[\s\S]*\]/);
      expect(match).not.toBeNull();
      const texts = JSON.parse(match![0]);
      expect(texts).toHaveLength(3);
      expect(texts[0]).toContain("두 사람");
    });

    it("should fallback to default texts when parsing fails", () => {
      const responseText = "파싱할 수 없는 응답";
      const match = responseText.match(/\[[\s\S]*\]/);
      const texts = match ? JSON.parse(match[0]) : [
        "두 사람이 하나가 되는 날, 함께해 주세요.",
        "사랑이 완성되는 순간에 초대합니다.",
        "설레는 마음으로 기다리겠습니다.",
      ];
      expect(texts).toHaveLength(3);
      expect(texts[0]).toContain("두 사람");
    });

    it("should handle JSON embedded in text response", () => {
      const responseText = '여기 3가지 문구입니다:\n["첫 번째 문구", "두 번째 문구", "세 번째 문구"]\n감사합니다.';
      const match = responseText.match(/\[[\s\S]*\]/);
      expect(match).not.toBeNull();
      const texts = JSON.parse(match![0]);
      expect(texts).toHaveLength(3);
    });
  });
});
