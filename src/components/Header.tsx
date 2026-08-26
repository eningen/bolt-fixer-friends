import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut, Search, Settings, Trophy, Upload, FileText, Shield } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { mailboxMessagesQuery, myProfileQuery, notificationsQuery } from "@/lib/queries";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext);
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
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.23);
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
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try { new Notification(row.title ?? "Stickman video", { body: row.body ?? "You have a new announcement" }); } catch {}
      }
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient, user?.id]);

  const onSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const q = term.trim();
    if (!q) return;
    void navigate({ to: "/search", search: { q } });
  };

  const onSignOut = async () => {
    await supabase.auth.signOut();
    toast.success(t("logoutDone"));
    void navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-1 text-xl font-extrabold"><span className="text-primary">Stickman</span><span className="hidden sm:inline">video</span></Link>
        <form onSubmit={onSearch} className="hidden flex-1 items-center gap-2 md:flex"><Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder={t("searchVideos")} className="max-w-md rounded-full bg-surface" aria-label={t("searchVideos")} /><Button type="submit" variant="secondary" className="rounded-full">{t("search")}</Button></form>
        <div className="flex-1 md:hidden" />
        <nav className="flex shrink-0 items-center gap-1">
          <Button asChild variant="ghost" size="sm"><Link to="/search" aria-label={t("search")} className="md:hidden"><Search className="size-4" /></Link></Button>
          <Button asChild variant="ghost" size="sm"><Link to="/ranking"><Trophy className="size-4" /><span className="hidden sm:inline">{t("ranking")}</span></Link></Button>
          {user ? <>
            <Button asChild size="sm"><Link to="/upload"><Upload className="size-4" /><span className="hidden sm:inline">{t("upload")}</span></Link></Button>
            <Button asChild variant="ghost" size="sm" className="relative" aria-label={t("notifications")}><Link to="/notifications"><Bell className="size-4" />{unreadCount > 0 ? <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}</Link></Button>
            {profile ? <Link to="/u/$username" params={{ username: profile.username }} aria-label={t("myPage")}><Avatar className="size-8"><AvatarImage src={profile.avatar_url ?? undefined} alt="" /><AvatarFallback className="text-xs">{profile.display_name.slice(0, 2)}</AvatarFallback></Avatar></Link> : null}
            <Button variant="ghost" size="sm" onClick={onSignOut} aria-label={t("logout")}><LogOut className="size-4" /></Button>
          </> : <Button asChild size="sm"><Link to="/auth">{t("login")}</Link></Button>}
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild><Button variant="ghost" size="sm" aria-label={t("settings")}><Settings className="size-4" /></Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>{t("settings")}</DialogTitle></DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-center gap-2 font-medium"><span>🌐</span>{t("languageSettings")}</div>
                  <select id="language-select" value={language} onChange={(event) => setLanguage(event.target.value as "ja" | "en")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="ja">{t("japanese")}</option><option value="en">{t("english")}</option></select>
                </div>
                <Button variant="outline" className="justify-start" onClick={() => { setSettingsOpen(false); void navigate({ to: "/terms" }); }}><FileText className="mr-2 size-4" />{t("terms")}</Button>
                <Button variant="outline" className="justify-start" onClick={() => { setSettingsOpen(false); void navigate({ to: "/admin-login" }); }}><Shield className="mr-2 size-4" />{t("adminLogin")}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </nav>
      </div>
    </header>
  );
}
