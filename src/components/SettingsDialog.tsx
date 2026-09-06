import { useNavigate } from "@tanstack/react-router";
import { FileText, MessageCircle, Shield, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function SettingsDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const closeAnd = (to: "/friends" | "/messages" | "/terms" | "/admin-login") => {
    onOpenChange(false);
    void navigate({ to });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("settings")}</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 font-medium">🌐 {t("languageSettings")}</div>
            <select value={language} onChange={(event) => setLanguage(event.target.value as "ja" | "en")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="ja">{t("japanese")}</option><option value="en">{t("english")}</option>
            </select>
          </div>
          <Button variant="outline" className="justify-start" onClick={() => closeAnd("/friends")}><Users className="mr-2 size-4" />フレンド</Button>
          <Button variant="outline" className="justify-start" onClick={() => closeAnd("/messages")}><MessageCircle className="mr-2 size-4" />DM</Button>
          <Button variant="outline" className="justify-start" onClick={() => closeAnd("/terms")}><FileText className="mr-2 size-4" />{t("terms")}</Button>
          <Button variant="outline" className="justify-start" onClick={() => closeAnd("/admin-login")}><Shield className="mr-2 size-4" />{t("adminLogin")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
