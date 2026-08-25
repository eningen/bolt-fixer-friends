import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Comment {
  id: string;
  video_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: { username: string; display_name: string; avatar_url: string | null } | null;
}

interface CommentsProps { videoId: string; }

export function Comments({ videoId }: CommentsProps) {
  const [body, setBody] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["comments", videoId],
    queryFn: async () => {
      const { data, error } = await supabase.from("comments")
        .select("id, video_id, user_id, body, created_at, profiles(username, display_name, avatar_url)")
        .eq("video_id", videoId).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Comment[];
    }, enabled: !!videoId,
  });

  const { data: commentLikes = [] } = useQuery({
    queryKey: ["comment-likes", videoId],
    queryFn: async () => {
      const { data, error } = await supabase.from("comment_likes")
        .select("comment_id, user_id").in("comment_id", comments.map((comment) => comment.id));
      if (error) throw error;
      return data ?? [];
    }, enabled: comments.length > 0,
  });

  const toggleCommentLike = useMutation({
    mutationFn: async (commentId: string) => {
      if (!currentUser) throw new Error("ログインが必要です");
      const existing = commentLikes.find((like) => like.comment_id === commentId && like.user_id === currentUser.id);
      if (existing) {
        const { error } = await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", currentUser.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: currentUser.id });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comment-likes", videoId] }),
    onError: (error: Error) => toast({ title: "コメントのいいねを変更できませんでした", description: error.message, variant: "destructive" }),
  });

  const addComment = useMutation({
    mutationFn: async (commentBody: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ログインが必要です");
      const { error } = await supabase.from("comments").insert({ video_id: videoId, user_id: user.id, body: commentBody });
      if (error) throw error;
    },
    onSuccess: () => { setBody(""); queryClient.invalidateQueries({ queryKey: ["comments", videoId] }); },
    onError: (error: Error) => toast({ title: "コメントを投稿できませんでした", description: error.message, variant: "destructive" }),
  });

  const handleSubmit = () => { const text = body.trim(); if (text && !addComment.isPending) addComment.mutate(text); };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">コメント</h2>
      <div className="space-y-2">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="コメントを書く..." disabled={addComment.isPending} />
        <Button onClick={handleSubmit} disabled={!body.trim() || addComment.isPending}>{addComment.isPending ? "投稿中..." : "コメントする"}</Button>
      </div>
      <div className="space-y-3">
        {isLoading ? <p>読み込み中...</p> : comments.length === 0 ? <p className="text-muted-foreground">まだコメントはありません。</p> : comments.map((comment) => {
          const likes = commentLikes.filter((like) => like.comment_id === comment.id);
          const liked = likes.some((like) => like.user_id === currentUser?.id);
          return (
            <article key={comment.id} className="rounded-lg border p-3">
              <div className="text-sm font-medium">{comment.profiles?.display_name || comment.profiles?.username || "ユーザー"}</div>
              <p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => toggleCommentLike.mutate(comment.id)} disabled={!currentUser || toggleCommentLike.isPending}>
                {liked ? "❤️" : "♡"} {likes.length}
              </Button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
