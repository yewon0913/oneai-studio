import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Plus, Layers, Play, Pause, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  pending: "대기중", processing: "처리중", completed: "완료", failed: "실패", cancelled: "취소",
};
const statusColors: Record<string, string> = {
  pending: "bg-gray-500/20 text-gray-400", processing: "bg-amber-500/20 text-amber-400",
  completed: "bg-green-500/20 text-green-400", failed: "bg-red-500/20 text-red-400",
  cancelled: "bg-gray-500/20 text-gray-400",
};

export default function BatchesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "" });

  const utils = trpc.useUtils();
  const { data: batches, isLoading } = trpc.batches.list.useQuery();

  const createBatch = trpc.batches.create.useMutation({
    onSuccess: () => {
      utils.batches.list.invalidate();
      setIsDialogOpen(false);
      setFormData({ name: "", description: "" });
      toast.success("배치가 생성되었습니다.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">배치 처리</h1>
            <p className="text-muted-foreground text-sm mt-1">여러 작업을 한번에 처리합니다</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />새 배치</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle className="text-foreground">새 배치 생성</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label className="text-foreground">배치 이름 *</Label>
                  <Input placeholder="예: 2월 웨딩 일괄 처리" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">설명</Label>
                  <Input placeholder="배치 설명..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                </div>
                <Button onClick={() => { if (!formData.name.trim()) { toast.error("배치 이름을 입력해주세요."); return; } createBatch.mutate({ title: formData.name, items: [] }); }} className="w-full" disabled={createBatch.isPending}>
                  {createBatch.isPending ? "생성 중..." : "배치 생성"}
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
              const progress = batch.totalItems > 0 ? Math.round((batch.completedItems / batch.totalItems) * 100) : 0;
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
                        </div>
                      </div>
                      <Badge variant="outline" className={`${statusColors[batch.status] || ""}`}>
                        {statusLabels[batch.status] || batch.status}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{batch.completedItems} / {batch.totalItems} 항목</span>
                        <span>{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>
                    {batch.failedItems > 0 && (
                      <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />{batch.failedItems}개 실패
                      </p>
                    )}
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
              <p className="text-muted-foreground text-sm mt-1">새 배치를 생성하여 여러 작업을 한번에 처리하세요</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
