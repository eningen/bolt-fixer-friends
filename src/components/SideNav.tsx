import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Bookmark, Home, Search, Trophy, Upload, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { myProfileQuery, notificationsQuery } from "@/lib/queries";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Item = {
  label: string;
  icon: LucideIcon;
  to: string;
  params?: Record<string, string>;
  badge?: number;
  match: (pathname: string) => boolean;
};

export function SideNav() {
  const { user } = useAuth();
  const { data: profile } = useQuery(myProfileQuery(user?.id));
  const { data: notifications = [] } = useQuery(notificationsQuery(user?.id));
  const unread = notifications.filter((item) => !item.read).length;
  const { t } = useLanguage();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const items: Item[] = [
    { label: t("home"), icon: Home, to: "/", match: (p) => p === "/" },
    { label: t("search"), icon: Search, to: "/search", match: (p) => p.startsWith("/search") },
    { label: t("ranking"), icon: Trophy, to: "/ranking", match: (p) => p.startsWith("/ranking") },
    { label: t("saved"), icon: Bookmark, to: "/saved", match: (p) => p.startsWith("/saved") },
    {
      label: t("notifications"),
      icon: Bell,
      to: "/notifications",
      badge: unread,
      match: (p) => p.startsWith("/notifications"),
    },
    { label: t("upload"), icon: Upload, to: "/upload", match: (p) => p.startsWith("/upload") },
    profile
      ? {
          label: t("myPage"),
          icon: UserRound,
          to: "/u/$username",
          params: { username: profile.username },
          match: (p) => p === `/u/${profile.username}`,
        }
      : { label: t("login"), icon: UserRound, to: "/auth", match: (p) => p.startsWith("/auth") },
  ];
  return (
    <>
      <nav
        aria-label={t("settings")}
        className="fixed left-0 top-14 z-40 hidden h-[calc(100vh-3.5rem)] w-20 flex-col items-center gap-1 border-r border-border bg-background py-3 md:flex"
      >
        {items.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.label}
              to={item.to}
              params={item.params as never}
              className={cn(
                "flex w-16 flex-col items-center gap-1 rounded-lg px-1 py-3 text-[10px] font-medium transition-colors hover:bg-accent",
                active ? "bg-accent text-foreground" : "text-muted-foreground",
              )}
            >
              <span className="relative">
                <item.icon className={cn("size-6", active && "text-primary")} />
                {item.badge ? (
                  <span className="absolute -right-2 -top-1 rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                ) : null}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <nav
        aria-label={t("home")}
        className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around border-t border-border bg-background/95 backdrop-blur md:hidden"
      >
        {items.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.label}
              to={item.to}
              params={item.params as never}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className="relative">
                <item.icon className="size-5" />
                {item.badge ? (
                  <span className="absolute -right-2 -top-1 rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                ) : null}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
