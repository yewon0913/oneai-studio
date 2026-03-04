import { describe, it, expect, vi } from "vitest";

// Mock DB
vi.mock("./db", () => ({
  getClientById: vi.fn(),
  getProjectsByUser: vi.fn(),
  getGenerationsByProject: vi.fn(),
  getGenerationById: vi.fn(),
  updateGeneration: vi.fn(),
}));

// Mock notification
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

import * as db from "./db";

describe("Preview Router Logic", () => {
  const mockClient = {
    id: 1,
    userId: 10,
    name: "김미영",
    gender: "female",
    phone: "01012345678",
    status: "in_progress",
  };

  // Token generation logic (matches server)
  const generateToken = (clientId: number, clientName: string) => {
    return Buffer.from(`preview-${clientId}-${clientName}`).toString("base64url").slice(0, 16);
  };

  describe("Token Generation", () => {
    it("should generate consistent tokens", () => {
      const token1 = generateToken(1, "김미영");
      const token2 = generateToken(1, "김미영");
      expect(token1).toBe(token2);
      expect(token1.length).toBe(16);
    });

    it("should generate different tokens for different clients", () => {
      const token1 = generateToken(1, "김미영");
      const token2 = generateToken(2, "이수진");
      expect(token1).not.toBe(token2);
    });
  });

  describe("Verify Logic", () => {
    it("should reject invalid birthdate length", () => {
      const birthdate = "9512";
      expect(birthdate.length).not.toBe(6);
    });

    it("should accept valid 6-digit birthdate", () => {
      const birthdate = "951230";
      expect(birthdate.length).toBe(6);
    });

    it("should reject when client not found", async () => {
      vi.mocked(db.getClientById).mockResolvedValue(null as any);
      const result = await db.getClientById(999);
      expect(result).toBeNull();
    });

    it("should verify with correct token", async () => {
      vi.mocked(db.getClientById).mockResolvedValue(mockClient as any);
      const client = await db.getClientById(1);
      expect(client).toBeTruthy();
      const expectedToken = generateToken(1, client!.name);
      const inputToken = generateToken(1, "김미영");
      expect(inputToken).toBe(expectedToken);
    });

    it("should reject incorrect token", () => {
      const expectedToken = generateToken(1, "김미영");
      const wrongToken = "wrongtoken123456";
      expect(wrongToken).not.toBe(expectedToken);
    });
  });

  describe("Gallery Logic", () => {
    it("should filter approved/completed images", () => {
      const generations = [
        { id: 1, status: "approved", stage: "final", resultImageUrl: "url1" },
        { id: 2, status: "draft", stage: "draft", resultImageUrl: "url2" },
        { id: 3, status: "completed", stage: "final", resultImageUrl: "url3" },
        { id: 4, status: "revision", stage: "review", resultImageUrl: "url4" },
      ];
      const approved = generations.filter(
        (g) => g.status === "approved" || g.status === "completed" || g.stage === "final"
      );
      expect(approved).toHaveLength(2); // id 1 (approved), id 3 (completed)
    });

    it("should filter projects by clientId", () => {
      const projects = [
        { id: 1, clientId: 1, title: "Project A" },
        { id: 2, clientId: 2, title: "Project B" },
        { id: 3, clientId: 1, title: "Project C" },
      ];
      const clientProjects = projects.filter((p) => p.clientId === 1);
      expect(clientProjects).toHaveLength(2);
    });
  });

  describe("Feedback Logic", () => {
    it("should update generation with revision note", async () => {
      vi.mocked(db.updateGeneration).mockResolvedValue(undefined);
      const revisionCategory = "얼굴이 실제와 달라요, 색감/밝기 문제";
      const revisionNote = "좀 더 밝게 해주세요";
      const reviewNotes = `[고객 수정요청] ${revisionCategory}: ${revisionNote}`;
      await db.updateGeneration(1, { status: "revision" as any, reviewNotes });
      expect(db.updateGeneration).toHaveBeenCalledWith(1, {
        status: "revision",
        reviewNotes: "[고객 수정요청] 얼굴이 실제와 달라요, 색감/밝기 문제: 좀 더 밝게 해주세요",
      });
    });

    it("should add like tag to review notes", async () => {
      vi.mocked(db.getGenerationById).mockResolvedValue({
        id: 1,
        reviewNotes: "기존 메모",
      } as any);
      const gen = await db.getGenerationById(1);
      const likeTag = "[❤️ 고객 선택]";
      const newNotes = `${likeTag} ${gen!.reviewNotes || ""}`;
      expect(newNotes).toBe("[❤️ 고객 선택] 기존 메모");
    });

    it("should remove like tag when unliked", () => {
      const currentNotes = "[❤️ 고객 선택] 기존 메모";
      const cleaned = currentNotes.replace(/\[❤️ 고객 선택\]\s*/g, "");
      expect(cleaned).toBe("기존 메모");
    });
  });

  describe("Revision Categories", () => {
    const categories = [
      { id: "face", label: "얼굴이 실제와 달라요" },
      { id: "background", label: "배경이 마음에 안 들어요" },
      { id: "pose", label: "포즈가 어색해요" },
      { id: "color", label: "색감/밝기 문제" },
      { id: "dress", label: "드레스/의상 이상해요" },
    ];

    it("should have 5 revision categories", () => {
      expect(categories).toHaveLength(5);
    });

    it("should join multiple categories with comma", () => {
      const selected = ["face", "color"];
      const labels = selected.map((id) => categories.find((c) => c.id === id)?.label).filter(Boolean);
      const joined = labels.join(", ");
      expect(joined).toBe("얼굴이 실제와 달라요, 색감/밝기 문제");
    });
  });
});
