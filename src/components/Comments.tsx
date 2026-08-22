import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { videoCommentsQuery } from "@/lib/queries";
import { formatRelativeDate } from "@/lib/video";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function Comments({ videoId }: { videoId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: comments = [], isPending } = useQuery(videoCommentsQuery(videoId));
  const [body, setBody] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["video", videoId, "comments"] });

  const post = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("ログインが必要です");
      const text = body.trim();
      if (!text) throw new Error("コメントを入力してください");
      const { error } = await supabase
        .from("comments")
        .insert({ video_id: videoId, user_id: user.id, body: text });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("コメントを削除しました");
      void invalidate();
    },
    onError: () => toast.error("削除できませんでした"),
  });

  return (
    <section className="mt-8">
      <h2 className="text-base font-bold">コメント {comments.length}</h2>

      {user ? (
        <form
          className="mt-3 flex gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            post.mutate();
          }}
        >
          <div className="flex-1">
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="コメントを追加..."
              rows={2}
              maxLength={1000}
              aria-label="コメント"
            />
            <div className="mt-2 flex justify-end">
              <Button type="submit" size="sm" disabled={post.isPending || !body.trim()}>
                コメントする
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          <Link to="/auth" className="text-primary underline">
            ログイン
          </Link>
          するとコメントできます。
        </p>
      )}

      <ul className="mt-4 space-y-4">
        {isPending ? (
          <li className="h-12 animate-pulse rounded bg-surface-strong" />
        ) : comments.length === 0 ? (
          <li className="text-sm text-muted-foreground">まだコメントはありません。</li>
        ) : (
          comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              {comment.profile ? (
                <Link to="/u/$username" params={{ username: comment.profile.username }}>
                  <UserAvatar
                    src={comment.profile.avatar_url}
                    name={comment.profile.display_name}
                    className="size-8"
                  />
                </Link>
              ) : (
                <UserAvatar src={null} name="?" className="size-8" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  {comment.profile?.display_name ?? "不明なユーザー"} ·{" "}
                  {formatRelativeDate(comment.created_at)}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{comment.body}</p>
              </div>
              {user?.id === comment.user_id ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="コメントを削除"
                  onClick={() => remove.mutate(comment.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
