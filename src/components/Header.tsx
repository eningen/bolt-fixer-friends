import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Search, Settings, Trophy, Upload } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { myProfileQuery } from "@/lib/queries";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function Header() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useQuery(myProfileQuery(user?.id));
  const { language, setLanguage, t } = useLanguage();
  const [term, setTerm] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        <Link to="/" className="flex shrink-0 items-center gap-1 text-xl font-extrabold">
          <span className="text-primary">Stickman</span>
          <span className="hidden sm:inline">video</span>
        </Link>
        <form onSubmit={onSearch} className="hidden flex-1 items-center gap-2 md:flex">
          <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder={t("searchVideos")} className="max-w-md rounded-full bg-surface" aria-label={t("searchVideos")} />
          <Button type="submit" variant="secondary" className="rounded-full">{t("search")}</Button>
        </form>
        <div className="flex-1 md:hidden" />
        <nav className="flex shrink-0 items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link to="/search" aria-label={t("search")} className="md:hidden"><Search className="size-4" /></Link></Button>
          <Button asChild variant="ghost" size="sm"><Link to="/ranking"><Trophy className="size-4" /><span className="hidden sm:inline">{t("ranking")}</span></Link></Button>
          {user ? (
            <>
              <Button asChild size="sm"><Link to="/upload"><Upload className="size-4" /><span className="hidden sm:inline">{t("upload")}</span></Link></Button>
              {profile ? <Link to="/u/$username" params={{ username: profile.username }} aria-label={t("myPage")}><Avatar className="size-8"><AvatarImage src={profile.avatar_url ?? undefined} alt="" /><AvatarFallback className="text-xs">{profile.display_name.slice(0, 2)}</AvatarFallback></Avatar></Link> : null}
              <Button variant="ghost" size="sm" onClick={onSignOut} aria-label={t("logout")}><LogOut className="size-4" /></Button>
            </>
          ) : <Button asChild size="sm"><Link to="/auth">{t("login")}</Link></Button>}
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild><Button variant="ghost" size="sm" aria-label={t("settings")}><Settings className="size-4" /></Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>{t("languageSettings")}</DialogTitle></DialogHeader>
              <div className="grid gap-2 py-2">
                <label htmlFor="language-select" className="text-sm font-medium">{t("language")}</label>
                <select id="language-select" value={language} onChange={(event) => setLanguage(event.target.value as "ja" | "en")} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="ja">{t("japanese")}</option>
                  <option value="en">{t("english")}</option>
                </select>
                {user ? (
                  <Button asChild variant="secondary" className="mt-2 justify-start">
                    <Link to="/settings" onClick={() => setSettingsOpen(false)}>
                      {t("editProfile")}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>
        </nav>
      </div>
    </header>
  );
}
