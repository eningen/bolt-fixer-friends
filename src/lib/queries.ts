import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type VideoRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  video_url: string;
  platform: string;
  youtube_id: string | null;
  thumbnail_url: string | null;
  views: number;
  created_at: string;
  profile: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

const VIDEO_SELECT =
  "id,user_id,title,description,video_url,platform,youtube_id,thumbnail_url,views,created_at,profile:profiles!videos_user_id_fkey(username,display_name,avatar_url)";

export const latestVideosQuery = queryOptions({
  queryKey: ["videos", "latest"],
  queryFn: async (): Promise<VideoRow[]> => {
    const { data, error } = await supabase
      .from("videos")
      .select(VIDEO_SELECT)
      .order("created_at", { ascending: false })
      .limit(24);
    if (error) throw error;
    return (data ?? []) as unknown as VideoRow[];
  },
});

export const rankingByViewsQuery = queryOptions({
  queryKey: ["videos", "ranking", "views"],
  queryFn: async (): Promise<VideoRow[]> => {
    const { data, error } = await supabase
      .from("videos")
      .select(VIDEO_SELECT)
      .order("views", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as unknown as VideoRow[];
  },
});

export const likeRankingQuery = queryOptions({
  queryKey: ["videos", "ranking", "likes"],
  queryFn: async (): Promise<{ video: VideoRow; likes: number }[]> => {
    const [{ data: videos, error: vErr }, { data: likes, error: lErr }] = await Promise.all([
      supabase.from("videos").select(VIDEO_SELECT).limit(200),
      supabase.from("likes").select("video_id"),
    ]);
    if (vErr) throw vErr;
    if (lErr) throw lErr;

    const counts = new Map<string, number>();
    for (const like of likes ?? []) {
      counts.set(like.video_id, (counts.get(like.video_id) ?? 0) + 1);
    }

    return ((videos ?? []) as unknown as VideoRow[])
      .map((video) => ({ video, likes: counts.get(video.id) ?? 0 }))
      .sort((a, b) => b.likes - a.likes || b.video.views - a.video.views)
      .slice(0, 50);
  },
});

export function searchVideosQuery(term: string) {
  return queryOptions({
    queryKey: ["videos", "search", term],
    queryFn: async (): Promise<VideoRow[]> => {
      const cleaned = term.trim();
      if (!cleaned) return [];
      const escaped = cleaned.replace(/[%_,()]/g, " ").trim();
      const { data, error } = await supabase
        .from("videos")
        .select(VIDEO_SELECT)
        .or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`)
        .order("views", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as VideoRow[];
    },
  });
}

export function videoDetailQuery(id: string) {
  return queryOptions({
    queryKey: ["video", id],
    queryFn: async (): Promise<VideoRow | null> => {
      const { data, error } = await supabase
        .from("videos")
        .select(VIDEO_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as VideoRow) ?? null;
    },
  });
}

export function videoLikesQuery(id: string) {
  return queryOptions({
    queryKey: ["video", id, "likes"],
    queryFn: async (): Promise<{ count: number; likedBy: string[] }> => {
      const { data, error } = await supabase.from("likes").select("user_id").eq("video_id", id);
      if (error) throw error;
      return { count: data?.length ?? 0, likedBy: (data ?? []).map((row) => row.user_id) };
    },
  });
}

export function profileQuery(username: string) {
  return queryOptions({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,bio,created_at")
        .eq("username", username)
        .maybeSingle();
      if (error) throw error;
      if (!profile) return null;

      const { data: videos, error: vErr } = await supabase
        .from("videos")
        .select(VIDEO_SELECT)
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });
      if (vErr) throw vErr;

      return { profile, videos: (videos ?? []) as unknown as VideoRow[] };
    },
  });
}

export const myProfileQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-profile", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,bio")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
