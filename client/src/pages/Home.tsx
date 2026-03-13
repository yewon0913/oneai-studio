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
      href: "/clients",
    },
    {
      title: "진행중 프로젝트",
      value: stats?.activeProjects ?? 0,
      icon: Clock,
      href: "/projects",
    },
    {
      title: "완료된 프로젝트",
      value: stats?.completedProjects ?? 0,
      icon: CheckCircle2,
      href: "/projects",
    },
    {
      title: "읽지 않은 알림",
      value: notifications?.length ?? 0,
      icon: Bell,
      href: "/notifications",
    },
  ];

  const quickActions = [
    {
      title: "새 고객 등록",
      description: "고객 정보와 사진을 등록합니다",
      icon: Users,
      href: "/clients",
    },
    {
      title: "새 프로젝트 생성",
      description: "AI 이미지/영상 프로젝트를 시작합니다",
      icon: FolderOpen,
      href: "/projects",
    },
    {
      title: "뷰티 브랜딩",
      description: "당신의 사진으로 4가지 뷰티 스타일 생성",
      icon: Sparkles,
      href: "/beauty",
    },
    {
      title: "기억복원소",
      description: "오래된 사진을 복원하고 영상으로 만들기",
      icon: Clock,
      href: "/memory",
    },
    {
      title: "커플 합성",
      description: "신부·신랑 사진으로 웨딩 커플 사진 생성",
      icon: Sparkles,
      href: "/couple",
    },
    {
      title: "Gemini 웨딩",
      description: "각자 사진으로 Gemini AI 웨딩 사진 생성",
      icon: Sparkles,
      href: "/gemini-wedding",
    },
    {
      title: "최종 검수",
      description: "생성된 이미지를 검수하고 전달합니다",
      icon: CheckCircle2,
      href: "/review",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Welcome Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              One AI Studio
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
              className="cursor-pointer hover:bg-accent/50 transition-colors border-border"
              onClick={() => setLocation(stat.href)}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-bold mt-1 text-foreground">
                      {isLoading ? "..." : stat.value}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary">
                    <stat.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-4 text-foreground">빠른 작업</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {quickActions.map((action) => (
              <Card
                key={action.title}
                className="cursor-pointer group hover:bg-accent/50 transition-colors border-border overflow-hidden"
                onClick={() => setLocation(action.href)}
              >
                <CardContent className="p-5">
                  <div className="inline-flex p-2.5 rounded-lg bg-secondary mb-3">
                    <action.icon className="h-5 w-5 text-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground">{action.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                  <div className="flex items-center gap-1 mt-3 text-foreground text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    시작하기 <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Workflow Guide */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              워크플로우 가이드
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { step: 1, title: "고객 등록 & 사진 업로드", desc: "성별을 구분하여 고객을 등록하고, 정면/측면 사진을 업로드합니다." },
                { step: 2, title: "템플릿 선택 & AI 생성", desc: "AI 템플릿을 선택하거나 참조 이미지를 첨부하여 이미지를 생성합니다." },
                { step: 3, title: "영상 변환 & 미리보기", desc: "생성된 이미지를 영상으로 변환하고, 마음에 들지 않으면 프롬프트로 재생성합니다." },
                { step: 4, title: "검수 & 고객 전달", desc: "초고화질 업스케일링 후 최종 검수를 거쳐 고객에게 전달합니다." },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-foreground text-background font-bold text-sm shrink-0">{step}</div>
                  <div>
                    <h4 className="font-medium text-foreground">{title}</h4>
                    <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
