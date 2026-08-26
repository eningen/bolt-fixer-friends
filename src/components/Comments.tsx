import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Reply, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatRelativeDate } from "@/lib/video";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CommentRow {
  id: string;
  video_id: string;
  user_id: string;
  body: string;
  created_at: string;
  parent_comment_id: string | null;
  profile: { username: string; display_name: string; avatar_url: string | null } | null;
  like_count: number;
  liked_by_me: boolean;
}

export function Comments({ videoId }: { videoId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<CommentRow | null>(null);

  const { data: comments = [], isPending } = useQuery({
    queryKey: ["video", videoId, "comments"],
    queryFn: async (): Promise<CommentRow[]> => {
      const { data, error } = await supabase
        .from("comments")
        .select("id,video_id,user_id,body,created_at,parent_comment_id,profile:profiles!comments_user_id_fkey(username,display_name,avatar_url)")
        .eq("video_id", videoId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const rows = (data ?? []) as unknown as Omit<CommentRow, "like_count" | "liked_by_me">[];
      if (!rows.length) return [];

      const ids = rows.map((row) => row.id);
      const { data: likes, error: likesError } = await supabase
        .from("comment_likes")
        .select("comment_id,user_id")
        .in("comment_id", ids);

      const likeRows = likesError ? [] : (likes ?? []);
      return rows.map((row) => ({
        ...row,
        like_count: likeRows.filter((like) => like.comment_id === row.id).length,
        liked_by_me: !!user && likeRows.some((like) => like.comment_id === row.id && like.user_id === user.id),
      }));
    },
  });

  const topLevelComments = useMemo(
    () => comments.filter((comment) => !comment.parent_comment_id),
    [comments],
  );

  const repliesByParent = useMemo(() => {
    const grouped = new Map<string, CommentRow[]>();
    for (const comment of comments) {
      if (!comment.parent_comment_id) continue;
      const replies = grouped.get(comment.parent_comment_id) ?? [];
      replies.push(comment);
      grouped.set(comment.parent_comment_id, replies);
    }
    return grouped;
  }, [comments]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["video", videoId, "comments"] });

  const post = useMutation({
    mutationFn: async (text: string) => {
      if (!user) throw new Error("ログインが必要です");
      const trimmed = text.trim();
      if (!trimmed) throw new Error("コメントを入力してください");

      const { error } = await supabase.from("comments").insert({
        video_id: videoId,
        user_id: user.id,
        body: trimmed,
        parent_comment_id: replyingTo?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      setReplyingTo(null);
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleLike = useMutation({
    mutationFn: async (comment: CommentRow) => {
      if (!user) throw new Error("ログインが必要です");

      if (comment.liked_by_me) {
        const { error } = await supabase
          .from("comment_likes")
          .delete()
          .eq("comment_id", comment.id)
          .eq("user_id", user.id);
        if (error) throw error;
        return { liked: false };
      }

      const { error } = await supabase
        .from("comment_likes")
        .insert({ comment_id: comment.id, user_id: user.id });
      if (error) throw error;
      return { liked: true };
    },
    onMutate: async (comment: CommentRow) => {
      await queryClient.cancelQueries({ queryKey: ["video", videoId, "comments"] });
      const previous = queryClient.getQueryData<CommentRow[]>(["video", videoId, "comments"]);
      const nextLiked = !comment.liked_by_me;

      queryClient.setQueryData<CommentRow[]>(["video", videoId, "comments"], (current = []) =>
        current.map((item) =>
          item.id === comment.id
            ? {
                ...item,
                liked_by_me: nextLiked,
                like_count: Math.max(0, item.like_count + (nextLiked ? 1 : -1)),
              }
            : item,
        ),
      );

      return { previous };
    },
    onError: (error: Error, _comment, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["video", videoId, "comments"], context.previous);
      }
      toast.error(error.message);
    },
    onSettled: () => void invalidate(),
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

  const startReply = (comment: CommentRow) => {
    if (!user) {
      toast.error("ログインが必要です");
      return;
    }
    setReplyingTo(comment);
    setBody("");
  };

  const renderComment = (comment: CommentRow, nested = false) => {
    const replies = repliesByParent.get(comment.id) ?? [];

    return (
      <li key={comment.id} className={`flex gap-3 ${nested ? "ml-10" : ""}`}>
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
          <div className="mt-1 flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={comment.liked_by_me ? "いいねを解除" : "コメントにいいね"}
              onClick={() => toggleLike.mutate(comment)}
              disabled={!user || toggleLike.isPending}
            >
              <Heart className={`size-4 ${comment.liked_by_me ? "fill-current" : ""}`} />
              <span>{comment.like_count}</span>
            </Button>
            {!nested ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => startReply(comment)} disabled={!user}>
                <Reply className="size-4" />
                返信
              </Button>
            ) : null}
            {user?.id === comment.user_id ? (
              <Button variant="ghost" size="sm" aria-label="コメントを削除" onClick={() => remove.mutate(comment.id)}>
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
          {replies.length > 0 ? (
            <ul className="mt-3 space-y-3 border-l pl-3">
              {replies.map((reply) => renderComment(reply, true))}
            </ul>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <section className="mt-8">
      <h2 className="text-base font-bold">コメント {comments.length}</h2>
      {user ? (
        <form
          className="mt-3 flex gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            post.mutate(body);
          }}
        >
          <div className="flex-1">
            {replyingTo ? (
              <div className="mb-2 flex items-center justify-between rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">{replyingTo.profile?.display_name ?? "ユーザー"}</span> に返信中
                </span>
                <Button type="button" variant="ghost" size="icon" className="size-6" onClick={() => setReplyingTo(null)} aria-label="返信をキャンセル">
                  <X className="size-4" />
                </Button>
              </div>
            ) : null}
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={replyingTo ? "返信を入力..." : "コメントを追加..."}
              rows={2}
              maxLength={1000}
              aria-label={replyingTo ? "返信" : "コメント"}
            />
            <div className="mt-2 flex justify-end">
              <Button type="submit" size="sm" disabled={post.isPending || !body.trim()}>
                {replyingTo ? "返信する" : "コメントする"}
              </Button>
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
        ) : topLevelComments.length === 0 ? (
          <li className="text-sm text-muted-foreground">まだコメントはありません。</li>
        ) : (
          topLevelComments.map((comment) => renderComment(comment))
        )}
      </ul>
    </section>
  );
}
