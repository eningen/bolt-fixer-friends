import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";

const youtubeSearchSchema = { title: "" };

export const Route = createFileRoute("/youtube/$videoId")({
  validateSearch: (search) => ({ title: typeof (search as Record<string, unknown>)["title"] === "string" ? String((search as Record<string, unknown>)["title"]) : youtubeSearchSchema.title }),
  head: ({ params }) => ({
    meta: [{ title: "YouTube動画｜Stickman video" }, { name: "description", content: `YouTube動画 ${params.videoId} をStickman video内で再生します。` }],
  }),
  component: YouTubeWatchPage,
});

function YouTubeWatchPage() {
  const { videoId } = Route.useParams();
  const { title } = Route.useSearch();

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4">
          <Link to="/search" search={{ source: "youtube" }}>
            <Button variant="ghost" className="gap-2 rounded-full">
              <ArrowLeft className="h-4 w-4" />
              YouTube検索に戻る
            </Button>
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl bg-black shadow-lg">
          <div className="aspect-video">
            <iframe
              className="h-full w-full"
              src={`https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`}
              title={title || "YouTube動画"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
        {title && <h1 className="mt-5 text-xl font-extrabold">{title}</h1>}
        <p className="mt-2 text-sm text-muted-foreground">YouTubeの公式埋め込みプレイヤーで再生しています。</p>
      </main>
    </div>
  );
}
