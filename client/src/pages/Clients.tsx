import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { Plus, Search, Phone, Mail, MessageSquare, ChevronRight, UserCircle, Users, Heart, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  consulting: "상담중", in_progress: "진행중", completed: "완료", delivered: "전달완료",
};
const statusColors: Record<string, string> = {
  consulting: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  in_progress: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  delivered: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};
const genderLabels: Record<string, string> = { female: "여성 (신부)", male: "남성 (신랑)" };
const genderColors: Record<string, string> = {
  female: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  male: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export default function ClientsPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_progress" | "completed">("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    gender: "female" as "female" | "male",
    phone: "",
    email: "",
    consultationNotes: "",
    preferredConcept: "",
    status: "consulting" as const,
  });

  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const utils = trpc.useUtils();
  const { data: clients, isLoading } = trpc.clients.list.useQuery({ search: search || undefined });
  const createClient = trpc.clients.create.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      utils.dashboard.stats.invalidate();
      setIsDialogOpen(false);
      setFormData({ name: "", gender: "female", phone: "", email: "", consultationNotes: "", preferredConcept: "", status: "consulting" });
      toast.success("고객이 등록되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteClient = trpc.clients.delete.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      utils.dashboard.stats.invalidate();
      setDeleteTarget(null);
      toast.success("고객이 삭제되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) { toast.error("고객 이름을 입력해주세요."); return; }
    createClient.mutate(formData);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">고객 관리</h1>
            <p className="text-muted-foreground text-sm mt-1">고객 정보와 사진을 체계적으로 관리합니다</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />새 고객 등록</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg bg-card border-border">
              <DialogHeader><DialogTitle className="text-foreground">새 고객 등록</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-foreground">이름 *</Label>
                    <Input placeholder="고객 이름" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">성별 *</Label>
                    <Select value={formData.gender} onValueChange={(v: "female" | "male") => setFormData({ ...formData, gender: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="female">여성 (신부)</SelectItem>
                        <SelectItem value="male">남성 (신랑)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-foreground">연락처</Label>
                    <Input placeholder="010-0000-0000" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">이메일</Label>
                    <Input type="email" placeholder="email@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">선호 컨셉</Label>
                  <Select value={formData.preferredConcept} onValueChange={(v) => setFormData({ ...formData, preferredConcept: v })}>
                    <SelectTrigger><SelectValue placeholder="컨셉 선택" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="classic_studio">클래식 스튜디오</SelectItem>
                      <SelectItem value="european_garden">유럽 가든</SelectItem>
                      <SelectItem value="cinematic_candle">시네마틱 캔들</SelectItem>
                      <SelectItem value="beach_sunset">해변 석양</SelectItem>
                      <SelectItem value="restoration">사진 복원</SelectItem>
                      <SelectItem value="kids">키즈</SelectItem>
                      <SelectItem value="custom">커스텀</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">상담 내용</Label>
                  <Textarea placeholder="상담 내용을 기록합니다..." rows={3} value={formData.consultationNotes} onChange={(e) => setFormData({ ...formData, consultationNotes: e.target.value })} />
                </div>
                <Button onClick={handleSubmit} className="w-full" disabled={createClient.isPending}>
                  {createClient.isPending ? "등록 중..." : "고객 등록"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="고객 이름으로 검색..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
              className="whitespace-nowrap"
            >
              전체
            </Button>
            <Button
              variant={statusFilter === "in_progress" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("in_progress")}
              className="whitespace-nowrap"
            >
              진행중
            </Button>
            <Button
              variant={statusFilter === "completed" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("completed")}
              className="whitespace-nowrap"
            >
              완료
            </Button>
          </div>
        </div>

        {/* Client List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-card border-border animate-pulse"><CardContent className="p-5 h-40" /></Card>
            ))}
          </div>
        ) : clients && clients.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients
              .filter((client) => {
                if (statusFilter === "all") return true;
                if (statusFilter === "in_progress") return ["consulting", "in_progress"].includes(client.status);
                if (statusFilter === "completed") return ["completed", "delivered"].includes(client.status);
                return true;
              })
              .map((client) => (
              <Card
                key={client.id}
                className="bg-card border-border hover:border-primary/30 cursor-pointer transition-all duration-200 group"
                onClick={() => setLocation(`/clients/${client.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${client.gender === "male" ? "bg-blue-500/20" : "bg-pink-500/20"}`}>
                        <UserCircle className={`h-5 w-5 ${client.gender === "male" ? "text-blue-400" : "text-pink-400"}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-card-foreground">{client.name}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="outline" className={`text-xs ${genderColors[client.gender] || ""}`}>
                            {genderLabels[client.gender] || client.gender}
                          </Badge>
                          <Badge variant="outline" className={`text-xs ${statusColors[client.status] || ""}`}>
                            {statusLabels[client.status] || client.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ id: client.id, name: client.name });
                        }}
                        title="고객 삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    {client.phone && (
                      <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /><span>{client.phone}</span></div>
                    )}
                    {client.email && (
                      <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /><span className="truncate">{client.email}</span></div>
                    )}
                    {client.partnerId && (
                      <div className="flex items-center gap-2"><Heart className="h-3.5 w-3.5 text-pink-400" /><span className="text-pink-400">커플 연결됨</span></div>
                    )}
                    {client.consultationNotes && (
                      <div className="flex items-start gap-2"><MessageSquare className="h-3.5 w-3.5 mt-0.5" /><span className="line-clamp-2">{client.consultationNotes}</span></div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground">등록된 고객이 없습니다</h3>
              <p className="text-muted-foreground text-sm mt-1">새 고객을 등록하여 시작하세요</p>
              <Button className="mt-4 gap-2" onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4" />첫 고객 등록하기
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">고객 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> 고객을 정말 삭제하시겠습니까? 관련된 사진과 데이터가 모두 삭제되며, 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteTarget && deleteClient.mutate({ id: deleteTarget.id })}
            >
              {deleteClient.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
