import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Header } from "@/components/Header";
import { StickmanMark } from "@/components/StickmanMark";
import { EmptyState, VideoCard, VideoGridSkeleton } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { PostList } from "@/components/PostList";
import { latestPostsQuery, latestVideosQuery } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stickman video｜棒人間動画をみんなで共有するSNS" },
      {
        name: "description",
        content:
          "オリジナルの棒人間アニメーションを投稿して共有。再生数といいねのランキングで頂点を目指そう。",
      },
      { property: "og:title", content: "Stickman video｜棒人間動画をみんなで共有するSNS" },
      {
        property: "og:description",
        content: "オリジナルの棒人間アニメーションを投稿して共有。ランキングで頂点を目指そう。",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { data, isPending, error } = useQuery(latestVideosQuery);
  const { data: posts } = useQuery(latestPostsQuery);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="relative mb-10 overflow-hidden rounded-2xl border border-border hero-surface px-6 py-14 sm:px-10 sm:py-16">
          <StickmanMark
            className="pointer-events-none absolute bottom-4 right-8 hidden h-48 w-48 text-primary opacity-15 sm:block"
          />
          <StickmanMark
            className="pointer-events-none absolute bottom-10 right-56 hidden h-28 w-28 text-primary opacity-10 lg:block"
          />
          <div className="relative max-w-xl">
            <h1 className="text-balance-jp text-3xl font-extrabold leading-tight sm:text-4xl">
              棒人間動画を、みんなで共有しよう
            </h1>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              オリジナルの棒人間アニメーションを投稿して、再生数ランキングの頂点を目指そう。
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">はじめる</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/ranking">ランキングを見る</Link>
              </Button>
            </div>
          </div>
        </section>

        <h2 className="mb-4 text-lg font-bold">最新の動画</h2>
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
            title="まだ動画がありません"
            description="最初の棒人間動画を投稿して、このページを埋めてみましょう。"
          />
        )}

        <h2 className="mb-4 mt-10 text-lg font-bold">みんなの投稿</h2>
        <PostList posts={posts ?? []} />
      </main>
    </div>
  );
}
