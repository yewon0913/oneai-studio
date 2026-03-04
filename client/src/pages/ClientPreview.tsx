import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Heart, MessageCircle, Download, Loader2, Lock, Check } from "lucide-react";

const REVISION_CATEGORIES = [
  "얼굴이 실제와 달라요",
  "배경이 마음에 안 들어요",
  "포즈가 어색해요",
  "색감/밝기 문제",
  "직접 입력",
];

export default function ClientPreview() {
  const params = useParams<{ clientId: string; token: string }>();
  const clientId = Number(params.clientId);
  const token = params.token || "";

  // ─── 인증 상태 ───
  const [verified, setVerified] = useState(false);
  const [clientName, setClientName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [failCount, setFailCount] = useState(0);
  const [locked, setLocked] = useState(false);

  // ─── 좋아요 상태 (로컬) ───
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());

  // ─── 수정 요청 다이얼로그 ───
  const [feedbackGenId, setFeedbackGenId] = useState<number | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [customNote, setCustomNote] = useState("");

  // ─── tRPC ───
  const verifyMutation = trpc.preview.verify.useMutation({
    onSuccess: (data) => {
      setVerified(true);
      setClientName(data.clientName);
      toast.success("인증 완료!");
    },
    onError: (err) => {
      const newCount = failCount + 1;
      setFailCount(newCount);
      if (newCount >= 5) {
        setLocked(true);
        toast.error("잠시 후 다시 시도해주세요");
      } else {
        toast.error(err.message || "인증 실패");
      }
    },
  });

  const { data: gallery, isLoading: galleryLoading } = trpc.preview.getGallery.useQuery(
    { clientId, token },
    { enabled: verified }
  );

  const feedbackMutation = trpc.preview.submitFeedback.useMutation({
    onSuccess: () => {
      toast.success("수정 요청이 전달되었습니다");
      setFeedbackGenId(null);
      setSelectedCategories([]);
      setCustomNote("");
    },
    onError: (err) => toast.error(err.message || "요청 실패"),
  });

  const likeMutation = trpc.preview.submitFeedback.useMutation();

  // ─── 좋아요 토글 ───
  const handleLike = (genId: number) => {
    const newLiked = new Set(likedIds);
    const isLiked = newLiked.has(genId);
    if (isLiked) {
      newLiked.delete(genId);
    } else {
      newLiked.add(genId);
    }
    setLikedIds(newLiked);
    likeMutation.mutate({
      clientId,
      token,
      generationId: genId,
      liked: !isLiked,
    });
  };

  // ─── 선택된 이미지 수 ───
  const selectedCount = likedIds.size;

  // ─── 선택된 이미지 다운로드 ───
  const handleBulkDownload = () => {
    if (!gallery) return;
    const selectedImages = gallery.images.filter((img: any) => likedIds.has(img.id));
    selectedImages.forEach((img: any, idx: number) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = img.imageUrl;
        a.download = `wedding-photo-${idx + 1}.jpg`;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, idx * 500);
    });
    toast.success(`${selectedImages.length}장 다운로드 시작`);
  };

  // ─── 인증 핸들러 ───
  const handleVerify = () => {
    if (locked) return;
    if (!birthdate || birthdate.length !== 6) {
      toast.error("생년월일 6자리를 입력해주세요 (예: 951230)");
      return;
    }
    verifyMutation.mutate({ clientId, token, birthdate });
  };

  // ─── 수정 요청 제출 ───
  const handleSubmitFeedback = () => {
    if (feedbackGenId === null) return;
    const hasCustom = selectedCategories.includes("직접 입력");
    if (selectedCategories.length === 0) {
      toast.error("수정 사유를 1개 이상 선택해주세요");
      return;
    }
    if (hasCustom && !customNote.trim()) {
      toast.error("직접 입력 내용을 작성해주세요");
      return;
    }
    feedbackMutation.mutate({
      clientId,
      token,
      generationId: feedbackGenId,
      revisionCategories: selectedCategories.filter((c) => c !== "직접 입력"),
      revisionNote: hasCustom ? customNote : undefined,
    });
  };

  // ═══════════════════════════════════════
  // 화면 1 - 인증
  // ═══════════════════════════════════════
  if (!verified) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm border-rose-200/50 dark:border-rose-900/30 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-4">
              <Lock className="h-7 w-7 text-rose-500" />
            </div>
            <CardTitle className="text-xl font-semibold text-foreground">
              AI 웨딩 사진이 준비됐어요
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              본인 확인을 위해 생년월일을 입력해주세요
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="생년월일 6자리 (예: 951230)"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                className="text-center text-lg tracking-widest"
                disabled={locked}
              />
              {failCount > 0 && failCount < 5 && (
                <p className="text-xs text-destructive text-center">
                  인증 실패 ({failCount}/5회)
                </p>
              )}
              {locked && (
                <p className="text-xs text-destructive text-center font-medium">
                  잠시 후 다시 시도해주세요
                </p>
              )}
            </div>
            <Button
              className="w-full bg-rose-500 hover:bg-rose-600 text-white"
              onClick={handleVerify}
              disabled={verifyMutation.isPending || locked || birthdate.length !== 6}
            >
              {verifyMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              확인
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // 화면 2 - 갤러리
  // ═══════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* 상단 고정 바 */}
      <div className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-rose-200/30 dark:border-rose-900/20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-rose-500 font-medium text-sm">
              {selectedCount > 0 ? `❤️ ${selectedCount}장 선택됨` : `${clientName}님의 갤러리`}
            </span>
          </div>
          {selectedCount > 0 && (
            <Button
              size="sm"
              className="bg-rose-500 hover:bg-rose-600 text-white gap-1.5"
              onClick={handleBulkDownload}
            >
              <Download className="h-3.5 w-3.5" />
              선택 다운로드
            </Button>
          )}
        </div>
      </div>

      {/* 갤러리 그리드 */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {galleryLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-rose-400" />
          </div>
        ) : !gallery || gallery.images.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">아직 준비된 사진이 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {gallery.images.map((img: any) => {
              const isLiked = likedIds.has(img.id);
              return (
                <div
                  key={img.id}
                  className="group relative rounded-xl overflow-hidden border border-rose-200/30 dark:border-rose-900/20 bg-white dark:bg-gray-900 shadow-sm"
                >
                  {/* 이미지 */}
                  <div className="aspect-[3/4] overflow-hidden">
                    <img
                      src={img.imageUrl}
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>

                  {/* 오버레이 버튼들 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 flex items-end justify-between">
                    <div className="flex items-center gap-2">
                      {/* 좋아요 */}
                      <button
                        onClick={() => handleLike(img.id)}
                        className={`p-2 rounded-full transition-all ${
                          isLiked
                            ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30"
                            : "bg-white/20 text-white hover:bg-white/30"
                        }`}
                      >
                        <Heart className={`h-4 w-4 ${isLiked ? "fill-current" : ""}`} />
                      </button>

                      {/* 수정 요청 */}
                      <button
                        onClick={() => {
                          setFeedbackGenId(img.id);
                          setSelectedCategories([]);
                          setCustomNote("");
                        }}
                        className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-all"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </button>
                    </div>

                    {/* 다운로드 */}
                    <a
                      href={img.imageUrl}
                      download={`wedding-${img.id}.jpg`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-all"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </div>

                  {/* 좋아요 표시 */}
                  {isLiked && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-rose-500 text-white text-xs px-1.5 py-0.5">
                        <Heart className="h-3 w-3 fill-current" />
                      </Badge>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 수정 요청 다이얼로그 */}
      <Dialog
        open={feedbackGenId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFeedbackGenId(null);
            setSelectedCategories([]);
            setCustomNote("");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">수정 요청</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              {REVISION_CATEGORIES.map((cat) => (
                <label
                  key={cat}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <Checkbox
                    checked={selectedCategories.includes(cat)}
                    onCheckedChange={(checked) => {
                      setSelectedCategories((prev) =>
                        checked
                          ? [...prev, cat]
                          : prev.filter((c) => c !== cat)
                      );
                    }}
                  />
                  <span className="text-sm text-foreground group-hover:text-rose-500 transition-colors">
                    {cat}
                  </span>
                </label>
              ))}
            </div>

            {selectedCategories.includes("직접 입력") && (
              <Textarea
                placeholder="수정하고 싶은 부분을 자유롭게 작성해주세요..."
                rows={3}
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                className="text-sm"
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFeedbackGenId(null)}
            >
              취소
            </Button>
            <Button
              size="sm"
              className="bg-rose-500 hover:bg-rose-600 text-white gap-1.5"
              onClick={handleSubmitFeedback}
              disabled={feedbackMutation.isPending || selectedCategories.length === 0}
            >
              {feedbackMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MessageCircle className="h-3.5 w-3.5" />
              )}
              수정 요청 보내기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
