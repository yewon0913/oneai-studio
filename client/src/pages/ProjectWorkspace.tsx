import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useState, useMemo, useRef } from "react";
import {
  ArrowLeft, Sparkles, Wand2, Download, Check, X,
  RotateCcw, ArrowUpCircle, Loader2, ImageIcon, Lock, Unlock,
  Package, Users, UserCircle, Video, Trash2, Link2, Image as ImageLucide,
  Upload, Brain, ArrowRight, Plus, Eye, Play, RefreshCw, Zap
} from "lucide-react";
import { toast } from "sonner";
import AIEngineSelector from "@/components/AIEngineSelector";
import type { AIEngineId } from "../../../shared/aiEngines";

const statusLabels: Record<string, string> = {
  draft: "초안", generating: "생성중", review: "검수중", revision: "수정중",
  upscaling: "업스케일링", completed: "완료", delivered: "전달완료",
};

const referenceModeLabels: Record<string, { label: string; desc: string }> = {
  background_composite: { label: "배경 합성", desc: "참조 이미지의 배경에 고객 얼굴을 합성합니다" },
  style_transfer: { label: "스타일 참조", desc: "참조 이미지의 스타일/분위기를 따라합니다" },
  face_swap: { label: "얼굴 교체", desc: "참조 이미지의 인물 얼굴을 고객 얼굴로 교체합니다" },
  direct_apply: { label: "원본 직접 적용", desc: "참조 이미지를 프롬프트 변환 없이 originalImages로 직접 전달합니다" },
};

const motionTypes = [
  { value: "cinematic", label: "시네마틱" },
  { value: "zoom_in", label: "줌 인" },
  { value: "zoom_out", label: "줌 아웃" },
  { value: "pan_left", label: "좌측 패닝" },
  { value: "pan_right", label: "우측 패닝" },
  { value: "slow_zoom", label: "슬로우 줌" },
];

