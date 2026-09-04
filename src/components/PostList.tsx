import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { PostRow } from "@/lib/queries";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { POST_IMAGE_BUCKET, useMediaUrl } from "@/lib/storage";

function PostImage({ path }: { path: string }) {
  const url = useMediaUrl(path, POST_IMAGE_BUCKET);
  if (!url) return null;
  return (
    <img
      src={url}
      alt="投稿の添付画像"
      loading="lazy"
      className="mt-2 max-h-96 w-full rounded-lg border border-border object-contain"
    />
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ja-JP", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

type PostComment = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  parent_comment_id: string | null;
};

type PostLike = {
  id: string;
  post_id: string;
  user_id: string;
};

export function PostList({ posts }: { posts: PostRow[] }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const authorIds = [...new Set(posts.map((post) => post.user_id))];
  const postIds = posts.map((post) => post.id);

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["post-author-subscriptions", user?.id, authorIds],
    enabled: Boolean(user && authorIds.length > 0),
    queryFn: async () => {
      if (!user || authorIds.length === 0) return [] as string[];
      const { data, error } = await supabase.from("subscriptions").select("channel_id").eq("subscriber_id", user.id).in("channel_id", authorIds);
      if (error) throw error;
      return (data ?? []).map((row) => row.channel_id as string);
    },
  });

  const { data: postComments = [] } = useQuery({
    queryKey: ["post-comments", postIds],
    enabled: postIds.length > 0,
    queryFn: async (): Promise<PostComment[]> => {
      const { data, error } = await supabase.from("post_comments").select("id,post_id,user_id,body,created_at,parent_comment_id").in("post_id", postIds).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PostComment[];
    },
  });

  const { data: postLikes = [] } = useQuery({
    queryKey: ["post-likes", postIds],
    enabled: postIds.length > 0,
    queryFn: async (): Promise<PostLike[]> => {
      const db = supabase as any;
      const { data, error } = await db.from("post_likes").select("id,post_id,user_id").in("post_id", postIds);
      if (error) throw error;
      return (data ?? []) as PostLike[];
    },
  });

  const toggleLike = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) throw new Error("ログインが必要です");
      const db = supabase as any;
      const currentLike = postLikes.find((like) => like.post_id === postId && like.user_id === user.id);
      if (currentLike) {
        const { error } = await db.from("post_likes").delete().eq("id", currentLike.id).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("post_likes").insert({ post_id: postId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["post-likes"] });
    },
    onError: (error: Error) => toast.error(error.message || "いいねを更新できませんでした"),
  });

  const addComment = useMutation({
    mutationFn: async ({ postId, body }: { postId: string; body: string }) => {
      if (!user) throw new Error("ログインが必要です");
      const trimmed = body.trim();
      if (!trimmed) throw new Error("コメントを入力してください");
      if (trimmed.length > 1000) throw new Error("コメントは1000文字以内にしてください");
      const { error } = await supabase.from("post_comments").insert({ post_id: postId, user_id: user.id, body: trimmed });
      if (error) throw error;
    },
    onSuccess: async (_, variables) => {
      setCommentDrafts((current) => ({ ...current, [variables.postId]: "" }));
      await queryClient.invalidateQueries({ queryKey: ["post-comments"] });
      toast.success("コメントしました");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeComment = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("ログインが必要です");
      const { error } = await supabase.from("post_comments").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["post-comments"] });
      toast.success("コメントを削除しました");
    },
    onError: (error: Error) => toast.error(error.message || "コメントを削除できませんでした"),
  });

  const toggleSubscribe = useMutation({
    mutationFn: async (channelId: string) => {
      if (!user) throw new Error("ログインが必要です");
      if (channelId === user.id) return;
      if (subscriptions.includes(channelId)) {
        const { error } = await supabase.from("subscriptions").delete().eq("channel_id", channelId).eq("subscriber_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("subscriptions").insert({ channel_id: channelId, subscriber_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["post-author-subscriptions"] });
      await queryClient.invalidateQueries({ queryKey: ["channel-subscribers"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["posts"] }); toast.success("投稿を削除しました"); },
    onError: () => toast.error("削除に失敗しました"),
  });

  if (posts.length === 0) return <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">まだ文章の投稿がありません。</p>;

  return <ul className="space-y-3">{posts.map((post) => {
    const isOwnPost = user?.id === post.user_id;
    const isSubscribed = subscriptions.includes(post.user_id);
    const comments = postComments.filter((comment) => comment.post_id === post.id && !comment.parent_comment_id);
    const likes = postLikes.filter((like) => like.post_id === post.id);
    const isLiked = Boolean(user && likes.some((like) => like.user_id === user.id));
    const draft = commentDrafts[post.id] ?? "";
    return <li key={post.id} className="rounded-xl border border-border bg-card p-4 shadow-card"><div className="flex items-start gap-3">
      <UserAvatar src={post.profile?.avatar_url ?? null} name={post.profile?.display_name ?? "?"} className="size-9" />
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-sm">
        {post.profile ? <Link to="/u/$username" params={{ username: post.profile.username }} className="font-semibold hover:underline">{post.profile.display_name}</Link> : <span className="font-semibold">不明なユーザー</span>}
        <span className="text-xs text-muted-foreground">{formatDate(post.created_at)}</span>
        {!isOwnPost && post.profile && user ? <Button type="button" variant={isSubscribed ? "secondary" : "default"} size="sm" className="h-7 rounded-full px-3 text-xs font-semibold" disabled={toggleSubscribe.isPending} onClick={() => toggleSubscribe.mutate(post.user_id)}>{isSubscribed ? "登録済み" : "チャンネル登録"}</Button> : null}
      </div><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{post.body}</p>
      {post.image_path ? <PostImage path={post.image_path} /> : null}
      <div className="mt-3 border-t border-border pt-3"><div className="flex flex-wrap items-center gap-2"><Button type="button" variant={isLiked ? "secondary" : "ghost"} size="sm" className="h-8 gap-1.5 px-2.5" disabled={toggleLike.isPending} onClick={() => user ? toggleLike.mutate(post.id) : undefined} aria-pressed={isLiked} aria-label={isLiked ? "いいねを取り消す" : "この投稿にいいねする"}><Heart className={`size-4 ${isLiked ? "fill-current text-red-500" : ""}`} />いいね {likes.length}</Button>{!user ? <Link to="/auth" className="text-xs text-muted-foreground underline underline-offset-2">ログインしていいね</Link> : null}<div className="flex items-center gap-1 text-sm font-medium"><MessageCircle className="size-4" />コメント {comments.length}</div></div>
      {user ? <form className="mt-2 flex gap-2" onSubmit={(event) => { event.preventDefault(); addComment.mutate({ postId: post.id, body: draft }); }}><Textarea value={draft} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="この投稿にコメント..." rows={2} maxLength={1000} /><Button type="submit" size="icon" className="mt-auto shrink-0" disabled={addComment.isPending || !draft.trim()} aria-label="コメントを送信"><Send className="size-4" /></Button></form> : <p className="mt-2 text-xs text-muted-foreground"><Link to="/auth" className="text-primary underline">ログイン</Link>するとコメントできます。</p>}
      {comments.length > 0 ? <div className="mt-3 space-y-3">{comments.map((comment) => <div key={comment.id} className="flex gap-2 pl-2"><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</p><p className="whitespace-pre-wrap break-words text-sm">{comment.body}</p>{user?.id === comment.user_id ? <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 px-2" disabled={removeComment.isPending} onClick={() => removeComment.mutate(comment.id)} aria-label="コメントを削除"><Trash2 className="size-3" /></Button> : null}</div></div>)}</div> : null}</div></div>
      {isOwnPost ? <Button variant="ghost" size="sm" aria-label="投稿を削除" disabled={remove.isPending} onClick={() => remove.mutate(post.id)}><Trash2 className="size-4" /></Button> : null}
    </div></li>;
  })}</ul>;
}
