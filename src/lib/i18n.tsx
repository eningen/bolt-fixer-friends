import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Language = "ja" | "en";
type TranslationKey = keyof typeof translations.ja;

const translations = {
  ja: {
    home: "ホーム", searchVideos: "動画を検索", search: "検索", ranking: "ランキング", upload: "投稿", myPage: "マイページ", login: "ログイン", logout: "ログアウト", settings: "設定", languageSettings: "言語設定", language: "言語", japanese: "日本語", english: "English", close: "閉じる", logoutDone: "ログアウトしました", notifications: "通知・メールボックス",
    terms: "利用規約", adminLogin: "管理者ログイン", country: "住んでいる国", selectCountry: "国を選択", adminLoginRequired: "まずは一般ログインをしてください", adminId: "管理者ID", adminPassword: "管理者パスワード", adminIdPlaceholder: "管理者IDを入力", adminPasswordPlaceholder: "管理者パスワードを入力", adminIdGeneralError: "一般IDではなく管理者IDを入力してください", unknownAdmin: "不明な管理者", adminLoginSuccess: "管理者ログインしました", adminLoginFailed: "管理者認証に失敗しました", adminLoginButton: "管理者ログイン", back: "戻る",
  },
  en: {
    home: "Home", searchVideos: "Search videos", search: "Search", ranking: "Ranking", upload: "Upload", myPage: "My page", login: "Log in", logout: "Log out", settings: "Settings", languageSettings: "Language settings", language: "Language", japanese: "Japanese", english: "English", close: "Close", logoutDone: "Logged out", notifications: "Notifications & mailbox",
    terms: "Terms of Service", adminLogin: "Admin login", country: "Country of residence", selectCountry: "Select country", adminLoginRequired: "Please log in with your regular account first", adminId: "Admin ID", adminPassword: "Admin password", adminIdPlaceholder: "Enter admin ID", adminPasswordPlaceholder: "Enter admin password", adminIdGeneralError: "Please enter an admin ID, not a regular user ID", unknownAdmin: "Unknown administrator", adminLoginSuccess: "Admin login successful", adminLoginFailed: "Admin authentication failed", adminLoginButton: "Admin login", back: "Back",
  },
} as const;

// UI text that is still hard-coded in individual pages. This lets the language
// switch apply to the whole existing app without changing user-generated text.
const uiDictionary: Record<string, string> = {
  "クイックメニュー": "Quick menu", "動画を投稿": "Upload video", "通知": "Notifications", "フレンド": "Friends", "DM": "DM", "マイページ": "My page", "利用規約": "Terms of Service", "管理者ログイン": "Admin login",
  "言語設定": "Language settings", "ホーム": "Home", "検索": "Search", "ランキング": "Ranking", "投稿": "Upload", "ログイン": "Log in", "ログアウト": "Log out",
  "棒人間動画を、みんなで共有しよう": "Share stickman videos with everyone", "オリジナルの棒人間アニメーションを投稿して、再生数ランキングの頂点を目指そう。": "Post your original stickman animations and aim for the top of the view ranking.", "はじめる": "Get started", "ランキングを見る": "View ranking",
  "🔴 ライブ配信中": "🔴 Live now", "いま配信中のライブをチェックしよう。": "Check out the live streams happening now.", "すべて見る": "View all", "最新の動画": "Latest videos", "動画を読み込めませんでした": "Could not load videos", "通信状況を確認して、ページを再読み込みしてください。": "Check your connection and reload the page.", "更に表示": "Show more", "まだ動画がありません": "No videos yet", "最初の棒人間動画を投稿して、このページを埋めてみましょう。": "Post the first stickman video and fill this page!", "みんなの投稿": "Community posts",
  "再生回数": "Views", "いいね数": "Likes", "ランキングはまだ空です": "The ranking is empty", "動画が投稿されると、ここに再生回数の順位が表示されます。": "Once videos are posted, their view rankings will appear here.", "いいねが付くと、ここに順位が表示されます。": "Once videos receive likes, their rankings will appear here.", "いいね": "Likes",
  "フレンド一覧": "Friends", "フレンド申請を許可すると、ここに追加されます。": "Friends you accept will appear here.", "ログインするとフレンドが表示されます。": "Log in to see your friends.", "まだフレンドがいません": "No friends yet", "気になるチャンネルのプロフィールから「フレンド申請」を送ってみましょう。": "Send a friend request from a profile you are interested in.",
  "写真ボックス・通知": "Mailbox & notifications", "通知をすべて既読": "Mark all as read", "メールボックス": "Mailbox", "ログインするとお知らせが届きます。": "Log in to receive announcements.", "お知らせはまだありません": "No announcements yet", "最重要メール": "Important mail", "送信者：": "Sender: ", "本物のプッシュ通知": "Push notifications", "本物の通知を有効にする": "Enable push notifications", "✓ 通知は有効": "✓ Notifications enabled", "テスト送信": "Send test", "送信中…": "Sending…", "全ユーザーへ配信": "Send to all users", "アップデートを全ユーザーへ配信": "Send an update to all users", "お知らせのタイトル": "Announcement title", "アップデート内容を書いてください": "Write the update details", "配信中…": "Publishing…",
  "住んでいる国": "Country of residence", "国を選択": "Select country", "戻る": "Back", "閉じる": "Close",
};

function translateValue(value: string, language: Language) {
  if (language !== "en") return value;
  return uiDictionary[value] ?? value;
}

function translateDom(language: Language) {
  if (typeof document === "undefined") return;
  if (language !== "en") return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  for (const text of nodes) {
    const value = text.nodeValue?.trim();
    if (!value) continue;
    const translated = translateValue(value, language);
    if (translated !== value) text.nodeValue = text.nodeValue!.replace(value, translated);
  }

  document.querySelectorAll<HTMLElement>("[placeholder],[aria-label],[title]").forEach((element) => {
    for (const attr of ["placeholder", "aria-label", "title"]) {
      const value = element.getAttribute(attr);
      if (!value) continue;
      const translated = translateValue(value, language);
      if (translated !== value) element.setAttribute(attr, translated);
    }
  });
}

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

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    try { window.localStorage.setItem("stickman-language", next); } catch {}
  };

  useEffect(() => {
    document.documentElement.lang = language;
    translateDom(language);

    if (language !== "en") return;
    const observer = new MutationObserver(() => translateDom(language));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t: (key: TranslationKey) => translations[language][key] }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() { return useContext(LanguageContext) ?? fallbackLanguageContext; }
