import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut, Search, Settings, Trophy, Upload, FileText, Shield, Users, MessageCircle, MoreHorizontal, Home, User, X } from "lucide-react";
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
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  const quickItems = [
    { label: "ホーム", to: "/", icon: Home },
    { label: "検索", to: "/search", icon: Search },
    { label: "ランキング", to: "/ranking", icon: Trophy },
    ...(user ? [
      { label: "動画を投稿", to: "/upload", icon: Upload },
      { label: "通知", to: "/notifications", icon: Bell },
      { label: "フレンド", to: "/friends", icon: Users },
      { label: "DM", to: "/messages", icon: MessageCircle },
      ...(profile ? [{ label: "マイページ", to: `/u/${profile.username}`, icon: User }] : []),
    ] : []),
    { label: "利用規約", to: "/terms", icon: FileText },
    { label: "管理者ログイン", to: "/admin-login", icon: Shield },
  ];

  const quickMenu = <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
    <DialogTrigger asChild><Button variant="ghost" size="sm" aria-label="クイックメニュー" className="h-8 w-8 shrink-0 p-0"><MoreHorizontal className="size-5" /></Button></DialogTrigger>
    <DialogContent className="w-[calc(100%-24px)] max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-5">
      <DialogHeader className="mb-2"><DialogTitle className="text-base sm:text-lg">クイックメニュー</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {quickItems.map(({ label, to, icon: Icon }) => <Button key={label} asChild variant="outline" className="h-12 justify-start gap-2 px-3 text-sm sm:h-14 sm:justify-center sm:px-2"><Link to={to as any} onClick={() => setSettingsOpen(false)}><Icon className="size-4 shrink-0" />{label}{label === "通知" && unreadCount > 0 ? <span className="ml-auto rounded-full bg-destructive px-1.5 py-1 text-[10px] font-bold text-destructive-foreground sm:ml-0">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}</Link></Button>)}
      </div>
      <div className="mt-3 border-t border-border pt-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">🌐 {t("languageSettings")}</div>
        <select id="quick-language-select" value={language} onChange={(event) => setLanguage(event.target.value as "ja" | "en")} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="ja">{t("japanese")}</option><option value="en">{t("english")}</option></select>
      </div>
    </DialogContent>
  </Dialog>;

  return <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
    <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-2 sm:gap-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-0">
        <Link to="/" className="flex shrink-0 items-center gap-1 text-xl font-extrabold"><span className="text-primary">Stickman</span><span className="hidden sm:inline">video</span></Link>
        <nav className="flex shrink-0 items-center gap-0.8">
          <Button asChild variant="ghost" size="sm" className="px-1"><Link to="/search" aria-label={t("search")} className="md:hidden"><Search className="size-4" /></Link></Button>
          <Button asChild variant="ghost" size="sm" className="px-1"><Link to="/ranking"><Trophy className="size-4" /><span className="hidden sm:inline">{t("ranking")}</span></Link></Button>
          {user ? <><Button asChild size="sm" className="px-1"><Link to="/upload"><Upload className="size-4" /><span className="hidden sm:inline">{t("upload")}</span></Link></Button><Button asChild variant="ghost" size="sm" className="relative px-1" aria-label={t("notifications")}><Link to="/notifications"><Bell className="size-4" />{unreadCount > 0 ? <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}</Link></Button>{profile ? <Link to="/u/$username" params={{ username: profile.username }} aria-label={t("myPage")} className="shrink-0 px-1"><UserAvatar className="size-8" src={profile.avatar_url} name={profile.display_name} /></Link> : null}<Button variant="ghost" size="sm" className="px-1" onClick={onSignOut} aria-label={t("logout")}><LogOut className="size-4" /></Button></> : <Button asChild size="sm" className="px-1"><Link to="/auth">{t("login")}</Link></Button>}
        </nav>
      </div>
      <form onSubmit={onSearch} className="hidden flex-1 items-center gap-2 md:flex"><Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder={t("searchVideos")} className="max-w-md rounded-full bg-surface" aria-label={t("searchVideos")} /><Button type="submit" variant="secondary" className="rounded-full">{t("search")}</Button></form>
      <div className="flex-1 md:hidden" />
      <div className="shrink-0 -mr-2 sm:mr-0">{quickMenu}</div>
    </div>
  </header>;
}
