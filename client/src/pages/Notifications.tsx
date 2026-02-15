import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  Bell, BellOff, Check, CheckCheck, Image, Upload, AlertTriangle,
  Sparkles, Clock, Trash2
} from "lucide-react";
import { toast } from "sonner";

const typeIcons: Record<string, any> = {
  generation_complete: Sparkles,
  photo_uploaded: Upload,
  urgent_revision: AlertTriangle,
  batch_complete: CheckCheck,
  delivery_ready: Image,
};

const typeLabels: Record<string, string> = {
  generation_complete: "이미지 생성 완료",
  photo_uploaded: "사진 업로드",
  urgent_revision: "긴급 수정 요청",
  batch_complete: "배치 처리 완료",
  delivery_ready: "전달 준비 완료",
};

const typeColors: Record<string, string> = {
  generation_complete: "text-green-400",
  photo_uploaded: "text-blue-400",
  urgent_revision: "text-red-400",
  batch_complete: "text-purple-400",
  delivery_ready: "text-amber-400",
};

export default function NotificationsPage() {
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const utils = trpc.useUtils();
  const { data: notifications, isLoading } = trpc.notifications.list.useQuery(
    { unreadOnly: showUnreadOnly }
  );

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
    },
  });

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      toast.success("모든 알림을 읽음 처리했습니다.");
    },
  });

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">알림</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개` : "모든 알림을 확인했습니다"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            >
              {showUnreadOnly ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
              {showUnreadOnly ? "전체 보기" : "읽지 않은 것만"}
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                모두 읽음
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="bg-card border-border animate-pulse">
                <CardContent className="p-4 h-20" />
              </Card>
            ))}
          </div>
        ) : notifications && notifications.length > 0 ? (
          <div className="space-y-2">
            {notifications.map(notif => {
              const IconComp = typeIcons[notif.type] || Bell;
              const colorClass = typeColors[notif.type] || "text-muted-foreground";
              return (
                <Card
                  key={notif.id}
                  className={`bg-card border-border transition-all ${!notif.isRead ? "border-l-2 border-l-primary" : "opacity-70"}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg bg-secondary shrink-0 ${colorClass}`}>
                        <IconComp className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs">
                            {typeLabels[notif.type] || notif.type}
                          </Badge>
                          {!notif.isRead && (
                            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-card-foreground">{notif.title}</p>
                        {notif.message && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notif.message}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(notif.createdAt).toLocaleString("ko-KR")}
                          </span>
                        </div>
                      </div>
                      {!notif.isRead && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => markRead.mutate({ id: notif.id })}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground">알림이 없습니다</h3>
              <p className="text-muted-foreground text-sm mt-1">새로운 알림이 오면 여기에 표시됩니다</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
