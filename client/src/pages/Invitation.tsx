import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Film,
  Heart,
  Sparkles,
  Camera,
  Music,
  Download,
  Link2,
  Play,
  Pause,
  Loader2,
  ChevronLeft,
} from "lucide-react";

// ─── 스타일 정의 ───
const STYLES = [
  {
    id: "cinematic",
    emoji: "🎬",
    name: "시네마틱 무비",
    desc: "드라마틱 전환, 웅장한 BGM",
    gradient: "from-slate-900 to-slate-700",
    border: "border-slate-500",
  },
  {
    id: "romantic",
    emoji: "🌸",
    name: "로맨틱 클래식",
    desc: "페이드 효과, 피아노 BGM",
    gradient: "from-pink-900 to-rose-700",
    border: "border-pink-500",
  },
  {
    id: "modern",
    emoji: "✨",
    name: "모던 미니멀",
    desc: "깔끔한 슬라이드, 잔잔한 BGM",
    gradient: "from-zinc-900 to-zinc-700",
    border: "border-zinc-400",
  },
  {
    id: "film",
    emoji: "📷",
    name: "필름 감성",
    desc: "grain 효과, 어쿠스틱 BGM",
    gradient: "from-amber-900 to-yellow-800",
    border: "border-amber-500",
  },
  {
    id: "luxury",
    emoji: "💫",
    name: "럭셔리 골드",
    desc: "골드 파티클, 금색 폰트",
    gradient: "from-yellow-900 to-amber-700",
    border: "border-yellow-400",
  },
];

// ─── BGM 목록 (Pixabay 무료 음원) ───
const BGM_LIST = [
  { id: "bgm1", name: "Wedding March", genre: "클래식", url: "https://cdn.pixabay.com/audio/2022/02/22/audio_d1718ab41b.mp3" },
  { id: "bgm2", name: "Romantic Piano", genre: "피아노", url: "https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3" },
  { id: "bgm3", name: "Acoustic Love", genre: "어쿠스틱", url: "https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3" },
  { id: "bgm4", name: "Cinematic Dream", genre: "시네마틱", url: "https://cdn.pixabay.com/audio/2022/03/15/audio_115b9b3c26.mp3" },
  { id: "bgm5", name: "Gentle Strings", genre: "오케스트라", url: "https://cdn.pixabay.com/audio/2021/11/25/audio_91b32e02f9.mp3" },
  { id: "bgm6", name: "Soft Guitar", genre: "기타", url: "https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c21.mp3" },
  { id: "bgm7", name: "Jazz Waltz", genre: "재즈", url: "https://cdn.pixabay.com/audio/2022/10/25/audio_3712e6a20a.mp3" },
  { id: "bgm8", name: "Ethereal Bells", genre: "앰비언트", url: "https://cdn.pixabay.com/audio/2022/01/20/audio_d16737dc28.mp3" },
  { id: "bgm9", name: "Happy Ukulele", genre: "우쿨렐레", url: "https://cdn.pixabay.com/audio/2022/03/10/audio_370ed0e4b8.mp3" },
  { id: "bgm10", name: "Emotional Cello", genre: "첼로", url: "https://cdn.pixabay.com/audio/2022/09/07/audio_dc39bde9c0.mp3" },
];

// ─── 스텝 정의 ───
const STEPS = [
  { id: 1, label: "스타일 선택", icon: Sparkles },
  { id: 2, label: "정보 입력", icon: Heart },
  { id: 3, label: "사진 선택", icon: Camera },
  { id: 4, label: "BGM 선택", icon: Music },
  { id: 5, label: "생성 결과", icon: Film },
];

