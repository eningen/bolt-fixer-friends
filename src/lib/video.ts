export type Platform = "youtube" | "other";

export type ParsedVideo = {
  platform: Platform;
  youtubeId: string | null;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  normalizedUrl: string;
};

const YT_PATTERNS = [
  /(?:youtube\.com\/watch\?[^#]*?\bv=)([A-Za-z0-9_-]{11})/,
  /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
  /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
  /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
  /(?:youtube\.com\/live\/)([A-Za-z0-9_-]{11})/,
];

export function parseVideoUrl(rawUrl: string): ParsedVideo | null {
  const url = rawUrl.trim();
  if (!url) return null;

  const ytId = YT_PATTERNS.map((pattern) => url.match(pattern)?.[1]).find(Boolean)
    ?? (/^[A-Za-z0-9_-]{11}$/.test(url) ? url : undefined);

  if (ytId) {
    return {
      platform: "youtube",
      youtubeId: ytId,
      embedUrl: `https://www.youtube.com/embed/${ytId}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      normalizedUrl: `https://www.youtube.com/watch?v=${ytId}`,
    };
  }

  return null;
}


export function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function formatViews(views: number): string {
  if (views >= 10000) return `${(views / 10000).toFixed(views >= 100000 ? 0 : 1)}万回`;
  return `${views.toLocaleString("ja-JP")}回`;
}

export function formatRelativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}か月前`;
  return `${Math.floor(months / 12)}年前`;
}
