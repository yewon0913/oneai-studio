import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useState, useMemo, useRef, useEffect } from "react";
import {
  ArrowLeft, ArrowRight, Check, Loader2, Sparkles,
  Download, Play, Pause, Music, Film, ImageIcon
} from "lucide-react";
import { toast } from "sonner";

// ─── 스타일 옵션 ───
const STYLES = [
  { id: "cinematic", label: "시네마틱 무비", emoji: "🎬", desc: "영화 같은 드라마틱한 연출", color: "from-slate-800 to-slate-900" },
  { id: "romantic", label: "로맨틱 클래식", emoji: "🌸", desc: "부드럽고 따뜻한 감성", color: "from-rose-800 to-pink-900" },
  { id: "modern", label: "모던 미니멀", emoji: "✨", desc: "깔끔하고 세련된 디자인", color: "from-zinc-700 to-zinc-900" },
  { id: "film", label: "필름 감성", emoji: "📷", desc: "빈티지 필름 느낌", color: "from-amber-800 to-orange-900" },
  { id: "luxury", label: "럭셔리 골드", emoji: "💫", desc: "고급스러운 골드 톤", color: "from-yellow-700 to-amber-900" },
];

// ─── BGM 옵션 (Pixabay 무료 음원) ───
const BGM_LIST = [
  { id: "romantic-piano", label: "로맨틱 피아노", genre: "클래식", url: "https://cdn.pixabay.com/audio/2024/11/29/audio_d4e4ef1dc0.mp3" },
  { id: "wedding-waltz", label: "웨딩 왈츠", genre: "클래식", url: "https://cdn.pixabay.com/audio/2024/02/14/audio_8e0b6e9bfe.mp3" },
  { id: "gentle-acoustic", label: "어쿠스틱 기타", genre: "어쿠스틱", url: "https://cdn.pixabay.com/audio/2024/09/10/audio_6e5d7d1eab.mp3" },
  { id: "dreamy-strings", label: "드리미 스트링", genre: "오케스트라", url: "https://cdn.pixabay.com/audio/2023/10/30/audio_e4a1e3a6c0.mp3" },
  { id: "soft-emotional", label: "소프트 이모셔널", genre: "뉴에이지", url: "https://cdn.pixabay.com/audio/2024/01/10/audio_d0e93ae0e8.mp3" },
  { id: "cinematic-love", label: "시네마틱 러브", genre: "시네마틱", url: "https://cdn.pixabay.com/audio/2024/04/16/audio_d4b2a6a5c0.mp3" },
  { id: "happy-day", label: "해피 데이", genre: "팝", url: "https://cdn.pixabay.com/audio/2023/09/04/audio_d4b2a6a5c0.mp3" },
  { id: "elegant-jazz", label: "엘레강트 재즈", genre: "재즈", url: "https://cdn.pixabay.com/audio/2024/06/20/audio_e4a1e3a6c0.mp3" },
  { id: "nature-calm", label: "네이처 캄", genre: "앰비언트", url: "https://cdn.pixabay.com/audio/2024/08/15/audio_d0e93ae0e8.mp3" },
  { id: "love-story", label: "러브 스토리", genre: "피아노", url: "https://cdn.pixabay.com/audio/2024/03/22/audio_8e0b6e9bfe.mp3" },
];

const STEP_LABELS = ["스타일", "정보 입력", "사진 선택", "BGM", "생성"];

