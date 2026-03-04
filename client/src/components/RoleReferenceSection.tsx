import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useRef, useState } from "react";
import {
  Users, UserCircle, Upload, X, Plus, Loader2, Trash2
} from "lucide-react";
import { toast } from "sonner";

interface RoleReferenceSectionProps {
  projectId: number;
  projectMode: "couple" | "family";
  roleReferenceImages: Record<string, string[]>;
  familyMembers: Array<{ role: string; label: string; clientId?: number }>;
}

// 커플 모드 기본 역할
const COUPLE_ROLES = [
  { role: "bride", label: "신부", icon: "👰", color: "pink" },
  { role: "groom", label: "신랑", icon: "🤵", color: "blue" },
];

// 가족 모드 기본 역할 프리셋
const FAMILY_ROLE_PRESETS = [
  { role: "father", label: "아버지" },
  { role: "mother", label: "어머니" },
  { role: "son", label: "아들" },
  { role: "daughter", label: "딸" },
  { role: "grandfather", label: "할아버지" },
  { role: "grandmother", label: "할머니" },
];

function RoleUploadCard({
  projectId,
  role,
  label,
  icon,
  colorClass,
  images,
}: {
  projectId: number;
  role: string;
  label: string;
  icon?: string;
  colorClass: string;
  images: string[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const uploadMutation = trpc.projects.uploadRoleRefImage.useMutation({
    onSuccess: () => {
      utils.projects.getById.invalidate();
      toast.success(`${label} 참조 이미지가 업로드되었습니다.`);
    },
    onError: (err) => toast.error(`업로드 실패: ${err.message}`),
  });

  const removeMutation = trpc.projects.removeRoleRefImage.useMutation({
    onSuccess: () => {
      utils.projects.getById.invalidate();
      toast.success(`${label} 참조 이미지가 삭제되었습니다.`);
    },
    onError: (err) => toast.error(`삭제 실패: ${err.message}`),
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name}은 이미지 파일이 아닙니다.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}은 10MB를 초과합니다.`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        try {
          await uploadMutation.mutateAsync({
            projectId,
            role,
            fileName: file.name,
            mimeType: file.type,
            base64Data: base64.split(",")[1],
          });
        } catch {
          // error handled by mutation
        }
      };
      reader.readAsDataURL(file);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemove = (imageUrl: string) => {
    removeMutation.mutate({ projectId, role, imageUrl });
  };

  return (
    <div className={`p-3 rounded-lg border ${colorClass}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-base">{icon}</span>}
        {!icon && <UserCircle className="h-4 w-4 text-muted-foreground" />}
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {images.length}/5장
        </span>
      </div>

      {/* 업로드된 이미지 그리드 */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {images.map((url, idx) => (
            <div key={idx} className="relative aspect-square rounded-md overflow-hidden border border-border group">
              <img
                src={url}
                alt={`${label} ${idx + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect fill='%23333' width='80' height='80'/%3E%3Ctext x='40' y='44' text-anchor='middle' fill='%23999' font-size='10'%3E?%3C/text%3E%3C/svg%3E";
                }}
              />
              <button
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-600/90 hover:bg-red-600 flex items-center justify-center shadow-lg z-10"
                onClick={() => handleRemove(url)}
                disabled={removeMutation.isPending}
              >
                <X className="h-2.5 w-2.5 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 업로드 버튼 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-xs h-7"
        onClick={() => fileInputRef.current?.click()}
        disabled={images.length >= 5 || uploadMutation.isPending}
      >
        {uploadMutation.isPending ? (
          <><Loader2 className="h-3 w-3 animate-spin" />업로드 중...</>
        ) : (
          <><Upload className="h-3 w-3" />{images.length === 0 ? "얼굴 사진 첨부" : "추가 첨부"}</>
        )}
      </Button>
    </div>
  );
}

export default function RoleReferenceSection({
  projectId,
  projectMode,
  roleReferenceImages,
  familyMembers,
}: RoleReferenceSectionProps) {
  const [newMemberRole, setNewMemberRole] = useState("");
  const [newMemberLabel, setNewMemberLabel] = useState("");
  const utils = trpc.useUtils();

  const updateFamilyMutation = trpc.projects.updateFamilyMembers.useMutation({
    onSuccess: () => {
      utils.projects.getById.invalidate();
    },
    onError: (err) => toast.error(`구성원 업데이트 실패: ${err.message}`),
  });

  const handleAddFamilyMember = () => {
    if (!newMemberLabel.trim()) {
      toast.error("구성원 이름을 입력해주세요.");
      return;
    }
    const role = newMemberRole || `member_${Date.now()}`;
    const updated = [...familyMembers, { role, label: newMemberLabel.trim() }];
    updateFamilyMutation.mutate({ projectId, familyMembers: updated });
    setNewMemberRole("");
    setNewMemberLabel("");
    toast.success(`${newMemberLabel.trim()} 구성원이 추가되었습니다.`);
  };

  const handleRemoveFamilyMember = (role: string) => {
    const updated = familyMembers.filter(m => m.role !== role);
    updateFamilyMutation.mutate({ projectId, familyMembers: updated });
    toast.success("구성원이 삭제되었습니다.");
  };

  if (projectMode === "couple") {
    return (
      <Card className="bg-card border-border border-pink-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-foreground text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-pink-400" />
            커플 역할별 참조 사진
          </CardTitle>
          <p className="text-[10px] text-muted-foreground">
            신부와 신랑의 얼굴 참조 사진을 각각 업로드하세요. AI가 각 인물의 얼굴을 개별적으로 합성합니다.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {COUPLE_ROLES.map(({ role, label, icon, color }) => (
            <RoleUploadCard
              key={role}
              projectId={projectId}
              role={role}
              label={label}
              icon={icon}
              colorClass={
                color === "pink"
                  ? "bg-pink-500/5 border-pink-500/20"
                  : "bg-blue-500/5 border-blue-500/20"
              }
              images={roleReferenceImages[role] || []}
            />
          ))}
        </CardContent>
      </Card>
    );
  }

  // 가족 모드
  return (
    <Card className="bg-card border-border border-orange-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-foreground text-sm flex items-center gap-2">
          <Users className="h-4 w-4 text-orange-400" />
          가족 구성원별 참조 사진
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">
          가족 구성원을 추가하고 각 인물의 얼굴 참조 사진을 업로드하세요. AI가 각 인물의 얼굴을 개별적으로 합성합니다.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* 등록된 가족 구성원 */}
        {familyMembers.map((member) => (
          <div key={member.role} className="relative">
            <RoleUploadCard
              projectId={projectId}
              role={member.role}
              label={member.label}
              colorClass="bg-orange-500/5 border-orange-500/20"
              images={roleReferenceImages[member.role] || []}
            />
            <button
              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-red-600/80 hover:bg-red-600 flex items-center justify-center"
              onClick={() => handleRemoveFamilyMember(member.role)}
              title="구성원 삭제"
            >
              <Trash2 className="h-2.5 w-2.5 text-white" />
            </button>
          </div>
        ))}

        {/* 구성원 추가 */}
        <div className="p-3 rounded-lg border border-dashed border-orange-500/30 bg-orange-500/5">
          <Label className="text-xs text-foreground mb-2 block">구성원 추가</Label>
          
          {/* 프리셋 버튼 */}
          <div className="flex flex-wrap gap-1 mb-2">
            {FAMILY_ROLE_PRESETS.filter(
              preset => !familyMembers.some(m => m.role === preset.role)
            ).map(preset => (
              <button
                key={preset.role}
                className="text-[10px] px-2 py-1 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 transition-colors"
                onClick={() => {
                  setNewMemberRole(preset.role);
                  setNewMemberLabel(preset.label);
                }}
              >
                + {preset.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="이름 (예: 아버지, 큰딸...)"
              value={newMemberLabel}
              onChange={(e) => {
                setNewMemberLabel(e.target.value);
                if (!newMemberRole) setNewMemberRole(`member_${Date.now()}`);
              }}
              className="text-xs flex-1 h-8"
              onKeyDown={(e) => { if (e.key === "Enter") handleAddFamilyMember(); }}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={handleAddFamilyMember}
              disabled={!newMemberLabel.trim() || updateFamilyMutation.isPending}
            >
              <Plus className="h-3 w-3" />추가
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
