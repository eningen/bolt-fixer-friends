import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Radio, Users } from "lucide-react";

import { Header } from "@/components/Header";
import { EmptyState } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { liveStreamsQuery } from "@/lib/live";

export const Route = createFileRoute("/live")({
  head: () => ({ meta: [{ title: "ライブ｜Stickman video" }, { name: "description", content: "Stickman videoのライブ配信を見つけよう。" }] }),
  component: LivePage,
});

function LivePage() {
  const { data: streams = [], isPending, error } = useQuery(liveStreamsQuery);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 pb-24">
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <Radio className="size-6 shrink-0 text-primary" />
              <h1 className="whitespace-nowrap text-2xl font-extrabold">ライブ</h1>
            </div>
            <p className="mt-1 whitespace-nowrap text-sm text-muted-foreground">いま配信中のライブを見つけよう。</p>
          </div>
          <Button asChild className="w-full shrink-0 sm:w-auto">
            <Link to="/live/start">🔴 ライブ配信を始める</Link>
          </Button>
        </div>

        {isPending ? <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-surface-strong" />)}</div> : error ? <div className="mt-8"><EmptyState title="ライブを読み込めませんでした" description="通信状況を確認して、もう一度お試しください。" /></div> : streams.length === 0 ? <div className="mt-8"><EmptyState title="現在ライブ配信はありません" description="最初のライブ配信を始めてみましょう。" /></div> : <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{streams.map((stream) => <Link key={stream.id} to="/live/$streamId" params={{ streamId: stream.id }} className="group overflow-hidden rounded-2xl border border-border bg-surface/40 transition-colors hover:bg-accent"><div className="aspect-video overflow-hidden bg-muted">{stream.thumbnail_url ? <img src={stream.thumbnail_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-5xl">🔴</div>}</div><div className="p-4"><div className="flex items-start justify-between gap-3"><h2 className="line-clamp-2 font-bold group-hover:text-primary">{stream.title}</h2><span className="shrink-0 rounded-full bg-red-500/10 px-2 py-1 text-xs font-bold text-red-600">LIVE</span></div><p className="mt-2 text-sm text-muted-foreground">{stream.profile?.display_name ?? stream.profile?.username ?? "配信者"}</p><div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"><Users className="size-4" />配信中</div></div></Link>)}</div>}
      </main>
    </div>
  );
}
