import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Language = "ja" | "en";
type TranslationKey = keyof typeof translations.ja;

const translations = {
  ja: {
    home: "ホーム", searchVideos: "動画を検索", search: "検索", ranking: "ランキング", upload: "投稿", myPage: "マイページ", login: "ログイン", logout: "ログアウト", settings: "設定", languageSettings: "言語設定", language: "言語", japanese: "日本語", english: "English", close: "閉じる", logoutDone: "ログアウトしました", notifications: "通知・メールボックス",
    terms: "利用規約", adminLogin: "管理者ログイン", country: "住んでいる国", selectCountry: "国を選択", adminLoginRequired: "まずは一般ログインをしてください", adminId: "管理者ID", adminPassword: "管理者パスワード", adminIdPlaceholder: "管理者IDを入力", adminPasswordPlaceholder: "管理者パスワードを入力", adminIdGeneralError: "一般IDではなく管理者IDを入力してください", unknownAdmin: "不明な管理者", adminLoginSuccess: "管理者ログインしました", adminLoginFailed: "管理者認証に失敗しました", adminLoginButton: "管理者ログイン", back: "戻る",
  },
  en: {
    home: "Home", searchVideos: "Search videos", search: "Search", ranking: "Ranking", upload: "Upload", myPage: "My page", login: "Log in", logout: "Log out", settings: "Settings", languageSettings: "Language settings", language: "Language", japanese: "日本語", english: "English", close: "Close", logoutDone: "Logged out", notifications: "Notifications & mailbox",
    terms: "Terms of Service", adminLogin: "Admin login", country: "Country of residence", selectCountry: "Select country", adminLoginRequired: "Please log in with your regular account first", adminId: "Admin ID", adminPassword: "Admin password", adminIdPlaceholder: "Enter admin ID", adminPasswordPlaceholder: "Enter admin password", adminIdGeneralError: "Please enter an admin ID, not a regular user ID", unknownAdmin: "Unknown administrator", adminLoginSuccess: "Admin login successful", adminLoginFailed: "Admin authentication failed", adminLoginButton: "Admin login", back: "Back",
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
    } catch {}
    return detectBrowserLanguage();
  });
  const setLanguage = (next: Language) => { setLanguageState(next); try { window.localStorage.setItem("stickman-language", next); } catch {} };
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const value = useMemo(() => ({ language, setLanguage, t: (key: TranslationKey) => translations[language][key] }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export function useLanguage() { return useContext(LanguageContext) ?? fallbackLanguageContext; }
