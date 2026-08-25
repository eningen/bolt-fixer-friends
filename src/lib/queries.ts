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
  storage_path: string | null;
  views: number;
  created_at: string;
  profile: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

const VIDEO_SELECT =
  "id,user_id,title,description,video_url,platform,youtube_id,thumbnail_url,storage_path,views,created_at,profile:profiles!videos_user_id_profiles_fkey(username,display_name,avatar_url)";

export const latestVideosQuery = queryOptions({
  queryKey: ["videos", "latest"],
  queryFn: async (): Promise<VideoRow[]> => {
    const { data, error } = await supabase.from("videos").select(VIDEO_SELECT).order("created_at", { ascending: false }).limit(24);
    if (error) throw error;
    return (data ?? []) as unknown as VideoRow[];
  },
});

export const rankingByViewsQuery = queryOptions({
  queryKey: ["videos", "ranking", "views"],
  queryFn: async (): Promise<VideoRow[]> => {
    const { data, error } = await supabase.from("videos").select(VIDEO_SELECT).order("views", { ascending: false }).limit(50);
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
    for (const like of likes ?? []) counts.set(like.video_id, (counts.get(like.video_id) ?? 0) + 1);
    return ((videos ?? []) as unknown as VideoRow[]).map((video) => ({ video, likes: counts.get(video.id) ?? 0 })).sort((a, b) => b.likes - a.likes || b.video.views - a.video.views).slice(0, 50);
  },
});

export function searchVideosQuery(term: string) {
  return queryOptions({
    queryKey: ["videos", "search", term],
    queryFn: async (): Promise<VideoRow[]> => {
      const cleaned = term.trim();
      if (!cleaned) return [];
      const escaped = cleaned.replace(/[%_,()]/g, " ").trim();
      const { data, error } = await supabase.from("videos").select(VIDEO_SELECT).or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`).order("views", { ascending: false }).limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as VideoRow[];
    },
  });
}

export function videoDetailQuery(id: string) {
  return queryOptions({
    queryKey: ["video", id],
    queryFn: async (): Promise<VideoRow | null> => {
      const { data, error } = await supabase.from("videos").select(VIDEO_SELECT).eq("id", id).maybeSingle();
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
      const { data: profile, error } = await supabase.from("profiles").select("id,username,display_name,avatar_url,bio,created_at").eq("username", username).maybeSingle();
      if (error) throw error;
      if (!profile) return null;
      const { data: videos, error: vErr } = await supabase.from("videos").select(VIDEO_SELECT).eq("user_id", profile.id).order("created_at", { ascending: false });
      if (vErr) throw vErr;
      return { profile, videos: (videos ?? []) as unknown as VideoRow[] };
    },
  });
}

export const myProfileQuery = (userId: string | undefined) => queryOptions({
  queryKey: ["my-profile", userId], enabled: Boolean(userId),
  queryFn: async () => {
    if (!userId) return null;
    const { data, error } = await supabase.from("profiles").select("id,username,display_name,avatar_url,bio").eq("id", userId).maybeSingle();
    if (error) throw error;
    return data;
  },
});

export function channelSubscribersQuery(channelId: string | undefined) {
  return queryOptions({
    queryKey: ["channel-subscribers", channelId], enabled: Boolean(channelId),
    queryFn: async (): Promise<{ subscriber_id: string; created_at: string }[]> => {
      if (!channelId) return [];
      const { data, error } = await supabase.from("subscriptions").select("subscriber_id,created_at").eq("channel_id", channelId).order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type CommentRow = {
  id: string;
  video_id: string;
  user_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
  profile: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

export function videoCommentsQuery(videoId: string) {
  return queryOptions({
    queryKey: ["video", videoId, "comments"],
    queryFn: async (): Promise<CommentRow[]> => {
      const { data, error } = await supabase.from("comments").select("id,video_id,user_id,parent_comment_id,body,created_at,profile:profiles!comments_user_id_fkey(username,display_name,avatar_url)").eq("video_id", videoId).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CommentRow[];
    },
  });
}

export function savedVideosQuery(userId: string | undefined) {
  return queryOptions({
    queryKey: ["saved-videos", userId], enabled: Boolean(userId),
    queryFn: async (): Promise<{ videoId: string; video: VideoRow | null }[]> => {
      if (!userId) return [];
      const { data, error } = await supabase.from("saved_videos").select(`video_id,created_at,video:videos!saved_videos_video_id_fkey(${VIDEO_SELECT})`).eq("user_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as { video_id: string; video: VideoRow | null }[]).map((row) => ({ videoId: row.video_id, video: row.video }));
    },
  });
}

export type NotificationRow = {
  id: string;
  type: "like" | "comment" | "subscribe" | "new_video";
  read: boolean;
  created_at: string;
  video_id: string | null;
  actor: { username: string; display_name: string; avatar_url: string | null } | null;
  video: { id: string; title: string } | null;
};

export function notificationsQuery(userId: string | undefined) {
  return queryOptions({
    queryKey: ["notifications", userId], enabled: Boolean(userId),
    queryFn: async (): Promise<NotificationRow[]> => {
      if (!userId) return [];
      const { data, error } = await supabase.from("notifications").select("id,type,read,created_at,video_id,actor:profiles!notifications_actor_id_fkey(username,display_name,avatar_url),video:videos!notifications_video_id_fkey(id,title)").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as NotificationRow[];
    },
  });
}

export type PostRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile: { username: string; display_name: string; avatar_url: string | null } | null;
};

const POST_SELECT = "id,user_id,body,created_at,profile:profiles!posts_user_id_fkey(username,display_name,avatar_url)";

export const latestPostsQuery = queryOptions({
  queryKey: ["posts", "latest"],
  queryFn: async (): Promise<PostRow[]> => {
    const { data, error } = await supabase.from("posts").select(POST_SELECT).order("created_at", { ascending: false }).limit(30);
    if (error) throw error;
    return (data ?? []) as unknown as PostRow[];
  },
});

export function userPostsQuery(userId: string | undefined) {
  return queryOptions({
    queryKey: ["posts", "user", userId], enabled: Boolean(userId),
    queryFn: async (): Promise<PostRow[]> => {
      if (!userId) return [];
      const { data, error } = await supabase.from("posts").select(POST_SELECT).eq("user_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PostRow[];
    },
  });
}
