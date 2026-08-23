import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { myProfileQuery } from "@/lib/queries";
import { VIDEO_BUCKET } from "@/lib/storage";
import { Header } from "@/components/Header";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "プロフィール編集｜Stickman video" },
      {
        name: "description",
        content: "表示名・ユーザー名・自己紹介・アイコン画像を編集して、あなたのチャンネルを整えましょう。",
      },
      { property: "og:title", content: "プロフィール編集｜Stickman video" },
      { property: "og:description", content: "表示名やアイコンを変更してチャンネルを整える。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery(myProfileQuery(user?.id));

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name);
    setUsername(profile.username);
    setBio(profile.bio ?? "");
    setAvatar(profile.avatar_url);
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("ログインが必要です");
      const name = displayName.trim();
      const handle = username.trim().toLowerCase();
      if (!name) throw new Error("表示名を入力してください");
      if (!/^[a-z0-9_]{3,20}$/.test(handle))
        throw new Error("ユーザー名は英小文字・数字・_ の3〜20文字で入力してください");

      let avatarPath = avatar;
      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${user.id}/avatar-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(VIDEO_BUCKET)
          .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
        if (upErr) throw new Error("画像をアップロードできませんでした");
        avatarPath = path;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: name,
          username: handle,
          bio: bio.trim() || null,
          avatar_url: avatarPath,
        })
        .eq("id", user.id);
      if (error) {
        throw new Error(
          error.code === "23505" || error.message.includes("duplicate")
            ? "このユーザー名は既に使われています"
            : "保存できませんでした",
        );
      }
      return handle;
    },
    onSuccess: (handle) => {
      toast.success("プロフィールを更新しました");
      void queryClient.invalidateQueries({ queryKey: ["my-profile", user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      setFile(null);
      void navigate({ to: "/u/$username", params: { username: handle } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-xl px-4 py-8">
        <h1 className="text-2xl font-extrabold">プロフィール編集</h1>

        {!user && !loading ? (
          <div className="mt-6 flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16">
            <p className="text-sm text-muted-foreground">ログインすると編集できます。</p>
            <Button asChild>
              <Link to="/auth">ログイン</Link>
            </Button>
          </div>
        ) : (
          <form
            className="mt-6 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <div className="flex items-center gap-4">
              <UserAvatar src={file ? null : avatar} name={displayName} className="size-16" />
              <div className="space-y-2">
                <label htmlFor="avatar-file" className="block text-sm font-medium">
                  アイコン画像
                </label>
                <Input
                  id="avatar-file"
                  type="file"
                  accept="image/*"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                {file ? (
                  <p className="text-xs text-muted-foreground">{file.name} を保存します</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="display-name" className="block text-sm font-medium">
                表示名
              </label>
              <Input
                id="display-name"
                value={displayName}
                maxLength={40}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-medium">
                ユーザー名（@）
              </label>
              <Input
                id="username"
                value={username}
                maxLength={20}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="bio" className="block text-sm font-medium">
                自己紹介
              </label>
              <Textarea
                id="bio"
                value={bio}
                rows={4}
                maxLength={500}
                onChange={(event) => setBio(event.target.value)}
              />
            </div>

            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "保存中..." : "保存する"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
