import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Reply, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatRelativeDate } from "@/lib/video";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ReplyRow {
  id: string;
  comment_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile: { username: string; display_name: string; avatar_url: string | null } | null;
}

export function CommentReplies({ commentId }: { commentId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");

  const queryKey = ["comment", commentId, "replies"];
  const { data: replies = [], isPending } = useQuery({
    queryKey,
    queryFn: async (): Promise<ReplyRow[]> => {
      const { data, error } = await supabase
        .from("comment_replies")
        .select(
          "id,comment_id,user_id,body,created_at,profile:profiles!comment_replies_user_id_fkey(username,display_name,avatar_url)",
        )
        .eq("comment_id", commentId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ReplyRow[];
    },
  });

  const post = useMutation({
    mutationFn: async (text: string) => {
      if (!user) throw new Error("ログインが必要です");
      const trimmed = text.trim();
      if (!trimmed) throw new Error("返信を入力してください");

      const { error } = await supabase.from("comment_replies").insert({
        comment_id: commentId,
        user_id: user.id,
        body: trimmed,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      setOpen(true);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comment_replies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error("返信を削除できませんでした"),
  });

  return (
    <div className="mt-1">
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((value) => !value)}>
        <Reply className="size-4" />
        {open ? "返信を閉じる" : replies.length > 0 ? `返信 ${replies.length}件` : "返信"}
      </Button>

      {open ? (
        <div className="mt-2 ml-8 border-l pl-3">
          {user ? (
            <form onSubmit={(event) => { event.preventDefault(); post.mutate(body); }}>
              <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="返信を入力..." rows={2} maxLength={1000} aria-label="返信" />
              <div className="mt-2 flex justify-end">
                <Button type="submit" size="sm" disabled={post.isPending || !body.trim()}>返信する</Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">ログインすると返信できます。</p>
          )}

          <div className="mt-3 space-y-3">
            {isPending ? <div className="h-8 animate-pulse rounded bg-surface-strong" /> : null}
            {replies.map((reply) => (
              <div key={reply.id} className="flex gap-2">
                <UserAvatar src={reply.profile?.avatar_url ?? null} name={reply.profile?.display_name ?? "?"} className="size-7" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{reply.profile?.display_name ?? "不明なユーザー"} · {formatRelativeDate(reply.created_at)}</p>
                  <p className="whitespace-pre-wrap break-words text-sm">{reply.body}</p>
                  {user?.id === reply.user_id ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove.mutate(reply.id)} aria-label="返信を削除"><Trash2 className="size-4" /></Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
