import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { notificationsQuery, type NotificationRow } from "@/lib/queries";
import { formatRelativeDate } from "@/lib/video";
import { Header } from "@/components/Header";
import { UserAvatar } from "@/components/UserAvatar";
import { EmptyState } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "通知｜Stickman video" },
      {
        name: "description",
        content: "いいね・コメント・チャンネル登録・登録チャンネルの新着動画のお知らせ。",
      },
      { property: "og:title", content: "通知｜Stickman video" },
      { property: "og:description", content: "あなたのチャンネルへの反応をまとめて確認。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

function label(item: NotificationRow) {
  const who = item.actor?.display_name ?? "だれか";
  switch (item.type) {
    case "like":
      return `${who} さんがあなたの動画にいいねしました`;
    case "comment":
      return `${who} さんがあなたの動画にコメントしました`;
    case "subscribe":
      return `${who} さんがあなたのチャンネルを登録しました`;
    case "new_video":
      return `${who} さんが新しい動画を投稿しました`;
  }
}

function NotificationsPage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const { data = [], isPending } = useQuery(notificationsQuery(user?.id));

  const unread = data.filter((item) => !item.read).length;

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("ログインが必要です");
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
    onError: () => toast.error("更新できませんでした"),
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-extrabold">通知</h1>
          {unread > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              すべて既読にする
            </Button>
          ) : null}
        </div>

        <div className="mt-6">
          {!user && !loading ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16">
              <p className="text-sm text-muted-foreground">ログインすると通知が届きます。</p>
              <Button asChild>
                <Link to="/auth">ログイン</Link>
              </Button>
            </div>
          ) : isPending || loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-lg bg-surface-strong" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <EmptyState
              title="通知はまだありません"
              description="いいね・コメント・チャンネル登録があるとここに表示されます。"
            />
          ) : (
            <ul className="space-y-2">
              {data.map((item) => {
                const content = (
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      src={item.actor?.avatar_url}
                      name={item.actor?.display_name}
                      className="size-9"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{label(item)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.video?.title ? `${item.video.title} · ` : ""}
                        {formatRelativeDate(item.created_at)}
                      </p>
                    </div>
                    {!item.read ? <span className="size-2 rounded-full bg-primary" /> : null}
                  </div>
                );

                const className = cn(
                  "block rounded-lg border border-border p-3 transition-colors hover:bg-accent",
                  !item.read && "bg-surface",
                );

                return (
                  <li key={item.id}>
                    {item.video_id ? (
                      <Link
                        to="/video/$videoId"
                        params={{ videoId: item.video_id }}
                        className={className}
                        onClick={() => {
                          if (!item.read) markRead.mutate(item.id);
                        }}
                      >
                        {content}
                      </Link>
                    ) : item.actor ? (
                      <Link
                        to="/u/$username"
                        params={{ username: item.actor.username }}
                        className={className}
                        onClick={() => {
                          if (!item.read) markRead.mutate(item.id);
                        }}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className={className}>{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
