import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { PostRow } from "@/lib/queries";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";

function formatDate(value: string) {
  return new Date(value).toLocaleString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PostList({ posts }: { posts: PostRow[] }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const authorIds = [...new Set(posts.map((post) => post.user_id))];

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["post-author-subscriptions", user?.id, authorIds],
    enabled: Boolean(user && authorIds.length > 0),
    queryFn: async () => {
      if (!user || authorIds.length === 0) return [] as string[];
      const { data, error } = await supabase
        .from("subscriptions")
        .select("channel_id")
        .eq("subscriber_id", user.id)
        .in("channel_id", authorIds);
      if (error) throw error;
      return (data ?? []).map((row) => row.channel_id as string);
    },
  });

  const toggleSubscribe = useMutation({
    mutationFn: async (channelId: string) => {
      if (!user) throw new Error("ログインが必要です");
      if (channelId === user.id) return;
      if (subscriptions.includes(channelId)) {
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["post-author-subscriptions"] });
      await queryClient.invalidateQueries({ queryKey: ["channel-subscribers"] });
      toast.success("チャンネル登録を更新しました");
    },
    onError: (error: Error) => toast.error(error.message || "チャンネル登録に失敗しました"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("投稿を削除しました");
    },
    onError: () => toast.error("削除に失敗しました"),
  });

  if (posts.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        まだ文章の投稿がありません。
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {posts.map((post) => {
        const isOwnPost = user?.id === post.user_id;
        const isSubscribed = subscriptions.includes(post.user_id);

        return (
          <li key={post.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-start gap-3">
              <UserAvatar
                src={post.profile?.avatar_url ?? null}
                name={post.profile?.display_name ?? "?"}
                className="size-9"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {post.profile ? (
                    <Link
                      to="/u/$username"
                      params={{ username: post.profile.username }}
                      className="font-semibold hover:underline"
                    >
                      {post.profile.display_name}
                    </Link>
                  ) : (
                    <span className="font-semibold">不明なユーザー</span>
                  )}
                  <span className="text-xs text-muted-foreground">{formatDate(post.created_at)}</span>
                  {!isOwnPost && post.profile ? (
                    user ? (
                      <Button
                        type="button"
                        variant={isSubscribed ? "secondary" : "default"}
                        size="sm"
                        className="h-7 rounded-full px-3 text-xs font-semibold"
                        disabled={toggleSubscribe.isPending}
                        onClick={() => toggleSubscribe.mutate(post.user_id)}
                      >
                        {isSubscribed ? "登録済み" : "チャンネル登録"}
                      </Button>
                    ) : (
                      <Button asChild variant="default" size="sm" className="h-7 rounded-full px-3 text-xs font-semibold">
                        <Link to="/auth">ログインして登録</Link>
                      </Button>
                    )
                  ) : null}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {post.body}
                </p>
              </div>
              {isOwnPost ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="投稿を削除"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(post.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
