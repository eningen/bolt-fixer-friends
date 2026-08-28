import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Film, Image, Link2, Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { parseVideoUrl } from "@/lib/video";
import { MAX_VIDEO_BYTES, uploadVideoFile } from "@/lib/storage";
import { MAX_THUMBNAIL_BYTES, uploadCustomThumbnail } from "@/lib/thumbnail";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const metaSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "タイトルを入力してください" })
    .max(100, { message: "タイトルは100文字以内にしてください" }),
  description: z.string().trim().max(1000, { message: "説明は1000文字以内にしてください" }),
});

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "動画を投稿｜Stickman video" },
      {
        name: "description",
        content:
          "YouTubeのURLを貼るか、フォトライブラリの動画ファイルを直接アップロードして棒人間動画を投稿できます。",
      },
      { property: "og:title", content: "動画を投稿｜Stickman video" },
      {
        property: "og:description",
        content: "URLでも端末の動画ファイルでも、棒人間動画をかんたんに投稿。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"file" | "url" | "text">("file");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const parsed = parseVideoUrl(url);
  const filePreview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const thumbnailPreview = useMemo(
    () => (thumbnailFile ? URL.createObjectURL(thumbnailFile) : null),
    [thumbnailFile],
  );

  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    };
  }, [filePreview, thumbnailPreview]);

  const onPickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null;
    if (!picked) {
      setFile(null);
      return;
    }
    if (!picked.type.startsWith("video/")) {
      toast.error("動画ファイルを選択してください");
      return;
    }
    if (picked.size > MAX_VIDEO_BYTES) {
      toast.error("動画は200MB以内にしてください");
      return;
    }
    setFile(picked);
    if (!title.trim()) setTitle(picked.name.replace(/\.[^.]+$/, "").slice(0, 100));
  };

  const onPickThumbnail = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null;
    if (!picked) {
      setThumbnailFile(null);
      return;
    }
    if (!picked.type.startsWith("image/")) {
      toast.error("画像ファイルを選択してください");
      return;
    }
    if (picked.size > MAX_THUMBNAIL_BYTES) {
      toast.error("サムネイルは10MB以内にしてください");
      return;
    }
    setThumbnailFile(picked);
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || busy) return;

    if (mode === "text") {
      const text = body.trim();
      if (!text) {
        toast.error("本文を入力してください");
        return;
      }
      if (text.length > 2000) {
        toast.error("本文は2000文字以内にしてください");
        return;
      }
      setBusy(true);
      const { error } = await supabase.from("posts").insert({ user_id: user.id, body: text });
      setBusy(false);
      if (error) {
        toast.error("投稿に失敗しました。もう一度お試しください。");
        return;
      }
      setBody("");
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("文章を投稿しました");
      void navigate({ to: "/" });
      return;
    }

    const meta = metaSchema.safeParse({ title, description });
    if (!meta.success) {
      toast.error(meta.error.issues[0]?.message ?? "入力内容を確認してください");
      return;
    }

    setBusy(true);
    try {
      let insertData: {
        video_url: string;
        platform: string;
        youtube_id: string | null;
        thumbnail_url: string | null;
        storage_path: string | null;
      };

      if (mode === "file") {
        if (!file) {
          toast.error("動画ファイルを選択してください");
          return;
        }
        const { videoPath, thumbnailPath } = await uploadVideoFile(file, user.id);
        insertData = {
          video_url: videoPath,
          platform: "upload",
          youtube_id: null,
          thumbnail_url: thumbnailPath,
          storage_path: videoPath,
        };
      } else {
        const video = parseVideoUrl(url);
        if (!video) {
          toast.error("YouTubeのURLを入力してください");
          return;
        }
        insertData = {
          video_url: video.normalizedUrl,
          platform: video.platform,
          youtube_id: video.youtubeId,
          thumbnail_url: video.thumbnailUrl,
          storage_path: null,
        };
      }

      if (thumbnailFile) {
        insertData.thumbnail_url = await uploadCustomThumbnail(thumbnailFile, user.id);
      }

      const { data, error } = await supabase
        .from("videos")
        .insert({
          user_id: user.id,
          title: meta.data.title,
          description: meta.data.description || null,
          ...insertData,
        })
        .select("id")
        .single();
      if (error) throw error;

      // AI感想は投稿処理を待たせずバックグラウンドで生成する。
      // 生成に失敗しても動画投稿そのものは成功したままにする。
      void supabase.functions.invoke("ai-video-review", {
        body: { videoId: data.id },
      });

      await queryClient.invalidateQueries({ queryKey: ["videos"] });
      toast.success("動画を投稿しました。Stickman AIが感想を準備中です！");
      void navigate({ to: "/video/$videoId", params: { videoId: data.id } });
    } catch {
      toast.error("投稿に失敗しました。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-extrabold">投稿する</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          動画はフォトライブラリまたはURLから、文章だけの投稿もできます。
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-6">
          <Tabs value={mode} onValueChange={(value) => setMode(value as "file" | "url" | "text")}>
            <TabsList className="w-full">
              <TabsTrigger value="file" className="flex-1">
                <Film className="size-4" />
                ファイル
              </TabsTrigger>
              <TabsTrigger value="url" className="flex-1">
                <Link2 className="size-4" />
                URL
              </TabsTrigger>
              <TabsTrigger value="text" className="flex-1">
                <PenLine className="size-4" />
                文章
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="mt-4 space-y-3">
              <Label htmlFor="video-file">動画ファイル（最大200MB）</Label>
              <Input
                id="video-file"
                type="file"
                accept="video/*"
                onChange={onPickFile}
                className="cursor-pointer file:mr-3 file:text-sm"
              />
              {filePreview ? (
                <video
                  src={filePreview}
                  controls
                  playsInline
                  className="aspect-video w-full rounded-lg bg-surface-strong"
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  スマートフォンではフォトライブラリから直接選択できます。
                </p>
              )}
            </TabsContent>

            <TabsContent value="url" className="mt-4 space-y-3">
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
              {parsed?.thumbnailUrl ? (
                <img
                  src={parsed.thumbnailUrl}
                  alt="サムネイルのプレビュー"
                  className="aspect-video w-full rounded-lg object-cover"
                />
              ) : null}
            </TabsContent>

            <TabsContent value="text" className="mt-4 space-y-3">
              <Label htmlFor="post-body">本文（最大2000文字）</Label>
              <Textarea
                id="post-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="いまどうしてる？棒人間の話をしよう"
                maxLength={2000}
                rows={7}
              />
              <p className="text-xs text-muted-foreground">{body.trim().length} / 2000</p>
            </TabsContent>
          </Tabs>

          {mode === "text" ? null : (
            <>
              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center gap-2">
                  <Image className="size-4" />
                  <Label htmlFor="thumbnail-file">カスタムサムネイル（任意）</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  好きな画像をサムネイルにできます。10MB以内の画像を選択してください。
                  未選択なら動画から自動生成、URL投稿なら元のサムネイルを使用します。
                </p>
                <Input
                  id="thumbnail-file"
                  type="file"
                  accept="image/*"
                  onChange={onPickThumbnail}
                  className="cursor-pointer file:mr-3 file:text-sm"
                />
                {thumbnailPreview ? (
                  <img
                    src={thumbnailPreview}
                    alt="カスタムサムネイルのプレビュー"
                    className="aspect-video w-full rounded-lg object-cover"
                  />
                ) : null}
              </div>

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
            </>
          )}

          <Button type="submit" size="lg" disabled={busy} className="w-full sm:w-auto">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? "送信中…" : "投稿する"}
          </Button>
        </form>
      </main>
    </div>
  );
}
