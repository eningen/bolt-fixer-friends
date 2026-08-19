import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Header } from "@/components/Header";
import { EmptyState, VideoCard, VideoGridSkeleton } from "@/components/VideoCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { likeRankingQuery, rankingByViewsQuery } from "@/lib/queries";

export const Route = createFileRoute("/ranking")({
  head: () => ({
    meta: [
      { title: "ランキング｜Stickman video" },
      {
        name: "description",
        content: "棒人間動画の再生回数ランキングといいね数ランキング。人気の作品をチェック。",
      },
      { property: "og:title", content: "ランキング｜Stickman video" },
      {
        property: "og:description",
        content: "棒人間動画の再生回数ランキングといいね数ランキング。",
      },
    ],
  }),
  component: RankingPage,
});

function RankingPage() {
  const views = useQuery(rankingByViewsQuery);
  const likes = useQuery(likeRankingQuery);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-5 text-2xl font-extrabold">ランキング</h1>

        <Tabs defaultValue="views">
          <TabsList className="mb-6">
            <TabsTrigger value="views">再生回数</TabsTrigger>
            <TabsTrigger value="likes">いいね数</TabsTrigger>
          </TabsList>

          <TabsContent value="views">
            {views.isPending ? (
              <VideoGridSkeleton />
            ) : views.data && views.data.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {views.data.map((video, index) => (
                  <VideoCard key={video.id} video={video} rank={index + 1} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="ランキングはまだ空です"
                description="動画が投稿されると、ここに再生回数の順位が表示されます。"
              />
            )}
          </TabsContent>

          <TabsContent value="likes">
            {likes.isPending ? (
              <VideoGridSkeleton />
            ) : likes.data && likes.data.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {likes.data.map((entry, index) => (
                  <div key={entry.video.id}>
                    <VideoCard video={entry.video} rank={index + 1} />
                    <p className="mt-1 pl-12 text-xs font-medium text-primary">
                      いいね {entry.likes}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="ランキングはまだ空です"
                description="いいねが付くと、ここに順位が表示されます。"
              />
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
