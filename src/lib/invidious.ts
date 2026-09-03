export const INVIDIOUS_BASE_URL = "https://invidious.f5.si";

export type InvidiousVideo = {
  type?: string;
  title: string;
  videoId: string;
  author: string;
  authorId?: string;
  authorUrl?: string;
  videoThumbnails: { quality: string; url: string; width: number; height: number }[];
  lengthSeconds: number;
  viewCount: number;
  published?: number;
  publishedText?: string;
  description?: string;
};

async function fetchInvidious<T>(path: string): Promise<T> {
  const response = await fetch(`${INVIDIOUS_BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Invidious API error: ${response.status}`);
  return response.json() as Promise<T>;
}

export async function fetchPopularYouTubeVideos() {
  return fetchInvidious<InvidiousVideo[]>("/api/v1/popular?hl=ja");
}

export async function searchYouTubeVideos(query: string) {
  const params = new URLSearchParams({ q: query, type: "video", page: "1", region: "JP", hl: "ja" });
  return fetchInvidious<InvidiousVideo[]>(`/api/v1/search?${params.toString()}`);
}
