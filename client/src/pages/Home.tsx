import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  Users,
  FolderOpen,
  Sparkles,
  Image,
  Bell,
  TrendingUp,
  Clock,
  CheckCircle2,
  Plus,
  ArrowRight,
} from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: notifications } = trpc.notifications.list.useQuery(
    { unreadOnly: true },
    { enabled: !!user }
  );

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
      description: "고객 정보와 사진을 등록합니다 (성별 구분)",
      icon: Users,
      href: "/clients",
      color: "from-blue-600/20 to-blue-800/20",
    },
    {
      title: "새 프로젝트 생성",
      description: "개인/커플 AI 이미지 프로젝트를 시작합니다",
      icon: FolderOpen,
      href: "/projects",
      color: "from-purple-600/20 to-purple-800/20",
    },
    {
      title: "프롬프트 라이브러리",
      description: "검증된 프롬프트를 관리합니다",
      icon: Sparkles,
      href: "/prompts",
      color: "from-amber-600/20 to-amber-800/20",
    },
    {
      title: "배치 생성 (최대 100장)",
      description: "대량 이미지를 한번에 생성합니다",
      icon: Image,
      href: "/batches",
      color: "from-green-600/20 to-green-800/20",
    },
  ];

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
              {user?.name ? `${user.name}님, 환영합니다` : "AI 이미지 생성 전문가 대시보드"}
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
                onClick={() => setLocation(action.href)}
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

        {/* Recent Activity */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              워크플로우 가이드
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm shrink-0">1</div>
                <div>
                  <h4 className="font-medium text-card-foreground">고객 등록 & 사진 업로드</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">성별을 구분하여 고객을 등록하고, 정면/측면 사진을 업로드합니다. 커플은 파트너를 연결합니다.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm shrink-0">2</div>
                <div>
                  <h4 className="font-medium text-card-foreground">AI 이미지 생성 & 튜닝</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">얼굴 고정 모드로 고객 얼굴을 유지하며, 상품 포맷(액자/티셔츠/컵/수건/3D)에 맞게 생성합니다.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm shrink-0">3</div>
                <div>
                  <h4 className="font-medium text-card-foreground">검수 & 고객 전달</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">초고화질 업스케일링 후 최종 검수를 거쳐 고객에게 전달합니다. 배치로 최대 100장 일괄 생성 가능.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
