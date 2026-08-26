import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/terms")({ component: TermsPage });

function TermsPage() {
  const { language } = useLanguage();
  const en = language === "en";
  return <div className="min-h-screen"><Header /><main className="mx-auto max-w-3xl px-4 py-8 pb-24"><Button asChild variant="ghost" className="mb-4"><Link to="/">← {en ? "Back" : "戻る"}</Link></Button><article className="rounded-xl border border-border bg-card p-6 leading-7"><h1 className="text-2xl font-extrabold">{en ? "Terms of Service" : "利用規約"}</h1><p className="mt-4 text-muted-foreground">{en ? "Please use Stickman video responsibly and respect other users." : "Stickman videoをご利用の際は、他の利用者を尊重し、適切にご利用ください。"}</p><h2 className="mt-7 text-lg font-bold">{en ? "1. Prohibited conduct" : "1. 禁止事項"}</h2><p className="mt-2 text-muted-foreground">{en ? "Do not upload illegal, harmful, abusive, or infringing content." : "違法、有害、他者を攻撃する内容、権利を侵害する内容などの投稿は禁止します。"}</p><h2 className="mt-7 text-lg font-bold">{en ? "2. Account responsibility" : "2. アカウントについて"}</h2><p className="mt-2 text-muted-foreground">{en ? "Keep your account secure and do not share credentials with others." : "アカウントを安全に管理し、ログイン情報を他人と共有しないでください。"}</p></article></main></div>;
}
