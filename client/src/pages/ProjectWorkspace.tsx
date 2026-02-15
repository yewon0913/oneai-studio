import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useState, useMemo } from "react";
import {
  ArrowLeft, Sparkles, Wand2, ZoomIn, Download, Check, X,
  RotateCcw, Eye, Columns2, ArrowUpCircle, Loader2, ImageIcon
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
  const [compareMode, setCompareMode] = useState(false);
  const [guidanceScale, setGuidanceScale] = useState([7.5]);

  const utils = trpc.useUtils();
  const { data: project, isLoading } = trpc.projects.getById.useQuery({ id: projectId });
  const { data: generations } = trpc.generations.list.useQuery({ projectId });
  const { data: prompts } = trpc.prompts.list.useQuery();

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

  const handleGenerate = () => {
    if (!promptText.trim()) { toast.error("프롬프트를 입력해주세요."); return; }
    generateMutation.mutate({
      projectId,
      promptText: promptText.trim(),
      negativePrompt: negativePrompt.trim() || undefined,
      referenceImageUrl: referenceUrl.trim() || undefined,
      parameters: { guidanceScale: guidanceScale[0] },
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
              {project.concept && <span className="text-sm text-muted-foreground">{project.concept}</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Prompt & Controls */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  프롬프트 설정
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quick Prompt Selection */}
                {prompts && prompts.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">프롬프트 라이브러리에서 선택</Label>
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
                  <Label className="text-foreground text-sm">메인 프롬프트</Label>
                  <Textarea
                    placeholder="A romantic wedding couple in a European garden, golden hour sunlight, cinematic bokeh, professional photography..."
                    rows={5}
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground text-sm">네거티브 프롬프트</Label>
                  <Textarea
                    placeholder="품질 저하 요소를 입력..."
                    rows={3}
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    className="text-sm text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground text-sm">참조 이미지 URL</Label>
                  <Input
                    placeholder="핀터레스트 URL 또는 이미지 URL..."
                    value={referenceUrl}
                    onChange={(e) => setReferenceUrl(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground text-sm">Guidance Scale: {guidanceScale[0]}</Label>
                  <Slider value={guidanceScale} onValueChange={setGuidanceScale} min={1} max={20} step={0.5} />
                </div>

                <Button
                  onClick={handleGenerate}
                  className="w-full gap-2"
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />생성 중...</>
                  ) : (
                    <><Wand2 className="h-4 w-4" />이미지 생성</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right: Results & Compare */}
          <div className="lg:col-span-2 space-y-4">
            {/* Selected Image View */}
            {selectedGen && selectedGen.resultImageUrl && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-foreground text-base">결과물 미리보기</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCompareMode(!compareMode)}>
                        <Columns2 className="h-3.5 w-3.5" />{compareMode ? "단일 뷰" : "비교 뷰"}
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5"
                        onClick={() => upscaleMutation.mutate({ id: selectedGen.id })}
                        disabled={upscaleMutation.isPending}>
                        {upscaleMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpCircle className="h-3.5 w-3.5" />}
                        업스케일
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
                              {gen.stage === "upscaled" ? "4K" : gen.status === "approved" ? "승인" : gen.status}
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
