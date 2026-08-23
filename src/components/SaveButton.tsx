import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { savedVideosQuery } from "@/lib/queries";
import { Button } from "@/components/ui/button";

export function SaveButton({ videoId }: { videoId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: saved = [] } = useQuery(savedVideosQuery(user?.id));
  const isSaved = saved.some((row) => row.videoId === videoId);

  const toggle = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("ログインすると保存できます");
      if (isSaved) {
        const { error } = await supabase
          .from("saved_videos")
          .delete()
          .eq("video_id", videoId)
          .eq("user_id", user.id);
        if (error) throw error;
        return "removed" as const;
      }
      const { error } = await supabase
        .from("saved_videos")
        .insert({ video_id: videoId, user_id: user.id });
      if (error) throw error;
      return "added" as const;
    },
    onSuccess: (result) => {
      toast.success(result === "added" ? "「後で見る」に保存しました" : "保存を解除しました");
      void queryClient.invalidateQueries({ queryKey: ["saved-videos", user?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Button
      variant={isSaved ? "default" : "secondary"}
      size="sm"
      className="rounded-full"
      disabled={toggle.isPending}
      aria-label={isSaved ? "保存を解除" : "後で見るに保存"}
      onClick={() => toggle.mutate()}
    >
      <Bookmark className={isSaved ? "size-4 fill-current" : "size-4"} />
      <span className="hidden sm:inline">{isSaved ? "保存済み" : "保存"}</span>
    </Button>
  );
}
