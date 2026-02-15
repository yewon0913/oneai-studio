import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState } from "react";
import {
  ArrowLeft, Check, X, Download, ArrowUpCircle,
  ShieldCheck, AlertTriangle, ImageIcon, Package, Eye
} from "lucide-react";
import { toast } from "sonner";

const stageLabels: Record<string, string> = {
  draft: "초안", review: "검수 대기", upscaled: "업스케일 완료", final: "최종 승인",
};

const stageColors: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400",
  review: "bg-amber-500/20 text-amber-400",
  upscaled: "bg-blue-500/20 text-blue-400",
  final: "bg-green-500/20 text-green-400",
};

export default function FinalReviewPage() {
  const [, setLocation] = useLocation();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rejectDialogId, setRejectDialogId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: projects } = trpc.projects.list.useQuery();
  const utils = trpc.useUtils();

  // 모든 프로젝트의 승인된 이미지 조회
  const projectIds = projects?.map(p => p.id) || [];
  
  // 각 프로젝트별 검수 대기 이미지
  const reviewQueries = projectIds.map(pid => 
    // eslint-disable-next-line react-hooks/rules-of-hooks
    trpc.generations.reviewQueue.useQuery({ projectId: pid }, { enabled: projectIds.length > 0 })
  );

  const allReviewItems = reviewQueries.flatMap((q, idx) => 
    (q.data || []).map(item => ({ ...item, projectId: projectIds[idx] }))
  );

  // final 승인된 이미지 (stage === 'final')
  const generationQueries = projectIds.map(pid =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    trpc.generations.list.useQuery({ projectId: pid }, { enabled: projectIds.length > 0 })
  );

  const finalApproved = generationQueries.flatMap((q, idx) =>
    (q.data || []).filter(g => g.stage === "final").map(item => ({ ...item, projectId: projectIds[idx] }))
  );

  const finalApproveMutation = trpc.generations.finalApprove.useMutation({
    onSuccess: () => {
      projectIds.forEach(pid => {
        utils.generations.reviewQueue.invalidate({ projectId: pid });
        utils.generations.list.invalidate({ projectId: pid });
      });
      toast.success("최종 검수 승인 완료! 출고 준비가 되었습니다.");
    },
    onError: (err) => toast.error(`승인 실패: ${err.message}`),
  });

  const finalRejectMutation = trpc.generations.finalReject.useMutation({
    onSuccess: () => {
      projectIds.forEach(pid => {
        utils.generations.reviewQueue.invalidate({ projectId: pid });
        utils.generations.list.invalidate({ projectId: pid });
      });
      setRejectDialogId(null);
      setRejectReason("");
      toast.success("반려 처리되었습니다. 재작업이 필요합니다.");
    },
    onError: (err) => toast.error(`반려 실패: ${err.message}`),
  });

  const selectedItem = allReviewItems.find(i => i.id === selectedId) || finalApproved.find(i => i.id === selectedId);
  const projectForSelected = projects?.find(p => p.id === selectedItem?.projectId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              최종 검수
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              출고 전 최종 이미지를 검수합니다. 승인된 이미지만 고객에게 전달됩니다.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 gap-1">
              <AlertTriangle className="h-3 w-3" />
              검수 대기: {allReviewItems.filter(i => i.stage !== "final").length}
            </Badge>
            <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 gap-1">
              <Check className="h-3 w-3" />
              출고 승인: {finalApproved.length}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Review Queue */}
          <div className="lg:col-span-1 space-y-4">
            {/* 검수 대기 */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-base flex items-center gap-2">
                  <Eye className="h-4 w-4 text-amber-400" />
                  검수 대기 ({allReviewItems.filter(i => i.stage !== "final").length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {allReviewItems.filter(i => i.stage !== "final").length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {allReviewItems.filter(i => i.stage !== "final").map((item) => (
                      <div
                        key={item.id}
                        className={`relative rounded-lg overflow-hidden border cursor-pointer transition-all aspect-square ${
                          selectedId === item.id ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/30"
                        }`}
                        onClick={() => setSelectedId(item.id)}
                      >
                        {item.resultImageUrl ? (
                          <img src={item.upscaledImageUrl || item.resultImageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-secondary">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                          <Badge variant="outline" className={`text-[10px] h-5 ${stageColors[item.stage || "review"]}`}>
                            {stageLabels[item.stage || "review"]}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <ShieldCheck className="h-8 w-8 text-green-500/50 mb-2" />
                    <p className="text-sm text-muted-foreground">검수 대기 이미지가 없습니다</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 출고 승인 완료 */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-base flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400" />
                  출고 승인 ({finalApproved.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {finalApproved.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {finalApproved.map((item) => (
                      <div
                        key={item.id}
                        className={`relative rounded-lg overflow-hidden border cursor-pointer transition-all aspect-square ${
                          selectedId === item.id ? "border-green-500 ring-2 ring-green-500/30" : "border-green-500/20 hover:border-green-500/40"
                        }`}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <img src={item.upscaledImageUrl || item.resultImageUrl || ""} alt="" className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                          <Badge variant="outline" className="text-[10px] h-5 bg-green-500/20 text-green-400">
                            출고 승인
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">아직 출고 승인된 이미지가 없습니다</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Selected Image Detail */}
          <div className="lg:col-span-2">
            {selectedItem && selectedItem.resultImageUrl ? (
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-foreground text-base">검수 상세</CardTitle>
                    <div className="flex items-center gap-2">
                      {projectForSelected && (
                        <Badge variant="secondary" className="text-xs">{projectForSelected.title}</Badge>
                      )}
                      <Badge variant="outline" className={`text-xs ${stageColors[selectedItem.stage || "review"]}`}>
                        {stageLabels[selectedItem.stage || "review"]}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 이미지 */}
                  <div className="rounded-lg overflow-hidden border border-border bg-black/20">
                    <img
                      src={selectedItem.upscaledImageUrl || selectedItem.resultImageUrl}
                      alt="Review"
                      className="w-full h-auto max-h-[600px] object-contain"
                    />
                  </div>

                  {/* 메타 정보 */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    {selectedItem.generationTimeMs && <span>생성시간: {(selectedItem.generationTimeMs / 1000).toFixed(1)}초</span>}
                    {selectedItem.merchandiseFormat && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Package className="h-3 w-3" />{selectedItem.merchandiseFormat}
                      </Badge>
                    )}
                    {selectedItem.faceConsistencyScore && <span>얼굴 일관성: {selectedItem.faceConsistencyScore}%</span>}
                    {selectedItem.upscaledImageUrl && (
                      <Badge variant="outline" className="text-xs text-green-400 border-green-500/30 gap-1">
                        <ArrowUpCircle className="h-3 w-3" />4K 업스케일
                      </Badge>
                    )}
                  </div>

                  {/* 프롬프트 */}
                  {selectedItem.promptText && (
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">사용된 프롬프트</p>
                      <p className="text-sm text-foreground line-clamp-3">{selectedItem.promptText}</p>
                    </div>
                  )}

                  {/* 검수 노트 */}
                  {selectedItem.reviewNotes && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-xs text-amber-400 mb-1">검수 노트</p>
                      <p className="text-sm text-foreground">{selectedItem.reviewNotes}</p>
                    </div>
                  )}

                  {/* 액션 버튼 */}
                  {selectedItem.stage !== "final" ? (
                    <div className="flex items-center gap-3 pt-2">
                      <Button
                        className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                        onClick={() => finalApproveMutation.mutate({ id: selectedItem.id })}
                        disabled={finalApproveMutation.isPending}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        {finalApproveMutation.isPending ? "처리 중..." : "최종 승인 (출고 확정)"}
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1 gap-2"
                        onClick={() => { setRejectDialogId(selectedItem.id); setRejectReason(""); }}
                      >
                        <X className="h-4 w-4" />반려 (재작업)
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 pt-2">
                      <a href={selectedItem.upscaledImageUrl || selectedItem.resultImageUrl || ""} target="_blank" rel="noopener noreferrer" className="flex-1">
                        <Button variant="outline" className="w-full gap-2">
                          <Download className="h-4 w-4" />최종 이미지 다운로드
                        </Button>
                      </a>
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-green-500" />
                        <span className="text-sm text-green-400 font-medium">출고 승인 완료</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="flex flex-col items-center justify-center py-24">
                  <ShieldCheck className="h-16 w-16 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium text-foreground">검수할 이미지를 선택하세요</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    왼쪽 목록에서 이미지를 클릭하면 상세 정보를 확인하고 검수할 수 있습니다
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* 반려 사유 다이얼로그 */}
      <Dialog open={!!rejectDialogId} onOpenChange={(open) => { if (!open) setRejectDialogId(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              검수 반려
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">반려 사유를 입력해주세요. 이 내용은 재작업 시 참고됩니다.</p>
            <Textarea
              placeholder="예: 얼굴 유사도가 낮음, 배경 색감 조정 필요..."
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRejectDialogId(null)}>취소</Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                if (!rejectReason.trim()) { toast.error("반려 사유를 입력해주세요."); return; }
                if (rejectDialogId) finalRejectMutation.mutate({ id: rejectDialogId, reviewNotes: rejectReason });
              }}
              disabled={finalRejectMutation.isPending}
            >
              {finalRejectMutation.isPending ? "처리 중..." : "반려 확정"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
