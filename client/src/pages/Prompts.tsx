import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Plus, Sparkles, Copy, Trash2, Star, BarChart3 } from "lucide-react";
import { toast } from "sonner";

const categoryLabels: Record<string, string> = {
  wedding: "웨딩", restoration: "복원", kids: "키즈", profile: "프로필", video: "영상", custom: "커스텀",
};

const defaultPrompts = [
  { category: "wedding", subcategory: "클래식 스튜디오", title: "클래식 웨딩 스튜디오", prompt: "A romantic wedding couple, elegant white lace dress with intricate details, sharp black tuxedo, soft studio lighting with rim light, high-end editorial photography, shot on Sony A7R IV, 85mm lens, f/1.8, photorealistic skin texture, natural skin pores, 8k ultra high resolution, professional color grading", negativePrompt: "(deformed, distorted, disfigured:1.3), poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, (mutated hands and fingers:1.4), disconnected limbs, mutation, mutated, ugly, disgusting, blurry, amputation, plastic skin, cartoon, anime" },
  { category: "wedding", subcategory: "유럽 가든", title: "유럽 가든 웨딩", prompt: "Candid moment of a bride and groom laughing in a blooming European garden with roses and wisteria, golden hour sunlight, natural lens flare, dreamy atmosphere, cinematic bokeh, highly detailed silk wedding dress, professional wedding photography, shot on Canon EOS R5, 50mm f/1.2, warm color palette", negativePrompt: "(deformed, distorted:1.3), bad anatomy, extra limb, missing limb, (mutated hands:1.4), blurry, plastic skin, cartoon, anime, low quality" },
  { category: "wedding", subcategory: "시네마틱 캔들", title: "시네마틱 캔들라이트", prompt: "Intimate candlelit wedding scene, warm amber lighting from hundreds of candles, soft shadows, luxury ballroom interior with crystal chandeliers, emotional expressions, film grain texture, 35mm film aesthetic, masterpiece, ultra-realistic, shot on Leica M11, natural skin texture", negativePrompt: "(deformed:1.3), bad anatomy, extra limb, (mutated hands:1.4), blurry, plastic skin, cartoon, anime, overexposed" },
  { category: "wedding", subcategory: "해변 석양", title: "해변 석양 웨딩", prompt: "Beautiful wedding couple on a pristine beach at sunset, dramatic orange and pink sky, gentle waves, flowing white dress in the wind, barefoot on sand, romantic silhouette, professional destination wedding photography, shot on Nikon Z9, 70-200mm f/2.8, golden hour magic", negativePrompt: "(deformed:1.3), bad anatomy, extra limb, (mutated hands:1.4), blurry, plastic skin, cartoon, anime" },
  { category: "restoration", subcategory: "흑백 복원", title: "흑백 사진 컬러 복원", prompt: "Restore and colorize this old black and white photograph, add natural realistic colors, preserve all original details and composition, enhance facial features, remove scratches and damage, professional photo restoration, high resolution output", negativePrompt: "artificial colors, oversaturated, cartoon, anime, blurry, distorted" },
  { category: "restoration", subcategory: "고화질 복원", title: "저화질 사진 고화질 복원", prompt: "Enhance and restore this low quality photograph to ultra high resolution, sharpen details, remove noise and artifacts, restore facial details and skin texture, improve lighting and contrast, professional photo enhancement", negativePrompt: "blurry, noisy, artifacts, distorted, oversaturated" },
  { category: "kids", subcategory: "동화 주인공", title: "동화 속 주인공", prompt: "A cute child as the main character in a magical fairy tale scene, enchanted forest with glowing fireflies, soft dreamy lighting, storybook illustration style but photorealistic, whimsical atmosphere, professional children's photography, warm and magical color palette", negativePrompt: "(deformed:1.3), bad anatomy, scary, dark, horror, blurry, low quality" },
  { category: "kids", subcategory: "미래 모습", title: "아이의 미래 모습", prompt: "Professional portrait of a young adult, natural aging progression, maintaining facial features and characteristics, modern professional attire, studio lighting, confident expression, high-end portrait photography, 8k resolution", negativePrompt: "(deformed:1.3), bad anatomy, blurry, low quality, cartoon, anime" },
];

