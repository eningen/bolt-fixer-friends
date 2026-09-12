import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const GENRES = [
  "アクション",
  "コメディ",
  "ストーリー",
  "ゲーム",
  "アニメ",
  "音楽",
  "スポーツ",
  "日常",
  "ネタ・ショート",
  "解説・知識",
  "バトル",
  "その他",
] as const;

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "設定｜Stickman video" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [genres, setGenres] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingPreferences, setLoadingPreferences] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: "/auth" });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      setLoadingPreferences(true);
      const db = supabase as any;
      const { data, error } = await db.from("profiles").select("preferred_genres").eq("id", user.id).maybeSingle();
      if (!active) return;
      if (error) {
        toast.error("設定を読み込めませんでした");
      } else {
        setGenres(Array.isArray(data?.preferred_genres) ? data.preferred_genres : []);
      }
      setLoadingPreferences(false);
    };
    void load();
    return () => { active = false; };
  }, [user]);

  const toggleGenre = (genre: string) => {
    setGenres((current) => current.includes(genre) ? current.filter((item) => item !== genre) : [...current, genre]);
  };

  const save = async () => {
    if (!user || busy) return;
    setBusy(true);
    const db = supabase as any;
    const { error } = await db.from("profiles").update({ preferred_genres: genres }).eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error("設定を保存できませんでした");
      return;
    }
    toast.success("好きなジャンルを保存しました！");
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-center gap-3">
          <Sparkles className="size-6 text-primary" />
          <div>
            <h1 className="text-2xl font-extrabold">設定</h1>
            <p className="mt-1 text-sm text-muted-foreground">好きなジャンルを選ぶと、おすすめ動画に反映されます。</p>
          </div>
        </div>

        <section className="mt-8 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-bold">🎯 好きなジャンル</h2>
          <p className="mt-1 text-sm text-muted-foreground">複数選択できます。選んだジャンルに近い動画が「あなたへのおすすめ」に優先表示されます。</p>

          {loadingPreferences ? (
            <div className="mt-5 text-sm text-muted-foreground">設定を読み込み中…</div>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {GENRES.map((genre) => {
                const selected = genres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    aria-pressed={selected}
                    className={`flex min-h-12 items-center justify-between rounded-lg border px-3 text-left text-sm font-medium transition-colors ${selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted"}`}
                  >
                    <span>{genre}</span>
                    {selected ? <Check className="size-4 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">選択中：{genres.length}ジャンル</p>
            <Button onClick={() => void save()} disabled={busy || loadingPreferences}>
              {busy ? "保存中…" : "設定を保存"}
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