export default function InvitationPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params.projectId);
  const [, setLocation] = useLocation();

  // ─── 스텝 상태 ───
  const [currentStep, setCurrentStep] = useState(1);

  // ─── Step 1: 스타일 ───
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);

  // ─── Step 2: 정보 입력 ───
  const [groomName, setGroomName] = useState("");
  const [brideName, setBrideName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [weddingTime, setWeddingTime] = useState("");
  const [venue, setVenue] = useState("");
  const [invitationText, setInvitationText] = useState("");
  const [aiTexts, setAiTexts] = useState<string[]>([]);
  const [selectedAiText, setSelectedAiText] = useState<number | null>(null);

  // ─── Step 3: 사진 선택 ───
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set());

  // ─── Step 4: BGM ───
  const [selectedBgm, setSelectedBgm] = useState<string | null>(null);
  const [playingBgm, setPlayingBgm] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ─── Step 5: 생성 ───
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [generatedVideoId, setGeneratedVideoId] = useState<number | null>(null);

  // ─── 데이터 로드 ───
  const { data: project } = trpc.projects.getById.useQuery({ id: projectId });
  const { data: generations } = trpc.generations.list.useQuery({ projectId });

  const completedImages = (generations || []).filter(
    (g: any) => g.status === "completed" && g.resultImageUrl
  );

  // ─── AI 문구 생성 ───
  const generateTextMutation = trpc.invitations.generateText.useMutation({
    onSuccess: (data) => {
      setAiTexts(data.texts);
      toast.success("AI 문구 3가지가 생성되었습니다!");
    },
    onError: () => {
      toast.error("AI 문구 생성에 실패했습니다.");
    },
  });

  // ─── 영상 생성 ───
  const createVideoMutation = trpc.videos.create.useMutation({
    onSuccess: (data) => {
      setGeneratedVideoId(data.id);
      startPolling(data.id);
    },
    onError: () => {
      setIsGenerating(false);
      toast.error("영상 생성에 실패했습니다.");
    },
  });

  // ─── 영상 상태 폴링 ───
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { data: videoList, refetch: refetchVideos } = trpc.videos.list.useQuery(
    { projectId },
    { enabled: !!generatedVideoId }
  );

  const startPolling = useCallback((videoId: number) => {
    let progress = 10;
    pollingRef.current = setInterval(async () => {
      progress = Math.min(progress + Math.random() * 8, 95);
      setGenerationProgress(progress);
      
      const result = await refetchVideos();
      const video = result.data?.find((v: any) => v.id === videoId);
      if (video) {
        if (video.status === "completed" && video.videoUrl) {
          setGeneratedVideoUrl(video.videoUrl);
          setGenerationProgress(100);
          setIsGenerating(false);
          if (pollingRef.current) clearInterval(pollingRef.current);
          toast.success("청첩장 영상이 완성되었습니다!");
        } else if (video.status === "failed") {
          setIsGenerating(false);
          if (pollingRef.current) clearInterval(pollingRef.current);
          toast.error(`영상 생성 실패: ${video.errorMessage || "알 수 없는 오류"}`);
        }
      }
    }, 3000);
  }, [refetchVideos]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // ─── BGM 미리듣기 ───
  const toggleBgmPreview = (bgmId: string, url: string) => {
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

  // ─── 사진 토글 ───
  const togglePhoto = (id: number) => {
    setSelectedPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 10) {
          toast.error("최대 10장까지 선택할 수 있습니다.");
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  // ─── AI 문구 생성 핸들러 ───
  const handleGenerateAiText = () => {
    if (!groomName || !brideName || !weddingDate || !venue) {
      toast.error("신랑/신부 이름, 예식 날짜, 장소를 먼저 입력해주세요.");
      return;
    }
    generateTextMutation.mutate({
      groomName,
      brideName,
      weddingDate,
      venue,
      style: selectedStyle || "romantic",
    });
  };

  // ─── 영상 생성 시작 ───
  const handleStartGeneration = () => {
    if (selectedPhotos.size < 6) {
      toast.error("최소 6장의 사진을 선택해주세요.");
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(5);

    // 첫 번째 선택된 사진으로 영상 생성
    const firstPhotoId = Array.from(selectedPhotos)[0];
    const firstPhoto = completedImages.find((g: any) => g.id === firstPhotoId);
    if (!firstPhoto) {
      toast.error("선택된 사진을 찾을 수 없습니다.");
      setIsGenerating(false);
      return;
    }

    const stylePrompts: Record<string, string> = {
      cinematic: "cinematic wedding invitation video, dramatic transitions, epic orchestral mood",
      romantic: "romantic classic wedding invitation, soft fade transitions, piano melody mood",
      modern: "modern minimalist wedding invitation, clean slide transitions, calm ambient mood",
      film: "film grain wedding invitation, vintage film look, acoustic guitar mood",
      luxury: "luxury gold wedding invitation, gold particle effects, elegant orchestral mood",
    };

    createVideoMutation.mutate({
      generationId: firstPhoto.id,
      projectId,
      sourceImageUrl: firstPhoto.resultImageUrl!,
      duration: 10,
      motionType: "cinematic",
      customPrompt: `${stylePrompts[selectedStyle || "romantic"]}. Wedding invitation for ${groomName} and ${brideName}. ${invitationText}`,
    });
  };

  // ─── 스텝 유효성 검사 ───
  const canProceed = () => {
    switch (currentStep) {
      case 1: return !!selectedStyle;
      case 2: return !!groomName && !!brideName && !!weddingDate && !!venue;
      case 3: return selectedPhotos.size >= 6;
      case 4: return !!selectedBgm;
      default: return true;
    }
  };

  const nextStep = () => {
    if (canProceed() && currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation(`/projects/${projectId}`)}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">📩 모바일 청첩장 만들기</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {project?.title || "프로젝트"} - AI 청첩장 영상 제작
            </p>
          </div>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((step, idx) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isCompleted
                        ? "bg-green-600 text-white"
                        : isActive
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <StepIcon className="w-5 h-5" />
                    )}
                  </div>
                  <span
                    className={`text-xs mt-1.5 font-medium ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 mt-[-18px] ${
                      currentStep > step.id ? "bg-green-600" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* ─── Step 1: 스타일 선택 ─── */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">청첩장 스타일을 선택해주세요</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {STYLES.map((style) => (
                <Card
                  key={style.id}
                  className={`cursor-pointer transition-all hover:scale-[1.02] ${
                    selectedStyle === style.id
                      ? `ring-2 ring-primary ${style.border}`
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                  onClick={() => setSelectedStyle(style.id)}
                >
                  <CardContent className="p-5">
                    <div
                      className={`w-full h-24 rounded-lg bg-gradient-to-br ${style.gradient} flex items-center justify-center mb-3`}
                    >
                      <span className="text-4xl">{style.emoji}</span>
                    </div>
                    <h3 className="font-semibold text-base">{style.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{style.desc}</p>
                    {selectedStyle === style.id && (
                      <div className="mt-2 flex items-center gap-1 text-primary text-sm font-medium">
                        <Check className="w-4 h-4" /> 선택됨
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ─── Step 2: 정보 입력 ─── */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">예식 정보를 입력해주세요</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>신랑 이름</Label>
                <Input
                  placeholder="홍길동"
                  value={groomName}
                  onChange={(e) => setGroomName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>신부 이름</Label>
                <Input
                  placeholder="김영희"
                  value={brideName}
                  onChange={(e) => setBrideName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>예식 날짜</Label>
                <Input
                  type="date"
                  value={weddingDate}
                  onChange={(e) => setWeddingDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>예식 시간</Label>
                <Input
                  placeholder="오후 2시"
                  value={weddingTime}
                  onChange={(e) => setWeddingTime(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>예식 장소</Label>
                <Input
                  placeholder="서울 강남 XX웨딩홀"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>청첩 문구</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateAiText}
                  disabled={generateTextMutation.isPending}
                  className="gap-1.5"
                >
                  {generateTextMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  AI 문구 자동생성
                </Button>
              </div>
              <Textarea
                placeholder="두 사람이 하나가 되는 날, 함께해 주세요..."
                rows={3}
                value={invitationText}
                onChange={(e) => setInvitationText(e.target.value)}
              />
            </div>

            {/* AI 생성 문구 선택 */}
            {aiTexts.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm text-muted-foreground">
                  AI가 생성한 문구 중 하나를 선택하세요
                </Label>
                {aiTexts.map((text, idx) => (
                  <Card
                    key={idx}
                    className={`cursor-pointer transition-all ${
                      selectedAiText === idx
                        ? "ring-2 ring-primary border-primary"
                        : "hover:border-muted-foreground/50"
                    }`}
                    onClick={() => {
                      setSelectedAiText(idx);
                      setInvitationText(text);
                    }}
                  >
                    <CardContent className="p-4 flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          selectedAiText === idx
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {selectedAiText === idx && (
                          <Check className="w-3 h-3 text-primary-foreground" />
                        )}
                      </div>
                      <p className="text-sm leading-relaxed">{text}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Step 3: 사진 선택 ─── */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">사진을 선택해주세요</h2>
              <span
                className={`text-sm font-medium px-3 py-1 rounded-full ${
                  selectedPhotos.size >= 6
                    ? "bg-green-600/20 text-green-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {selectedPhotos.size}장 선택됨 (6~10장)
              </span>
            </div>

            {completedImages.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>완료된 이미지가 없습니다.</p>
                  <p className="text-sm mt-1">
                    프로젝트 워크스페이스에서 이미지를 먼저 생성해주세요.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {completedImages.map((gen: any) => {
                  const isSelected = selectedPhotos.has(gen.id);
                  return (
                    <div
                      key={gen.id}
                      className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-transparent hover:border-muted-foreground/30"
                      }`}
                      onClick={() => togglePhoto(gen.id)}
                    >
                      <img
                        src={gen.resultImageUrl}
                        alt=""
                        className="w-full aspect-square object-cover"
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-primary-foreground" />
                        </div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <p className="text-xs text-white truncate">
                          {gen.promptText?.slice(0, 30) || "이미지"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── Step 4: BGM 선택 ─── */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">배경 음악을 선택해주세요</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BGM_LIST.map((bgm) => {
                const isSelected = selectedBgm === bgm.id;
                const isPlaying = playingBgm === bgm.id;
                return (
                  <Card
                    key={bgm.id}
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? "ring-2 ring-primary border-primary"
                        : "hover:border-muted-foreground/50"
                    }`}
                    onClick={() => setSelectedBgm(bgm.id)}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Music className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{bgm.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {bgm.genre}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBgmPreview(bgm.id, bgm.url);
                        }}
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="w-3.5 h-3.5" /> 정지
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" /> 미리듣기
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Step 5: 생성 결과 ─── */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">청첩장 영상 생성</h2>

            {/* 요약 카드 */}
            <Card>
              <CardContent className="p-5 space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground">
                  제작 요약
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">스타일:</span>{" "}
                    <span className="font-medium">
                      {STYLES.find((s) => s.id === selectedStyle)?.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">신랑/신부:</span>{" "}
                    <span className="font-medium">
                      {groomName} & {brideName}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">예식일:</span>{" "}
                    <span className="font-medium">
                      {weddingDate} {weddingTime}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">장소:</span>{" "}
                    <span className="font-medium">{venue}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">사진:</span>{" "}
                    <span className="font-medium">{selectedPhotos.size}장</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">BGM:</span>{" "}
                    <span className="font-medium">
                      {BGM_LIST.find((b) => b.id === selectedBgm)?.name}
                    </span>
                  </div>
                </div>
                {invitationText && (
                  <div className="pt-2 border-t border-border">
                    <span className="text-sm text-muted-foreground">
                      청첩 문구:
                    </span>
                    <p className="text-sm mt-1 italic">"{invitationText}"</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 생성 버튼 / 진행바 */}
            {!generatedVideoUrl && !isGenerating && (
              <Button
                size="lg"
                className="w-full gap-2 h-14 text-base"
                onClick={handleStartGeneration}
              >
                <Film className="w-5 h-5" />
                🎬 영상 생성 시작
              </Button>
            )}

            {isGenerating && (
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="font-medium">
                      Kling AI로 청첩장 영상을 생성하고 있습니다...
                    </span>
                  </div>
                  <Progress value={generationProgress} className="h-2" />
                  <p className="text-sm text-muted-foreground">
                    {generationProgress < 30
                      ? "이미지를 분석하고 있습니다..."
                      : generationProgress < 60
                      ? "영상 프레임을 생성하고 있습니다..."
                      : generationProgress < 90
                      ? "효과와 전환을 적용하고 있습니다..."
                      : "최종 렌더링 중..."}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* 완료 결과 */}
            {generatedVideoUrl && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-0 overflow-hidden rounded-lg">
                    <video
                      src={generatedVideoUrl}
                      controls
                      className="w-full max-h-[500px] bg-black"
                      poster={
                        completedImages[0]?.resultImageUrl || undefined
                      }
                    />
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Button
                    variant="default"
                    className="gap-2 h-12"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = generatedVideoUrl;
                      a.download = `wedding_invitation_${groomName}_${brideName}.mp4`;
                      a.click();
                    }}
                  >
                    <Download className="w-4 h-4" />
                    MP4 다운로드
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 h-12"
                    onClick={() => {
                      toast.success("고객 전달 링크에 추가되었습니다!");
                    }}
                  >
                    <Link2 className="w-4 h-4" />
                    고객 링크에 추가
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 h-12"
                    onClick={() => {
                      setGeneratedVideoUrl(null);
                      setGeneratedVideoId(null);
                      setIsGenerating(false);
                      setGenerationProgress(0);
                    }}
                  >
                    <Film className="w-4 h-4" />
                    다시 만들기
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── 네비게이션 버튼 ─── */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" /> 이전
          </Button>

          {currentStep < 5 ? (
            <Button
              onClick={nextStep}
              disabled={!canProceed()}
              className="gap-1.5"
            >
              다음 <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setLocation(`/projects/${projectId}`)}
              className="gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" /> 프로젝트로 돌아가기
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
