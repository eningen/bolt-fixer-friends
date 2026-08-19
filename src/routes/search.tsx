import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { Header } from "@/components/Header";
import { EmptyState, VideoCard, VideoGridSkeleton } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchVideosQuery } from "@/lib/queries";

const searchSchema = z.object({ q: z.string().max(100).optional() });

export const Route = createFileRoute("/search")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "動画を検索｜Stickman video" },
      { name: "description", content: "タイトルや説明文から棒人間動画を検索できます。" },
      { property: "og:title", content: "動画を検索｜Stickman video" },
      { property: "og:description", content: "タイトルや説明文から棒人間動画を検索。" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const [term, setTerm] = useState(q ?? "");
  const { data, isPending } = useQuery({ ...searchVideosQuery(q ?? ""), enabled: Boolean(q) });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-extrabold">動画を検索</h1>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void navigate({ to: "/search", search: { q: term.trim() || undefined } });
          }}
          className="mb-8 flex max-w-xl gap-2"
        >
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="キーワードを入力"
            maxLength={100}
            className="rounded-full bg-surface"
            aria-label="キーワード"
          />
          <Button type="submit" className="rounded-full">
            検索
          </Button>
        </form>

        {!q ? (
          <EmptyState
            title="キーワードを入力してください"
            description="タイトルや説明文に含まれる言葉で動画を探せます。"
          />
        ) : isPending ? (
          <VideoGridSkeleton count={6} />
        ) : data && data.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              「{q}」の検索結果 {data.length} 件
            </p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title="見つかりませんでした"
            description={`「${q}」に一致する動画はありません。別のキーワードを試してください。`}
          />
        )}
      </main>
    </div>
  );
}
