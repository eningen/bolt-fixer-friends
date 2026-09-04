import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { Header } from "@/components/Header";
import { EmptyState, VideoCard, VideoGridSkeleton } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchVideosQuery } from "@/lib/queries";
import { fetchPopularYouTubeVideos, searchYouTubeVideos } from "@/lib/invidious";

const searchSchema = z.object({ q: z.string().max(100).optional(), source: z.enum(["stickman", "youtube"]).optional() });

export const Route = createFileRoute("/search")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "動画を検索｜Stickman video" },
      { name: "description", content: "Stickman videoとYouTubeの動画を検索できます。" },
      { property: "og:title", content: "動画を検索｜Stickman video" },
      { property: "og:description", content: "Stickman VideoとYouTubeの動画を検索。" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q, source = "stickman" } = Route.useSearch();
  const navigate = useNavigate();
  const [term, setTerm] = useState(q ?? "");
  const isYouTube = source === "youtube";

  // YouTubeタブでは入力を500msデバウンスして自動検索（通信量を削減）
  useEffect(() => {
    if (!isYouTube) return;
    const next = term.trim();
    if (next === (q ?? "")) return;
    const timer = setTimeout(() => {
      void navigate({ to: "/search", search: { q: next || undefined, source: "youtube" }, replace: true });
    }, 500);
    return () => clearTimeout(timer);
  }, [term, isYouTube, q, navigate]);

  const ownQuery = useQuery({ ...searchVideosQuery(q ?? ""), enabled: Boolean(q) && !isYouTube });
  const youtubeQuery = useQuery({
    queryKey: ["invidious", "youtube", q ?? "popular"],
    queryFn: () => (q ? searchYouTubeVideos({ data: q }) : fetchPopularYouTubeVideos()),
    enabled: isYouTube,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (prev) => prev,
  });

  const submitSearch = (nextSource: "stickman" | "youtube") => {
    const nextQuery = term.trim();
    void navigate({ to: "/search", search: { q: nextQuery || undefined, source: nextSource } });
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-extrabold">動画を検索</h1>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch(isYouTube ? "youtube" : "stickman");
          }}
          className="mb-4 flex max-w-xl gap-2"
        >
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="キーワードを入力"
            maxLength={100}
            className="rounded-full bg-surface"
            aria-label="キーワード"
          />
          <Button type="submit" className="rounded-full">検索</Button>
        </form>

        <div className="mb-8 flex gap-2">
          <Button type="button" variant={!isYouTube ? "default" : "outline"} className="rounded-full" onClick={() => submitSearch("stickman")}>
            Stickman Video
          </Button>
          <Button type="button" variant={isYouTube ? "default" : "outline"} className="rounded-full" onClick={() => submitSearch("youtube")}>
            YouTube
          </Button>
        </div>

        {!isYouTube ? (
          !q ? (
            <EmptyState title="キーワードを入力してください" description="Stickman Video内の動画を探せます。" />
          ) : ownQuery.isPending ? (
            <VideoGridSkeleton count={6} />
          ) : ownQuery.data && ownQuery.data.length > 0 ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground">「{q}」のStickman Video検索結果 {ownQuery.data.length} 件</p>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {ownQuery.data.map((video) => <VideoCard key={video.id} video={video} />)}
              </div>
            </>
          ) : (
            <EmptyState title="見つかりませんでした" description={`「${q}」に一致するStickman Videoの動画はありません。`} />
          )
        ) : youtubeQuery.isPending ? (
          <VideoGridSkeleton count={8} />
        ) : youtubeQuery.isError ? (
          <EmptyState title="YouTube検索に失敗しました" description="YouTube検索サーバーに接続できませんでした。しばらくしてからもう一度お試しください。" />
        ) : youtubeQuery.data && youtubeQuery.data.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {q ? `「${q}」のYouTube検索結果` : "YouTubeの人気動画"} {youtubeQuery.data.length} 件
            </p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {youtubeQuery.data.map((video) => {
                const thumbnail = video.videoThumbnails.find((item) => item.quality === "medium") ?? video.videoThumbnails[0];
                return (
                  <button
                    key={video.videoId}
                    type="button"
                    className="group overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    onClick={() => void navigate({ to: "/youtube/$videoId", params: { videoId: video.videoId }, search: { title: video.title } })}
                  >
                    <div className="aspect-video overflow-hidden bg-muted">
                      {thumbnail && <img src={thumbnail.url} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.02]" loading="lazy" />}
                    </div>
                    <div className="p-4">
                      <h2 className="line-clamp-2 font-bold">{video.title}</h2>
                      <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">{video.author}</p>
                      {video.viewCount > 0 && <p className="mt-1 text-xs text-muted-foreground">{video.viewCount.toLocaleString()} 回視聴</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <EmptyState title="見つかりませんでした" description={`「${q}」に一致するYouTube動画はありません。`} />
        )}
      </main>
    </div>
  );
}
