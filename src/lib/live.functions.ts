import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { pushToUser } from "@/lib/push.functions";

const streamInput = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().default(""),
});

export const startLiveStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => streamInput.parse(data))
  .handler(async ({ data, context }) => {
    const existing = await supabaseAdmin
      .from("live_streams")
      .select("id")
      .eq("user_id", context.userId)
      .eq("status", "live")
      .limit(1);

    if (existing.data?.length) {
      throw new Error("すでにライブ配信中です");
    }

    const { data: stream, error } = await supabaseAdmin
      .from("live_streams")
      .insert({
        user_id: context.userId,
        title: data.title,
        description: data.description || null,
        status: "live",
        transport: "webrtc",
        started_at: new Date().toISOString(),
      } as never)
      .select("id")
      .single();

    if (error || !stream) throw new Error(error?.message ?? "ライブ配信を開始できませんでした");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("username,display_name")
      .eq("id", context.userId)
      .maybeSingle();
    const sender = profile?.display_name ?? profile?.username ?? "だれか";

    const { data: followers } = await supabaseAdmin
      .from("subscriptions")
      .select("subscriber_id")
      .eq("channel_id", context.userId);

    for (const follower of (followers ?? []) as { subscriber_id: string }[]) {
      if (follower.subscriber_id === context.userId) continue;
      await supabaseAdmin.from("notifications").insert({
        user_id: follower.subscriber_id,
        actor_id: context.userId,
        type: "live_start",
        metadata: { stream_id: stream.id, title: data.title },
      } as never);
      void pushToUser(follower.subscriber_id, {
        title: "🔴 ライブ配信開始",
        body: `${sender} さんが「${data.title}」を開始しました`,
        url: `/live/${stream.id}`,
        tag: `live-${stream.id}`,
      }).catch((error) => console.warn("live start push failed", error));
    }

    return { streamId: stream.id };
  });

export const endLiveStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ streamId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: stream, error } = await supabaseAdmin
      .from("live_streams")
      .select("id")
      .eq("id", data.streamId)
      .eq("user_id", context.userId)
      .eq("status", "live")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!stream) return { ok: true };

    const { error: updateError } = await supabaseAdmin
      .from("live_streams")
      .update({ status: "ended", ended_at: new Date().toISOString() } as never)
      .eq("id", data.streamId)
      .eq("user_id", context.userId);
    if (updateError) throw new Error(updateError.message);
    return { ok: true };
  });