export default function PromptsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [formData, setFormData] = useState({
    category: "wedding" as any,
    subcategory: "",
    title: "",
    prompt: "",
    negativePrompt: "",
  });

  const utils = trpc.useUtils();
  const { data: prompts, isLoading } = trpc.prompts.list.useQuery(
    activeCategory !== "all" ? { category: activeCategory } : undefined
  );

  const createPrompt = trpc.prompts.create.useMutation({
    onSuccess: () => {
      utils.prompts.list.invalidate();
      setIsDialogOpen(false);
      setFormData({ category: "wedding", subcategory: "", title: "", prompt: "", negativePrompt: "" });
      toast.success("프롬프트가 저장되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  const deletePrompt = trpc.prompts.delete.useMutation({
    onSuccess: () => { utils.prompts.list.invalidate(); toast.success("프롬프트가 삭제되었습니다."); },
  });

  const handleSaveDefault = (dp: typeof defaultPrompts[0]) => {
    createPrompt.mutate({
      category: dp.category as any,
      subcategory: dp.subcategory,
      title: dp.title,
      prompt: dp.prompt,
      negativePrompt: dp.negativePrompt,
      isDefault: true,
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("프롬프트가 클립보드에 복사되었습니다.");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">프롬프트 라이브러리</h1>
            <p className="text-muted-foreground text-sm mt-1">검증된 고퀄리티 프롬프트를 관리합니다</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />새 프롬프트</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl bg-card border-border">
              <DialogHeader><DialogTitle className="text-foreground">새 프롬프트 등록</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-foreground">카테고리</Label>
                    <Select value={formData.category} onValueChange={(v: any) => setFormData({ ...formData, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">서브카테고리</Label>
                    <Input placeholder="예: 클래식 스튜디오" value={formData.subcategory} onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">제목 *</Label>
                  <Input placeholder="프롬프트 제목" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">프롬프트 *</Label>
                  <Textarea rows={4} placeholder="영문 프롬프트를 입력하세요..." value={formData.prompt} onChange={(e) => setFormData({ ...formData, prompt: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">네거티브 프롬프트</Label>
                  <Textarea rows={3} placeholder="제외할 요소를 입력하세요..." value={formData.negativePrompt} onChange={(e) => setFormData({ ...formData, negativePrompt: e.target.value })} />
                </div>
                <Button onClick={() => { if (!formData.title || !formData.prompt) { toast.error("제목과 프롬프트를 입력해주세요."); return; } createPrompt.mutate(formData); }} className="w-full" disabled={createPrompt.isPending}>
                  {createPrompt.isPending ? "저장 중..." : "프롬프트 저장"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="bg-secondary">
            <TabsTrigger value="all">전체</TabsTrigger>
            {Object.entries(categoryLabels).map(([k, v]) => <TabsTrigger key={k} value={k}>{v}</TabsTrigger>)}
          </TabsList>

          {/* Default Prompts Section */}
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">프리미엄 프리셋</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {defaultPrompts
                .filter(dp => activeCategory === "all" || dp.category === activeCategory)
                .map((dp, i) => (
                <Card key={i} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                          <h3 className="font-semibold text-card-foreground text-sm">{dp.title}</h3>
                        </div>
                        <Badge variant="secondary" className="text-xs mt-1">{categoryLabels[dp.category]} / {dp.subcategory}</Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(dp.prompt)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSaveDefault(dp)}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3 mt-2">{dp.prompt}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* User Prompts */}
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">내 프롬프트</h2>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[1, 2].map(i => <Card key={i} className="bg-card border-border animate-pulse"><CardContent className="p-4 h-24" /></Card>)}
              </div>
            ) : prompts && prompts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {prompts.map(p => (
                  <Card key={p.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-card-foreground text-sm">{p.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">{categoryLabels[p.category] || p.category}</Badge>
                            {p.subcategory && <span className="text-xs text-muted-foreground">{p.subcategory}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <BarChart3 className="h-3 w-3" />{p.usageCount}
                          </span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(p.prompt)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletePrompt.mutate({ id: p.id })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3 mt-2">{p.prompt}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Sparkles className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground text-sm">저장된 프롬프트가 없습니다</p>
                  <p className="text-muted-foreground/70 text-xs mt-1">프리미엄 프리셋을 추가하거나 새 프롬프트를 만들어보세요</p>
                </CardContent>
              </Card>
            )}
          </div>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
