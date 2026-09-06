import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Header } from "@/components/Header";
import { StickmanMark } from "@/components/StickmanMark";
import { EmptyState, VideoCard, VideoGridSkeleton } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { PostList } from "@/components/PostList";
import { latestPostsQuery, latestVideosQuery } from "@/lib/queries";
import { liveStreamsQuery } from "@/lib/live";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stickman video｜棒人間動画をみんなで共有するSNS" },
      { name: "description", content: "オリジナルの棒人間アニメーションを投稿して共有。再生数といいねのランキングで頂点を目指そう。" },
      { property: "og:title", content: "Stickman video｜棒人間動画をみんなで共有するSNS" },
      { property: "og:description", content: "オリジナルの棒人間アニメーションを投稿して共有。ランキングで頂点を目指そう。" },
    ],
  }),
  component: Index,
});

function Index() {
  const { data, isPending, error } = useQuery(latestVideosQuery);
  const { data: posts } = useQuery(latestPostsQuery);
  const { data: liveStreams = [] } = useQuery(liveStreamsQuery);
  const [visibleCount, setVisibleCount] = useState(5);
  const visibleVideos = data?.slice(0, visibleCount) ?? [];
  const hasMore = data ? visibleCount < data.length : false;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="relative mb-10 overflow-hidden rounded-2xl border border-border hero-surface px-6 py-14 sm:px-10 sm:py-16">
          <StickmanMark className="pointer-events-none absolute bottom-4 right-8 hidden h-48 w-48 text-primary opacity-15 sm:block" />
          <StickmanMark className="pointer-events-none absolute bottom-10 right-56 hidden h-28 w-28 text-primary opacity-10 lg:block" />
          <div className="relative max-w-xl">
            <h1 className="text-balance-jp text-3xl font-extrabold leading-tight sm:text-4xl">棒人間動画を、みんなで共有しよう</h1>
            <p className="mt-4 leading-relaxed text-muted-foreground">オリジナルの棒人間アニメーションを投稿して、再生数ランキングの頂点を目指そう。</p>
            <div className="mt-7 flex flex-wrap gap-3"><Button asChild size="lg"><Link to="/auth">はじめる</Link></Button><Button asChild size="lg" variant="secondary"><Link to="/ranking">ランキングを見る</Link></Button></div>
          </div>
        </section>

        {liveStreams.length > 0 ? <section className="mb-10 rounded-2xl border border-red-200/70 bg-red-50/40 p-5 dark:border-red-900/50 dark:bg-red-950/10"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">🔴 ライブ配信中</h2><p className="mt-1 text-sm text-muted-foreground">いま配信中のライブをチェックしよう。</p></div><Button asChild variant="outline"><Link to="/live">すべて見る</Link></Button></div><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{liveStreams.slice(0, 3).map((stream) => <Link key={stream.id} to="/live/$streamId" params={{ streamId: stream.id }} className="rounded-xl border border-border bg-background p-4 transition-colors hover:bg-accent"><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 font-semibold">{stream.title}</p><span className="shrink-0 rounded-full bg-red-500/10 px-2 py-1 text-xs font-bold text-red-600">LIVE</span></div><p className="mt-2 text-sm text-muted-foreground">{stream.profile?.display_name ?? stream.profile?.username ?? "配信者"}</p></Link>)}</div></section> : null}

        <h2 className="mb-4 text-lg font-bold">最新の動画</h2>
        {isPending ? <VideoGridSkeleton /> : error ? <EmptyState title="動画を読み込めませんでした" description="通信状況を確認して、ページを再読み込みしてください。" /> : visibleVideos.length > 0 ? <div className="space-y-6"><div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{visibleVideos.map((video) => <VideoCard key={video.id} video={video} />)}</div>{hasMore ? <div className="flex justify-center"><Button variant="secondary" onClick={() => setVisibleCount((c) => c + 5)}>更に表示</Button></div> : null}</div> : <EmptyState title="まだ動画がありません" description="最初の棒人間動画を投稿して、このページを埋めてみましょう。" />}
        <h2 className="mb-4 mt-10 text-lg font-bold">みんなの投稿</h2>
        <PostList posts={posts ?? []} />
      </main>
    </div>
  );
}
