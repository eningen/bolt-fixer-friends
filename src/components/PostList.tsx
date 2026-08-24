import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
      {posts.map((post) => (
        <li key={post.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-start gap-3">
            <UserAvatar
              src={post.profile?.avatar_url ?? null}
              name={post.profile?.display_name ?? "?"}
              className="size-9"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm">
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
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                {post.body}
              </p>
            </div>
            {user?.id === post.user_id ? (
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
      ))}
    </ul>
  );
}
