import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Handshake, MessageCircle, UserPlus, Check } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { channelSubscribersQuery, profileQuery } from "@/lib/queries";
import { Header } from "@/components/Header";
import { ChannelAnalytics } from "@/components/ChannelAnalytics";
import { EmptyState, VideoCard, VideoGridSkeleton } from "@/components/VideoCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/UserAvatar";
import { uploadAvatarFile } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const BLOCKED_NAME_TERMS = [
  "sex", "sexy", "porn", "xxx", "fuck", "shit", "dick", "pussy", "nude", "nudes",
  "セックス", "せっくす", "えっち", "エッチ", "エロ", "えろ", "ポルノ", "ちんこ", "ちんぽ",
  "まんこ", "おっぱい", "巨乳", "裸", "全裸", "性器", "オナニー", "おなにー", "精子",
];

function hasBlockedNameTerm(value: string) {
  const normalized = value.toLowerCase().replace(/[\s_\-\.]/g, "");
  return BLOCKED_NAME_TERMS.some((term) => normalized.includes(term.toLowerCase().replace(/[\s_\-\.]/g, "")));
}

export const Route = createFileRoute("/u/$username")({
  head: () => ({
    meta: [
      { title: "プロフィール｜Stickman video" },
      { name: "description", content: "投稿者のプロフィールと投稿した棒人間動画の一覧です。" },
      { property: "og:title", content: "プロフィール｜Stickman video" },
      { property: "og:description", content: "投稿者のプロフィールと動画一覧。" },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(profileQuery(username));
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [collabOpen, setCollabOpen] = useState(false);
  const [collabContent, setCollabContent] = useState("");
  const [collabReason, setCollabReason] = useState("");

  const channelId = data?.profile.id;
  const { data: subscribers = [] } = useQuery(channelSubscribersQuery(channelId));
  const isOwner = Boolean(user && channelId && user.id === channelId);
  const isSubscribed = Boolean(user && subscribers.some((s) => s.subscriber_id === user.id));

  const { data: subscribedChannels = [], isPending: subscriptionsPending } = useQuery({
    queryKey: ["profile-subscriptions", channelId],
    enabled: Boolean(channelId),
    queryFn: async () => {
      if (!channelId) return [] as Array<{ id: string; username: string; display_name: string; avatar_url: string | null }>;
      const db = supabase as any;
      const { data: rows, error } = await db.from("subscriptions").select("channel_id,created_at").eq("subscriber_id", channelId).order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (rows ?? []).map((row: { channel_id: string }) => row.channel_id);
      if (ids.length === 0) return [] as Array<{ id: string; username: string; display_name: string; avatar_url: string | null }>;
      const { data: channels, error: channelsError } = await db.from("profiles").select("id,username,display_name,avatar_url").in("id", ids);
      if (channelsError) throw channelsError;
      const byId = new Map((channels ?? []).map((channel: { id: string; username: string; display_name: string; avatar_url: string | null }) => [channel.id, channel]));
      return ids.map((id: string) => byId.get(id)).filter(Boolean) as Array<{ id: string; username: string; display_name: string; avatar_url: string | null }>;
    },
  });

  const { data: friendshipStatus = { friends: false, pending: false, incoming: false } } = useQuery({
    queryKey: ["friendship-status", user?.id, channelId],
    enabled: Boolean(user?.id && channelId && !isOwner),
    queryFn: async () => {
      const db = supabase as any;
      const [{ data: friends, error: friendsError }, { data: outgoing, error: outgoingError }, { data: incoming, error: incomingError }] = await Promise.all([
        db.from("friendships").select("id").or(`and(user_a.eq.${user!.id},user_b.eq.${channelId}),and(user_a.eq.${channelId},user_b.eq.${user!.id})`).limit(1),
        db.from("friend_requests").select("id").eq("requester_id", user!.id).eq("recipient_id", channelId).eq("status", "pending").limit(1),
        db.from("friend_requests").select("id").eq("requester_id", channelId).eq("recipient_id", user!.id).eq("status", "pending").limit(1),
      ]);
      if (friendsError) throw friendsError;
      if (outgoingError) throw outgoingError;
      if (incomingError) throw incomingError;
      return { friends: Boolean(friends?.length), pending: Boolean(outgoing?.length), incoming: Boolean(incoming?.length) };
    },
  });

  useEffect(() => {
    if (!data || editing) return;
    setDisplayName(data.profile.display_name ?? "");
    setBio(data.profile.bio ?? "");
    setAvatarFile(null);
    setPreviewUrl(null);
  }, [data, editing]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user || !channelId || user.id !== channelId) throw new Error("自分のチャンネルだけ編集できます");
      const cleanName = displayName.trim();
      const cleanBio = bio.trim();
      if (!cleanName) throw new Error("チャンネル名を入力してください");
      if (cleanName.length > 40) throw new Error("チャンネル名は40文字以内にしてください");
      if (hasBlockedNameTerm(cleanName)) throw new Error("このチャンネル名は使用できません");
      if (cleanBio.length > 500) throw new Error("概要欄は500文字以内にしてください");
      let avatarUrl = data.profile.avatar_url ?? null;
      if (avatarFile) {
        avatarUrl = await uploadAvatarFile(avatarFile, user.id);
      }

      const { error } = await supabase.from("profiles").update({ display_name: cleanName, bio: cleanBio || null, avatar_url: avatarUrl }).eq("id", user.id);
      if (error) throw new Error(`プロフィールの保存に失敗しました: ${error.message}`);
    },
    onSuccess: async () => {
      toast.success("チャンネル情報を更新しました");
      setEditing(false); setAvatarFile(null); setPreviewUrl(null);
      await queryClient.invalidateQueries({ queryKey: ["profile", username] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleSubscribe = useMutation({
    mutationFn: async () => {
      if (!user || !channelId) throw new Error("ログインが必要です");
      if (isSubscribed) {
        const { error } = await supabase.from("subscriptions").delete().eq("channel_id", channelId).eq("subscriber_id", user.id);
        if (error) throw error;
        return "unsubscribed" as const;
      }
      const { error } = await supabase.from("subscriptions").insert({ channel_id: channelId, subscriber_id: user.id });
      if (error) throw error;
      return "subscribed" as const;
    },
    onSuccess: (result) => {
      toast.success(result === "subscribed" ? "チャンネル登録しました" : "登録を解除しました");
      void queryClient.invalidateQueries({ queryKey: ["channel-subscribers", channelId] });
      void queryClient.invalidateQueries({ queryKey: ["profile-subscriptions", user?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sendCollaboration = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("ログインが必要です");
      if (!channelId || isOwner) throw new Error("このチャンネルにはコラボ依頼を送れません");
      const content = collabContent.trim(); const reason = collabReason.trim();
      if (!content) throw new Error("コラボ内容を入力してください");
      if (!reason) throw new Error("コラボしたい理由を入力してください");
      const db = supabase as any;
      const { data: requestId, error } = await db.rpc("send_collaboration_request", { p_recipient_id: channelId, p_content: content, p_reason: reason });
      if (error) throw new Error(error.message);
      return requestId as string;
    },
    onSuccess: () => { setCollabContent(""); setCollabReason(""); setCollabOpen(false); toast.success("コラボ依頼を送信しました！"); },
    onError: (error: Error) => toast.error(error.message),
  });

  const sendFriendRequest = useMutation({
    mutationFn: async () => {
      if (!user || !channelId || isOwner) throw new Error("このチャンネルにはフレンド申請を送れません");
      const db = supabase as any;
      const { error } = await db.rpc("send_friend_request", { p_recipient_id: channelId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("フレンド申請を送信しました！");
      void queryClient.invalidateQueries({ queryKey: ["friendship-status", user?.id, channelId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const totalViews = (data?.videos ?? []).reduce((sum, video) => sum + (video.views ?? 0), 0);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {isPending ? <VideoGridSkeleton count={3} /> : !data ? <EmptyState title="ユーザーが見つかりません" description="ユーザー名が変更されたか、削除された可能性があります。" /> : <>
          <div className="flex flex-wrap items-center gap-4">
            {previewUrl ? <Avatar className="size-16"><AvatarImage src={previewUrl} alt="" /><AvatarFallback>{data.profile.display_name.slice(0, 2)}</AvatarFallback></Avatar> : <UserAvatar className="size-16" src={data.profile.avatar_url} name={data.profile.display_name} />}
            <div className="min-w-0 flex-1"><h1 className="truncate text-2xl font-extrabold">{data.profile.display_name}</h1><p className="text-sm text-muted-foreground">@{data.profile.username}・登録者 {subscribers.length.toLocaleString()} 人</p></div>
            {isOwner ? <Button variant="secondary" className="rounded-full" onClick={() => setEditing((value) => !value)}>{editing ? "編集を閉じる" : "チャンネルを編集"}</Button> : user ? <div className="flex flex-wrap gap-2">
              <Button variant={isSubscribed ? "secondary" : "default"} className="rounded-full" disabled={toggleSubscribe.isPending} onClick={() => toggleSubscribe.mutate()}>{isSubscribed ? "登録済み" : "チャンネル登録"}</Button>
              {friendshipStatus.friends ? <Button asChild variant="outline" className="rounded-full"><Link to="/messages/$username" params={{ username: data.profile.username }}><MessageCircle className="mr-2 size-4" />DM</Link></Button> : friendshipStatus.pending ? <Button variant="secondary" className="rounded-full" disabled><Check className="mr-2 size-4" />申請済み</Button> : friendshipStatus.incoming ? <Button variant="secondary" className="rounded-full" disabled><UserPlus className="mr-2 size-4" />申請が届いています</Button> : <Button variant="outline" className="rounded-full" disabled={sendFriendRequest.isPending} onClick={() => sendFriendRequest.mutate()}><UserPlus className="mr-2 size-4" />フレンド申請</Button>}
              <Button variant="outline" className="rounded-full" onClick={() => setCollabOpen((value) => !value)}><Handshake className="mr-2 size-4" />コラボ</Button>
            </div> : <Button asChild variant="default" className="rounded-full"><Link to="/auth">ログインして登録</Link></Button>}
          </div>

          {!isOwner && user && collabOpen ? <section className="mt-6 max-w-2xl rounded-2xl border border-primary/20 bg-primary/5 p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">🤝 コラボ依頼を送る</h2><p className="mt-1 text-sm text-muted-foreground">{data.profile.display_name} さんにコラボ内容と理由を送ります。</p></div><Button variant="ghost" size="sm" onClick={() => setCollabOpen(false)}>閉じる</Button></div><div className="mt-4 space-y-4"><label className="block text-sm font-medium">コラボ内容<Textarea value={collabContent} onChange={(e) => setCollabContent(e.target.value)} maxLength={1000} rows={4} className="mt-2" placeholder="どんなコラボをしたいですか？" /><span className="mt-1 block text-xs text-muted-foreground">{collabContent.length}/1000</span></label><label className="block text-sm font-medium">コラボしたい理由<Textarea value={collabReason} onChange={(e) => setCollabReason(e.target.value)} maxLength={1000} rows={4} className="mt-2" placeholder="なぜこのチャンネルとコラボしたいですか？" /><span className="mt-1 block text-xs text-muted-foreground">{collabReason.length}/1000</span></label><Button disabled={sendCollaboration.isPending || !collabContent.trim() || !collabReason.trim()} onClick={() => sendCollaboration.mutate()}>{sendCollaboration.isPending ? "送信中…" : "コラボ依頼を送信"}</Button></div></section> : null}

          {isOwner && editing ? <section className="mt-6 max-w-2xl rounded-2xl border p-5"><h2 className="text-lg font-bold">チャンネル情報を編集</h2><div className="mt-4 space-y-4"><label className="block text-sm font-medium">チャンネル名<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} className="mt-2 w-full rounded-xl border bg-background px-3 py-2 outline-none focus:ring-2" placeholder="チャンネル名" /></label><label className="block text-sm font-medium">概要欄<textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={5} className="mt-2 w-full resize-y rounded-xl border bg-background px-3 py-2 outline-none focus:ring-2" placeholder="チャンネルについて紹介しましょう" /></label><label className="block text-sm font-medium">アイコン画像<input type="file" accept="image/*,image/heic,image/heif" className="mt-2 block w-full text-sm" onChange={(e) => { const file = e.target.files?.[0] ?? null; if (!file) return; if (file.size > 5 * 1024 * 1024) { toast.error("画像は5MB以内にしてください"); return; } setAvatarFile(file); setPreviewUrl(URL.createObjectURL(file)); }} /><span className="mt-1 block text-xs text-muted-foreground">PNG / JPG / WEBP / GIF / HEIC、5MBまで</span></label><div className="flex gap-2"><Button disabled={saveProfile.isPending} onClick={() => saveProfile.mutate()}>{saveProfile.isPending ? "保存中…" : "保存する"}</Button><Button variant="ghost" onClick={() => setEditing(false)}>キャンセル</Button></div></div></section> : null}

          {data.profile.bio ? <p className="mt-4 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed">{data.profile.bio}</p> : null}

          <section className="mt-8"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">登録チャンネル</h2><span className="text-sm text-muted-foreground">{subscribedChannels.length.toLocaleString()} チャンネル</span></div>{subscriptionsPending ? <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">登録チャンネルを読み込み中…</div> : subscribedChannels.length > 0 ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{subscribedChannels.map((channel) => <Link key={channel.id} to="/u/$username" params={{ username: channel.username }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"><UserAvatar className="size-12 shrink-0" src={channel.avatar_url} name={channel.display_name} /><div className="min-w-0"><p className="truncate font-semibold">{channel.display_name}</p><p className="truncate text-sm text-muted-foreground">@{channel.username}</p></div></Link>)}</div> : <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">まだチャンネル登録していません。</div>}</section>

          {isOwner ? <ChannelAnalytics subscribers={subscribers} totalViews={totalViews} videoCount={data.videos.length} /> : null}
          <h2 className="mb-4 mt-8 text-lg font-bold">投稿した動画</h2>
          {data.videos.length > 0 ? <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{data.videos.map((video) => <VideoCard key={video.id} video={video} />)}</div> : <EmptyState title="まだ投稿がありません" description="最初の動画を待ちましょう。" />}
        </>}
      </main>
    </div>
  );
}
