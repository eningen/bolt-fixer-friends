import { useMediaUrl } from "@/lib/storage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** avatar_url がストレージのパスでもURLでも表示できるアバター */
export function UserAvatar({
  src,
  name,
  className,
}: {
  src: string | null | undefined;
  name: string | null | undefined;
  className?: string;
}) {
  const url = useMediaUrl(src);
  return (
    <Avatar className={cn("size-9", className)}>
      <AvatarImage src={url ?? undefined} alt="" />
      <AvatarFallback className="text-xs">{(name ?? "??").slice(0, 2)}</AvatarFallback>
    </Avatar>
  );
}
