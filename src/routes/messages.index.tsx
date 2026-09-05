import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { UserAvatar } from "@/components/UserAvatar";
import { EmptyState } from "@/components/VideoCard";
import { AdminBadge } from "@/components/AdminBadge";
import { Button } from "@/components/ui/button";

type Profile = { id: string; username: string; display_name: string; avatar_url: string | null };
type Row = { id: string; sender_id: string; recipient_id: string; body: string; read: boolean; created_at: string };
type Thread = { partner: Profile; last: Row; unread: number };

export const Route = createFileRoute("/messages/")({
  head: () => ({
    meta: [
      { title: "DM一覧｜Stickman video" },
      { name: "description", content: "フレンドとのダイレクトメッセージのやりとりを一覧で確認できます。" },
      { property: "og:title", content: "DM一覧｜Stickman video" },
      { property: "og:description", content: "フレンドとのDMのやりとり一覧。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesIndexPage,
});

function MessagesIndexPage() {
  const { user, loading } = useAuth();

  const { data: threads = [], isPending } = useQuery({
    queryKey: ["dm-threads", user?.id],
    enabled: Boolean(user?.id),
    refetchInterval: 8000,
    queryFn: async (): Promise<Thread[]> => {
      const db = supabase as any;
      const { data, error } = await db
        .from("direct_messages")
        .select("id,sender_id,recipient_id,body,read,created_at")
        .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const rows = (data ?? []) as Row[];
      const ids = Array.from(new Set(rows.map((r) => (r.sender_id === user!.id ? r.recipient_id : r.sender_id))));
      if (ids.length === 0) return [];
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", ids);
      if (profileError) throw profileError;
      const byId = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
      const map = new Map<string, Thread>();
      for (const row of rows) {
        const partnerId = row.sender_id === user!.id ? row.recipient_id : row.sender_id;
        const partner = byId.get(partnerId);
        if (!partner) continue;
        const existing = map.get(partnerId);
        const unreadDelta = row.recipient_id === user!.id && !row.read ? 1 : 0;
        if (existing) existing.unread += unreadDelta;
        else map.set(partnerId, { partner, last: row, unread: unreadDelta });
      }
      return Array.from(map.values());
    },
  });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 pb-24">
        <h1 className="text-2xl font-extrabold">DM</h1>
        <p className="mt-1 text-sm text-muted-foreground">フレンドとのやりとりが新しい順に表示されます。</p>

        {!user && !loading ? (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16">
            <p className="text-sm text-muted-foreground">ログインするとDMが表示されます。</p>
            <Button asChild><Link to="/auth">ログイン</Link></Button>
          </div>
        ) : isPending || loading ? (
          <div className="mt-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-strong" />)}</div>
        ) : threads.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="まだDMはありません" description="フレンド一覧から相手を選んでメッセージを送ってみましょう。" />
            <div className="mt-4 flex justify-center"><Button asChild variant="outline" className="rounded-full"><Link to="/friends">フレンド一覧へ</Link></Button></div>
          </div>
        ) : (
          <ul className="mt-6 space-y-2">
            {threads.map((thread) => (
              <li key={thread.partner.id}>
                <Link to="/messages/$username" params={{ username: thread.partner.username }} className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent">
                  <UserAvatar src={thread.partner.avatar_url} name={thread.partner.display_name} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-semibold">
                      {thread.partner.display_name}
                      <AdminBadge userId={thread.partner.id} />
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {thread.last.sender_id === user?.id ? "自分: " : ""}
                      {thread.last.body}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[10px] text-muted-foreground">{new Date(thread.last.created_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}</span>
                    {thread.unread > 0 ? <span className="flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">{thread.unread > 99 ? "99+" : thread.unread}</span> : <MessageCircle className="size-4 text-muted-foreground" />}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
