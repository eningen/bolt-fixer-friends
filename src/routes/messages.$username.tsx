import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/messages/$username")({
  head: () => ({ meta: [{ title: "DM｜Stickman video" }] }),
  component: MessagesPage,
});

type Profile = { id: string; username: string; display_name: string; avatar_url: string | null };
type Message = { id: string; sender_id: string; recipient_id: string; body: string; created_at: string };

function MessagesPage() {
  const { username } = Route.useParams();
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: target, isPending: targetPending } = useQuery({
    queryKey: ["dm-profile", username],
    enabled: Boolean(username),
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.from("profiles").select("id,username,display_name,avatar_url").eq("username", username).maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  const { data: isFriend = false, isPending: friendshipPending } = useQuery({
    queryKey: ["friendship", user?.id, target?.id],
    enabled: Boolean(user?.id && target?.id),
    queryFn: async () => {
      const db = supabase as any;
      const { data, error } = await db.rpc("are_friends", { p_other_id: target!.id });
      if (error) throw error;
      return Boolean(data);
    },
  });

  const { data: messages = [], isPending: messagesPending } = useQuery({
    queryKey: ["direct-messages", user?.id, target?.id],
    enabled: Boolean(user?.id && target?.id && isFriend),
    refetchInterval: 3000,
    queryFn: async (): Promise<Message[]> => {
      const db = supabase as any;
      const { data, error } = await db
        .from("direct_messages")
        .select("id,sender_id,recipient_id,body,created_at")
        .or(`and(sender_id.eq.${user!.id},recipient_id.eq.${target!.id}),and(sender_id.eq.${target!.id},recipient_id.eq.${user!.id})`)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!user || !target) throw new Error("ログインが必要です");
      const clean = body.trim();
      if (!clean) return;
      if (clean.length > 2000) throw new Error("メッセージは2000文字以内です");
      const db = supabase as any;
      const { error } = await db.from("direct_messages").insert({ sender_id: user.id, recipient_id: target.id, body: clean });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      void queryClient.invalidateQueries({ queryKey: ["direct-messages", user?.id, target?.id] });
    },
    onError: (error: Error) => toast.error(error.message || "送信できませんでした"),
  });

  if (loading || targetPending || friendshipPending) {
    return <div className="min-h-screen"><Header /><main className="mx-auto max-w-2xl px-4 py-10"><div className="h-20 animate-pulse rounded-2xl bg-surface-strong" /></main></div>;
  }

  if (!user) {
    return <div className="min-h-screen"><Header /><main className="mx-auto max-w-2xl px-4 py-20 text-center"><p className="text-muted-foreground">DMを利用するにはログインしてください。</p><Button asChild className="mt-4"><Link to="/auth">ログイン</Link></Button></main></div>;
  }

  if (!target || target.id === user.id) {
    return <div className="min-h-screen"><Header /><main className="mx-auto max-w-2xl px-4 py-20 text-center"><p className="text-muted-foreground">ユーザーが見つかりません。</p></main></div>;
  }

  if (!isFriend) {
    return <div className="min-h-screen"><Header /><main className="mx-auto max-w-2xl px-4 py-20 text-center"><p className="text-muted-foreground">DMはフレンド同士でのみ利用できます。</p><Button asChild variant="outline" className="mt-4 rounded-full"><Link to="/u/$username" params={{ username: target.username }}>チャンネルに戻る</Link></Button></main></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto flex h-[calc(100vh-4rem)] max-w-2xl flex-col px-4 py-4 pb-24 md:pb-4">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <Button asChild variant="ghost" size="icon" className="rounded-full"><Link to="/u/$username" params={{ username: target.username }}><ArrowLeft className="size-5" /></Link></Button>
          <UserAvatar className="size-10" src={target.avatar_url} name={target.display_name} />
          <div className="min-w-0"><p className="truncate font-bold">{target.display_name}</p><p className="truncate text-xs text-muted-foreground">@{target.username}</p></div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto py-4">
          {messagesPending ? <div className="text-center text-sm text-muted-foreground">メッセージを読み込み中…</div> : messages.length === 0 ? <div className="py-20 text-center text-sm text-muted-foreground">まだメッセージはありません。最初の一言を送ってみよう！</div> : messages.map((message) => {
            const mine = message.sender_id === user.id;
            return <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm ${mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted text-foreground"}`}><p className="whitespace-pre-wrap break-words">{message.body}</p><p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{new Date(message.created_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p></div></div>;
          })}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border pt-3">
          <div className="flex items-end gap-2">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={2} placeholder="メッセージを入力…" className="resize-none" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (body.trim()) sendMessage.mutate(); } }} />
            <Button size="icon" className="size-11 shrink-0 rounded-full" disabled={sendMessage.isPending || !body.trim()} onClick={() => sendMessage.mutate()}><Send className="size-4" /></Button>
          </div>
          <p className="mt-1 text-right text-[10px] text-muted-foreground">Enterで送信・Shift+Enterで改行</p>
        </div>
      </main>
    </div>
  );
}