export default function Invitation() {
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params.projectId);
  const [, setLocation] = useLocation();

  // ─── 스텝 상태 ───
  const [step, setStep] = useState(0);

  // ─── Step 1: 스타일 ───
  const [selectedStyle, setSelectedStyle] = useState("");

  // ─── Step 2: 정보 입력 ───
  const [groomName, setGroomName] = useState("");
  const [brideName, setBrideName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [weddingTime, setWeddingTime] = useState("");
  const [venue, setVenue] = useState("");
  const [message, setMessage] = useState("");
  const [aiTexts, setAiTexts] = useState<string[]>([]);

  // ─── Step 3: 사진 선택 ───
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set());

  // ─── Step 4: BGM ───
  const [selectedBgm, setSelectedBgm] = useState("");
  const [playingBgm, setPlayingBgm] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ─── Step 5: 생성 ───
  const [generatingVideoId, setGeneratingVideoId] = useState<number | null>(null);

  // ─── tRPC ───
  const { data: project } = trpc.projects.getById.useQuery({ id: projectId });
  const { data: generations } = trpc.generations.list.useQuery(
    { projectId },
    { enabled: !!projectId }
  );

  const completedImages = useMemo(() => {
    if (!generations) return [];
    return generations.filter((g: any) => (g.status === "completed" || g.status === "approved") && g.resultImageUrl);
  }, [generations]);

  const generateTextMutation = trpc.invitations.generateText.useMutation({
    onSuccess: (data) => {
      setAiTexts(data.texts);
      toast.success("AI 문구 3가지가 생성되었습니다");
    },
    onError: () => toast.error("문구 생성 실패. 다시 시도해주세요."),
  });

  const createVideoMutation = trpc.videos.create.useMutation({
    onSuccess: (data) => {
      setGeneratingVideoId(data.id);
      toast.success("영상 생성이 시작되었습니다");
    },
    onError: () => toast.error("영상 생성 실패"),
  });

  const { data: videoStatus } = trpc.videos.list.useQuery(
    { projectId },
    {
      enabled: generatingVideoId !== null,
      refetchInterval: generatingVideoId !== null ? 5000 : false,
    }
  );

  const currentVideo = useMemo(() => {
    if (!videoStatus || !generatingVideoId) return null;
    return videoStatus.find((v: any) => v.id === generatingVideoId);
  }, [videoStatus, generatingVideoId]);

  // ─── BGM 재생 ───
  const toggleBgm = (bgmId: string, url: string) => {
    if (playingBgm === bgmId) {
      audioRef.current?.pause();
      setPlayingBgm(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(url);
      audio.volume = 0.5;
      audio.play().catch(() => {});
      audio.onended = () => setPlayingBgm(null);
      audioRef.current = audio;
      setPlayingBgm(bgmId);
    }
  };

  // cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  // ─── 사진 토글 ───
  const togglePhoto = (id: number) => {
    const newSet = new Set(selectedPhotos);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      if (newSet.size >= 10) {
        toast.error("최대 10장까지 선택 가능합니다");
        return;
      }
      newSet.add(id);
    }
    setSelectedPhotos(newSet);
  };

  // ─── AI 문구 생성 ───
  const handleGenerateText = () => {
    if (!groomName || !brideName || !weddingDate || !venue) {
      toast.error("이름, 날짜, 장소를 먼저 입력해주세요");
      return;
    }
    const styleName = STYLES.find(s => s.id === selectedStyle)?.label || selectedStyle;
    generateTextMutation.mutate({
      groomName,
      brideName,
      weddingDate,
      venue,
      style: styleName,
    });
  };

  // ─── 영상 생성 시작 ───
  const handleGenerate = () => {
    if (selectedPhotos.size < 1) {
      toast.error("사진을 1장 이상 선택해주세요");
      return;
    }
    // 첫 번째 선택된 사진으로 영상 생성
    const firstPhotoId = Array.from(selectedPhotos)[0];
    const firstPhoto = completedImages.find((g: any) => g.id === firstPhotoId);
    if (!firstPhoto) return;

    createVideoMutation.mutate({
      generationId: firstPhoto.id,
      projectId,
      sourceImageUrl: firstPhoto.resultImageUrl!,
      duration: 5,
      motionType: "cinematic",
      customPrompt: `${STYLES.find(s => s.id === selectedStyle)?.label || ""} 스타일 청첩장 영상. ${message || ""}`,
    });
  };

  // ─── 다음 단계 유효성 ───
  const canNext = () => {
    switch (step) {
      case 0: return !!selectedStyle;
      case 1: return !!groomName && !!brideName && !!weddingDate && !!venue;
      case 2: return selectedPhotos.size >= 1;
      case 3: return true; // BGM은 선택사항
      default: return true;
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* 헤더 */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/projects/${projectId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">청첩장 영상 만들기</h1>
            <p className="text-sm text-muted-foreground">{project?.title}</p>
          </div>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center gap-2">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  i === step
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : i < step
                    ? "bg-primary/20 text-primary cursor-pointer hover:bg-primary/30"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                <span className="hidden sm:inline">{label}</span>
              </button>
              {i < STEP_LABELS.length - 1 && (
                <div className={`w-8 h-0.5 ${i < step ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        {/* ═══════════════════════════════════════ */}
        {/* Step 1: 스타일 선택 */}
        {/* ═══════════════════════════════════════ */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">청첩장 스타일을 선택하세요</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id)}
                  className={`relative p-5 rounded-xl border-2 text-left transition-all ${
                    selectedStyle === style.id
                      ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                      : "border-border hover:border-primary/30 hover:bg-muted/50"
                  }`}
                >
                  <div className="text-3xl mb-2">{style.emoji}</div>
                  <div className="font-semibold text-foreground">{style.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{style.desc}</div>
                  {selectedStyle === style.id && (
                    <div className="absolute top-3 right-3">
                      <Check className="h-5 w-5 text-primary" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* Step 2: 정보 입력 */}
        {/* ═══════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-foreground">예식 정보를 입력하세요</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">신랑 이름</Label>
                <Input
                  placeholder="홍길동"
                  value={groomName}
                  onChange={(e) => setGroomName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">신부 이름</Label>
                <Input
                  placeholder="김영희"
                  value={brideName}
                  onChange={(e) => setBrideName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">예식 날짜</Label>
                <Input
                  type="date"
                  value={weddingDate}
                  onChange={(e) => setWeddingDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">예식 시간</Label>
                <Input
                  type="time"
                  value={weddingTime}
                  onChange={(e) => setWeddingTime(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-foreground">예식 장소</Label>
                <Input
                  placeholder="서울 강남구 더채플앳청담"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-foreground">청첩 문구</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={handleGenerateText}
                  disabled={generateTextMutation.isPending}
                >
                  {generateTextMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  AI 문구 자동생성
                </Button>
              </div>
              <Textarea
                placeholder="두 사람이 하나가 되는 날, 함께해 주세요..."
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            {/* AI 생성 문구 선택 */}
            {aiTexts.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">AI 추천 문구 (클릭하여 선택)</Label>
                <div className="space-y-2">
                  {aiTexts.map((text, i) => (
                    <button
                      key={i}
                      onClick={() => setMessage(text)}
                      className={`w-full text-left p-3 rounded-lg border text-sm transition-all ${
                        message === text
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border hover:border-primary/30 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-xs text-primary mr-2">#{i + 1}</span>
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* Step 3: 사진 선택 */}
        {/* ═══════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">사진을 선택하세요</h2>
              <Badge variant="secondary" className="gap-1">
                <ImageIcon className="h-3 w-3" />
                {selectedPhotos.size}장 선택됨
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">최소 1장, 최대 10장까지 선택할 수 있습니다.</p>

            {completedImages.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">완료된 이미지가 없습니다.</p>
                  <p className="text-sm text-muted-foreground mt-1">프로젝트에서 이미지를 먼저 생성해주세요.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {completedImages.map((img: any) => {
                  const isSelected = selectedPhotos.has(img.id);
                  return (
                    <button
                      key={img.id}
                      onClick={() => togglePhoto(img.id)}
                      className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all ${
                        isSelected
                          ? "border-primary shadow-lg shadow-primary/20 ring-2 ring-primary/30"
                          : "border-transparent hover:border-primary/30"
                      }`}
                    >
                      <img
                        src={img.resultImageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-5 w-5 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* Step 4: BGM 선택 */}
        {/* ═══════════════════════════════════════ */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">BGM을 선택하세요 (선택사항)</h2>
            <p className="text-sm text-muted-foreground">원하는 배경 음악을 선택하세요. 미리듣기 가능합니다.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BGM_LIST.map((bgm) => {
                const isSelected = selectedBgm === bgm.id;
                const isPlaying = playingBgm === bgm.id;
                return (
                  <button
                    key={bgm.id}
                    onClick={() => setSelectedBgm(bgm.id)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBgm(bgm.id, bgm.url);
                      }}
                      className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        isPlaying
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-primary/20"
                      }`}
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground">{bgm.label}</div>
                      <div className="text-xs text-muted-foreground">{bgm.genre}</div>
                    </div>
                    {isSelected && <Check className="h-5 w-5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* Step 5: 생성 및 결과 */}
        {/* ═══════════════════════════════════════ */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-foreground">청첩장 영상 생성</h2>

            {/* 요약 */}
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">스타일:</span>
                    <span className="ml-2 text-foreground font-medium">
                      {STYLES.find(s => s.id === selectedStyle)?.emoji} {STYLES.find(s => s.id === selectedStyle)?.label}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">신랑/신부:</span>
                    <span className="ml-2 text-foreground font-medium">{groomName} & {brideName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">예식일:</span>
                    <span className="ml-2 text-foreground font-medium">{weddingDate} {weddingTime}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">장소:</span>
                    <span className="ml-2 text-foreground font-medium">{venue}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">사진:</span>
                    <span className="ml-2 text-foreground font-medium">{selectedPhotos.size}장</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">BGM:</span>
                    <span className="ml-2 text-foreground font-medium">
                      {selectedBgm ? BGM_LIST.find(b => b.id === selectedBgm)?.label : "없음"}
                    </span>
                  </div>
                </div>
                {message && (
                  <div className="pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground">청첩 문구:</span>
                    <p className="text-sm text-foreground mt-1 italic">"{message}"</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 생성 버튼 또는 진행 상태 */}
            {!generatingVideoId ? (
              <Button
                className="w-full gap-2 h-12 text-base"
                onClick={handleGenerate}
                disabled={createVideoMutation.isPending}
              >
                {createVideoMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Film className="h-5 w-5" />
                )}
                🎬 영상 생성 시작
              </Button>
            ) : currentVideo?.status === "completed" && currentVideo?.videoUrl ? (
              <div className="space-y-4">
                <div className="rounded-xl overflow-hidden border border-border bg-black">
                  <video
                    src={currentVideo.videoUrl || undefined}
                    controls
                    className="w-full max-h-[500px]"
                    autoPlay
                    muted
                  />
                </div>
                <div className="flex gap-3">
                  <a
                    href={currentVideo.videoUrl || ""}
                    download="invitation-video.mp4"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button className="w-full gap-2" variant="outline">
                      <Download className="h-4 w-4" />
                      MP4 다운로드
                    </Button>
                  </a>
                </div>
              </div>
            ) : currentVideo?.status === "failed" ? (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-5 text-center">
                  <p className="text-destructive font-medium">영상 생성에 실패했습니다</p>
                  <p className="text-sm text-muted-foreground mt-1">다시 시도해주세요</p>
                  <Button
                    className="mt-4 gap-2"
                    onClick={() => {
                      setGeneratingVideoId(null);
                      handleGenerate();
                    }}
                  >
                    <Film className="h-4 w-4" />
                    다시 생성
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-foreground font-medium">영상을 생성하고 있습니다...</p>
                  <p className="text-sm text-muted-foreground mt-1">약 1~3분 소요됩니다. 이 페이지를 떠나도 됩니다.</p>
                  <div className="mt-4 w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: "60%" }} />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* 네비게이션 버튼 */}
        {step < 4 || (!generatingVideoId && step === 4) ? (
          <div className="flex justify-between pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              이전
            </Button>
            {step < 4 && (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canNext()}
                className="gap-1.5"
              >
                다음
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
