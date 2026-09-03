import { createServerFn } from "@tanstack/react-start";

export const INVIDIOUS_BASE_URL = "https://invidious.f5.si";

const INVIDIOUS_INSTANCES = [
  "https://invidious.f5.si",
  "https://invidious.tiekoetter.com",
  "https://vid.blompinne.eu",
];

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
  let lastError: unknown;

  for (const baseUrl of INVIDIOUS_INSTANCES) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Invidious API error: ${response.status}`);
      }

      const data = (await response.json()) as T;
      return data;
    } catch (error) {
      lastError = error;
      console.warn(`Invidious instance failed: ${baseUrl}`, error);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("All Invidious instances failed", { cause: lastError });
}

export const fetchPopularYouTubeVideos = createServerFn({ method: "GET" }).handler(async () => {
  return fetchInvidious<InvidiousVideo[]>("/api/v1/popular?hl=ja");
});

export const searchYouTubeVideos = createServerFn({ method: "GET" })
  .validator((query: string) => query.trim().slice(0, 100))
  .handler(async ({ data }) => {
    if (!data) return [];

    const params = new URLSearchParams({
      q: data,
      type: "video",
      page: "1",
      region: "JP",
      hl: "ja",
    });

    return fetchInvidious<InvidiousVideo[]>(`/api/v1/search?${params.toString()}`);
  });
