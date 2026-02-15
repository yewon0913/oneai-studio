import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { Plus, Layers, XCircle, Lock, Unlock, Trash2, Package } from "lucide-react";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  queued: "대기중", processing: "처리중", completed: "완료", failed: "실패", cancelled: "취소",
};
const statusColors: Record<string, string> = {
  queued: "bg-gray-500/20 text-gray-400", processing: "bg-amber-500/20 text-amber-400",
  completed: "bg-green-500/20 text-green-400", failed: "bg-red-500/20 text-red-400",
  cancelled: "bg-gray-500/20 text-gray-400",
};

export default function BatchesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [promptsText, setPromptsText] = useState("");
  const [faceFixMode, setFaceFixMode] = useState(true);
  const [merchandiseFormat, setMerchandiseFormat] = useState<string>("");

  const utils = trpc.useUtils();
  const { data: batches, isLoading } = trpc.batches.list.useQuery();
  const { data: projects } = trpc.projects.list.useQuery();
  const { data: formats } = trpc.generations.merchandiseFormats.useQuery();

  const cancelBatch = trpc.batches.cancel.useMutation({
    onSuccess: () => {
      utils.batches.list.invalidate();
      toast.success("배치가 취소되었습니다.");
    },
  });

  const createBatch = trpc.batches.create.useMutation({
    onSuccess: () => {
      utils.batches.list.invalidate();
      setIsDialogOpen(false);
      setBatchName("");
      setSelectedProjectId("");
      setPromptsText("");
      setFaceFixMode(true);
      setMerchandiseFormat("");
      toast.success("배치 생성이 시작되었습니다! 백그라운드에서 처리됩니다.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const promptsList = useMemo(() => {
    return promptsText
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.length > 0);
  }, [promptsText]);

  const formatCategories = useMemo(() => {
    if (!formats) return {};
    const cats: Record<string, typeof formats> = {};
    for (const f of formats) {
      const cat = f.category;
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(f);
    }
    return cats;
  }, [formats]);

  const categoryLabels: Record<string, string> = {
    acrylic: "아크릴 액자", tshirt: "티셔츠", mug: "머그컵", towel: "수건",
    "3d": "3D 프린팅", canvas: "캔버스", digital: "디지털",
  };

  const handleCreateBatch = () => {
    if (!batchName.trim()) { toast.error("배치 이름을 입력해주세요."); return; }
    if (!selectedProjectId) { toast.error("프로젝트를 선택해주세요."); return; }
    if (promptsList.length === 0) { toast.error("프롬프트를 최소 1개 이상 입력해주세요."); return; }
    if (promptsList.length > 100) { toast.error("최대 100개까지 가능합니다."); return; }

    createBatch.mutate({
      title: batchName,
      projectId: parseInt(selectedProjectId),
      prompts: promptsList,
      faceFixMode,
      merchandiseFormat: merchandiseFormat || undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">배치 생성</h1>
            <p className="text-muted-foreground text-sm mt-1">최대 100장의 이미지를 한번에 생성합니다</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />새 배치</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl bg-card border-border max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="text-foreground">대량 이미지 생성</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label className="text-foreground">배치 이름 *</Label>
                  <Input placeholder="예: 2월 웨딩 일괄 처리" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">프로젝트 선택 *</Label>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger><SelectValue placeholder="프로젝트를 선택하세요" /></SelectTrigger>
                    <SelectContent>
                      {projects?.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          {p.title} ({p.category})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-foreground">프롬프트 목록 * (한 줄에 하나씩)</Label>
                    <span className="text-xs text-muted-foreground">{promptsList.length}/100</span>
                  </div>
                  <Textarea
                    placeholder={"유럽 정원에서 웨딩 드레스를 입은 로맨틱한 웨딩 사진\n해변 석양을 배경으로 한 드라마틱한 웨딩 사진\n클래식 스튜디오에서 촬영한 우아한 웨딩 포트레이트\n..."}
                    rows={6}
                    value={promptsText}
                    onChange={(e) => setPromptsText(e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">각 줄이 하나의 이미지 생성 프롬프트가 됩니다. 최대 100개.</p>
                </div>

                {/* 얼굴 고정 모드 */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                  <div className="flex items-center gap-2">
                    {faceFixMode ? <Lock className="h-4 w-4 text-green-500" /> : <Unlock className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <p className="text-sm font-medium text-foreground">얼굴 고정 모드</p>
                      <p className="text-xs text-muted-foreground">고객 사진의 얼굴을 유지합니다</p>
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
                  <Label className="text-foreground flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    상품 포맷 (선택사항)
                  </Label>
                  <Select value={merchandiseFormat} onValueChange={setMerchandiseFormat}>
                    <SelectTrigger><SelectValue placeholder="기본 (자유 비율)" /></SelectTrigger>
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
                </div>

                <Button
                  onClick={handleCreateBatch}
                  className="w-full gap-2"
                  disabled={createBatch.isPending}
                >
                  {createBatch.isPending ? "생성 중..." : `${promptsList.length}장 일괄 생성 시작`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Card key={i} className="bg-card border-border animate-pulse"><CardContent className="p-5 h-24" /></Card>)}
          </div>
        ) : batches && batches.length > 0 ? (
          <div className="space-y-3">
            {batches.map(batch => {
              const progress = batch.totalItems > 0 ? Math.round(((batch.completedItems + batch.failedItems) / batch.totalItems) * 100) : 0;
              return (
                <Card key={batch.id} className="bg-card border-border">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                          <Layers className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-card-foreground">{batch.title}</h3>
                          <p className="text-xs text-muted-foreground">
                            {new Date(batch.createdAt).toLocaleDateString("ko-KR")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`${statusColors[batch.status] || ""}`}>
                          {statusLabels[batch.status] || batch.status}
                        </Badge>
                        {batch.status === "processing" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => cancelBatch.mutate({ id: batch.id })}>
                            <XCircle className="h-4 w-4 text-red-400" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          완료: {batch.completedItems} / {batch.totalItems}
                          {batch.failedItems > 0 && <span className="text-red-400 ml-2">실패: {batch.failedItems}</span>}
                        </span>
                        <span>{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Layers className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground">배치가 없습니다</h3>
              <p className="text-muted-foreground text-sm mt-1">새 배치를 생성하여 여러 이미지를 한번에 생성하세요</p>
              <Button className="mt-4 gap-2" onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4" />첫 배치 생성하기
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
