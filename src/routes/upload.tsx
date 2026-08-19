import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { parseVideoUrl } from "@/lib/video";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "タイトルを入力してください" })
    .max(100, { message: "タイトルは100文字以内にしてください" }),
  description: z.string().trim().max(1000, { message: "説明は1000文字以内にしてください" }),
  url: z.string().trim().min(1, { message: "動画のURLを入力してください" }),
});

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "動画を投稿｜Stickman video" },
      { name: "description", content: "YouTubeのURLを貼るだけで棒人間動画を投稿できます。" },
      { property: "og:title", content: "動画を投稿｜Stickman video" },
      { property: "og:description", content: "YouTubeのURLを貼るだけで棒人間動画を投稿。" },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const parsed = parseVideoUrl(url);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    const values = formSchema.safeParse({ title, description, url });
    if (!values.success) {
      toast.error(values.error.issues[0]?.message ?? "入力内容を確認してください");
      return;
    }
    const video = parseVideoUrl(values.data.url);
    if (!video) {
      toast.error("YouTubeのURLを入力してください");
      return;
    }

    setBusy(true);
    const { data, error } = await supabase
      .from("videos")
      .insert({
        user_id: user.id,
        title: values.data.title,
        description: values.data.description || null,
        video_url: video.normalizedUrl,
        platform: video.platform,
        youtube_id: video.youtubeId,
        thumbnail_url: video.thumbnailUrl,
      })
      .select("id")
      .single();
    setBusy(false);

    if (error) {
      toast.error("投稿に失敗しました。もう一度お試しください。");
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["videos"] });
    toast.success("動画を投稿しました");
    void navigate({ to: "/video/$videoId", params: { videoId: data.id } });
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-extrabold">動画を投稿</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          YouTubeの動画URLを貼り付けて、棒人間動画をシェアしましょう。
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="url">動画URL</Label>
            <Input
              id="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              maxLength={300}
            />
            {url.trim() && !parsed ? (
              <p className="text-xs text-destructive">YouTubeのURLとして認識できませんでした</p>
            ) : null}
          </div>

          {parsed?.thumbnailUrl ? (
            <img
              src={parsed.thumbnailUrl}
              alt="サムネイルのプレビュー"
              className="aspect-video w-full rounded-lg object-cover"
            />
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="title">タイトル</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="棒人間バトル 第1話"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">説明（任意）</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="動画の見どころを書きましょう"
              maxLength={1000}
              rows={5}
            />
          </div>

          <Button type="submit" size="lg" disabled={busy} className="w-full sm:w-auto">
            投稿する
          </Button>
        </form>
      </main>
    </div>
  );
}
