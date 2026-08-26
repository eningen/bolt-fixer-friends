import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/admin-login")({ component: AdminLoginPage });

function AdminLoginPage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) { toast.error(t("adminLoginRequired")); return; }
    if (!adminId.trim()) { toast.error(t("unknownAdmin")); return; }
    if (!password) { toast.error(t("adminLoginFailed")); return; }
    setBusy(true);
    try {
      // The final credential verification must be performed server-side. This page never stores credentials in source code.
      const { data, error } = await (await import("@/integrations/supabase/client")).supabase.rpc("verify_admin_login", { p_admin_id: adminId.trim(), p_password: password });
      if (error) throw error;
      if (!data) throw new Error(t("adminLoginFailed"));
      toast.success(t("adminLoginSuccess"));
      window.location.assign("/notifications");
    } catch (error: any) {
      toast.error(error?.message === "unknown_admin" ? t("unknownAdmin") : error?.message === "regular_user_id" ? t("adminIdGeneralError") : t("adminLoginFailed"));
    } finally { setBusy(false); }
  };

  return <div className="min-h-screen"><Header /><main className="mx-auto max-w-md px-4 py-10"><Button asChild variant="ghost" className="mb-5"><Link to="/">← {t("back")}</Link></Button><div className="rounded-xl border border-border bg-card p-6"><h1 className="text-2xl font-extrabold">👑 {t("adminLogin")}</h1>{loading ? <p className="mt-4 text-sm text-muted-foreground">...</p> : !user ? <p className="mt-4 text-sm text-muted-foreground">{t("adminLoginRequired")}</p> : <form onSubmit={submit} className="mt-6 space-y-4"><div className="space-y-2"><Label htmlFor="admin-id">{t("adminId")}</Label><Input id="admin-id" value={adminId} onChange={(e) => setAdminId(e.target.value)} placeholder={t("adminIdPlaceholder")} autoComplete="username" /></div><div className="space-y-2"><Label htmlFor="admin-password">{t("adminPassword")}</Label><Input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("adminPasswordPlaceholder")} autoComplete="current-password" /></div><Button className="w-full" type="submit" disabled={busy}>{busy ? "..." : t("adminLoginButton")}</Button></form>}</div></main></div>;
}
