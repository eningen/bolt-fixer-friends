import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { mailboxMessagesQuery, notificationsQuery, type MailboxMessage, type NotificationRow } from "@/lib/queries";
import { formatRelativeDate } from "@/lib/video";
import { Header } from "@/components/Header";
import { UserAvatar } from "@/components/UserAvatar";
import { EmptyState } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "写真ボックス・通知｜Stickman video" },
      { name: "description", content: "アップデートのお知らせ、重要メール、いいね、コメント、チャンネル登録などをまとめて確認。" },
    ],
  }),
  component: NotificationsPage,
});

function label(item: NotificationRow) {
  const who = item.actor?.display_name ?? "だれか";
  switch (item.type) {
    case "like": return `${who} さんがあなたの動画にいいねしました`;
    case "comment": return `${who} さんがあなたの動画にコメントしました`;
    case "subscribe": return `${who} さんがあなたのチャンネルを登録しました`;
    case "new_video": return `${who} さんが新しい動画を投稿しました`;
    case "friend_request": return item.metadata?.accepted ? `${who} さんがフレンド申請を許可しました` : `${who} さんからフレンド申請が届きました`;
  }
}

function MailboxCard({ item, onRead }: { item: MailboxMessage; onRead: (id: string) => void }) {
  const isImportant = item.category === "important";
  return (
    <button type="button" className={cn("w-full rounded-xl border p-4 text-left transition-colors hover:bg-accent", isImportant ? "border-amber-300/70 bg-amber-50/50 dark:bg-amber-950/10" : "border-border", !item.read && "bg-surface")} onClick={() => { if (!item.read) onRead(item.id); }}>
      <div className="flex items-start gap-3">
        <div className={cn("mt-1 flex size-9 shrink-0 items-center justify-center rounded-full", isImportant ? "bg-amber-500/15 text-amber-700" : "bg-primary/10 text-primary")}>{isImportant ? "⭐" : "✉"}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.title}</p>{isImportant ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-700">最重要メール</span> : null}</div>{!item.read ? <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" /> : null}</div>
          {item.sender ? <p className="mt-1 text-xs font-medium text-muted-foreground">送信者：{item.sender.display_name} @{item.sender.username}</p> : null}
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{item.body}</p>
          <p className="mt-2 text-xs text-muted-foreground">{formatRelativeDate(item.created_at)}</p>
        </div>
      </div>
    </button>
  );
}

