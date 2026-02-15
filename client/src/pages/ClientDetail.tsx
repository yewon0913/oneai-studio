import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useState, useRef } from "react";
import {
  ArrowLeft, Upload, Camera, User as UserIcon, Image as ImageIcon,
  FolderPlus, Trash2, Phone, Mail, FileText
} from "lucide-react";
import { toast } from "sonner";

const photoTypeLabels: Record<string, string> = { front: "정면", side: "측면", additional: "추가" };

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const clientId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [uploadType, setUploadType] = useState<"front" | "side" | "additional">("front");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [projectForm, setProjectForm] = useState({
    title: "", category: "wedding" as const, concept: "", notes: "", priority: "normal" as const,
  });

  const utils = trpc.useUtils();
  const { data: client, isLoading } = trpc.clients.getById.useQuery({ id: clientId });
  const { data: photos } = trpc.clientPhotos.list.useQuery({ clientId });
  const { data: projects } = trpc.projects.list.useQuery({ clientId });

  const uploadPhoto = trpc.clientPhotos.upload.useMutation({
    onSuccess: () => { utils.clientPhotos.list.invalidate(); toast.success("사진이 업로드되었습니다."); },
    onError: (err) => toast.error(err.message),
  });

  const deletePhoto = trpc.clientPhotos.delete.useMutation({
    onSuccess: () => { utils.clientPhotos.list.invalidate(); toast.success("사진이 삭제되었습니다."); },
  });

  const createProject = trpc.projects.create.useMutation({
    onSuccess: (data) => {
      utils.projects.list.invalidate();
      setIsProjectDialogOpen(false);
      toast.success("프로젝트가 생성되었습니다.");
      setLocation(`/projects/${data.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("파일 크기는 10MB 이하만 가능합니다."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadPhoto.mutate({ clientId, photoType: uploadType, fileName: file.name, mimeType: file.type, base64Data: base64 });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreateProject = () => {
    if (!projectForm.title.trim()) { toast.error("프로젝트 제목을 입력해주세요."); return; }
    createProject.mutate({ ...projectForm, clientId });
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

  if (!client) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-muted-foreground">고객을 찾을 수 없습니다.</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/clients")}>고객 목록으로</Button>
        </div>
      </DashboardLayout>
    );
  }

  const frontPhotos = photos?.filter(p => p.photoType === "front") || [];
  const sidePhotos = photos?.filter(p => p.photoType === "side") || [];
  const additionalPhotos = photos?.filter(p => p.photoType === "additional") || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/clients")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {client.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{client.phone}</span>}
              {client.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{client.email}</span>}
            </div>
          </div>
          <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><FolderPlus className="h-4 w-4" />새 프로젝트</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle className="text-foreground">새 프로젝트 생성</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label className="text-foreground">프로젝트 제목 *</Label>
                  <Input placeholder="예: 김철수님 웨딩 스냅" value={projectForm.title} onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-foreground">카테고리</Label>
                    <Select value={projectForm.category} onValueChange={(v: any) => setProjectForm({ ...projectForm, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wedding">웨딩</SelectItem>
                        <SelectItem value="restoration">사진 복원</SelectItem>
                        <SelectItem value="kids">키즈</SelectItem>
                        <SelectItem value="profile">프로필</SelectItem>
                        <SelectItem value="video">영상</SelectItem>
                        <SelectItem value="custom">커스텀</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">우선순위</Label>
                    <Select value={projectForm.priority} onValueChange={(v: any) => setProjectForm({ ...projectForm, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">낮음</SelectItem>
                        <SelectItem value="normal">보통</SelectItem>
                        <SelectItem value="high">높음</SelectItem>
                        <SelectItem value="urgent">긴급</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">컨셉</Label>
                  <Input placeholder="예: 유럽 가든 스타일" value={projectForm.concept} onChange={(e) => setProjectForm({ ...projectForm, concept: e.target.value })} />
                </div>
                <Button onClick={handleCreateProject} className="w-full" disabled={createProject.isPending}>
                  {createProject.isPending ? "생성 중..." : "프로젝트 생성"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Consultation Notes */}
        {client.consultationNotes && (
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">상담 내용</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.consultationNotes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="photos" className="w-full">
          <TabsList className="bg-secondary">
            <TabsTrigger value="photos">고객 사진</TabsTrigger>
            <TabsTrigger value="projects">프로젝트 ({projects?.length || 0})</TabsTrigger>
          </TabsList>

          {/* Photos Tab */}
          <TabsContent value="photos" className="space-y-6 mt-4">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

            {/* Photo upload sections */}
            {(["front", "side", "additional"] as const).map((type) => {
              const typePhotos = type === "front" ? frontPhotos : type === "side" ? sidePhotos : additionalPhotos;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{photoTypeLabels[type]} 사진</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => { setUploadType(type); fileInputRef.current?.click(); }}
                      disabled={uploadPhoto.isPending}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      업로드
                    </Button>
                  </div>
                  {typePhotos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {typePhotos.map((photo) => (
                        <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-border bg-secondary aspect-square">
                          <img src={photo.originalUrl} alt={photo.fileName || ""} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button variant="destructive" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); deletePhoto.mutate({ id: photo.id }); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => { setUploadType(type); fileInputRef.current?.click(); }}>
                      <Camera className="h-8 w-8 text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">{photoTypeLabels[type]} 사진을 업로드하세요</p>
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="mt-4">
            {projects && projects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.map((project) => (
                  <Card key={project.id} className="bg-card border-border hover:border-primary/30 cursor-pointer transition-all" onClick={() => setLocation(`/projects/${project.id}`)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-card-foreground">{project.title}</h3>
                        <Badge variant="outline" className="text-xs">{project.status}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="secondary" className="text-xs">{project.category}</Badge>
                        {project.concept && <span>{project.concept}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ImageIcon className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">아직 프로젝트가 없습니다</p>
                  <Button className="mt-3 gap-2" onClick={() => setIsProjectDialogOpen(true)}>
                    <FolderPlus className="h-4 w-4" />새 프로젝트 생성
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
