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

type Friend = { id: string; username: string; display_name: string; avatar_url: string | null };

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "フレンド一覧｜Stickman video" },
      { name: "description", content: "フレンド申請を許可して追加したフレンドの一覧。DMもここから送れます。" },
      { property: "og:title", content: "フレンド一覧｜Stickman video" },
      { property: "og:description", content: "追加したフレンドの一覧とDM。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FriendsPage,
});

function FriendsPage() {
  const { user, loading } = useAuth();

  const { data: friends = [], isPending } = useQuery({
    queryKey: ["friends", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<Friend[]> => {
      const db = supabase as any;
      const { data, error } = await db
        .from("friendships")
        .select("user_a,user_b,created_at,a:profiles!friendships_user_a_fkey(id,username,display_name,avatar_url),b:profiles!friendships_user_b_fkey(id,username,display_name,avatar_url)")
        .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .map((row: any) => (row.user_a === user!.id ? row.b : row.a))
        .filter(Boolean) as Friend[];
    },
  });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 pb-24">
        <h1 className="text-2xl font-extrabold">フレンド</h1>
        <p className="mt-1 text-sm text-muted-foreground">フレンド申請を許可すると、ここに追加されます。</p>

        {!user && !loading ? (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16">
            <p className="text-sm text-muted-foreground">ログインするとフレンドが表示されます。</p>
            <Button asChild><Link to="/auth">ログイン</Link></Button>
          </div>
        ) : isPending || loading ? (
          <div className="mt-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-strong" />)}</div>
        ) : friends.length === 0 ? (
          <div className="mt-6"><EmptyState title="まだフレンドがいません" description="気になるチャンネルのプロフィールから「フレンド申請」を送ってみましょう。" /></div>
        ) : (
          <ul className="mt-6 space-y-2">
            {friends.map((friend) => (
              <li key={friend.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <Link to="/u/$username" params={{ username: friend.username }} className="flex min-w-0 flex-1 items-center gap-3">
                  <UserAvatar src={friend.avatar_url} name={friend.display_name} className="size-10" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-semibold">{friend.display_name}<AdminBadge userId={friend.id} /></p>
                    <p className="truncate text-xs text-muted-foreground">@{friend.username}</p>
                  </div>
                </Link>
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <Link to="/messages/$username" params={{ username: friend.username }}><MessageCircle className="mr-1.5 size-4" />DM</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
