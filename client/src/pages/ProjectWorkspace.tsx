import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useState, useMemo } from "react";
import {
  ArrowLeft, Sparkles, Wand2, Download, Check, X,
  RotateCcw, ArrowUpCircle, Loader2, ImageIcon, Lock, Unlock,
  Package, Users, UserCircle
} from "lucide-react";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  draft: "초안", generating: "생성중", review: "검수중", revision: "수정중",
  upscaling: "업스케일링", completed: "완료", delivered: "전달완료",
};

export default function ProjectWorkspace() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const [promptText, setPromptText] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("(deformed, distorted, disfigured:1.3), poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, (mutated hands and fingers:1.4), disconnected limbs, mutation, mutated, ugly, disgusting, blurry, amputation, plastic skin, cartoon, anime");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [selectedGenId, setSelectedGenId] = useState<number | null>(null);
  const [faceFixMode, setFaceFixMode] = useState(true);
  const [merchandiseFormat, setMerchandiseFormat] = useState<string>("");

  const utils = trpc.useUtils();
  const { data: project, isLoading } = trpc.projects.getById.useQuery({ id: projectId });
  const { data: generations } = trpc.generations.list.useQuery({ projectId });
  const { data: prompts } = trpc.prompts.list.useQuery();
  const { data: formats } = trpc.generations.merchandiseFormats.useQuery();
  const { data: clientPhotos } = trpc.clientPhotos.list.useQuery(
    { clientId: project?.clientId || 0 },
    { enabled: !!project?.clientId }
  );
  const { data: client } = trpc.clients.getById.useQuery(
    { id: project?.clientId || 0 },
    { enabled: !!project?.clientId }
  );

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

  const handleGenerate = () => {
    if (!promptText.trim()) { toast.error("프롬프트를 입력해주세요."); return; }
    if (faceFixMode && !hasFaceRef) {
      toast.error("얼굴 고정 모드를 사용하려면 고객 정면 사진이 필요합니다.");
      return;
    }
    generateMutation.mutate({
      projectId,
      promptText: promptText.trim(),
      negativePrompt: negativePrompt.trim() || undefined,
      referenceImageUrl: referenceUrl.trim() || undefined,
      faceFixMode,
      merchandiseFormat: merchandiseFormat && merchandiseFormat !== "none" ? merchandiseFormat : undefined,
    });
  };

  const handleApplyPrompt = (prompt: string, negative?: string | null) => {
    setPromptText(prompt);
    if (negative) setNegativePrompt(negative);
    toast.success("프롬프트가 적용되었습니다.");
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
          {/* 고객 정보 */}
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
                    <img src={frontPhoto.originalUrl} alt="Face ref" className="w-12 h-12 rounded-lg object-cover border border-border" />
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
                {/* Quick Prompt Selection */}
                {prompts && prompts.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">프롬프트 라이브러리</Label>
                    <Select onValueChange={(v) => {
                      const p = prompts.find(pr => pr.id.toString() === v);
                      if (p) handleApplyPrompt(p.prompt, p.negativePrompt);
                    }}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder="프롬프트 선택..." /></SelectTrigger>
                      <SelectContent>
                        {prompts.map(p => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-foreground text-sm">메인 프롬프트 *</Label>
                  <Textarea
                    placeholder="유럽 정원에서 웨딩 드레스를 입은 로맨틱한 웨딩 사진, 골든아워 조명, 시네마틱 보케..."
                    rows={5}
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

                <div className="space-y-2">
                  <Label className="text-foreground text-sm">스타일 참조 이미지 URL</Label>
                  <Input
                    placeholder="핀터레스트 URL 또는 이미지 URL..."
                    value={referenceUrl}
                    onChange={(e) => setReferenceUrl(e.target.value)}
                    className="text-sm"
                  />
                </div>

                {/* 얼굴 고정 모드 */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                  <div className="flex items-center gap-2">
                    {faceFixMode ? <Lock className="h-4 w-4 text-green-500" /> : <Unlock className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <p className="text-sm font-medium text-foreground">얼굴 고정 모드</p>
                      <p className="text-xs text-muted-foreground">
                        {faceFixMode ? "고객 얼굴을 참조하여 생성" : "얼굴 참조 없이 생성"}
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
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5"
                        onClick={() => upscaleMutation.mutate({ id: selectedGen.id })}
                        disabled={upscaleMutation.isPending || !!selectedGen.upscaledImageUrl}>
                        {upscaleMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpCircle className="h-3.5 w-3.5" />}
                        {selectedGen.upscaledImageUrl ? "업스케일 완료" : "초고화질 업스케일"}
                      </Button>
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
                      alt="Generated"
                      className="w-full h-auto max-h-[600px] object-contain"
                    />
                  </div>
                  {/* 메타 정보 */}
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    {selectedGen.generationTimeMs && <span>생성시간: {(selectedGen.generationTimeMs / 1000).toFixed(1)}초</span>}
                    {selectedGen.merchandiseFormat && <Badge variant="secondary" className="text-xs">{selectedGen.merchandiseFormat}</Badge>}
                    {selectedGen.faceConsistencyScore && <span>얼굴 일관성: {selectedGen.faceConsistencyScore}%</span>}
                    {selectedGen.upscaledImageUrl && <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">4K 업스케일</Badge>}
                  </div>
                  {/* Review Actions */}
                  <div className="flex items-center gap-2 mt-4">
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
                  </div>
                </CardContent>
              </Card>
            )}

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
                              <X className="h-6 w-6 text-destructive" />
                            ) : (
                              <ImageIcon className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-[10px] h-5">
                              {gen.stage === "upscaled" ? "4K" : gen.status === "approved" ? "승인" : gen.status === "completed" ? "완료" : gen.status}
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
                    <p className="text-muted-foreground/70 text-xs mt-1">프롬프트를 입력하고 이미지를 생성해보세요</p>
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
