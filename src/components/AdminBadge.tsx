import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { adminUserIdsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function useIsAdminChannel(userId: string | null | undefined) {
  const { data: adminIds = [] } = useQuery(adminUserIdsQuery);
  return Boolean(userId && adminIds.includes(userId));
}

export function AdminBadge({ userId, className, withLabel = false }: { userId: string | null | undefined; className?: string; withLabel?: boolean }) {
  const isAdmin = useIsAdminChannel(userId);
  if (!isAdmin) return null;
  return (
    <span
      title="管理者チャンネル"
      className={cn("inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary align-middle", className)}
    >
      <ShieldCheck className="size-3.5" aria-hidden />
      {withLabel ? "管理者" : <span className="sr-only">管理者チャンネル</span>}
    </span>
  );
}
