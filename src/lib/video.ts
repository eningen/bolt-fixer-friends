export type Platform = "youtube" | "other";

export type ParsedVideo = {
  platform: Platform;
  youtubeId: string | null;
  embedUrl: string | null;
  thumbnailUrl: string | null;
};

const YT_PATTERNS = [
  /(?:youtube\.com\/watch\?[^#]*?\bv=)([A-Za-z0-9_-]{11})/,
  /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
  /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
  /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
  /(?:youtube\.com\/live\/)([A-Za-z0-9_-]{11})/,
];

export function parseVideoUrl(rawUrl: string): ParsedVideo {
  const url = rawUrl.trim();

  for (const pattern of YT_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1]) {
      const id = match[1];
      return {
        platform: "youtube",
        youtubeId: id,
        embedUrl: `https://www.youtube.com/embed/${id}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      };
    }
  }

  // 11桁のIDだけを貼られたケース
  if (/^[A-Za-z0-9_-]{11}$/.test(url)) {
    return {
      platform: "youtube",
      youtubeId: url,
      embedUrl: `https://www.youtube.com/embed/${url}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${url}/hqdefault.jpg`,
    };
  }

  return { platform: "other", youtubeId: null, embedUrl: null, thumbnailUrl: null };
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