function NotificationsPage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const { data: notifications = [], isPending: notificationsPending } = useQuery(notificationsQuery(user?.id));
  const { data: mailbox = [], isPending: mailboxPending } = useQuery(mailboxMessagesQuery(user?.id));
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(() => {
    if (typeof Notification === "undefined") return "unsupported";
    return Notification.permission;
  });

  const unread = notifications.filter((item) => !item.read).length;
  const mailboxUnread = mailbox.filter((item) => !item.read).length;
  const importantUnread = mailbox.filter((item) => item.category === "important" && !item.read).length;
  const isAdmin = user?.id === "aff7aa26-32e9-4595-bcf1-09fd0f3bd720";

  const enableBrowserNotifications = async () => {
    if (typeof Notification === "undefined") { setNotificationPermission("unsupported"); toast.info("このブラウザは通知に対応していません"); return; }
    if (Notification.permission === "denied") { setNotificationPermission("denied"); toast.info("ブラウザの設定から、このサイトの通知を許可してください"); return; }
    if (Notification.permission === "granted") { setNotificationPermission("granted"); toast.success("通知はすでに有効です"); return; }
    try { const permission = await Notification.requestPermission(); setNotificationPermission(permission); if (permission === "granted") toast.success("通知を許可しました"); else if (permission === "denied") toast.info("ブラウザの設定から、このサイトの通知を許可してください"); } catch { toast.info("ブラウザの設定から通知を確認してください"); }
  };

  const markAllRead = useMutation({
    mutationFn: async () => { if (!user) throw new Error("ログインが必要です"); const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false); if (error) throw error; },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
    onError: () => toast.error("更新できませんでした"),
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id); if (error) throw error; },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const markMailboxRead = useMutation({
    mutationFn: async (id: string) => { const db = supabase as any; const { error } = await db.from("mailbox_messages").update({ read: true }).eq("id", id).eq("user_id", user!.id); if (error) throw error; },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["mailbox", user?.id] }),
  });

  const acceptFriend = useMutation({
    mutationFn: async (requestId: string) => {
      if (!user) throw new Error("ログインが必要です");
      const db = supabase as any;
      const { error } = await db.rpc("accept_friend_request", { p_request_id: requestId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("フレンド追加完了！");
      void queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["friendship-status"] });
    },
    onError: (error: Error) => toast.error(error.message || "フレンド申請を許可できませんでした"),
  });

  const publish = useMutation({
    mutationFn: async () => { const db = supabase as any; const { data, error } = await db.rpc("publish_announcement", { p_title: title, p_body: body }); if (error) throw error; return data as number; },
    onSuccess: (count) => { setTitle(""); setBody(""); toast.success(`${count}人にアップデートを配信しました`); void queryClient.invalidateQueries({ queryKey: ["mailbox"] }); },
    onError: (error: Error) => toast.error(error.message || "配信に失敗しました"),
  });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 pb-24">
        <div className="flex items-center justify-between gap-4"><div><h1 className="text-2xl font-extrabold">写真ボックス・通知</h1>{mailboxUnread > 0 ? <p className="mt-1 text-sm text-primary">未読のお知らせが {mailboxUnread} 件あります{importantUnread > 0 ? `・最重要メール ${importantUnread} 件` : ""}</p> : null}</div>{unread > 0 ? <Button variant="secondary" size="sm" className="rounded-full" disabled={markAllRead.isPending} onClick={() => markAllRead.mutate()}>通知をすべて既読</Button> : null}</div>

        <section className="mt-6 rounded-xl border border-border bg-surface/40 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">🔔 ブラウザ通知</h2><p className="mt-1 text-sm text-muted-foreground">新しいアップデートが届いたときにブラウザでも知らせます。</p></div>{notificationPermission === "granted" ? <span className="shrink-0 rounded-full bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">✓ 通知は有効です</span> : notificationPermission === "denied" ? <span className="shrink-0 text-sm text-muted-foreground">ブラウザの設定から通知を許可してください</span> : notificationPermission === "unsupported" ? <span className="shrink-0 text-sm text-muted-foreground">このブラウザは通知に対応していません</span> : <Button type="button" className="shrink-0" onClick={enableBrowserNotifications}>🔔 通知を有効にする</Button>}</div></section>

        {isAdmin ? <section className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4"><h2 className="font-bold">📢 アップデートを全ユーザーへ配信</h2><p className="mt-1 text-xs text-muted-foreground">登録済みの全ユーザーのメールボックスに保存され、サイトを開いているユーザーには通知音も鳴ります。</p><div className="mt-4 space-y-3"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="お知らせのタイトル" maxLength={120} /><Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="アップデート内容を書いてください" rows={5} maxLength={5000} /><Button disabled={publish.isPending || !title.trim() || !body.trim()} onClick={() => publish.mutate()}>{publish.isPending ? "配信中…" : "全ユーザーへ配信"}</Button></div></section> : null}

        <section className="mt-8"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">📬 メールボックス</h2></div>{!user && !loading ? <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16"><p className="text-sm text-muted-foreground">ログインするとお知らせが届きます。</p><Button asChild><Link to="/auth">ログイン</Link></Button></div> : mailboxPending || loading ? <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-strong" />)}</div> : mailbox.length === 0 ? <EmptyState title="お知らせはまだありません" description="運営からのアップデートやコラボ依頼などがここに届きます。" /> : <div className="space-y-3">{[...mailbox].sort((a, b) => Number(b.category === "important") - Number(a.category === "important") || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((item) => <MailboxCard key={item.id} item={item} onRead={(id) => markMailboxRead.mutate(id)} />)}</div>}</section>

        <section className="mt-10"><h2 className="mb-3 text-lg font-bold">🔔 アクティビティ通知</h2>{notificationsPending || loading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-strong" />)}</div> : notifications.length === 0 ? <EmptyState title="通知はまだありません" description="いいね・コメント・チャンネル登録などがあるとここに表示されます。" /> : <ul className="space-y-2">{notifications.map((item) => {
          const isFriendRequest = item.type === "friend_request" && !item.metadata?.accepted;
          const content = <div className="flex items-center gap-3"><UserAvatar src={item.actor?.avatar_url} name={item.actor?.display_name} className="size-9" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{label(item)}</p><p className="truncate text-xs text-muted-foreground">{item.video?.title ? `${item.video.title} · ` : ""}{formatRelativeDate(item.created_at)}</p></div>{!item.read ? <span className="size-2 rounded-full bg-primary" /> : null}</div>;
          const className = cn("block rounded-lg border border-border p-3 transition-colors hover:bg-accent", !item.read && "bg-surface");
          return <li key={item.id}>{isFriendRequest ? <div className={className}><div>{content}</div><Button size="sm" className="mt-3 ml-12" disabled={acceptFriend.isPending} onClick={() => { const requestId = item.metadata?.request_id; if (requestId) acceptFriend.mutate(requestId); }}>{acceptFriend.isPending ? "処理中…" : <><Check className="mr-1.5 size-4" />許可</>}</Button></div> : item.video_id ? <Link to="/video/$videoId" params={{ videoId: item.video_id }} className={className} onClick={() => { if (!item.read) markRead.mutate(item.id); }}>{content}</Link> : item.actor ? <Link to="/u/$username" params={{ username: item.actor.username }} className={className} onClick={() => { if (!item.read) markRead.mutate(item.id); }}>{content}</Link> : <div className={className}>{content}</div>}</li>;
        })}</ul>}</section>
      </main>
    </div>
  );
}
