import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Heart, Download, MessageSquare, Loader2, CheckCircle, Lock, Camera } from "lucide-react";

const REVISION_CATEGORIES = [
  { id: "face", label: "얼굴이 실제와 달라요" },
  { id: "background", label: "배경이 마음에 안 들어요" },
  { id: "pose", label: "포즈가 어색해요" },
  { id: "color", label: "색감/밝기 문제" },
  { id: "dress", label: "드레스/의상 이상해요" },
];

export default function ClientPreview() {
  const params = useParams<{ clientId: string; token: string }>();
  const clientId = parseInt(params.clientId || "0");
  const token = params.token || "";

  // 인증 상태
  const [isVerified, setIsVerified] = useState(false);
  const [clientName, setClientName] = useState("");
  const [birthdate, setBirthdate] = useState("");

  // 갤러리 상태
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [feedbackGenId, setFeedbackGenId] = useState<number | null>(null);
  const [feedbackCategories, setFeedbackCategories] = useState<string[]>([]);
  const [feedbackNote, setFeedbackNote] = useState("");

  // 인증 API
  const verifyMutation = trpc.preview.verify.useMutation({
    onSuccess: (data) => {
      setIsVerified(true);
      setClientName(data.clientName);
      toast.success(`${data.clientName}님 환영합니다!`);
    },
    onError: (err) => toast.error(err.message),
  });

  // 갤러리 데이터
  const galleryQuery = trpc.preview.getGallery.useQuery(
    { clientId, token },
    { enabled: isVerified }
  );

  // 피드백 API
  const feedbackMutation = trpc.preview.submitFeedback.useMutation({
    onSuccess: () => {
      toast.success("수정 요청이 전달되었습니다!");
      setFeedbackGenId(null);
      setFeedbackCategories([]);
      setFeedbackNote("");
    },
    onError: (err) => toast.error(err.message),
  });

  // 좋아요 토글
  const likeMutation = trpc.preview.submitFeedback.useMutation({
    onSuccess: () => {},
  });

  const handleVerify = () => {
    if (!birthdate || birthdate.length !== 6) {
      toast.error("생년월일 6자리를 입력해주세요 (예: 951230)");
      return;
    }
    verifyMutation.mutate({ clientId, token, birthdate });
  };

  const toggleLike = (genId: number) => {
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

  const handleSubmitFeedback = () => {
    if (!feedbackGenId) return;
    if (feedbackCategories.length === 0 && !feedbackNote.trim()) {
      toast.error("수정 요청 내용을 입력해주세요.");
      return;
    }
    feedbackMutation.mutate({
      clientId,
      token,
      generationId: feedbackGenId,
      revisionCategory: feedbackCategories.join(", "),
      revisionNote: feedbackNote.trim() || undefined,
    });
  };

  const toggleCategory = (catId: string) => {
    setFeedbackCategories(prev =>
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
  };

  const likedCount = likedIds.size;

  const handleBulkDownload = () => {
    const images = galleryQuery.data?.images || [];
    const likedImages = images.filter((img: any) => likedIds.has(img.id));
    if (likedImages.length === 0) {
      toast.error("다운로드할 이미지를 선택해주세요.");
      return;
    }
    likedImages.forEach((img: any, idx: number) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = img.resultImageUrl;
        a.download = `wedding-photo-${idx + 1}.jpg`;
        a.target = "_blank";
        a.click();
      }, idx * 500);
    });
    toast.success(`${likedImages.length}장 다운로드를 시작합니다.`);
  };

  // ─── 화면 1: 비밀번호 입력 ───
  if (!isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-pink-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-rose-200/50 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center mb-4 shadow-lg">
              <Camera className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-800">
              One AI Studio
            </CardTitle>
            <p className="text-rose-500 font-medium mt-2 text-lg">
              AI 웨딩 사진이 준비됐어요 💕
            </p>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">
                본인 확인을 위해 생년월일 6자리를 입력해주세요
              </p>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="예: 951230"
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  className="pl-10 text-center text-lg tracking-widest border-rose-200 focus:border-rose-400 focus:ring-rose-400 bg-white"
                />
              </div>
              <Button
                onClick={handleVerify}
                disabled={verifyMutation.isPending || birthdate.length !== 6}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white shadow-md"
                size="lg"
              >
                {verifyMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    확인
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-center text-gray-400">
              보안을 위해 본인 확인 후 사진을 확인할 수 있습니다
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── 화면 2: 갤러리 ───
  const images = galleryQuery.data?.images || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-pink-50">
      {/* 상단 고정 바 */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-rose-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center">
              <Camera className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">{clientName}님의 갤러리</p>
              <p className="text-xs text-gray-500">{images.length}장의 사진</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {likedCount > 0 && (
              <span className="text-sm font-medium text-rose-500 flex items-center gap-1">
                <Heart className="h-4 w-4 fill-rose-500" />
                {likedCount}장 선택
              </span>
            )}
            <Button
              onClick={handleBulkDownload}
              disabled={likedCount === 0}
              size="sm"
              className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white text-xs"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              선택 다운로드
            </Button>
          </div>
        </div>
      </div>

      {/* 이미지 그리드 */}
      <div className="max-w-2xl mx-auto px-3 py-4">
        {galleryQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-rose-400" />
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-20">
            <Camera className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">아직 준비된 사진이 없습니다</p>
            <p className="text-sm text-gray-400 mt-1">곧 멋진 사진이 준비될 거예요!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {images.map((img: any) => {
              const isLiked = likedIds.has(img.id);
              return (
                <Card key={img.id} className={`overflow-hidden border-2 transition-all duration-200 ${
                  isLiked ? "border-rose-400 shadow-lg shadow-rose-100" : "border-gray-100 shadow-sm"
                } bg-white`}>
                  <div className="relative aspect-[3/4] overflow-hidden bg-gray-50">
                    <img
                      src={img.resultImageUrl}
                      alt="웨딩 사진"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* 좋아요 오버레이 */}
                    {isLiked && (
                      <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-rose-500 flex items-center justify-center shadow-md">
                        <Heart className="h-4 w-4 text-white fill-white" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-2.5">
                    <div className="flex items-center justify-between gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleLike(img.id)}
                        className={`h-8 px-2 gap-1 text-xs ${
                          isLiked ? "text-rose-500 hover:text-rose-600" : "text-gray-500 hover:text-rose-500"
                        }`}
                      >
                        <Heart className={`h-4 w-4 ${isLiked ? "fill-rose-500" : ""}`} />
                        {isLiked ? "선택됨" : "선택"}
                      </Button>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFeedbackGenId(img.id);
                            setFeedbackCategories([]);
                            setFeedbackNote("");
                          }}
                          className="h-8 px-2 text-xs text-gray-500 hover:text-amber-500"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </Button>
                        <a href={img.resultImageUrl} target="_blank" rel="noopener noreferrer" download>
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-gray-500 hover:text-blue-500">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 수정 요청 다이얼로그 */}
      <Dialog open={feedbackGenId !== null} onOpenChange={(open) => !open && setFeedbackGenId(null)}>
        <DialogContent className="max-w-md bg-white border-rose-100">
          <DialogHeader>
            <DialogTitle className="text-gray-800 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-amber-500" />
              수정 요청
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">어떤 부분이 마음에 들지 않으셨나요?</p>
            <div className="space-y-2.5">
              {REVISION_CATEGORIES.map((cat) => (
                <label
                  key={cat.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    feedbackCategories.includes(cat.id)
                      ? "border-rose-300 bg-rose-50"
                      : "border-gray-200 hover:border-rose-200 hover:bg-rose-50/50"
                  }`}
                >
                  <Checkbox
                    checked={feedbackCategories.includes(cat.id)}
                    onCheckedChange={() => toggleCategory(cat.id)}
                  />
                  <span className="text-sm text-gray-700">{cat.label}</span>
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-500">추가 요청사항</p>
              <Textarea
                placeholder="원하시는 수정 내용을 자유롭게 적어주세요..."
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                rows={3}
                className="border-gray-200 focus:border-rose-400 focus:ring-rose-400 text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" size="sm" className="border-gray-200 text-gray-600">
                취소
              </Button>
            </DialogClose>
            <Button
              onClick={handleSubmitFeedback}
              disabled={feedbackMutation.isPending}
              size="sm"
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              {feedbackMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "수정 요청 보내기"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
