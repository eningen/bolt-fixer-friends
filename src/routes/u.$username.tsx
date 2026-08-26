import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Handshake } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { channelSubscribersQuery, profileQuery } from "@/lib/queries";
import { Header } from "@/components/Header";
import { ChannelAnalytics } from "@/components/ChannelAnalytics";
import { EmptyState, VideoCard, VideoGridSkeleton } from "@/components/VideoCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
        if (!avatarFile.type.startsWith("image/")) throw new Error("画像ファイルを選択してください");
        if (avatarFile.size > 5 * 1024 * 1024) throw new Error("画像は5MB以内にしてください");

        const extensionByType: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
          "image/gif": "gif",
        };
        const extension = extensionByType[avatarFile.type];
        if (!extension) throw new Error("JPG、PNG、WEBP、GIF画像を選択してください");

        const path = `${user.id}/avatar.${extension}`;
        const { error: uploadError } = await supabase.storage.from("avatars").upload(path, avatarFile, {
          upsert: true,
          contentType: avatarFile.type,
          cacheControl: "3600",
        });
        if (uploadError) throw new Error(`画像のアップロードに失敗しました: ${uploadError.message}`);

        const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
        if (!publicData?.publicUrl) throw new Error("画像URLを取得できませんでした");
        avatarUrl = `${publicData.publicUrl}?v=${Date.now()}`;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ display_name: cleanName, bio: cleanBio || null, avatar_url: avatarUrl })
        .eq("id", user.id);
      if (error) throw new Error(`プロフィールの保存に失敗しました: ${error.message}`);
    },
    onSuccess: async () => {
      toast.success("チャンネル情報を更新しました");
      setEditing(false);
      setAvatarFile(null);
      setPreviewUrl(null);
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
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sendCollaboration = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("ログインが必要です");
      if (!channelId || isOwner) throw new Error("このチャンネルにはコラボ依頼を送れません");
      const content = collabContent.trim();
      const reason = collabReason.trim();
      if (!content) throw new Error("コラボ内容を入力してください");
      if (!reason) throw new Error("コラボしたい理由を入力してください");
      const { data: requestId, error } = await supabase.rpc("send_collaboration_request", {
        p_recipient_id: channelId,
        p_content: content,
        p_reason: reason,
      });
      if (error) throw new Error(error.message);
      return requestId as string;
    },
    onSuccess: () => {
      setCollabContent("");
      setCollabReason("");
      setCollabOpen(false);
      toast.success("コラボ依頼を送信しました！");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const totalViews = (data?.videos ?? []).reduce((sum, video) => sum + (video.views ?? 0), 0);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {isPending ? (
          <VideoGridSkeleton count={3} />
        ) : !data ? (
          <EmptyState title="ユーザーが見つかりません" description="ユーザー名が変更されたか、削除された可能性があります。" />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar className="size-16">
                <AvatarImage src={previewUrl ?? data.profile.avatar_url ?? undefined} alt="" />
                <AvatarFallback>{data.profile.display_name.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-2xl font-extrabold">{data.profile.display_name}</h1>
                <p className="text-sm text-muted-foreground">@{data.profile.username}・登録者 {subscribers.length.toLocaleString()} 人</p>
              </div>
              {isOwner ? (
                <Button variant="secondary" className="rounded-full" onClick={() => setEditing((value) => !value)}>
                  {editing ? "編集を閉じる" : "チャンネルを編集"}
                </Button>
              ) : user ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant={isSubscribed ? "secondary" : "default"} className="rounded-full" disabled={toggleSubscribe.isPending} onClick={() => toggleSubscribe.mutate()}>
                    {isSubscribed ? "登録済み" : "チャンネル登録"}
                  </Button>
                  <Button variant="outline" className="rounded-full" onClick={() => setCollabOpen((value) => !value)}>
                    <Handshake className="mr-2 size-4" />
                    コラボ
                  </Button>
                </div>
              ) : (
                <Button asChild variant="default" className="rounded-full"><Link to="/auth">ログインして登録</Link></Button>
              )}
            </div>

            {!isOwner && user && collabOpen ? (
              <section className="mt-6 max-w-2xl rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">🤝 コラボ依頼を送る</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{data.profile.display_name} さんにコラボ内容と理由を送ります。</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setCollabOpen(false)}>閉じる</Button>
                </div>
                <div className="mt-4 space-y-4">
                  <label className="block text-sm font-medium">コラボ内容
                    <Textarea value={collabContent} onChange={(e) => setCollabContent(e.target.value)} maxLength={1000} rows={4} className="mt-2" placeholder="どんなコラボをしたいですか？" />
                    <span className="mt-1 block text-xs text-muted-foreground">{collabContent.length}/1000</span>
                  </label>
                  <label className="block text-sm font-medium">コラボしたい理由
                    <Textarea value={collabReason} onChange={(e) => setCollabReason(e.target.value)} maxLength={1000} rows={4} className="mt-2" placeholder="なぜこのチャンネルとコラボしたいですか？" />
                    <span className="mt-1 block text-xs text-muted-foreground">{collabReason.length}/1000</span>
                  </label>
                  <Button disabled={sendCollaboration.isPending || !collabContent.trim() || !collabReason.trim()} onClick={() => sendCollaboration.mutate()}>
                    {sendCollaboration.isPending ? "送信中…" : "コラボ依頼を送信"}
                  </Button>
                </div>
              </section>
            ) : null}

            {isOwner && editing ? (
              <section className="mt-6 max-w-2xl rounded-2xl border p-5">
                <h2 className="text-lg font-bold">チャンネル情報を編集</h2>
                <div className="mt-4 space-y-4">
                  <label className="block text-sm font-medium">チャンネル名
                    <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} className="mt-2 w-full rounded-xl border bg-background px-3 py-2 outline-none focus:ring-2" placeholder="チャンネル名" />
                  </label>
                  <label className="block text-sm font-medium">概要欄
                    <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={5} className="mt-2 w-full resize-y rounded-xl border bg-background px-3 py-2 outline-none focus:ring-2" placeholder="チャンネルについて紹介しましょう" />
                  </label>
                  <label className="block text-sm font-medium">アイコン画像
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="mt-2 block w-full text-sm" onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) { toast.error("画像は5MB以内にしてください"); return; }
                      setAvatarFile(file);
                      setPreviewUrl(URL.createObjectURL(file));
                    }} />
                    <span className="mt-1 block text-xs text-muted-foreground">PNG / JPG / WEBP / GIF、5MBまで</span>
                  </label>
                  <div className="flex gap-2">
                    <Button disabled={saveProfile.isPending} onClick={() => saveProfile.mutate()}>{saveProfile.isPending ? "保存中…" : "保存する"}</Button>
                    <Button variant="ghost" onClick={() => setEditing(false)}>キャンセル</Button>
                  </div>
                </div>
              </section>
            ) : null}

            {data.profile.bio ? <p className="mt-4 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed">{data.profile.bio}</p> : null}
            {isOwner ? <ChannelAnalytics subscribers={subscribers} totalViews={totalViews} videoCount={data.videos.length} /> : null}

            <h2 className="mb-4 mt-8 text-lg font-bold">投稿した動画</h2>
            {data.videos.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{data.videos.map((video) => <VideoCard key={video.id} video={video} />)}</div>
            ) : <EmptyState title="まだ投稿がありません" description="最初の動画を待ちましょう。" />}
          </>
        )}
      </main>
    </div>
  );
}
