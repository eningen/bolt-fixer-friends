import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Radio } from "lucide-react";
import { toast } from "sonner";

import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { startLiveStream } from "@/lib/live.functions";

export const Route = createFileRoute("/live/start")({
  head: () => ({ meta: [{ title: "ライブ配信を開始｜Stickman video" }] }),
  component: StartLivePage,
});

function StartLivePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);

  const start = async () => {
    if (pending) return;
    if (!user) {
      toast.info("ライブ配信にはログインが必要です");
      await navigate({ to: "/auth" });
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("配信タイトルを入力してください");
      return;
    }

    setPending(true);
    try {
      // カメラ・マイクの許可確認は配信ページ側で行う。
      // ここで getUserMedia を先に実行すると、ブラウザの権限状態によって
      // 「開始」ボタンを押しても画面遷移しないように見えることがある。
      // DBに配信を作成してから /live/$streamId へ移動し、そこで実際の
      // メディア取得を行う。取得失敗時は配信ページ側でDBを終了状態に戻す。
      const result = await startLiveStream({
        data: { title: trimmedTitle, description: description.trim() },
      });
      await navigate({ to: "/live/$streamId", params: { streamId: result.streamId } });
    } catch (error) {
      console.error("live start error", error);
      toast.error(error instanceof Error ? error.message : "ライブ配信を開始できませんでした");
    } finally {
      setPending(false);
    }
  };

  if (loading) return <div className="min-h-screen"><Header /><main className="mx-auto max-w-xl px-4 py-8">読み込み中…</main></div>;
  if (!user) return <div className="min-h-screen"><Header /><main className="mx-auto max-w-xl px-4 py-8"><div className="rounded-2xl border border-border p-6 text-center"><p className="text-sm text-muted-foreground">ライブ配信にはログインが必要です。</p><Button className="mt-4" onClick={() => void navigate({ to: "/auth" })}>ログイン</Button></div></main></div>;

  return <div className="min-h-screen"><Header /><main className="mx-auto max-w-xl px-4 py-8 pb-24">
    <div className="flex items-center gap-2"><Radio className="size-6 text-primary" /><h1 className="text-2xl font-extrabold">ライブ配信を開始</h1></div>
    <p className="mt-2 text-sm text-muted-foreground">カメラとマイクを使ってリアルタイム配信します。</p>
    <div className="mt-6 space-y-4 rounded-2xl border border-border bg-surface/40 p-5">
      <div><label className="mb-2 block text-sm font-semibold">配信タイトル</label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="今日のライブ！" /></div>
      <div><label className="mb-2 block text-sm font-semibold">説明（任意）</label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={5} placeholder="配信内容を書いてください" /></div>
      <Button className="w-full" size="lg" disabled={pending || !title.trim()} onClick={() => void start()}>{pending ? <><Loader2 className="mr-2 size-4 animate-spin" />開始中…</> : "🔴 ライブ配信を開始"}</Button>
      <p className="text-xs leading-relaxed text-muted-foreground">配信開始後、次の画面でブラウザのカメラ・マイク許可を求めます。現在の初期版はWebRTCで視聴者へ映像を届けます。</p>
    </div>
  </main></div>;
}
