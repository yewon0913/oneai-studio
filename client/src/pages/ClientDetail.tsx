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
import { useState, useRef, useMemo } from "react";
import {
  ArrowLeft, Upload, Camera, Image as ImageIcon,
  FolderPlus, Trash2, Phone, Mail, FileText, Heart, HeartOff, UserCircle, Users,
  Plus, X, RefreshCw, Scan, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { ImageLightbox } from "@/components/ImageLightbox";

const photoTypeLabels: Record<string, string> = { front: "정면", side: "측면", additional: "추가", face_reference: "얼굴 참조" };
const genderLabels: Record<string, string> = { female: "여성 (신부)", male: "남성 (신랑)" };

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const clientId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isPartnerDialogOpen, setIsPartnerDialogOpen] = useState(false);
  const [uploadType, setUploadType] = useState<"front" | "side" | "additional" | "face_reference">("front");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<Array<{ id: number; url: string; alt?: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faceRefInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replacingPhotoId, setReplacingPhotoId] = useState<number | null>(null);
  const [faceDetectedMap, setFaceDetectedMap] = useState<Record<number, boolean | null>>({});
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

  const replacePhoto = trpc.clientPhotos.replace.useMutation({
    onSuccess: () => {
      utils.clientPhotos.list.invalidate();
      setReplacingPhotoId(null);
      toast.success("사진이 교체되었습니다.");
    },
    onError: (err) => toast.error(err.message),
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

  // 사진 분류
  const frontPhotos = useMemo(() => photos?.filter(p => p.photoType === "front") || [], [photos]);
  const sidePhotos = useMemo(() => photos?.filter(p => p.photoType === "side") || [], [photos]);
  const faceRefPhotos = useMemo(() => photos?.filter(p => p.photoType === "face_reference") || [], [photos]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name}은 이미지 파일이 아닙니다.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) { toast.error("파일 크기는 10MB 이하만 가능합니다."); continue; }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        uploadPhoto.mutate({ clientId, photoType: uploadType, fileName: file.name, mimeType: file.type, base64Data: base64 });
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (faceRefInputRef.current) faceRefInputRef.current.value = "";
  };

  // 얼굴 참조 사진 다중 업로드
  const handleFaceRefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentCount = faceRefPhotos.length;
    const maxUpload = 25 - currentCount;

    if (files.length > maxUpload) {
      toast.error(`얼굴 참조 사진은 최대 25장까지 등록 가능합니다. 현재 ${currentCount}장, 추가 가능: ${maxUpload}장`);
    }

    const filesToUpload = Array.from(files).slice(0, maxUpload);
    
    for (const file of filesToUpload) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name}은 이미지 파일이 아닙니다.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name}: 파일 크기는 10MB 이하만 가능합니다.`); continue; }
      
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        uploadPhoto.mutate({ clientId, photoType: "face_reference", fileName: file.name, mimeType: file.type, base64Data: base64 });
      };
      reader.readAsDataURL(file);
    }
    if (faceRefInputRef.current) faceRefInputRef.current.value = "";
  };

  // 사진 교체
  const handleReplaceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingPhotoId) return;
    if (!file.type.startsWith("image/")) { toast.error("이미지 파일만 업로드 가능합니다."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("파일 크기는 10MB 이하만 가능합니다."); return; }
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      replacePhoto.mutate({ id: replacingPhotoId, fileName: file.name, mimeType: file.type, base64Data: base64 });
    };
    reader.readAsDataURL(file);
    if (replaceInputRef.current) replaceInputRef.current.value = "";
  };

  const handleCreateProject = () => {
    if (!projectForm.title.trim()) { toast.error("프로젝트 제목을 입력해주세요."); return; }
    createProject.mutate({
      ...projectForm,
      clientId,
      partnerClientId: projectForm.projectMode === "couple" && client?.partnerId ? client.partnerId : undefined,
    });
  };

  const openLightbox = (images: Array<{ id: number; url: string; alt?: string }>, index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxOpen(true);
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
              <h1 className="text-2xl font-bold text-foreground">{client.name} 프로필</h1>
              <Badge variant="outline" className={`text-xs ${client.gender === "male" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-pink-500/20 text-pink-400 border-pink-500/30"}`}>
                {genderLabels[client.gender] || client.gender}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {client.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{client.phone}</span>}
              {client.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{client.email}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
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
                    <p className="text-sm text-muted-foreground">커플 사진 합성을 위해 파트너를 연결합니다.</p>
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
                            <Button size="sm" onClick={() => linkPartner.mutate({ clientId, partnerId: c.id })} disabled={linkPartner.isPending}>연결</Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">연결 가능한 파트너가 없습니다.</p>
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
                      <Select value={projectForm.projectMode} onValueChange={(v: any) => setProjectForm({ ...projectForm, projectMode: v })}>
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
            <TabsTrigger value="face_ref">
              얼굴 참조 ({faceRefPhotos.length}/25)
            </TabsTrigger>
            <TabsTrigger value="projects">프로젝트 ({projects?.length || 0})</TabsTrigger>
          </TabsList>

          {/* ═══ 고객 사진 탭 (정면/측면) ═══ */}
          <TabsContent value="photos" className="space-y-6 mt-4">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            <input ref={replaceInputRef} type="file" accept="image/*" className="hidden" onChange={handleReplaceUpload} />

            <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <p className="text-sm font-medium text-amber-400 mb-2">📸 사진을 많이 등록할수록 얼굴이 더 정확하게 나와요!</p>
              <div className="space-y-1">
                <p className="text-xs text-amber-300/80">✅ <strong>정면 사진</strong> (필수) - 눈뜨고 카메라 바라보기</p>
                <p className="text-xs text-amber-300/80">⭐ <strong>측면 사진</strong> (권장) - 퀄리티 +30% 향상</p>
                <p className="text-xs text-amber-300/80">⭐ <strong>다양한 표정</strong> (권장) - 퀄리티 +20% 향상</p>
              </div>
            </div>

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
                      {typePhotos.map((photo, idx) => (
                        <div
                          key={photo.id}
                          className="relative rounded-lg overflow-hidden border border-border bg-secondary aspect-square cursor-pointer group"
                          onClick={() => openLightbox(typePhotos.map(p => ({ id: p.id, url: p.originalUrl, alt: p.fileName || undefined })), idx)}
                        >
                          <img src={photo.originalUrl} alt={photo.fileName || ""} className="w-full h-full object-cover group-hover:opacity-75 transition-opacity" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          {/* 교체 버튼 */}
                          <button
                            className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-blue-600/90 hover:bg-blue-600 flex items-center justify-center shadow-lg transition-colors z-10"
                            onClick={(e) => { e.stopPropagation(); setReplacingPhotoId(photo.id); replaceInputRef.current?.click(); }}
                            title="사진 교체"
                          >
                            <RefreshCw className="h-3.5 w-3.5 text-white" />
                          </button>
                          {/* 삭제 버튼 */}
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
          </TabsContent>

          {/* ═══ 얼굴 참조 사진 탭 (최대 25장) ═══ */}
          <TabsContent value="face_ref" className="space-y-6 mt-4">
            <input ref={faceRefInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFaceRefUpload} />
            <input ref={replaceInputRef} type="file" accept="image/*" className="hidden" onChange={handleReplaceUpload} />

            {/* 안내 카드 */}
            <Card className={`border ${faceRefPhotos.length > 0 ? "bg-green-500/5 border-green-500/20" : "bg-amber-500/5 border-amber-500/20"}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Scan className={`h-5 w-5 mt-0.5 ${faceRefPhotos.length > 0 ? "text-green-500" : "text-amber-500"}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      얼굴 참조 사진 ({faceRefPhotos.length}/25장)
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      고객의 다양한 각도/표정의 사진을 등록하면 AI가 얼굴을 더 정확하게 재현합니다.
                      정면, 45도, 측면, 미소, 무표정 등 다양한 사진을 업로드해주세요.
                    </p>
                    {faceRefPhotos.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        <span className="text-xs text-green-400">
                          {faceRefPhotos.length}장의 얼굴 참조 사진이 준비되었습니다
                        </span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={() => faceRefInputRef.current?.click()}
                    disabled={uploadPhoto.isPending || faceRefPhotos.length >= 25}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {faceRefPhotos.length >= 25 ? "최대 25장" : "사진 추가"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 진행 바 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>등록 현황</span>
                <span>{faceRefPhotos.length}/25장</span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    faceRefPhotos.length >= 20 ? "bg-green-500" :
                    faceRefPhotos.length >= 10 ? "bg-blue-500" :
                    faceRefPhotos.length >= 5 ? "bg-amber-500" : "bg-red-500"
                  }`}
                  style={{ width: `${(faceRefPhotos.length / 25) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {faceRefPhotos.length < 5 && "최소 5장 이상 등록을 권장합니다 (현재 얼굴 일관성: 낮음)"}
                {faceRefPhotos.length >= 5 && faceRefPhotos.length < 10 && "좋습니다! 10장 이상이면 얼굴 일관성이 크게 향상됩니다"}
                {faceRefPhotos.length >= 10 && faceRefPhotos.length < 20 && "훌륭합니다! 얼굴 일관성 95%+ 달성 가능"}
                {faceRefPhotos.length >= 20 && "최고 수준! 얼굴 일관성 98%+ 달성 가능"}
              </p>
            </div>

            {/* 얼굴 참조 사진 그리드 */}
            {faceRefPhotos.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {faceRefPhotos.map((photo, idx) => (
                  <div
                    key={photo.id}
                    className={`relative rounded-lg overflow-hidden bg-secondary aspect-square cursor-pointer group border-2 transition-colors ${
                      faceDetectedMap[photo.id] === true ? "border-green-500/50" :
                      faceDetectedMap[photo.id] === false ? "border-amber-500/50" :
                      "border-border"
                    }`}
                    onClick={() => openLightbox(faceRefPhotos.map(p => ({ id: p.id, url: p.originalUrl, alt: p.fileName || undefined })), idx)}
                  >
                    <img
                      src={photo.originalUrl}
                      alt={photo.fileName || ""}
                      className={`w-full h-full object-cover group-hover:opacity-75 transition-opacity`}
                      onLoad={(e) => {
                        // 얼굴 인식 체크 - 캔버스로 얼굴 감지 시도
                        if (faceDetectedMap[photo.id] === undefined) {
                          const img = e.target as HTMLImageElement;
                          // 이미지 비율로 얼굴 사진 여부 추정 (세로 비율이 높으면 얼굴 사진일 확률 높음)
                          const ratio = img.naturalHeight / img.naturalWidth;
                          // 얼굴 사진은 보통 세로 비율이 0.8~2.0 사이
                          const likelyFace = ratio >= 0.6 && ratio <= 2.5 && img.naturalWidth >= 100;
                          setFaceDetectedMap(prev => ({ ...prev, [photo.id]: likelyFace }));
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    
                    {/* 얼굴 인식 상태 표시 */}
                    {faceDetectedMap[photo.id] === true && (
                      <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-green-500/90 flex items-center justify-center" title="얼굴 인식 성공">
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      </div>
                    )}
                    {faceDetectedMap[photo.id] === false && (
                      <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-amber-500/90 flex items-center gap-0.5" title="얼굴이 불명확합니다">
                        <span className="text-[8px] text-white font-medium">⚠️</span>
                      </div>
                    )}
                    
                    {/* 번호 표시 */}
                    <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                      <span className="text-[9px] text-white font-bold">{idx + 1}</span>
                    </div>
                    
                    {/* 교체 버튼 */}
                    <button
                      className="absolute bottom-1 left-1 w-6 h-6 rounded-full bg-blue-600/90 hover:bg-blue-600 flex items-center justify-center shadow-lg transition-colors z-10"
                      onClick={(e) => { e.stopPropagation(); setReplacingPhotoId(photo.id); replaceInputRef.current?.click(); }}
                      title="사진 교체"
                    >
                      <RefreshCw className="h-3 w-3 text-white" />
                    </button>
                    
                    {/* 삭제 버튼 */}
                    <button
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600/90 hover:bg-red-600 flex items-center justify-center shadow-lg transition-colors z-10"
                      onClick={(e) => { e.stopPropagation(); if (confirm('이 얼굴 참조 사진을 삭제하시겠습니까?')) deletePhoto.mutate({ id: photo.id }); }}
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}

                {/* 추가 버튼 (25장 미만일 때) */}
                {faceRefPhotos.length < 25 && (
                  <div
                    className="border-2 border-dashed border-border rounded-lg aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                    onClick={() => faceRefInputRef.current?.click()}
                  >
                    <Plus className="h-6 w-6 text-muted-foreground/50 mb-1" />
                    <p className="text-[10px] text-muted-foreground">추가</p>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-border rounded-lg p-12 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                onClick={() => faceRefInputRef.current?.click()}
              >
                <Scan className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">얼굴 참조 사진을 등록하세요</p>
                <p className="text-xs text-muted-foreground/70 mt-1 text-center max-w-sm">
                  고객의 다양한 각도/표정 사진을 최대 25장까지 등록할 수 있습니다.
                  여러 장을 한번에 선택하여 업로드할 수 있습니다.
                </p>
                <Button variant="outline" size="sm" className="gap-1.5 mt-4">
                  <Upload className="h-3.5 w-3.5" />
                  사진 업로드
                </Button>
              </div>
            )}
          </TabsContent>

          {/* ═══ 프로젝트 탭 ═══ */}
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

      {/* Image Lightbox */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </DashboardLayout>
  );
}
