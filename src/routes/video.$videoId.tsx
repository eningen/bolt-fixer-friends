import { useCallback, useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { videoDetailQuery, videoLikesQuery } from "@/lib/queries";
import { formatRelativeDate, formatViews, parseVideoUrl } from "@/lib/video";
import { useMediaUrl } from "@/lib/storage";
import { Header } from "@/components/Header";
import { Comments } from "@/components/Comments";
import { SaveButton } from "@/components/SaveButton";
import { EmptyState } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

  // 10秒以上再生されたら再生回数を1増やす
  const counted = useRef(false);
  const watched = useRef(0);
  const queryClientRef = queryClient;

  useEffect(() => {
    counted.current = false;
    watched.current = 0;
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

  // YouTube などの埋め込みは再生位置を取れないため、表示から10秒後にカウント
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
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("video_id", videoId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("likes")
          .insert({ video_id: videoId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["video", videoId, "likes"] });
    },
    onError: () => toast.error("ログインするといいねできます"),
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
          <EmptyState
            title="動画が見つかりません"
            description="削除されたか、URLが間違っている可能性があります。"
          />
        ) : (
          <>
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-surface-strong">
              {video.storage_path ? (
                fileUrl ? (
                  <video
                    src={fileUrl}
                    controls
                    playsInline
                    onTimeUpdate={onTimeUpdate}
                    className="size-full"
                  />
                ) : (
                  <div className="size-full animate-pulse" />
                )
              ) : embedUrl ? (
                <iframe
                  src={embedUrl}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="size-full"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                  再生できない動画です
                </div>
              )}
            </div>



            <h1 className="mt-4 text-xl font-bold leading-snug">{video.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatViews(video.views)} · {formatRelativeDate(video.created_at)}
            </p>

            <div className="mt-4 flex items-center justify-between gap-4 border-y border-border py-3">
              {video.profile ? (
                <Link
                  to="/u/$username"
                  params={{ username: video.profile.username }}
                  className="flex items-center gap-3"
                >
                  <Avatar className="size-10">
                    <AvatarImage src={video.profile.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="text-xs">
                      {video.profile.display_name.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-semibold">{video.profile.display_name}</span>
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground">不明なユーザー</span>
              )}

              <Button
                variant={liked ? "default" : "secondary"}
                size="sm"
                className="rounded-full"
                onClick={() => toggleLike.mutate()}
                disabled={toggleLike.isPending}
              >
                <Heart className={liked ? "size-4 fill-current" : "size-4"} />
                {likes?.count ?? 0}
              </Button>
            </div>

            {video.description ? (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">
                {video.description}
              </p>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
