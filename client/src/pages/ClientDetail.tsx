import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
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
  ArrowLeft, Upload, Camera, Image as ImageIcon,
  FolderPlus, Trash2, Phone, Mail, FileText, Heart, HeartOff, UserCircle, Users,
  Sparkles, Loader2, Download, RotateCcw
} from "lucide-react";
import { toast } from "sonner";

const photoTypeLabels: Record<string, string> = { front: "정면", side: "측면" };
const genderLabels: Record<string, string> = { female: "여성 (신부)", male: "남성 (신랑)" };

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const clientId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isPartnerDialogOpen, setIsPartnerDialogOpen] = useState(false);
  const [uploadType, setUploadType] = useState<"front" | "side">("front");
  const [characterSheetUrl, setCharacterSheetUrl] = useState<string | null>(null);
  const [isGeneratingSheet, setIsGeneratingSheet] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [projectForm, setProjectForm] = useState({
    title: "", category: "wedding" as const, concept: "", notes: "", priority: "normal" as const,
    projectMode: "single" as "single" | "couple",
  });

  const utils = trpc.useUtils();
  const { data: client, isLoading } = trpc.clients.getById.useQuery({ id: clientId });
  const { data: photos } = trpc.clientPhotos.list.useQuery({ clientId });
  const { data: projects } = trpc.projects.list.useQuery({ clientId });
  const { data: allClients } = trpc.clients.list.useQuery();

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

  const linkPartner = trpc.clients.linkPartner.useMutation({
    onSuccess: () => {
      utils.clients.getById.invalidate({ id: clientId });
      utils.clients.list.invalidate();
      setIsPartnerDialogOpen(false);
      toast.success("파트너가 연결되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  const unlinkPartner = trpc.clients.unlinkPartner.useMutation({
    onSuccess: () => {
      utils.clients.getById.invalidate({ id: clientId });
      utils.clients.list.invalidate();
      toast.success("파트너 연결이 해제되었습니다.");
    },
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
    createProject.mutate({
      ...projectForm,
      clientId,
      partnerClientId: projectForm.projectMode === "couple" && client?.partnerId ? client.partnerId : undefined,
    });
  };

  // 파트너 후보 (다른 성별의 고객)
  const partnerCandidates = allClients?.filter(c => c.id !== clientId && c.gender !== client?.gender && !c.partnerId) || [];

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

  const generateCharacterSheet = trpc.generations.generateCharacterSheet.useMutation({
    onSuccess: (data) => {
      setCharacterSheetUrl(data.resultImageUrl);
      setIsGeneratingSheet(false);
      toast.success("캐릭터 시트가 생성되었습니다!");
    },
    onError: (err) => {
      setIsGeneratingSheet(false);
      toast.error(err.message || "캐릭터 시트 생성 실패");
    },
  });

  const handleGenerateCharacterSheet = () => {
    if (frontPhotos.length === 0) {
      toast.error("정면 사진을 먼저 업로드해주세요.");
      return;
    }
    setIsGeneratingSheet(true);
    setCharacterSheetUrl(null);
    generateCharacterSheet.mutate({
      clientId,
      age: client.age ?? undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/clients")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${client.gender === "male" ? "bg-blue-500/20" : "bg-pink-500/20"}`}>
            <UserCircle className={`h-6 w-6 ${client.gender === "male" ? "text-blue-400" : "text-pink-400"}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
              <Badge variant="outline" className={`text-xs ${client.gender === "male" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-pink-500/20 text-pink-400 border-pink-500/30"}`}>
                {genderLabels[client.gender] || client.gender}
              </Badge>
              {client.age && (
                <Badge variant="outline" className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">
                  {client.age}세
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {client.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{client.phone}</span>}
              {client.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{client.email}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 파트너 연결 */}
            {client.partnerId ? (
              <Button variant="outline" size="sm" className="gap-1.5 text-pink-400 border-pink-500/30" onClick={() => unlinkPartner.mutate({ clientId })}>
                <HeartOff className="h-3.5 w-3.5" />파트너 해제
              </Button>
            ) : (
              <Dialog open={isPartnerDialogOpen} onOpenChange={setIsPartnerDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Heart className="h-3.5 w-3.5" />파트너 연결
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader><DialogTitle className="text-foreground">파트너 연결 (커플)</DialogTitle></DialogHeader>
                  <div className="space-y-3 mt-2">
                    <p className="text-sm text-muted-foreground">커플 사진 합성을 위해 파트너를 연결합니다. 다른 성별의 고객만 표시됩니다.</p>
                    {partnerCandidates.length > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {partnerCandidates.map(c => (
                          <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${c.gender === "male" ? "bg-blue-500/20" : "bg-pink-500/20"}`}>
                                <UserCircle className={`h-4 w-4 ${c.gender === "male" ? "text-blue-400" : "text-pink-400"}`} />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{c.name}</p>
                                <p className="text-xs text-muted-foreground">{genderLabels[c.gender]}</p>
                              </div>
                            </div>
                            <Button size="sm" onClick={() => linkPartner.mutate({ clientId, partnerId: c.id })} disabled={linkPartner.isPending}>
                              연결
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">연결 가능한 파트너가 없습니다. 먼저 다른 성별의 고객을 등록해주세요.</p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
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
                      <Label className="text-foreground">촬영 모드</Label>
                      <Select value={projectForm.projectMode} onValueChange={(v: "single" | "couple") => setProjectForm({ ...projectForm, projectMode: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">개인 촬영</SelectItem>
                          <SelectItem value="couple" disabled={!client.partnerId}>
                            커플 합성 {!client.partnerId && "(파트너 연결 필요)"}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-foreground">컨셉</Label>
                      <Input placeholder="예: 유럽 가든 스타일" value={projectForm.concept} onChange={(e) => setProjectForm({ ...projectForm, concept: e.target.value })} />
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
                  {projectForm.projectMode === "couple" && client.partnerId && (
                    <div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
                      <div className="flex items-center gap-2 text-sm text-pink-400">
                        <Users className="h-4 w-4" />
                        <span>커플 모드: 파트너의 얼굴도 함께 합성됩니다</span>
                      </div>
                    </div>
                  )}
                  <Button onClick={handleCreateProject} className="w-full" disabled={createProject.isPending}>
                    {createProject.isPending ? "생성 중..." : "프로젝트 생성"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Partner Info */}
        {client.partnerId && (
          <Card className="bg-pink-500/5 border-pink-500/20">
            <CardContent className="p-4 flex items-center gap-3">
              <Heart className="h-5 w-5 text-pink-400" />
              <div>
                <p className="text-sm font-medium text-foreground">커플 연결됨</p>
                <p className="text-xs text-muted-foreground">파트너 ID: {client.partnerId} - 커플 프로젝트에서 두 사람의 사진이 함께 합성됩니다</p>
              </div>
            </CardContent>
          </Card>
        )}

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

            {/* Important notice */}
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm text-amber-400">
                <strong>얼굴 고정 모드</strong>를 사용하려면 반드시 <strong>정면 사진</strong>을 업로드해주세요. 측면 사진은 보조 참조로 사용됩니다.
              </p>
            </div>

            {/* 정면 사진 */}
            {(["front", "side"] as const).map((type) => {
              const typePhotos = type === "front" ? frontPhotos : sidePhotos;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                      {photoTypeLabels[type]} 사진
                      {type === "front" && <span className="text-primary ml-1">(필수)</span>}
                    </h3>
                    <Button
                      variant="outline" size="sm" className="gap-1.5"
                      onClick={() => { setUploadType(type); fileInputRef.current?.click(); }}
                      disabled={uploadPhoto.isPending}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {uploadPhoto.isPending && uploadType === type ? "업로드 중..." : "업로드"}
                    </Button>
                  </div>
                  {typePhotos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {typePhotos.map((photo) => (
                        <div key={photo.id} className="relative rounded-lg overflow-hidden border border-border bg-secondary aspect-square">
                          <img src={photo.originalUrl} alt={photo.fileName || ""} className="w-full h-full object-cover" />
                          <button
                            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-red-600/90 hover:bg-red-600 flex items-center justify-center shadow-lg transition-colors z-10"
                            onClick={(e) => { e.stopPropagation(); if (confirm('이 사진을 삭제하시겠습니까?')) deletePhoto.mutate({ id: photo.id }); }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-white" />
                          </button>
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

            {/* 캐릭터 시트 생성 영역 */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  AI 캐릭터 시트
                </h3>
                <Button
                  variant="outline" size="sm" className="gap-1.5 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                  onClick={handleGenerateCharacterSheet}
                  disabled={isGeneratingSheet || frontPhotos.length === 0}
                >
                  {isGeneratingSheet ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />생성 중...</>
                  ) : characterSheetUrl ? (
                    <><RotateCcw className="h-3.5 w-3.5" />재생성</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5" />캐릭터 시트 생성</>
                  )}
                </Button>
              </div>

              <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 mb-3">
                <p className="text-xs text-purple-300">
                  정면/측면 사진을 기반으로 <strong>정면, 측면, 후면</strong> 3가지 각도의 초사실주의 캐릭터 시트를 생성합니다.
                  {client.age ? ` (고객 나이: ${client.age}세)` : " (나이 미설정 - 고객 정보에서 나이를 입력하면 더 정확한 시트가 생성됩니다)"}
                </p>
                <p className="text-xs text-purple-300/70 mt-1">
                  Flux LoRA + IP-Adapter 일관성 엔진 · 85mm 인물용 렌즈 · 4K 해상도 · DSLR 품질
                </p>
              </div>

              {isGeneratingSheet ? (
                <div className="border border-dashed border-purple-500/30 rounded-lg p-12 flex flex-col items-center justify-center bg-purple-500/5">
                  <div className="relative">
                    <div className="w-16 h-16 border-3 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-purple-400" />
                  </div>
                  <p className="text-sm text-purple-300 mt-4 font-medium">캐릭터 시트 생성 중...</p>
                  <p className="text-xs text-muted-foreground mt-1">원본 사진을 기반으로 다각도 캐릭터를 생성하고 있습니다 (15~30초)</p>
                </div>
              ) : characterSheetUrl ? (
                <div className="space-y-3">
                  <div className="relative rounded-lg overflow-hidden border border-purple-500/30 bg-secondary">
                    <img src={characterSheetUrl} alt="캐릭터 시트" className="w-full h-auto" />
                    <div className="absolute top-2 right-2 flex gap-1.5">
                      <a href={characterSheetUrl} target="_blank" rel="noopener noreferrer"
                        className="w-8 h-8 rounded-full bg-black/70 hover:bg-black/90 flex items-center justify-center transition-colors">
                        <Download className="h-4 w-4 text-white" />
                      </a>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    이 캐릭터 시트는 프로젝트 생성 시 얼굴 일관성 참조로 자동 사용됩니다.
                  </p>
                </div>
              ) : (
                <div className="border border-dashed border-purple-500/20 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500/40 transition-colors"
                  onClick={frontPhotos.length > 0 ? handleGenerateCharacterSheet : undefined}>
                  <Sparkles className="h-10 w-10 text-purple-400/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {frontPhotos.length > 0 ? "클릭하여 캐릭터 시트를 생성하세요" : "정면 사진을 먼저 업로드해주세요"}
                  </p>
                </div>
              )}
            </div>
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
                        <div className="flex items-center gap-1.5">
                          {project.projectMode === "couple" && (
                            <Badge variant="outline" className="text-xs bg-pink-500/20 text-pink-400 border-pink-500/30">커플</Badge>
                          )}
                          <Badge variant="outline" className="text-xs">{project.status}</Badge>
                        </div>
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
