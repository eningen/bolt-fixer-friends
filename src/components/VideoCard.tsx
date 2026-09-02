import { Link } from "@tanstack/react-router";

import type { VideoRow } from "@/lib/queries";
import { formatRelativeDate, formatViews } from "@/lib/video";
import { useMediaUrl } from "@/lib/storage";
import { StickmanMark } from "@/components/StickmanMark";
import { UserAvatar } from "@/components/UserAvatar";

export function VideoCard({ video, rank }: { video: VideoRow; rank?: number }) {
  const thumbnailUrl = useMediaUrl(video.thumbnail_url);

  return (
    <article className="group">
      <Link
        to="/video/$videoId"
        params={{ videoId: video.id }}
        className="relative block overflow-hidden rounded-lg bg-surface-strong"
      >
        <div className="aspect-video w-full">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={video.title}
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <StickmanMark className="h-16 w-16 opacity-40" />
            </div>
          )}
        </div>

        {rank ? (
          <span
            className="absolute left-2 top-2 flex size-8 items-center justify-center rounded-full text-sm font-bold text-background shadow-card"
            style={{
              backgroundColor:
                rank === 1
                  ? "var(--gold)"
                  : rank === 2
                    ? "var(--silver)"
                    : rank === 3
                      ? "var(--bronze)"
                      : "var(--foreground)",
            }}
          >
            {rank}
          </span>
        ) : null}
      </Link>

      <div className="mt-3 flex gap-3">
        {video.profile ? (
          <Link to="/u/$username" params={{ username: video.profile.username }} className="shrink-0">
            <UserAvatar className="size-9" src={video.profile.avatar_url} name={video.profile.display_name} />
          </Link>
        ) : null}
        <div className="min-w-0">
          <Link to="/video/$videoId" params={{ videoId: video.id }}>
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{video.title}</h3>
          </Link>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {video.profile?.display_name ?? "不明なユーザー"}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatViews(video.views)} · {formatRelativeDate(video.created_at)}
          </p>
        </div>
      </div>
    </article>
  );
}

export function VideoGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>
          <div className="aspect-video w-full animate-pulse rounded-lg bg-surface-strong" />
          <div className="mt-3 flex gap-3">
            <div className="size-9 shrink-0 animate-pulse rounded-full bg-surface-strong" />
            <div className="flex-1 space-y-2">
              <div className="h-4 animate-pulse rounded bg-surface-strong" />
              <div className="h-3 w-3/5 animate-pulse rounded bg-surface-strong" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
      <StickmanMark className="h-16 w-16 text-muted-foreground opacity-40" />
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
