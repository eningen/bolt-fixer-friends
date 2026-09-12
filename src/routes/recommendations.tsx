import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Header } from "@/components/Header";
import { EmptyState, VideoCard, VideoGridSkeleton } from "@/components/VideoCard";
import { latestVideosQuery } from "@/lib/queries";

export const Route = createFileRoute("/recommendations")({
  head: () => ({
    meta: [{ title: "あなたへのおすすめ｜Stickman video" }],
  }),
  component: RecommendationsPage,
});

function RecommendationsPage() {
  const { data, isPending, error } = useQuery(latestVideosQuery);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold">✨ あなたへのおすすめ</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            あなたに合いそうな棒人間動画を見つけよう。
          </p>
        </div>

        {isPending ? (
          <VideoGridSkeleton />
        ) : error ? (
          <EmptyState
            title="動画を読み込めませんでした"
            description="通信状況を確認して、ページを再読み込みしてください。"
          />
        ) : data && data.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="おすすめできる動画がまだありません"
            description="動画が増えると、ここにおすすめ候補が表示されます。"
          />
        )}
      </main>
    </div>
  );
}