export default function ProjectWorkspace() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const [promptText, setPromptText] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("(deformed, distorted, disfigured:1.3), poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, (mutated hands and fingers:1.4), disconnected limbs, mutation, mutated, ugly, disgusting, blurry, amputation, plastic skin, cartoon, anime");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [referenceMode, setReferenceMode] = useState<"background_composite" | "style_transfer" | "face_swap" | "direct_apply">("background_composite");
  const [selectedGenId, setSelectedGenId] = useState<number | null>(null);
  const [faceFixMode, setFaceFixMode] = useState(true);
  const [merchandiseFormat, setMerchandiseFormat] = useState<string>("");
  const [videoMotion, setVideoMotion] = useState("cinematic");
  const [videoDuration, setVideoDuration] = useState(5);
  const [videoCustomPrompt, setVideoCustomPrompt] = useState("");

  // 참조 이미지 다중 첨부
  const [refImages, setRefImages] = useState<Array<{ url: string; preview: string; file?: File }>>([]);
  const [aiPromptResult, setAiPromptResult] = useState<string>("");
  const refFileInputRef = useRef<HTMLInputElement>(null);

  // 영상 재생성 다이얼로그
  const [regenVideoId, setRegenVideoId] = useState<number | null>(null);
  const [regenPrompt, setRegenPrompt] = useState("");
  const [regenMotion, setRegenMotion] = useState("cinematic");

  // 멀티 AI 엔진 선택
  const [selectedEngines, setSelectedEngines] = useState<AIEngineId[]>(["flux_lora", "midjourney_omniref"]);
  const handleToggleEngine = (engineId: AIEngineId) => {
    setSelectedEngines(prev =>
      prev.includes(engineId)
        ? prev.filter(id => id !== engineId)
        : [...prev, engineId]
    );
  };

  const utils = trpc.useUtils();
  const { data: project, isLoading } = trpc.projects.getById.useQuery({ id: projectId });
  const { data: generations } = trpc.generations.list.useQuery({ projectId });
  const { data: formats } = trpc.generations.merchandiseFormats.useQuery();
  const { data: clientPhotos } = trpc.clientPhotos.list.useQuery(
    { clientId: project?.clientId || 0 },
    { enabled: !!project?.clientId }
  );
  const { data: client } = trpc.clients.getById.useQuery(
    { id: project?.clientId || 0 },
    { enabled: !!project?.clientId }
  );
  const { data: videos } = trpc.videos.list.useQuery({ projectId }, {
    refetchInterval: (query) => {
      // 처리중인 영상이 있으면 5초마다 자동 새로고침
      const data = query.state.data;
      if (data && Array.isArray(data) && data.some((v: any) => v.status === "processing" || v.status === "queued")) {
        return 5000;
      }
      return false;
    },
  });

  const generateMutation = trpc.generations.generate.useMutation({
    onSuccess: (data) => {
      utils.generations.list.invalidate();
      utils.projects.getById.invalidate();
      setSelectedGenId(data.id);
      toast.success(`이미지 생성 완료! (${(data.generationTimeMs / 1000).toFixed(1)}초)`);
    },
    onError: (err) => toast.error(`생성 실패: ${err.message}`),
  });

  const upscaleMutation = trpc.generations.upscale.useMutation({
    onSuccess: () => {
      utils.generations.list.invalidate();
      toast.success("업스케일링이 완료되었습니다!");
    },
    onError: (err) => toast.error(`업스케일링 실패: ${err.message}`),
  });

  const updateStatus = trpc.generations.updateStatus.useMutation({
    onSuccess: () => {
      utils.generations.list.invalidate();
      toast.success("상태가 업데이트되었습니다.");
    },
  });

  const deleteGenMutation = trpc.generations.delete.useMutation({
    onSuccess: () => {
      utils.generations.list.invalidate();
      setSelectedGenId(null);
      toast.success("이미지가 삭제되었습니다.");
    },
    onError: (err) => toast.error(`삭제 실패: ${err.message}`),
  });

  const createVideoMutation = trpc.videos.create.useMutation({
    onSuccess: () => {
      utils.videos.list.invalidate();
      toast.success("영상 변환이 시작되었습니다. 완료까지 30초~1분 소요됩니다.");
    },
    onError: (err) => toast.error(`영상 변환 실패: ${err.message}`),
  });

  const regenVideoMutation = trpc.videos.regenerate.useMutation({
    onSuccess: () => {
      utils.videos.list.invalidate();
      setRegenVideoId(null);
      setRegenPrompt("");
      toast.success("영상 재생성이 시작되었습니다.");
    },
    onError: (err) => toast.error(`영상 재생성 실패: ${err.message}`),
  });

  // AI Vision 프롬프트 자동 생성
  const analyzeImagesMutation = trpc.generations.analyzeReferenceImages.useMutation({
    onSuccess: (data) => {
      setAiPromptResult(data.prompt);
      if (data.negativePrompt) setNegativePrompt(data.negativePrompt);
      toast.success(`AI가 ${data.imageCount}장의 이미지를 분석하여 프롬프트를 생성했습니다.`);
    },
    onError: (err) => toast.error(`AI 분석 실패: ${err.message}`),
  });

  // 참조 이미지 파일 업로드 (S3)
  const uploadRefImage = trpc.clientPhotos.upload.useMutation();

  const selectedGen = useMemo(() => generations?.find(g => g.id === selectedGenId), [generations, selectedGenId]);
  const frontPhoto = useMemo(() => clientPhotos?.find(p => p.photoType === "front"), [clientPhotos]);
  const hasFaceRef = !!frontPhoto;

  const formatCategories = useMemo(() => {
    if (!formats) return {};
    const cats: Record<string, typeof formats> = {};
    for (const f of formats) {
      if (!cats[f.category]) cats[f.category] = [];
      cats[f.category].push(f);
    }
    return cats;
  }, [formats]);

  const categoryLabels: Record<string, string> = {
    acrylic: "아크릴 액자", tshirt: "티셔츠", mug: "머그컵", towel: "수건",
    "3d": "3D 프린팅", canvas: "캔버스", digital: "디지털",
  };

  // 참조 이미지 파일 선택 핸들러
  const handleRefFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name}은 이미지 파일이 아닙니다.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}은 10MB를 초과합니다.`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        
        try {
          const result = await uploadRefImage.mutateAsync({
            clientId: project?.clientId || 0,
            photoType: "additional" as const,
            fileName: file.name,
            mimeType: file.type,
            base64Data: base64.split(",")[1],
          });
          
          setRefImages(prev => [...prev, {
            url: (result as any).originalUrl || base64,
            preview: base64,
            file,
          }]);
          toast.success(`${file.name} 업로드 완료`);
        } catch {
          setRefImages(prev => [...prev, {
            url: base64,
            preview: base64,
            file,
          }]);
        }
      };
      reader.readAsDataURL(file);
    }
    
    if (refFileInputRef.current) refFileInputRef.current.value = "";
  };

  // 참조 이미지 URL 추가
  const handleAddRefUrl = () => {
    const url = referenceUrl.trim();
    if (!url) return;
    setRefImages(prev => [...prev, { url, preview: url }]);
    setReferenceUrl("");
    toast.success("참조 이미지 URL이 추가되었습니다.");
  };

  // 참조 이미지 삭제
  const handleRemoveRefImage = (index: number) => {
    setRefImages(prev => prev.filter((_, i) => i !== index));
  };

  // AI 프롬프트 생성
  const handleAnalyzeImages = () => {
    if (refImages.length === 0) {
      toast.error("분석할 참조 이미지를 먼저 첨부해주세요.");
      return;
    }
    const urls = refImages.map(img => img.url);
    analyzeImagesMutation.mutate({
      imageUrls: urls,
      category: project?.category as any,
      gender: client?.gender as any,
      isCouple: project?.projectMode === "couple",
    });
  };

  // AI 프롬프트를 메인 프롬프트에 삽입
  const handleInsertAiPrompt = () => {
    setPromptText(aiPromptResult);
    toast.success("AI 생성 프롬프트가 메인 프롬프트에 삽입되었습니다.");
  };

  const handleGenerate = () => {
    if (!promptText.trim() && !referenceUrl.trim() && refImages.length === 0) {
      toast.error("프롬프트 또는 참조 이미지 중 하나는 입력해주세요.");
      return;
    }
    if (faceFixMode && !hasFaceRef) {
      toast.error("얼굴 고정 모드를 사용하려면 고객 정면 사진이 필요합니다.");
      return;
    }
    const refUrl = refImages.length > 0 ? refImages[0].url : (referenceUrl.trim() || undefined);
    
    // direct_apply 모드에서는 referenceMode를 face_swap으로 전달하되, 프롬프트를 최소화
    const effectiveMode = referenceMode === "direct_apply" ? "face_swap" : referenceMode;
    
    generateMutation.mutate({
      projectId,
      promptText: referenceMode === "direct_apply" 
        ? (promptText.trim() || "Reproduce this exact image with the provided face. Keep everything identical.")
        : (promptText.trim() || undefined),
      negativePrompt: negativePrompt.trim() || undefined,
      referenceImageUrl: refUrl,
      faceFixMode,
      merchandiseFormat: merchandiseFormat && merchandiseFormat !== "none" ? merchandiseFormat : undefined,
      referenceMode: refUrl ? effectiveMode : undefined,
    });
  };

  const handleCreateVideo = () => {
    if (!selectedGen?.resultImageUrl) {
      toast.error("영상으로 변환할 이미지를 선택해주세요.");
      return;
    }
    createVideoMutation.mutate({
      generationId: selectedGen.id,
      projectId,
      sourceImageUrl: selectedGen.upscaledImageUrl || selectedGen.resultImageUrl,
      duration: videoDuration,
      motionType: videoMotion as any,
      customPrompt: videoCustomPrompt.trim() || undefined,
    });
  };

  const handleRegenVideo = () => {
    if (!regenVideoId || !regenPrompt.trim()) {
      toast.error("재생성할 프롬프트를 입력해주세요.");
      return;
    }
    regenVideoMutation.mutate({
      videoId: regenVideoId,
      customPrompt: regenPrompt.trim(),
      motionType: regenMotion as any,
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-muted-foreground">프로젝트를 찾을 수 없습니다.</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/projects")}>프로젝트 목록으로</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/projects")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{project.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{project.category}</Badge>
              <Badge variant="outline">{statusLabels[project.status] || project.status}</Badge>
              {project.projectMode === "couple" && (
                <Badge variant="outline" className="bg-pink-500/20 text-pink-400 border-pink-500/30 gap-1">
                  <Users className="h-3 w-3" />커플
                </Badge>
              )}
              {project.concept && <span className="text-sm text-muted-foreground">{project.concept}</span>}
            </div>
          </div>
          {client && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${client.gender === "male" ? "bg-blue-500/20" : "bg-pink-500/20"}`}>
                <UserCircle className={`h-4 w-4 ${client.gender === "male" ? "text-blue-400" : "text-pink-400"}`} />
              </div>
              <span>{client.name}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Prompt & Controls */}
          <div className="lg:col-span-1 space-y-4">
            {/* 얼굴 참조 상태 */}
            <Card className={`border ${hasFaceRef ? "bg-green-500/5 border-green-500/20" : "bg-amber-500/5 border-amber-500/20"}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {frontPhoto ? (
                    <img src={frontPhoto.originalUrl} alt="얼굴 참조" className="w-12 h-12 rounded-lg object-cover border border-border" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center border border-border">
                      <UserCircle className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {hasFaceRef ? "얼굴 참조 사진 준비됨" : "얼굴 참조 사진 없음"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {hasFaceRef 
                        ? `${clientPhotos?.length || 0}장의 참조 사진이 등록되어 있습니다`
                        : "고객 프로필에서 정면 사진을 업로드해주세요"
                      }
                    </p>
                  </div>
                  {hasFaceRef && <Check className="h-5 w-5 text-green-500" />}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  이미지 생성 설정
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ═══ 참조 이미지 다중 첨부 ═══ */}
                <div className="space-y-3">
                  <Label className="text-foreground text-sm flex items-center gap-2">
                    <ImageLucide className="h-3.5 w-3.5 text-primary" />
                    참조 이미지 첨부
                    <span className="text-xs text-muted-foreground">(최대 10장)</span>
                  </Label>

                  {refImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {refImages.map((img, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                          <img 
                            src={img.preview.startsWith("data:") ? img.preview : img.url} 
                            alt={`참조 ${idx + 1}`} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23333' width='100' height='100'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='%23999' font-size='12'%3EURL%3C/text%3E%3C/svg%3E";
                            }}
                          />
                          <button
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600/90 hover:bg-red-600 flex items-center justify-center shadow-lg z-10"
                            onClick={() => handleRemoveRefImage(idx)}
                          >
                            <X className="h-3 w-3 text-white" />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                            <p className="text-[9px] text-white/80 truncate">{idx + 1}번</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      ref={refFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleRefFileSelect}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={() => refFileInputRef.current?.click()}
                      disabled={refImages.length >= 10}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      파일 첨부
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="핀터레스트 URL 또는 이미지 URL..."
                      value={referenceUrl}
                      onChange={(e) => setReferenceUrl(e.target.value)}
                      className="text-xs flex-1"
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddRefUrl(); }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddRefUrl}
                      disabled={!referenceUrl.trim() || refImages.length >= 10}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    핀터레스트 링크, 직접 이미지 URL, 또는 파일을 첨부하세요.
                  </p>
                </div>

                {/* ═══ AI 프롬프트 자동 생성 ═══ */}
                {refImages.length > 0 && referenceMode !== "direct_apply" && (
                  <div className="space-y-2 p-3 rounded-lg bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20">
                    <div className="flex items-center justify-between">
                      <Label className="text-foreground text-sm flex items-center gap-2">
                        <Brain className="h-3.5 w-3.5 text-purple-400" />
                        AI 프롬프트 자동 생성
                      </Label>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs border-purple-500/30 hover:bg-purple-500/10"
                        onClick={handleAnalyzeImages}
                        disabled={analyzeImagesMutation.isPending}
                      >
                        {analyzeImagesMutation.isPending ? (
                          <><Loader2 className="h-3 w-3 animate-spin" />분석 중...</>
                        ) : (
                          <><Eye className="h-3 w-3" />이미지 분석</>
                        )}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      AI Vision이 첨부된 이미지를 분석하여 동일한 장면, 구도, 조명, 스타일을 재현하는 프롬프트를 자동 생성합니다.
                    </p>

                    {aiPromptResult && (
                      <div className="space-y-2 mt-2">
                        <div className="p-2 rounded bg-black/20 border border-border">
                          <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">{aiPromptResult}</p>
                        </div>
                        <Button
                          size="sm"
                          className="w-full gap-1.5 bg-purple-600 hover:bg-purple-700 text-xs"
                          onClick={handleInsertAiPrompt}
                        >
                          <ArrowRight className="h-3 w-3" />
                          메인 프롬프트에 삽입
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* 원본 직접 적용 모드 안내 */}
                {referenceMode === "direct_apply" && refImages.length > 0 && (
                  <div className="p-3 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="h-3.5 w-3.5 text-green-400" />
                      <Label className="text-foreground text-sm font-medium">원본 직접 적용 모드</Label>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      참조 이미지가 프롬프트 변환 없이 AI에 직접 전달됩니다. 고객 얼굴과 참조 이미지를 최대한 동일하게 합성합니다.
                    </p>
                  </div>
                )}

                {/* 메인 프롬프트 */}
                <div className="space-y-2">
                  <Label className="text-foreground text-sm">
                    메인 프롬프트 <span className="text-muted-foreground text-xs">(참조 이미지 사용 시 선택사항)</span>
                  </Label>
                  <Textarea
                    placeholder="유럽 정원에서 웨딩 드레스를 입은 로맨틱한 웨딩 사진, 골든아워 조명..."
                    rows={4}
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground text-sm">네거티브 프롬프트</Label>
                  <Textarea
                    rows={2}
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    className="text-sm text-muted-foreground"
                  />
                </div>

                {/* 참조 모드 선택 (참조 이미지가 있을 때만) */}
                {refImages.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-foreground text-sm flex items-center gap-2">
                      <ImageLucide className="h-3.5 w-3.5" />
                      참조 모드
                    </Label>
                    <div className="grid grid-cols-1 gap-2">
                      {(Object.entries(referenceModeLabels) as [string, { label: string; desc: string }][]).map(([key, { label, desc }]) => (
                        <button
                          key={key}
                          onClick={() => setReferenceMode(key as any)}
                          className={`text-left p-3 rounded-lg border transition-all ${
                            referenceMode === key 
                              ? "border-primary bg-primary/10 ring-1 ring-primary/30" 
                              : "border-border bg-secondary/30 hover:border-primary/30"
                          }`}
                        >
                          <p className="text-sm font-medium text-foreground">{label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 얼굴 고정 모드 */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                  <div className="flex items-center gap-2">
                    {faceFixMode ? <Lock className="h-4 w-4 text-green-500" /> : <Unlock className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <p className="text-sm font-medium text-foreground">얼굴 고정 모드</p>
                      <p className="text-xs text-muted-foreground">
                        {faceFixMode ? "고객 얼굴을 최대한 동일하게 합성 (100% 목표)" : "얼굴 참조 없이 생성"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setFaceFixMode(!faceFixMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${faceFixMode ? "bg-green-600" : "bg-gray-600"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${faceFixMode ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>

                {/* 멀티 AI 엔진 일관성 전략 */}
                {faceFixMode && (
                  <div className="p-3 rounded-lg bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/20">
                    <AIEngineSelector
                      selectedEngines={selectedEngines}
                      onToggleEngine={handleToggleEngine}
                      compact
                    />
                  </div>
                )}

                {/* 상품 포맷 선택 */}
                <div className="space-y-2">
                  <Label className="text-foreground text-sm flex items-center gap-2">
                    <Package className="h-3.5 w-3.5" />
                    상품 포맷
                  </Label>
                  <Select value={merchandiseFormat} onValueChange={setMerchandiseFormat}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="기본 (자유 비율)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">기본 (자유 비율)</SelectItem>
                      {Object.entries(formatCategories).map(([cat, items]) => (
                        <div key={cat}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                            {categoryLabels[cat] || cat}
                          </div>
                          {items.map(f => (
                            <SelectItem key={f.key} value={f.key}>
                              {f.name} ({f.aspectRatio})
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                  {merchandiseFormat && merchandiseFormat !== "none" && formats && (
                    <div className="text-xs text-muted-foreground p-2 rounded bg-secondary/50">
                      {(() => {
                        const f = formats.find(fmt => fmt.key === merchandiseFormat);
                        return f ? `${f.width}x${f.height}px / ${f.dpi}DPI / ${f.aspectRatio}` : "";
                      })()}
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleGenerate}
                  className="w-full gap-2"
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />생성 중... (10~20초)</>
                  ) : (
                    <><Wand2 className="h-4 w-4" />이미지 생성</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right: Results */}
          <div className="lg:col-span-2 space-y-4">
            {/* Selected Image View */}
            {selectedGen && selectedGen.resultImageUrl && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-foreground text-base">결과물 미리보기</CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button variant="outline" size="sm" className="gap-1.5"
                        onClick={() => upscaleMutation.mutate({ id: selectedGen.id })}
                        disabled={upscaleMutation.isPending || !!selectedGen.upscaledImageUrl}>
                        {upscaleMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpCircle className="h-3.5 w-3.5" />}
                        {selectedGen.upscaledImageUrl ? "업스케일 완료" : "초고화질 업스케일"}
                      </Button>
                      
                      {/* 영상 변환 버튼 */}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <Video className="h-3.5 w-3.5" />영상 변환
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-card border-border">
                          <DialogHeader>
                            <DialogTitle className="text-foreground">이미지 → 영상 변환</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-2">
                            <div className="space-y-2">
                              <Label className="text-sm text-foreground">모션 효과</Label>
                              <Select value={videoMotion} onValueChange={setVideoMotion}>
                                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {motionTypes.map(m => (
                                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm text-foreground">영상 길이 (초)</Label>
                              <Select value={videoDuration.toString()} onValueChange={(v) => setVideoDuration(parseInt(v))}>
                                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="3">3초</SelectItem>
                                  <SelectItem value="5">5초</SelectItem>
                                  <SelectItem value="10">10초</SelectItem>
                                  <SelectItem value="15">15초</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm text-foreground">커스텀 프롬프트 <span className="text-xs text-muted-foreground">(선택사항)</span></Label>
                              <Textarea
                                placeholder="영상에 원하는 움직임이나 효과를 설명하세요..."
                                rows={2}
                                value={videoCustomPrompt}
                                onChange={(e) => setVideoCustomPrompt(e.target.value)}
                                className="text-sm"
                              />
                            </div>
                            <div className="rounded-lg overflow-hidden border border-border bg-black/20 max-h-48">
                              <img src={selectedGen.upscaledImageUrl || selectedGen.resultImageUrl} alt="" className="w-full h-auto object-contain max-h-48" />
                            </div>
                          </div>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button variant="outline" size="sm">취소</Button>
                            </DialogClose>
                            <DialogClose asChild>
                              <Button size="sm" className="gap-1.5" onClick={handleCreateVideo} disabled={createVideoMutation.isPending}>
                                {createVideoMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />}
                                영상 생성 시작
                              </Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <a href={selectedGen.upscaledImageUrl || selectedGen.resultImageUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" />다운로드</Button>
                      </a>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg overflow-hidden border border-border bg-black/20">
                    <img
                      src={selectedGen.upscaledImageUrl || selectedGen.resultImageUrl}
                      alt="생성 결과"
                      className="w-full h-auto max-h-[600px] object-contain"
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
                    {selectedGen.generationTimeMs && <span>생성시간: {(selectedGen.generationTimeMs / 1000).toFixed(1)}초</span>}
                    {selectedGen.merchandiseFormat && <Badge variant="secondary" className="text-xs">{selectedGen.merchandiseFormat}</Badge>}
                    {selectedGen.faceConsistencyScore && <span>얼굴 일관성: {selectedGen.faceConsistencyScore}%</span>}
                    {selectedGen.upscaledImageUrl && <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">4K 업스케일</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700"
                      onClick={() => updateStatus.mutate({ id: selectedGen.id, status: "approved", stage: "review" })}>
                      <Check className="h-3.5 w-3.5" />승인
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-1.5"
                      onClick={() => updateStatus.mutate({ id: selectedGen.id, status: "rejected" })}>
                      <X className="h-3.5 w-3.5" />반려
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5"
                      onClick={() => { setPromptText(selectedGen.promptText); toast.info("프롬프트를 재사용합니다."); }}>
                      <RotateCcw className="h-3.5 w-3.5" />프롬프트 재사용
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => { if (confirm("이 이미지를 삭제하시겠습니까?")) deleteGenMutation.mutate({ id: selectedGen.id }); }}>
                      <Trash2 className="h-3.5 w-3.5" />삭제
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ═══ Videos Section - 인라인 플레이어 + 재생성 ═══ */}
            {videos && videos.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground text-base flex items-center gap-2">
                    <Video className="h-4 w-4 text-primary" />
                    영상 ({videos.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4">
                    {videos.map((video: any) => (
                      <div key={video.id} className="rounded-lg border border-border p-4 bg-secondary/30">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge variant={video.status === "completed" ? "default" : video.status === "processing" || video.status === "queued" ? "secondary" : "destructive"} className="text-xs">
                              {video.status === "completed" ? "완료" : video.status === "processing" ? "변환중..." : video.status === "queued" ? "대기중..." : "실패"}
                            </Badge>
                            {video.motionType && (
                              <span className="text-xs text-muted-foreground">
                                {motionTypes.find(m => m.value === video.motionType)?.label || video.motionType}
                              </span>
                            )}
                            {video.customPrompt && (
                              <span className="text-xs text-purple-400 truncate max-w-[200px]" title={video.customPrompt}>
                                커스텀: {video.customPrompt}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {(video.status === "processing" || video.status === "queued") && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                          </div>
                        </div>
                        
                        {/* 인라인 비디오 플레이어 */}
                        {video.videoUrl && video.status === "completed" ? (
                          <div className="space-y-3">
                            <div className="rounded-lg overflow-hidden border border-border bg-black aspect-video">
                              <video
                                src={video.videoUrl}
                                controls
                                className="w-full h-full object-contain"
                                preload="metadata"
                                playsInline
                              >
                                <source src={video.videoUrl} type="video/mp4" />
                                브라우저가 비디오를 지원하지 않습니다.
                              </video>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <a href={video.videoUrl} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="sm" className="gap-1.5">
                                  <Download className="h-3.5 w-3.5" />다운로드
                                </Button>
                              </a>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 border-purple-500/30 hover:bg-purple-500/10"
                                onClick={() => {
                                  setRegenVideoId(video.id);
                                  setRegenMotion(video.motionType || "cinematic");
                                  setRegenPrompt("");
                                }}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />프롬프트로 재생성
                              </Button>
                            </div>
                          </div>
                        ) : video.status === "failed" ? (
                          <div className="space-y-2">
                            <p className="text-xs text-destructive">변환에 실패했습니다: {video.errorMessage || "알 수 없는 오류"}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => {
                                setRegenVideoId(video.id);
                                setRegenMotion(video.motionType || "cinematic");
                                setRegenPrompt("");
                              }}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />다시 시도
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 py-4 justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">영상을 변환하고 있습니다...</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 영상 재생성 다이얼로그 */}
            <Dialog open={regenVideoId !== null} onOpenChange={(open) => { if (!open) setRegenVideoId(null); }}>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="text-foreground">영상 재생성</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label className="text-sm text-foreground">커스텀 프롬프트</Label>
                    <Textarea
                      placeholder="원하는 영상 움직임이나 효과를 설명하세요. 예: 부드러운 줌인과 함께 꽃잎이 날리는 효과..."
                      rows={3}
                      value={regenPrompt}
                      onChange={(e) => setRegenPrompt(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-foreground">모션 효과</Label>
                    <Select value={regenMotion} onValueChange={setRegenMotion}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {motionTypes.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={() => setRegenVideoId(null)}>취소</Button>
                  <Button size="sm" className="gap-1.5" onClick={handleRegenVideo} disabled={regenVideoMutation.isPending || !regenPrompt.trim()}>
                    {regenVideoMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    재생성 시작
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Generation History */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-base flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  생성 이력 ({generations?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {generations && generations.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {generations.map((gen) => (
                      <div
                        key={gen.id}
                        className={`relative rounded-lg overflow-hidden border cursor-pointer transition-all aspect-square ${
                          selectedGenId === gen.id ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/30"
                        }`}
                        onClick={() => setSelectedGenId(gen.id)}
                      >
                        {gen.resultImageUrl ? (
                          <img src={gen.resultImageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-secondary">
                            {gen.status === "generating" ? (
                              <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            ) : gen.status === "failed" ? (
                              <div className="text-center p-2">
                                <X className="h-6 w-6 text-destructive mx-auto" />
                                <p className="text-[10px] text-destructive mt-1 line-clamp-2">{gen.reviewNotes || "실패"}</p>
                              </div>
                            ) : (
                              <ImageIcon className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                        )}
                        <button
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600/90 hover:bg-red-600 flex items-center justify-center shadow-lg transition-colors z-10"
                          onClick={(e) => { e.stopPropagation(); if (confirm('이 이미지를 삭제하시겠습니까?')) deleteGenMutation.mutate({ id: gen.id }); }}
                        >
                          <Trash2 className="h-3 w-3 text-white" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-[10px] h-5">
                              {gen.stage === "upscaled" ? "4K" : gen.status === "approved" ? "승인" : gen.status === "completed" ? "완료" : gen.status === "failed" ? "실패" : gen.status}
                            </Badge>
                            {gen.upscaledImageUrl && <ArrowUpCircle className="h-3 w-3 text-green-400" />}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Wand2 className="h-10 w-10 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground text-sm">아직 생성된 이미지가 없습니다</p>
                    <p className="text-muted-foreground/70 text-xs mt-1">참조 이미지를 첨부하고 AI 프롬프트를 생성한 후 이미지를 생성해보세요</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
