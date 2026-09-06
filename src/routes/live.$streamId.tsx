import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Heart, Loader2, Radio, Send, Users, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Header } from "@/components/Header";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { endLiveStream } from "@/lib/live.functions";
import { liveLikesQuery, liveStreamQuery, liveViewerCountQuery, useLiveHostBroadcast, useLiveViewerStream, useViewerHeartbeat } from "@/lib/live";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/live/$streamId")({
  head: () => ({ meta: [{ title: "ライブ配信｜Stickman video" }] }),
  component: LiveDetailPage,
});

type ChatRow = { id: string; stream_id: string; user_id: string; body: string; created_at: string; profile: { username: string; display_name: string; avatar_url: string | null } | null };

function LiveDetailPage() {
  const { streamId } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: stream, isPending } = useQuery(liveStreamQuery(streamId));
  const { data: viewerCount = 0 } = useQuery(liveViewerCountQuery(streamId));
  const { data: likes = { count: 0, likedBy: [] } } = useQuery(liveLikesQuery(streamId));
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [message, setMessage] = useState("");
  const [ending, setEnding] = useState(false);
  const [chat, setChat] = useState<ChatRow[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isHost = Boolean(user && stream && user.id === stream.user_id && stream.status === "live");
  const viewerEnabled = Boolean(stream?.status === "live" && !isHost);
  const viewer = useLiveViewerStream(streamId, viewerEnabled);
  const host = useLiveHostBroadcast(streamId, isHost ? mediaStream : null);
  useViewerHeartbeat(streamId, user?.id, viewerEnabled);

  useEffect(() => {
    if (!isHost || !navigator.mediaDevices?.getUserMedia) return;
    let cancelled = false;
    void navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((next) => {
      if (cancelled) next.getTracks().forEach((track) => track.stop());
      else setMediaStream(next);
    }).catch((error) => { console.error(error); toast.error("カメラ・マイクを開始できませんでした"); });
    return () => { cancelled = true; setMediaStream((current) => { current?.getTracks().forEach((track) => track.stop()); return null; }); };
  }, [isHost]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = isHost ? mediaStream : viewer.remoteStream;
  }, [isHost, mediaStream, viewer.remoteStream]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase.from("live_chat_messages").select("id,stream_id,user_id,body,created_at,profile:profiles!live_chat_messages_user_id_fkey(username,display_name,avatar_url)").eq("stream_id", streamId).order("created_at", { ascending: true }).limit(100);
      if (!cancelled && !error) setChat((data ?? []) as unknown as ChatRow[]);
    };
    void load();
    const channel = supabase.channel(`live-chat-${streamId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "live_chat_messages", filter: `stream_id=eq.${streamId}` }, (payload) => setChat((current) => [...current, payload.new as ChatRow].slice(-100))).subscribe();
    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, [streamId]);

  const liked = Boolean(user && likes.likedBy.includes(user.id));
  const toggleLike = async () => {
    if (!user) { toast.info("いいねにはログインが必要です"); return; }
    if (liked) await supabase.from("live_likes").delete().eq("stream_id", streamId).eq("user_id", user.id);
    else await supabase.from("live_likes").insert({ stream_id: streamId, user_id: user.id } as never);
    void queryClient.invalidateQueries({ queryKey: ["live", "stream", streamId, "likes"] });
  };

  const sendChat = async () => {
    const body = message.trim();
    if (!user) { toast.info("コメントにはログインが必要です"); return; }
    if (!body || stream?.status !== "live") return;
    const { error } = await supabase.from("live_chat_messages").insert({ stream_id: streamId, user_id: user.id, body } as never);
    if (error) toast.error(error.message); else setMessage("");
  };

  const finish = async () => {
    setEnding(true);
    try { await endLiveStream({ data: { streamId } }); mediaStream?.getTracks().forEach((track) => track.stop()); toast.success("ライブ配信を終了しました"); void queryClient.invalidateQueries({ queryKey: ["live", "stream", streamId] }); } catch (error) { toast.error(error instanceof Error ? error.message : "配信を終了できませんでした"); } finally { setEnding(false); }
  };

  if (isPending) return <div className="min-h-screen"><Header /><main className="mx-auto max-w-5xl px-4 py-8">読み込み中…</main></div>;
  if (!stream) return <div className="min-h-screen"><Header /><main className="mx-auto max-w-5xl px-4 py-8"><p>ライブ配信が見つかりません。</p></main></div>;

  return <div className="min-h-screen"><Header /><main className="mx-auto max-w-5xl px-4 py-8 pb-24">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Radio className="size-6 text-red-500" /><span className="rounded-full bg-red-500/10 px-2 py-1 text-xs font-bold text-red-600">{stream.status === "live" ? "LIVE" : "終了"}</span></div>{isHost ? <Button variant="destructive" disabled={ending} onClick={() => void finish()}>{ending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <XCircle className="mr-2 size-4" />}配信を終了</Button> : null}</div>
    <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_360px]">
      <section>
        <div className="relative overflow-hidden rounded-2xl bg-black shadow-sm"><video ref={videoRef} autoPlay playsInline muted={isHost} controls={!isHost} className="aspect-video w-full object-contain" />{isHost && !mediaStream ? <div className="absolute inset-0 flex items-center justify-center text-sm text-white"><Loader2 className="mr-2 size-4 animate-spin" />カメラを準備中…</div> : null}{!isHost && stream.status === "live" && viewer.state !== "connected" ? <div className="absolute inset-0 flex items-center justify-center text-sm text-white"><Loader2 className="mr-2 size-4 animate-spin" />配信に接続中…</div> : null}</div>
        <h1 className="mt-4 text-xl font-extrabold">{stream.title}</h1>
        {stream.description ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{stream.description}</p> : null}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground"><div className="flex items-center gap-1"><Users className="size-4" />{viewerCount}人視聴中</div><button type="button" onClick={() => void toggleLike()} className={liked ? "font-semibold text-red-500" : "text-muted-foreground"}><Heart className="mr-1 inline size-4" fill={liked ? "currentColor" : "none"} />{likes.count}</button><span>{host.peerCount > 0 ? `${host.peerCount}接続` : ""}</span></div>
        <div className="mt-4 flex items-center gap-3">{stream.profile ? <UserAvatar src={stream.profile.avatar_url} name={stream.profile.display_name} /> : <div className="size-9 rounded-full bg-muted" />}<div><p className="font-semibold">{stream.profile?.display_name ?? stream.profile?.username ?? "配信者"}</p><p className="text-xs text-muted-foreground">@{stream.profile?.username ?? ""}</p></div></div>
      </section>
      <section className="flex min-h-[520px] flex-col rounded-2xl border border-border bg-surface/30 p-4"><h2 className="mb-3 font-bold">💬 ライブチャット</h2><div className="min-h-0 flex-1 space-y-3 overflow-y-auto">{chat.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">最初のコメントを送ってみよう！</p> : chat.map((item) => <div key={item.id} className="flex gap-2">{item.profile ? <UserAvatar src={item.profile.avatar_url} name={item.profile.display_name} className="size-8" /> : <div className="size-8 rounded-full bg-muted" />}<div className="min-w-0"><p className="text-xs font-semibold">{item.profile?.display_name ?? item.profile?.username ?? "ユーザー"}</p><p className="break-words text-sm">{item.body}</p></div></div>)}</div><div className="mt-3 flex gap-2"><Input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void sendChat(); }} maxLength={500} placeholder="コメントを入力…" disabled={stream.status !== "live"} /><Button size="icon" onClick={() => void sendChat()} disabled={!message.trim() || stream.status !== "live"} aria-label="送信"><Send className="size-4" /></Button></div></section>
    </div>
    {!isHost && stream.status === "live" ? <p className="mt-5 text-xs text-muted-foreground">この初期版はブラウザ間WebRTCで配信しています。配信者の端末・ブラウザが閉じると映像も終了します。</p> : null}
    <div className="mt-6"><Button asChild variant="outline"><Link to="/live">← ライブ一覧へ戻る</Link></Button></div>
  </main></div>;
}
