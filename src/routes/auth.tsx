import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "メールアドレスを入力してください" })
    .email({ message: "有効なメールアドレスを入力してください" })
    .max(255, { message: "メールアドレスが長すぎます" }),
  password: z
    .string()
    .min(6, { message: "パスワードは6文字以上にしてください" })
    .max(72, { message: "パスワードが長すぎます" }),
});

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "ログイン / 新規登録｜Stickman video" },
      {
        name: "description",
        content: "メールアドレスまたはGoogleアカウントでStickman videoにログインできます。",
      },
      { property: "og:title", content: "ログイン / 新規登録｜Stickman video" },
      { property: "og:description", content: "Stickman videoにログインして動画を投稿しよう。" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/" });
  }, [loading, user, navigate]);

  const validate = () => {
    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "入力内容を確認してください");
      return null;
    }
    return parsed.data;
  };

  const onSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    const values = validate();
    if (!values) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(values);
    setBusy(false);
    if (error) {
      toast.error(
        error.message.includes("Invalid login credentials")
          ? "メールアドレスまたはパスワードが正しくありません"
          : error.message,
      );
      return;
    }
    toast.success("ログインしました");
    void navigate({ to: "/" });
  };

  const onSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    const values = validate();
    if (!values) return;
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      ...values,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setBusy(false);
    if (error) {
      toast.error(
        error.message.includes("already registered")
          ? "このメールアドレスは既に登録されています"
          : error.message,
      );
      return;
    }
    toast.success("確認メールを送信しました。メール内のリンクから登録を完了してください。");
  };

  const onOAuth = async (provider: "google" | "microsoft", label: string) => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error(`${label}ログインに失敗しました`);
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto flex max-w-md flex-col px-4 py-12">
        <h1 className="text-center text-2xl font-extrabold">Stickman video へようこそ</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          ログインすると動画の投稿やいいねができます。
        </p>

        <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-card">
          <div className="space-y-3">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => void onOAuth("google", "Google")}
              disabled={busy}
            >
              Googleで続ける
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => void onOAuth("microsoft", "Microsoft")}
              disabled={busy}
            >
              Microsoftで続ける
            </Button>
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            または
            <span className="h-px flex-1 bg-border" />
          </div>

          <Tabs defaultValue="signin">
            <TabsList className="mb-5 w-full">
              <TabsTrigger value="signin" className="flex-1">
                ログイン
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">
                新規登録
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={onSignIn} className="space-y-4">
                <Fields
                  email={email}
                  password={password}
                  onEmail={setEmail}
                  onPassword={setPassword}
                />
                <Button type="submit" className="w-full" disabled={busy}>
                  ログイン
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={onSignUp} className="space-y-4">
                <Fields
                  email={email}
                  password={password}
                  onEmail={setEmail}
                  onPassword={setPassword}
                />
                <Button type="submit" className="w-full" disabled={busy}>
                  新規登録
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <Link to="/" className="mt-6 text-center text-sm text-primary hover:underline">
          ホームに戻る
        </Link>
      </main>
    </div>
  );
}

function Fields({
  email,
  password,
  onEmail,
  onPassword,
}: {
  email: string;
  password: string;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="email">メールアドレス</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          maxLength={255}
          onChange={(event) => onEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">パスワード</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          maxLength={72}
          onChange={(event) => onPassword(event.target.value)}
          placeholder="6文字以上"
        />
      </div>
    </>
  );
}
