import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut, Search, Trophy, Upload, FileText, Shield, Users, MessageCircle, MoreHorizontal, Home, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { mailboxMessagesQuery, myProfileQuery, notificationsQuery } from "@/lib/queries";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/UserAvatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(); oscillator.stop(ctx.currentTime + 0.23);
    window.setTimeout(() => void ctx.close(), 350);
  } catch {}
}

export function Header() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery(myProfileQuery(user?.id));
  const { data: notifications = [] } = useQuery(notificationsQuery(user?.id));
  const { data: mailbox = [] } = useQuery(mailboxMessagesQuery(user?.id));
  const { language, setLanguage, t } = useLanguage();
  const [term, setTerm] = useState("");
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const unreadCount = notifications.filter((item) => !item.read).length + mailbox.filter((item) => !item.read).length;

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel(`mailbox-notifications-${user.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "mailbox_messages", filter: `user_id=eq.${user.id}` }, (payload) => {
      const row = payload.new as { title?: string; body?: string };
      void queryClient.invalidateQueries({ queryKey: ["mailbox", user.id] });
      playNotificationSound();
      toast.info(row.title ?? "New announcement", { description: row.body ?? "You have a new message" });
      if (typeof Notification !== "undefined" && Notification.permission === "granted") { try { new Notification(row.title ?? "Stickman video", { body: row.body ?? "You have a new announcement" }); } catch {} }
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient, user?.id]);

  const onSearch = (event: React.FormEvent) => { event.preventDefault(); const q = term.trim(); if (q) void navigate({ to: "/search", search: { q } }); };
  const onSignOut = async () => { await supabase.auth.signOut(); toast.success(t("logoutDone")); void navigate({ to: "/" }); };
  const go = (to: string) => { setQuickMenuOpen(false); void navigate({ to: to as any }); };

  const quickItems = [
    { label: "ホーム", icon: Home, to: "/" },
    { label: "検索", icon: Search, to: "/search" },
    { label: "ランキング", icon: Trophy, to: "/ranking" },
    { label: "動画を投稿", icon: Upload, to: "/upload", primary: true },
    { label: "通知", icon: Bell, to: "/notifications", badge: unreadCount },
    { label: "フレンド", icon: Users, to: "/friends" },
    { label: "DM", icon: MessageCircle, to: "/messages" },
    { label: "マイページ", icon: User, to: profile ? `/u/${profile.username}` : "/auth" },
    { label: "利用規約", icon: FileText, to: "/terms" },
    { label: "管理者ログイン", icon: Shield, to: "/admin-login" },
  ];

  return <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
    <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
      <Link to="/" className="flex shrink-0 items-center gap-1 text-xl font-extrabold"><span className="text-primary">Stickman</span><span className="hidden sm:inline">video</span></Link>
      <form onSubmit={onSearch} className="hidden flex-1 items-center gap-2 md:flex"><Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder={t("searchVideos")} className="max-w-md rounded-full bg-surface" aria-label={t("searchVideos")} /><Button type="submit" variant="secondary" className="rounded-full">{t("search")}</Button></form>
      <div className="flex-1 md:hidden" />
      <nav className="flex shrink-0 items-center gap-1">
        <Button asChild variant="ghost" size="sm"><Link to="/search" aria-label={t("search")} className="md:hidden"><Search className="size-4" /></Link></Button>
        <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex"><Link to="/ranking"><Trophy className="size-4" /><span className="hidden lg:inline">{t("ranking")}</span></Link></Button>
        {user ? <><Button asChild size="sm"><Link to="/upload"><Upload className="size-4" /><span className="hidden sm:inline">{t("upload")}</span></Link></Button><Button asChild variant="ghost" size="sm" className="relative" aria-label={t("notifications")}><Link to="/notifications"><Bell className="size-4" />{unreadCount > 0 ? <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}</Link></Button>{profile ? <Link to="/u/$username" params={{ username: profile.username }} aria-label={t("myPage")}><UserAvatar className="size-8" src={profile.avatar_url} name={profile.display_name} /></Link> : null}<Button variant="ghost" size="sm" onClick={onSignOut} aria-label={t("logout")}><LogOut className="size-4" /></Button></> : <Button asChild size="sm"><Link to="/auth">{t("login")}</Link></Button>}
        <Dialog open={quickMenuOpen} onOpenChange={setQuickMenuOpen}>
          <DialogTrigger asChild><Button variant="ghost" size="sm" aria-label="クイックメニュー" title="クイックメニュー"><MoreHorizontal className="size-5" /></Button></DialogTrigger>
          <DialogContent className="w-[calc(100vw-24px)] max-w-2xl rounded-2xl p-5 sm:p-6">
            <DialogHeader><DialogTitle className="text-xl">クイックメニュー</DialogTitle><p className="text-sm text-muted-foreground">よく使う機能をここからすぐ開けます</p></DialogHeader>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {quickItems.map(({ label, icon: Icon, to, primary, badge }) => (
                <Button key={label} variant={primary ? "default" : "outline"} className="relative h-auto min-h-20 flex-col gap-2 rounded-xl px-3 py-3 text-sm" onClick={() => go(to)}>
                  <Icon className="size-6" /><span>{label}</span>
                  {badge ? <span className="absolute right-2 top-2 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{badge > 99 ? "99+" : badge}</span> : null}
                </Button>
              ))}
            </div>
            <div className="mt-2 rounded-xl border border-border bg-muted/30 p-3">
              <div className="mb-2 text-sm font-medium">表示言語</div>
              <select id="quick-language-select" value={language} onChange={(event) => setLanguage(event.target.value as "ja" | "en")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="ja">{t("japanese")}</option><option value="en">{t("english")}</option></select>
            </div>
          </DialogContent>
        </Dialog>
      </nav>
    </div>
  </header>;
}
