import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Heart, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatRelativeDate } from "@/lib/video";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CommentReplies } from "@/components/CommentReplies";

interface CommentRow {
  id: string;
  video_id: string;
  user_id: string;
  body: string;
  created_at: string;
  is_ai: boolean;
  ai_model: string | null;
  profile: { username: string; display_name: string; avatar_url: string | null } | null;
  like_count: number;
  liked_by_me: boolean;
}

export function Comments({ videoId }: { videoId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const { data: comments = [], isPending } = useQuery({
    queryKey: ["video", videoId, "comments"],
    queryFn: async (): Promise<CommentRow[]> => {
      const { data, error } = await supabase
        .from("comments")
        .select("id,video_id,user_id,body,created_at,is_ai,ai_model,profile:profiles!comments_user_id_fkey(username,display_name,avatar_url)")
        .eq("video_id", videoId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const rows = (data ?? []) as unknown as Omit<CommentRow, "like_count" | "liked_by_me">[];
      if (!rows.length) return [];

      const ids = rows.map((row) => row.id);
      const { data: likes } = await supabase.from("comment_likes").select("comment_id,user_id").in("comment_id", ids);
      const likeRows = likes ?? [];

      return rows.map((row) => ({
        ...row,
        like_count: likeRows.filter((like) => like.comment_id === row.id).length,
        liked_by_me: !!user && likeRows.some((like) => like.comment_id === row.id && like.user_id === user.id),
      }));
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["video", videoId, "comments"] });

  const post = useMutation({
    mutationFn: async (text: string) => {
      if (!user) throw new Error("ログインが必要です");
      const trimmed = text.trim();
      if (!trimmed) throw new Error("コメントを入力してください");
      const { error } = await supabase.from("comments").insert({ video_id: videoId, user_id: user.id, body: trimmed });
      if (error) throw error;
    },
    onSuccess: () => { setBody(""); void invalidate(); },
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
      } else {
        const { error } = await supabase
          .from("comment_likes")
          .upsert(
            { comment_id: comment.id, user_id: user.id },
            { onConflict: "comment_id,user_id", ignoreDuplicates: true },
          );
        if (error) throw error;
      }
    },
    onSuccess: () => void invalidate(),
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("コメントを削除しました"); void invalidate(); },
    onError: () => toast.error("削除できませんでした"),
  });

  return (
    <section className="mt-8">
      <h2 className="text-base font-bold">コメント {comments.length}</h2>
      {user ? (
        <form className="mt-3 flex gap-3" onSubmit={(event) => { event.preventDefault(); post.mutate(body); }}>
          <div className="flex-1">
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="コメントを追加..." rows={2} maxLength={1000} aria-label="コメント" />
            <div className="mt-2 flex justify-end"><Button type="submit" size="sm" disabled={post.isPending || !body.trim()}>コメントする</Button></div>
          </div>
        </form>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground"><Link to="/auth" className="text-primary underline">ログイン</Link>するとコメントできます。</p>
      )}

      <ul className="mt-4 space-y-4">
        {isPending ? <li className="h-12 animate-pulse rounded bg-surface-strong" /> : comments.length === 0 ? (
          <li className="text-sm text-muted-foreground">まだコメントはありません。</li>
        ) : comments.map((comment) => (
          <li key={comment.id} className="flex gap-3">
            {comment.is_ai ? (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" aria-label="Stickman AI">
                <Bot className="size-4" />
              </div>
            ) : comment.profile ? (
              <Link to="/u/$username" params={{ username: comment.profile.username }}><UserAvatar src={comment.profile.avatar_url} name={comment.profile.display_name} className="size-8" /></Link>
            ) : (
              <UserAvatar src={null} name="?" className="size-8" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                {comment.is_ai ? "Stickman AI" : comment.profile?.display_name ?? "不明なユーザー"}
                {comment.is_ai ? <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-primary">AI</span> : null}
                <span className="ml-1">· {formatRelativeDate(comment.created_at)}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{comment.body}</p>
              <div className="mt-1 flex items-center gap-1">
                <Button type="button" variant="ghost" size="sm" aria-label={comment.liked_by_me ? "いいねを解除" : "コメントにいいね"} onClick={() => toggleLike.mutate(comment)} disabled={!user || toggleLike.isPending}><Heart className={`size-4 ${comment.liked_by_me ? "fill-current" : ""}`} /><span>{comment.like_count}</span></Button>
                {user?.id === comment.user_id && !comment.is_ai ? <Button variant="ghost" size="sm" aria-label="コメントを削除" onClick={() => remove.mutate(comment.id)}><Trash2 className="size-4" /></Button> : null}
              </div>
              <CommentReplies commentId={comment.id} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
