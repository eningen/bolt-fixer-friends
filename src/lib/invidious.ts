import { createServerFn } from "@tanstack/react-start";

export const INVIDIOUS_BASE_URL = "https://invidious.f5.si";

const INVIDIOUS_INSTANCES = [
  "https://invidious.f5.si",
  "https://invidious.tiekoetter.com",
  "https://vid.blompinne.eu",
];

const REQUEST_TIMEOUT_MS = 4000;
const FALLBACK_STAGGER_MS = 400;
const CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 30;
const MAX_RESULTS = 24;

const responseCache = new Map<string, { expiresAt: number; data: unknown }>();
const inFlightRequests = new Map<string, Promise<unknown>>();

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

async function requestInvidious<T>(baseUrl: string, path: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Invidious API error: ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

async function fetchInvidious<T>(path: string): Promise<T> {
  const cached = responseCache.get(path);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }
  if (cached) responseCache.delete(path);

  const existing = inFlightRequests.get(path);
  if (existing) return existing as Promise<T>;

  const request = (async () => {
    const controllers = INVIDIOUS_INSTANCES.map(() => new AbortController());
    let lastError: unknown;

    try {
      const attempts = INVIDIOUS_INSTANCES.map((baseUrl, index) =>
        new Promise<T>((resolve, reject) => {
          const start = async () => {
            try {
              const data = await requestInvidious<T>(baseUrl, path, controllers[index]!.signal);
              resolve(data);
            } catch (error) {
              lastError = error;
              reject(error);
            }
          };

          if (index === 0) {
            void start();
          } else {
            setTimeout(() => void start(), FALLBACK_STAGGER_MS * index);
          }
        }),
      );

      const data = await Promise.any(attempts);

      responseCache.set(path, { expiresAt: Date.now() + CACHE_TTL_MS, data });
      while (responseCache.size > MAX_CACHE_ENTRIES) {
        const oldestKey = responseCache.keys().next().value;
        if (!oldestKey) break;
        responseCache.delete(oldestKey);
      }

      return data;
    } catch (error) {
      throw new Error("All Invidious instances failed", { cause: lastError ?? error });
    } finally {
      controllers.forEach((controller) => controller.abort());
    }
  })();

  inFlightRequests.set(path, request);
  try {
    return await request;
  } finally {
    inFlightRequests.delete(path);
  }
}

export const fetchPopularYouTubeVideos = createServerFn({ method: "GET" }).handler(async () => {
  const videos = await fetchInvidious<InvidiousVideo[]>("/api/v1/popular?hl=ja");
  return videos.slice(0, MAX_RESULTS);
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
