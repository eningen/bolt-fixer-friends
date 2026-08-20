import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { profileQuery } from "@/lib/queries";
import { Header } from "@/components/Header";
import { EmptyState, VideoCard, VideoGridSkeleton } from "@/components/VideoCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/u/$username")({
  head: () => ({
    meta: [
      { title: "プロフィール｜Stickman video" },
      { name: "description", content: "投稿者のプロフィールと投稿した棒人間動画の一覧です。" },
      { property: "og:title", content: "プロフィール｜Stickman video" },
      { property: "og:description", content: "投稿者のプロフィールと動画一覧。" },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { data, isPending } = useQuery(profileQuery(username));

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {isPending ? (
          <VideoGridSkeleton count={3} />
        ) : !data ? (
          <EmptyState
            title="ユーザーが見つかりません"
            description="ユーザー名が変更されたか、削除された可能性があります。"
          />
        ) : (
          <>
            <div className="flex items-center gap-4">
              <Avatar className="size-16">
                <AvatarImage src={data.profile.avatar_url ?? undefined} alt="" />
                <AvatarFallback>{data.profile.display_name.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-extrabold">{data.profile.display_name}</h1>
                <p className="text-sm text-muted-foreground">@{data.profile.username}</p>
              </div>
            </div>
            {data.profile.bio ? (
              <p className="mt-4 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed">
                {data.profile.bio}
              </p>
            ) : null}

            <h2 className="mb-4 mt-8 text-lg font-bold">投稿した動画</h2>
            {data.videos.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {data.videos.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            ) : (
              <EmptyState title="まだ投稿がありません" description="最初の動画を待ちましょう。" />
            )}
          </>
        )}
      </main>
    </div>
  );
}
