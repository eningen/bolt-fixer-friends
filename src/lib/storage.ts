import { queryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const VIDEO_BUCKET = "videos";
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB

export function isStoragePath(value: string | null | undefined): boolean {
  return Boolean(value) && !/^https?:\/\//i.test(value as string);
}

function signedUrlQuery(path: string | null | undefined) {
  return queryOptions({
    queryKey: ["storage-url", path],
    enabled: Boolean(path) && isStoragePath(path),
    staleTime: 45 * 60 * 1000,
    queryFn: async (): Promise<string | null> => {
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from(VIDEO_BUCKET)
        .createSignedUrl(path, 60 * 60);
      if (error) return null;
      return data.signedUrl;
    },
  });
}

/** http(s) URLはそのまま、ストレージのパスは署名付きURLに変換する */
export function useMediaUrl(value: string | null | undefined): string | null {
  const { data } = useQuery(signedUrlQuery(value));
  if (!value) return null;
  if (!isStoragePath(value)) return value;
  return data ?? null;
}

/** 動画ファイルの先頭付近のフレームからサムネイル画像を作る */
export async function captureThumbnail(file: File): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const objectUrl = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), 10000);
      video.onloadeddata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error("load error"));
      };
    });

    video.currentTime = Math.min(1, (video.duration || 1) / 3);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      setTimeout(resolve, 3000);
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.8);
    });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function uploadVideoFile(file: File, userId: string) {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
  const base = `${userId}/${crypto.randomUUID()}`;
  const videoPath = `${base}.${ext}`;

  const { error } = await supabase.storage
    .from(VIDEO_BUCKET)
    .upload(videoPath, file, { contentType: file.type || "video/mp4", upsert: false });
  if (error) throw error;

  let thumbnailPath: string | null = null;
  const thumb = await captureThumbnail(file);
  if (thumb) {
    const path = `${base}.jpg`;
    const { error: thumbError } = await supabase.storage
      .from(VIDEO_BUCKET)
      .upload(path, thumb, { contentType: "image/jpeg", upsert: false });
    if (!thumbError) thumbnailPath = path;
  }

  return { videoPath, thumbnailPath };
}
