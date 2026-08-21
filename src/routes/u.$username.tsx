import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { channelSubscribersQuery, profileQuery } from "@/lib/queries";
import { Header } from "@/components/Header";
import { ChannelAnalytics } from "@/components/ChannelAnalytics";
import { EmptyState, VideoCard, VideoGridSkeleton } from "@/components/VideoCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/u/$username")({
  head: () => ({
    meta: [
      { title: "プロフィール｜Stickman video" },
      { name: "description", content: "投稿者のプロフィールと投稿した棒人間動画の一覧です。" },
      { property: "og:title", content: "プロフィール｜Stickman video" },
      { property: "og:description", content: "投稿者のプロフィールと動画一覧。" },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(profileQuery(username));

  const channelId = data?.profile.id;
  const { data: subscribers = [] } = useQuery(channelSubscribersQuery(channelId));

  const isOwner = Boolean(user && channelId && user.id === channelId);
  const isSubscribed = Boolean(user && subscribers.some((s) => s.subscriber_id === user.id));

  const toggleSubscribe = useMutation({
    mutationFn: async () => {
      if (!user || !channelId) throw new Error("ログインが必要です");
      if (isSubscribed) {
        const { error } = await supabase
          .from("subscriptions")
          .delete()
          .eq("channel_id", channelId)
          .eq("subscriber_id", user.id);
        if (error) throw error;
        return "unsubscribed" as const;
      }
      const { error } = await supabase
        .from("subscriptions")
        .insert({ channel_id: channelId, subscriber_id: user.id });
      if (error) throw error;
      return "subscribed" as const;
    },
    onSuccess: (result) => {
      toast.success(result === "subscribed" ? "チャンネル登録しました" : "登録を解除しました");
      void queryClient.invalidateQueries({ queryKey: ["channel-subscribers", channelId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const totalViews = (data?.videos ?? []).reduce((sum, video) => sum + (video.views ?? 0), 0);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {isPending ? (
          <VideoGridSkeleton count={3} />
        ) : !data ? (
          <EmptyState
            title="ユーザーが見つかりません"
            description="ユーザー名が変更されたか、削除された可能性があります。"
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar className="size-16">
                <AvatarImage src={data.profile.avatar_url ?? undefined} alt="" />
                <AvatarFallback>{data.profile.display_name.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-2xl font-extrabold">{data.profile.display_name}</h1>
                <p className="text-sm text-muted-foreground">
                  @{data.profile.username}・登録者 {subscribers.length.toLocaleString()} 人
                </p>
              </div>
              {!isOwner ? (
                user ? (
                  <Button
                    variant={isSubscribed ? "secondary" : "default"}
                    className="rounded-full"
                    disabled={toggleSubscribe.isPending}
                    onClick={() => toggleSubscribe.mutate()}
                  >
                    {isSubscribed ? "登録済み" : "チャンネル登録"}
                  </Button>
                ) : (
                  <Button asChild variant="default" className="rounded-full">
                    <Link to="/auth">ログインして登録</Link>
                  </Button>
                )
              ) : null}
            </div>
            {data.profile.bio ? (
              <p className="mt-4 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed">
                {data.profile.bio}
              </p>
            ) : null}

            {isOwner ? (
              <ChannelAnalytics
                subscribers={subscribers}
                totalViews={totalViews}
                videoCount={data.videos.length}
              />
            ) : null}

            <h2 className="mb-4 mt-8 text-lg font-bold">投稿した動画</h2>
            {data.videos.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {data.videos.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            ) : (
              <EmptyState title="まだ投稿がありません" description="最初の動画を待ちましょう。" />
            )}
          </>
        )}
      </main>
    </div>
  );
}
