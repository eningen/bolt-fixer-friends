import { supabase } from "@/integrations/supabase/client";

export const MAX_THUMBNAIL_BYTES = 10 * 1024 * 1024; // 10MB
export const VIDEO_BUCKET = "videos";

export async function uploadCustomThumbnail(file: File, userId: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("画像ファイルを選択してください");
  if (file.size > MAX_THUMBNAIL_BYTES) throw new Error("サムネイルは10MB以内にしてください");

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/thumbnails/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(VIDEO_BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}
