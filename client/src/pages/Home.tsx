import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState } from "react";
import {
  Users,
  FolderOpen,
  Sparkles,
  Bell,
  TrendingUp,
  Clock,
  CheckCircle2,
  Plus,
  ArrowRight,
  Zap,
  Wand2,
  Video,
  Camera,
  Palette,
  Star,
  ExternalLink,
  Flame,
} from "lucide-react";

// ═══ AI 템플릿 갤러리 데이터 ═══
const AI_TEMPLATE_CATEGORIES = [
  { id: "all", label: "전체", icon: Sparkles },
  { id: "wedding", label: "웨딩", icon: Camera },
  { id: "portrait", label: "프로필", icon: Users },
  { id: "video", label: "영상", icon: Video },
  { id: "art", label: "아트", icon: Palette },
  { id: "product", label: "상품", icon: Star },
];

const AI_TEMPLATES = [
  // Freepik 스타일
  {
    id: "freepik-dreamy-wedding",
    title: "드리미 웨딩 포토",
    description: "부드러운 파스텔 톤의 몽환적인 웨딩 사진",
    category: "wedding",
    engine: "Freepik AI",
    engineColor: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    prompt: "Dreamy pastel-toned wedding photo in a European garden, soft bokeh background, golden hour lighting, romantic atmosphere, flower petals floating, photorealistic, 8K",
    thumbnail: "https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=300&fit=crop",
    popular: true,
  },
  {
    id: "freepik-vintage-portrait",
    title: "빈티지 프로필",
    description: "레트로 필름 감성의 프로필 사진",
    category: "portrait",
    engine: "Freepik AI",
    engineColor: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    prompt: "Vintage film-style portrait photo, warm color grading, soft grain texture, natural window light, classic studio background, photorealistic, 8K",
    thumbnail: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=300&fit=crop",
    popular: false,
  },
  // Flux 스타일
  {
    id: "flux-cinematic-couple",
    title: "시네마틱 커플",
    description: "영화 같은 시네마틱 커플 포토",
    category: "wedding",
    engine: "Flux Pro",
    engineColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    prompt: "Cinematic couple portrait, dramatic lighting, shallow depth of field, anamorphic lens flare, movie-like color grading, golden hour, photorealistic, 8K",
    thumbnail: "https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=400&h=300&fit=crop",
    popular: true,
  },
  {
    id: "flux-fantasy-art",
    title: "판타지 아트 포트레이트",
    description: "환상적인 디지털 아트 스타일 초상화",
    category: "art",
    engine: "Flux Pro",
    engineColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    prompt: "Fantasy digital art portrait, ethereal glow, magical particles, dramatic lighting, detailed ornate clothing, mystical background, ultra detailed, 8K",
    thumbnail: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop",
    popular: false,
  },
  // Kling 스타일
  {
    id: "kling-video-wedding",
    title: "웨딩 시네마 영상",
    description: "AI 기반 웨딩 시네마 영상 생성",
    category: "video",
    engine: "Kling AI",
    engineColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    prompt: "Cinematic wedding video, slow motion flower petals, smooth camera movement, romantic music atmosphere, golden hour, 4K cinematic",
    thumbnail: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400&h=300&fit=crop",
    popular: true,
  },
  {
    id: "kling-product-showcase",
    title: "상품 쇼케이스 영상",
    description: "360도 회전 상품 프레젠테이션",
    category: "product",
    engine: "Kling AI",
    engineColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    prompt: "Product showcase video, 360 degree rotation, clean white background, professional studio lighting, smooth animation, 4K",
    thumbnail: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=300&fit=crop",
    popular: false,
  },
  // Runway 스타일
  {
    id: "runway-gen3-motion",
    title: "모션 포트레이트",
    description: "자연스러운 움직임이 있는 포트레이트 영상",
    category: "video",
    engine: "Runway Gen-3",
    engineColor: "bg-green-500/20 text-green-400 border-green-500/30",
    prompt: "Natural motion portrait video, gentle hair movement, subtle smile, soft wind effect, cinematic depth of field, professional studio, 4K",
    thumbnail: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=300&fit=crop",
    popular: true,
  },
  {
    id: "runway-artistic-transform",
    title: "아티스틱 변환",
    description: "사진을 예술 작품으로 변환",
    category: "art",
    engine: "Runway Gen-3",
    engineColor: "bg-green-500/20 text-green-400 border-green-500/30",
    prompt: "Artistic transformation, oil painting style, impressionist color palette, textured brush strokes, dramatic composition, museum quality, 8K",
    thumbnail: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=300&fit=crop",
    popular: false,
  },
  // 추가 템플릿
  {
    id: "flux-korean-hanbok",
    title: "한복 프로필",
    description: "전통 한복을 입은 고급 프로필 사진",
    category: "portrait",
    engine: "Flux Pro",
    engineColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    prompt: "Korean traditional hanbok portrait, elegant silk fabric, traditional Korean garden background, soft natural lighting, cultural beauty, photorealistic, 8K",
    thumbnail: "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=400&h=300&fit=crop",
    popular: true,
  },
  {
    id: "freepik-kids-fairy",
    title: "동화 속 아이",
    description: "동화 속 주인공 같은 아동 사진",
    category: "art",
    engine: "Freepik AI",
    engineColor: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    prompt: "Fairy tale children portrait, magical forest background, soft dreamy lighting, butterflies and flowers, storybook illustration style, photorealistic, 8K",
    thumbnail: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400&h=300&fit=crop",
    popular: false,
  },
  {
    id: "kling-outdoor-wedding",
    title: "야외 웨딩 영상",
    description: "자연 속 로맨틱 웨딩 시네마",
    category: "video",
    engine: "Kling AI",
    engineColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    prompt: "Outdoor wedding cinema, natural forest setting, sunlight through trees, gentle breeze, romantic slow motion, cinematic color grading, 4K",
    thumbnail: "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=400&h=300&fit=crop",
    popular: false,
  },
  {
    id: "runway-fashion-editorial",
    title: "패션 에디토리얼",
    description: "하이패션 매거진 스타일 촬영",
    category: "portrait",
    engine: "Runway Gen-3",
    engineColor: "bg-green-500/20 text-green-400 border-green-500/30",
    prompt: "High fashion editorial portrait, dramatic studio lighting, bold color contrast, avant-garde styling, magazine cover quality, photorealistic, 8K",
    thumbnail: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=300&fit=crop",
    popular: false,
  },
];

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: notifications } = trpc.notifications.list.useQuery(
    { unreadOnly: true },
    { enabled: !!user }
  );

  const filteredTemplates = selectedCategory === "all"
    ? AI_TEMPLATES
    : AI_TEMPLATES.filter(t => t.category === selectedCategory);

  const statCards = [
    {
      title: "전체 고객",
      value: stats?.totalClients ?? 0,
      icon: Users,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      href: "/clients",
    },
    {
      title: "진행중 프로젝트",
      value: stats?.activeProjects ?? 0,
      icon: Clock,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      href: "/projects",
    },
    {
      title: "완료된 프로젝트",
      value: stats?.completedProjects ?? 0,
      icon: CheckCircle2,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
      href: "/projects",
    },
    {
      title: "읽지 않은 알림",
      value: notifications?.length ?? 0,
      icon: Bell,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      href: "/notifications",
    },
  ];

  const quickActions = [
    {
      title: "새 고객 등록",
      description: "고객 정보와 사진을 등록합니다",
      icon: Users,
      href: "/clients",
      color: "from-blue-600/20 to-blue-800/20",
    },
    {
      title: "새 프로젝트 생성",
      description: "AI 이미지/영상 프로젝트를 시작합니다",
      icon: FolderOpen,
      href: "/projects",
      color: "from-purple-600/20 to-purple-800/20",
    },
    {
      title: "AI 템플릿 갤러리",
      description: "Flux, Kling, Runway 등 최신 템플릿",
      icon: Sparkles,
      href: "#templates",
      color: "from-amber-600/20 to-amber-800/20",
    },
    {
      title: "최종 검수",
      description: "생성된 이미지를 검수하고 전달합니다",
      icon: CheckCircle2,
      href: "/review",
      color: "from-green-600/20 to-green-800/20",
    },
  ];

  const handleTemplateClick = (template: typeof AI_TEMPLATES[0]) => {
    // 프로젝트 생성 페이지로 이동하면서 프롬프트 전달
    // 실제로는 프로젝트 워크스페이스에서 프롬프트를 사용
    navigator.clipboard?.writeText(template.prompt).then(() => {
      // clipboard API 지원시
    }).catch(() => {});
    setLocation("/projects");
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Welcome Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="gradient-text">One AI Studio</span>
            </h1>
            <p className="text-muted-foreground mt-1">
              {user?.name ? `${user.name}님, 환영합니다` : "AI 이미지 & 영상 생성 전문가 대시보드"}
            </p>
          </div>
          <Button
            onClick={() => setLocation("/clients")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            새 고객 등록
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card
              key={stat.title}
              className="cursor-pointer hover:border-primary/30 transition-all duration-200 bg-card border-border"
              onClick={() => setLocation(stat.href)}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-bold mt-1 text-card-foreground">
                      {isLoading ? "..." : stat.value}
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-4 text-foreground">빠른 작업</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <Card
                key={action.title}
                className="cursor-pointer group hover:border-primary/30 transition-all duration-200 bg-card border-border overflow-hidden"
                onClick={() => {
                  if (action.href === "#templates") {
                    document.getElementById("templates-section")?.scrollIntoView({ behavior: "smooth" });
                  } else {
                    setLocation(action.href);
                  }
                }}
              >
                <CardContent className="p-5">
                  <div className={`inline-flex p-2.5 rounded-lg bg-gradient-to-br ${action.color} mb-3`}>
                    <action.icon className="h-5 w-5 text-foreground" />
                  </div>
                  <h3 className="font-semibold text-card-foreground">{action.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                  <div className="flex items-center gap-1 mt-3 text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    시작하기 <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Workflow Guide */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              워크플로우 가이드
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm shrink-0">1</div>
                <div>
                  <h4 className="font-medium text-card-foreground">고객 등록 & 사진 업로드</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">성별을 구분하여 고객을 등록하고, 정면/측면 사진을 업로드합니다.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm shrink-0">2</div>
                <div>
                  <h4 className="font-medium text-card-foreground">템플릿 선택 & AI 생성</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">AI 템플릿을 선택하거나 참조 이미지를 첨부하여 이미지를 생성합니다.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm shrink-0">3</div>
                <div>
                  <h4 className="font-medium text-card-foreground">영상 변환 & 미리보기</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">생성된 이미지를 영상으로 변환하고, 마음에 들지 않으면 프롬프트로 재생성합니다.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm shrink-0">4</div>
                <div>
                  <h4 className="font-medium text-card-foreground">검수 & 고객 전달</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">초고화질 업스케일링 후 최종 검수를 거쳐 고객에게 전달합니다.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
