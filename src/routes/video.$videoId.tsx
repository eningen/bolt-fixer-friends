import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Heart, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { videoDetailQuery, videoLikesQuery } from "@/lib/queries";
import { formatRelativeDate, formatViews, parseVideoUrl } from "@/lib/video";
import { useMediaUrl } from "@/lib/storage";
import { Header } from "@/components/Header";
import { Comments } from "@/components/Comments";
import { EmptyState } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";

export const Route = createFileRoute("/video/$videoId")({
  head: () => ({
    meta: [
      { title: "動画を再生｜Stickman video" },
      { name: "description", content: "投稿された棒人間動画を再生して、いいねで応援しましょう。" },
      { property: "og:title", content: "動画を再生｜Stickman video" },
      { property: "og:description", content: "投稿された棒人間動画を再生して応援しよう。" },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VideoDetailPage,
});

function VideoDetailPage() {
  const { videoId } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: video, isPending } = useQuery(videoDetailQuery(videoId));
  const { data: likes } = useQuery(videoLikesQuery(videoId));
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);

  const counted = useRef(false);
  const watched = useRef(0);
  const queryClientRef = queryClient;

  useEffect(() => {
    counted.current = false;
    watched.current = 0;
    setAiExplanation(null);
  }, [videoId]);

  const countView = useCallback(() => {
    if (counted.current) return;
    counted.current = true;
    void supabase.rpc("increment_video_views", { _video_id: videoId }).then(() => {
      void queryClientRef.invalidateQueries({ queryKey: ["video", videoId] });
    });
  }, [queryClientRef, videoId]);

  const onTimeUpdate = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    watched.current = Math.max(watched.current, event.currentTarget.currentTime);
    if (watched.current >= 10) countView();
  };

  const isEmbed = Boolean(video && !video.storage_path);
  useEffect(() => {
    if (!isEmbed) return;
    const timer = setTimeout(countView, 10_000);
    return () => clearTimeout(timer);
  }, [countView, isEmbed]);

  const liked = Boolean(user && likes?.likedBy.includes(user.id));

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("unauthenticated");
      if (liked) {
        const { error } = await supabase.from("likes").delete().eq("video_id", videoId).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("likes").insert({ video_id: videoId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["video", videoId, "likes"] }),
    onError: () => toast.error("ログインするといいねできます"),
  });

  const aiReview = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Chat AETを使うにはログインしてください。");

      const { data, error } = await supabase.functions.invoke("ai-video-review", {
        body: { videoId },
      });

      if (error) {
        const context = error.context;
        let detail = "";
        if (context instanceof Response) {
          try {
            const payload = await context.clone().json();
            if (payload?.error) detail = `: ${payload.error}`;
          } catch {
            // Keep the SDK error when the response is not JSON.
          }
          detail = detail || ` (HTTP ${context.status})`;
        }
        throw new Error(`AIサーバーに接続できませんでした${detail}`);
      }

      if (!data?.comment && !data?.reused) {
        throw new Error(data?.error || "Chat AETから説明を受け取れませんでした。");
      }

      return data;
    },
    onSuccess: (data) => {
      const explanation = data?.comment?.body;
      if (typeof explanation === "string" && explanation.trim()) {
        setAiExplanation(explanation.trim());
      }
      void queryClient.invalidateQueries({ queryKey: ["video", videoId, "comments"] });
      toast.success(data?.reused ? "Chat AETの説明を表示しました" : "Chat AETが動画を解析しました！");
    },
    onError: (error: Error) => toast.error(error.message || "Chat AETの解析に失敗しました。"),
  });

  const embedUrl = video ? parseVideoUrl(video.video_url)?.embedUrl : null;
  const fileUrl = useMediaUrl(video?.storage_path ?? null);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-6">
        {isPending ? (
          <div className="aspect-video w-full animate-pulse rounded-xl bg-surface-strong" />
        ) : !video ? (
          <EmptyState title="動画が見つかりません" description="削除されたか、URLが間違っている可能性があります。" />
        ) : (
          <>
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-surface-strong">
              {video.storage_path ? (
                fileUrl ? <video src={fileUrl} controls playsInline onTimeUpdate={onTimeUpdate} className="size-full" /> : <div className="size-full animate-pulse" />
              ) : embedUrl ? (
                <iframe src={embedUrl} title={video.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowFullScreen className="size-full" />
              ) : (
                <div className="flex size-full items-center justify-center text-sm text-muted-foreground">再生できない動画です</div>
              )}
            </div>

            <h1 className="mt-4 text-xl font-bold leading-snug">{video.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{formatViews(video.views)} · {formatRelativeDate(video.created_at)}</p>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
              {video.profile ? (
                <Link to="/u/$username" params={{ username: video.profile.username }} className="flex items-center gap-3">
                  <UserAvatar className="size-10" src={video.profile.avatar_url} name={video.profile.display_name} />
                  <span className="text-sm font-semibold">{video.profile.display_name}</span>
                </Link>
              ) : <span className="text-sm text-muted-foreground">不明なユーザー</span>}

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" className="rounded-full" onClick={() => aiReview.mutate()} disabled={aiReview.isPending}>
                  {aiReview.isPending ? <Sparkles className="size-4 animate-pulse" /> : <Bot className="size-4" />}
                  {aiReview.isPending ? "Chat AETが動画を見ています…" : "🤖 Chat AETで説明"}
                </Button>
                <Button variant={liked ? "default" : "secondary"} size="sm" className="rounded-full" onClick={() => toggleLike.mutate()} disabled={toggleLike.isPending}>
                  <Heart className={liked ? "size-4 fill-current" : "size-4"} /> {likes?.count ?? 0}
                </Button>
              </div>
            </div>

            {aiExplanation ? (
              <section className="mt-5 overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 shadow-sm">
                <div className="flex items-center gap-3 border-b border-primary/10 px-4 py-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                    <Bot className="size-5" />
                  </div>
                  <div>
                    <h2 className="font-extrabold">Chat AET</h2>
                    <p className="text-xs text-muted-foreground">動画を読み込んで内容を説明しました</p>
                  </div>
                </div>
                <div className="whitespace-pre-wrap px-4 py-4 text-sm leading-7">{aiExplanation}</div>
              </section>
            ) : null}

            {video.description ? <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{video.description}</p> : null}
            <Comments videoId={videoId} />
          </>
        )}
      </main>
    </div>
  );
}
