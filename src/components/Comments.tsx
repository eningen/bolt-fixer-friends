import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CornerDownRight, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { videoCommentsQuery, type CommentRow } from "@/lib/queries";
import { formatRelativeDate } from "@/lib/video";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function Comments({ videoId }: { videoId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: comments = [], isPending } = useQuery(videoCommentsQuery(videoId));
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["video", videoId, "comments"] });

  const post = useMutation({
    mutationFn: async ({ text, parentCommentId }: { text: string; parentCommentId?: string | null }) => {
      if (!user) throw new Error("ログインが必要です");
      const trimmed = text.trim();
      if (!trimmed) throw new Error("コメントを入力してください");
      const { error } = await supabase.from("comments").insert({
        video_id: videoId,
        user_id: user.id,
        body: trimmed,
        parent_comment_id: parentCommentId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      if (variables.parentCommentId) {
        setReplyTo(null);
        setReplyBody("");
      } else {
        setBody("");
      }
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

  const { roots, replies } = useMemo(() => {
    const roots: CommentRow[] = [];
    const replies = new Map<string, CommentRow[]>();
    for (const comment of comments) {
      if (!comment.parent_comment_id) roots.push(comment);
      else replies.set(comment.parent_comment_id, [...(replies.get(comment.parent_comment_id) ?? []), comment]);
    }
    return { roots, replies };
  }, [comments]);

  const renderComment = (comment: CommentRow, isReply = false) => (
    <li key={comment.id} className={isReply ? "ml-10 flex gap-3 border-l pl-4" : "flex gap-3"}>
      {comment.profile ? (
        <Link to="/u/$username" params={{ username: comment.profile.username }}>
          <UserAvatar src={comment.profile.avatar_url} name={comment.profile.display_name} className="size-8" />
        </Link>
      ) : (
        <UserAvatar src={null} name="?" className="size-8" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          {comment.profile?.display_name ?? "不明なユーザー"} · {formatRelativeDate(comment.created_at)}
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm">{comment.body}</p>
        <div className="mt-1 flex items-center gap-2">
          {user ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => {
                setReplyTo(replyTo === comment.id ? null : comment.id);
                setReplyBody("");
              }}
            >
              <CornerDownRight className="mr-1 size-3" />返信
            </Button>
          ) : null}
          {user?.id === comment.user_id ? (
            <Button variant="ghost" size="sm" aria-label="コメントを削除" onClick={() => remove.mutate(comment.id)}>
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>

        {replyTo === comment.id && user ? (
          <form
            className="mt-2 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              post.mutate({ text: replyBody, parentCommentId: comment.id });
            }}
          >
            <Textarea
              value={replyBody}
              onChange={(event) => setReplyBody(event.target.value)}
              placeholder={`${comment.profile?.display_name ?? "このコメント"}に返信...`}
              rows={2}
              maxLength={1000}
              className="text-sm"
            />
            <Button type="submit" size="sm" disabled={post.isPending || !replyBody.trim()}>送信</Button>
          </form>
        ) : null}
      </div>
    </li>
  );

  return (
    <section className="mt-8">
      <h2 className="text-base font-bold">コメント {comments.length}</h2>

      {user ? (
        <form
          className="mt-3 flex gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            post.mutate({ text: body });
          }}
        >
          <div className="flex-1">
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="コメントを追加..." rows={2} maxLength={1000} aria-label="コメント" />
            <div className="mt-2 flex justify-end">
              <Button type="submit" size="sm" disabled={post.isPending || !body.trim()}>コメントする</Button>
            </div>
          </div>
        </form>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          <Link to="/auth" className="text-primary underline">ログイン</Link>するとコメントできます。
        </p>
      )}

      <ul className="mt-4 space-y-4">
        {isPending ? (
          <li className="h-12 animate-pulse rounded bg-surface-strong" />
        ) : roots.length === 0 ? (
          <li className="text-sm text-muted-foreground">まだコメントはありません。</li>
        ) : (
          roots.map((comment) => (
            <div key={comment.id} className="space-y-3">
              {renderComment(comment)}
              {replies.get(comment.id)?.map((reply) => renderComment(reply, true))}
            </div>
          ))
        )}
      </ul>
    </section>
  );
}
