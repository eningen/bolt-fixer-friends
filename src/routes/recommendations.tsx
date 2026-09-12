import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Header } from "@/components/Header";
import { EmptyState, VideoCard, VideoGridSkeleton } from "@/components/VideoCard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { VideoRow } from "@/lib/queries";

const GENRE_KEYWORDS: Record<string, string[]> = {
  "アクション": ["アクション", "action", "戦い", "戦闘"],
  "コメディ": ["コメディ", "面白", "おもしろ", "笑", "ギャグ"],
  "ストーリー": ["ストーリー", "物語", "ドラマ", "story", "話"],
  "ゲーム": ["ゲーム", "game", "minecraft", "マイクラ", "ゲーム実況"],
  "アニメ": ["アニメ", "anime", "漫画", "マンガ"],
  "音楽": ["音楽", "music", "歌", "曲", "ダンス"],
  "スポーツ": ["スポーツ", "sport", "サッカー", "野球", "バスケ"],
  "日常": ["日常", "daily", "生活", "vlog"],
  "ネタ・ショート": ["ネタ", "ショート", "short", "shorts"],
  "解説・知識": ["解説", "知識", "紹介", "講座", "学習"],
  "バトル": ["バトル", "battle", "対決", "決闘"],
  "その他": [],
};

export const Route = createFileRoute("/recommendations")({
  head: () => ({
    meta: [{ title: "あなたへのおすすめ｜Stickman video" }],
  }),
  component: RecommendationsPage,
});

function RecommendationsPage() {
  const { user } = useAuth();
  const { data, isPending, error } = useQuery({
    queryKey: ["recommendations", user?.id],
    queryFn: async (): Promise<{ videos: VideoRow[]; genres: string[] }> => {
      const db = supabase as any;
      const [profileResult, videoResult] = await Promise.all([
        user ? db.from("profiles").select("preferred_genres").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
        db.from("videos").select("id,user_id,title,description,video_url,platform,youtube_id,thumbnail_url,storage_path,views,created_at,genres,profile:profiles!videos_user_id_profiles_fkey(username,display_name,avatar_url)").order("created_at", { ascending: false }).limit(100),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (videoResult.error) throw videoResult.error;

      const preferred = Array.isArray(profileResult.data?.preferred_genres) ? profileResult.data.preferred_genres : [];
      const videos = (videoResult.data ?? []) as VideoRow[];
      if (preferred.length === 0) return { videos: videos.slice(0, 24), genres: [] };

      const ranked = videos.map((video) => {
        const explicitGenres = Array.isArray(video.genres) ? video.genres : [];
        const text = `${video.title} ${video.description ?? ""}`.toLowerCase();
        const matchedExplicit = preferred.filter((genre) => explicitGenres.includes(genre)).length;
        const matchedKeywords = preferred.reduce((count, genre) => {
          const keywords = GENRE_KEYWORDS[genre] ?? [];
          return count + (keywords.some((keyword) => text.includes(keyword.toLowerCase())) ? 1 : 0);
        }, 0);
        return { video, score: matchedExplicit * 10 + matchedKeywords * 3 };
      });

      return {
        genres: preferred,
        videos: ranked
          .sort((a, b) => b.score - a.score || b.video.views - a.video.views || b.video.created_at.localeCompare(a.video.created_at))
          .map((item) => item.video)
          .slice(0, 24),
      };
    },
  });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold">✨ あなたへのおすすめ</h1>
          {data?.genres.length ? (
            <p className="mt-2 text-sm text-muted-foreground">
              好きなジャンル：{data.genres.join("・")}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              設定で好きなジャンルを選ぶと、あなた向けにおすすめを調整できます。
            </p>
          )}
        </div>

        {isPending ? (
          <VideoGridSkeleton />
        ) : error ? (
          <EmptyState
            title="動画を読み込めませんでした"
            description="通信状況を確認して、ページを再読み込みしてください。"
          />
        ) : data && data.videos.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="おすすめできる動画がまだありません"
            description="動画が増えると、ここにおすすめ候補が表示されます。"
          />
        )}
      </main>
    </div>
  );
}
