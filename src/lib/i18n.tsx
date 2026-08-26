import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Language = "ja" | "en";
type TranslationKey = keyof typeof translations.ja;

const translations = {
  ja: {
    home: "ホーム", searchVideos: "動画を検索", search: "検索", ranking: "ランキング", upload: "投稿", myPage: "マイページ", login: "ログイン", logout: "ログアウト", settings: "設定", languageSettings: "言語設定", language: "言語", japanese: "日本語", english: "English", close: "閉じる", logoutDone: "ログアウトしました",
  },
  en: {
    home: "Home", searchVideos: "Search videos", search: "Search", ranking: "Ranking", upload: "Upload", myPage: "My page", login: "Log in", logout: "Log out", settings: "Settings", languageSettings: "Language settings", language: "Language", japanese: "日本語", english: "English", close: "Close", logoutDone: "Logged out",
  },
} as const;

function detectBrowserLanguage(): Language {
  if (typeof navigator === "undefined") return "ja";
  const locales = [navigator.language, ...(navigator.languages ?? [])].map((value) => value.toLowerCase());
  return locales.some((value) => value === "ja" || value.startsWith("ja-")) ? "ja" : "en";
}

const fallbackLanguageContext = { language: "ja" as Language, setLanguage: () => undefined, t: (key: TranslationKey) => translations.ja[key] };
const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void; t: (key: TranslationKey) => string } | null>(fallbackLanguageContext);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === "undefined") return "ja";
    try {
      const saved = window.localStorage.getItem("stickman-language");
      if (saved === "en" || saved === "ja") return saved;
    } catch { /* use browser locale */ }
    return detectBrowserLanguage();
  });

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    try { window.localStorage.setItem("stickman-language", next); } catch { /* continue without persistence */ }
  };

  useEffect(() => { document.documentElement.lang = language; }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t: (key: TranslationKey) => translations[language][key] }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  return context ?? fallbackLanguageContext;
}
