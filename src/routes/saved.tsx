import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { savedVideosQuery } from "@/lib/queries";
import { Header } from "@/components/Header";
import { EmptyState, VideoCard, VideoGridSkeleton } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "後で見る｜Stickman video" },
      { name: "description", content: "保存した棒人間動画を後からまとめて見られる再生リストです。" },
      { property: "og:title", content: "後で見る｜Stickman video" },
      { property: "og:description", content: "保存した棒人間動画の再生リスト。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SavedPage,
});

function SavedPage() {
  const { user, loading } = useAuth();
  const { data = [], isPending } = useQuery(savedVideosQuery(user?.id));

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-extrabold">後で見る</h1>
        <p className="mt-1 text-sm text-muted-foreground">保存した動画の再生リストです。</p>

        <div className="mt-6">
          {!user && !loading ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16">
              <p className="text-sm text-muted-foreground">
                ログインすると動画を保存できます。
              </p>
              <Button asChild>
                <Link to="/auth">ログイン</Link>
              </Button>
            </div>
          ) : isPending || loading ? (
            <VideoGridSkeleton count={3} />
          ) : data.length === 0 ? (
            <EmptyState
              title="保存した動画はありません"
              description="動画ページの「保存」ボタンで後で見るリストに追加できます。"
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data
                .filter((row) => row.video)
                .map((row) => (
                  <VideoCard key={row.videoId} video={row.video!} />
                ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
