import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { FolderOpen, ChevronRight, Clock, Users, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const statusLabels: Record<string, string> = {
  draft: "초안", generating: "생성중", review: "검수중", revision: "수정중",
  upscaling: "업스케일링", completed: "완료", delivered: "전달완료",
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  generating: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  review: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  delivered: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const categoryLabels: Record<string, string> = {
  wedding: "웨딩", restoration: "복원", kids: "키즈", profile: "프로필", video: "영상", custom: "커스텀",
};

const priorityColors: Record<string, string> = {
  low: "text-gray-400", normal: "text-blue-400", high: "text-amber-400", urgent: "text-red-400",
};

export default function ProjectsPage() {
  const [, setLocation] = useLocation();
  const { data: projects, isLoading } = trpc.projects.list.useQuery();
  const utils = trpc.useUtils();
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const deleteMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      setDeleteTargetId(null);
      toast.success("프로젝트가 삭제되었습니다.");
    },
    onError: (err) => toast.error(`삭제 실패: ${err.message}`),
  });

  const handleDelete = (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    setDeleteTargetId(projectId);
  };

  const confirmDelete = () => {
    if (deleteTargetId) {
      deleteMutation.mutate({ id: deleteTargetId });
    }
  };

  const deleteTarget = projects?.find(p => p.id === deleteTargetId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">프로젝트</h1>
          <p className="text-muted-foreground text-sm mt-1">AI 이미지 생성 프로젝트를 관리합니다</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="bg-card border-border animate-pulse"><CardContent className="p-5 h-32" /></Card>
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map(project => (
              <Card
                key={project.id}
                className="bg-card border-border hover:border-primary/30 cursor-pointer transition-all group relative"
                onClick={() => setLocation(`/projects/${project.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                        <FolderOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-card-foreground">{project.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">{categoryLabels[project.category] || project.category}</Badge>
                          <Badge variant="outline" className={`text-xs ${statusColors[project.status] || ""}`}>
                            {statusLabels[project.status] || project.status}
                          </Badge>
                          {project.projectMode === "couple" && (
                            <Badge variant="outline" className="text-xs bg-pink-500/20 text-pink-400 border-pink-500/30 gap-0.5">
                              <Users className="h-2.5 w-2.5" />커플
                            </Badge>
                          )}
                          {project.projectMode === "family" && (
                            <Badge variant="outline" className="text-xs bg-orange-500/20 text-orange-400 border-orange-500/30 gap-0.5">
                              <Users className="h-2.5 w-2.5" />가족
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDelete(e, project.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(project.updatedAt).toLocaleDateString("ko-KR")}
                    </div>
                    <span className={priorityColors[project.priority]}>
                      {project.priority === "urgent" ? "긴급" : project.priority === "high" ? "높음" : ""}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground">프로젝트가 없습니다</h3>
              <p className="text-muted-foreground text-sm mt-1">고객 상세 페이지에서 새 프로젝트를 생성하세요</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              프로젝트 삭제
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              <strong className="text-foreground">"{deleteTarget?.title}"</strong> 프로젝트를 삭제하시겠습니까?
              이 작업은 되돌릴 수 없으며, 프로젝트에 포함된 모든 생성 이미지도 함께 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTargetId(null)}>취소</Button>
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={confirmDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
