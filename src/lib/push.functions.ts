import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().max(400).optional(),
});

export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env["VAPID_PUBLIC_KEY"] ?? "" };
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => subscriptionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent ?? null,
      } as never,
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ endpoint: z.string().url() }).parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    return { ok: true };
  });

type SendResult = { sent: number };

async function pushToUser(
  userId: string,
  message: { title: string; body: string; url: string; tag?: string },
): Promise<SendResult> {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"] ?? "mailto:push@example.com";
  if (!publicKey || !privateKey) return { sent: 0 };

  const { buildPushPayload } = await import("@block65/webcrypto-web-push");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: rows, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error || !rows?.length) return { sent: 0 };

  let sent = 0;
  for (const row of rows as { endpoint: string; p256dh: string; auth: string }[]) {
    try {
      const payload = await buildPushPayload(
        { data: JSON.stringify(message), options: { ttl: 3600, urgency: "high" } },
        { endpoint: row.endpoint, expirationTime: null, keys: { p256dh: row.p256dh, auth: row.auth } },
        { subject, publicKey, privateKey },
      );
      const res = await fetch(row.endpoint, payload);
      if (res.ok) sent += 1;
      else if (res.status === 404 || res.status === 410) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
      } else {
        console.error(`Push failed [${res.status}]: ${await res.text()}`);
      }
    } catch (pushError) {
      console.error("Push send error", pushError);
    }
  }
  return { sent };
}

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    pushToUser(context.userId, {
      title: "Stickman video",
      body: "通知のテストです。この通知が届いていれば設定は完了です！",
      url: "/notifications",
      tag: "test",
    }),
  );

export const notifyDirectMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ recipientId: z.string().uuid(), preview: z.string().max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: own } = await context.supabase
      .from("direct_messages")
      .select("id")
      .eq("sender_id", context.userId)
      .eq("recipient_id", data.recipientId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (!own?.length) return { sent: 0 };

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", context.userId)
      .maybeSingle();
    const sender = profile?.display_name ?? profile?.username ?? "だれか";

    return pushToUser(data.recipientId, {
      title: `${sender} さんからDM`,
      body: data.preview || "新しいメッセージが届きました",
      url: profile?.username ? `/messages/${profile.username}` : "/messages",
      tag: `dm-${context.userId}`,
    });
  });
