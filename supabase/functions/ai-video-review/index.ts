import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-3.6-flash";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function getBearerToken(request: Request) {
  const value = request.headers.get("Authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : null;
}

function isYouTubeUrl(value: string) {
  return /(?:youtube\.com\/watch\?v=|youtu\.be\/)/i.test(value);
}

function guessMimeType(pathOrUrl: string) {
  const clean = pathOrUrl.split("?")[0].toLowerCase();
  if (clean.endsWith(".webm")) return "video/webm";
  if (clean.endsWith(".mov")) return "video/quicktime";
  if (clean.endsWith(".m4v")) return "video/x-m4v";
  if (clean.endsWith(".avi")) return "video/x-msvideo";
  return "video/mp4";
}

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  if (typeof payload?.text === "string") return payload.text.trim();
  const outputs = Array.isArray(payload?.outputs) ? payload.outputs : [];
  return outputs
    .flatMap((output: any) => Array.isArray(output?.content) ? output.content : [])
    .filter((part: any) => part?.type === "text" && typeof part?.text === "string")
    .map((part: any) => part.text)
    .join("\n")
    .trim();
}

async function createInteraction(input: Array<Record<string, unknown>>) {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "x-goog-api-key": GEMINI_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      input,
      response_format: {
        type: "text",
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Gemini interaction failed", response.status, payload);
    throw new Error("AIサービスへの接続に失敗しました。");
  }

  const text = extractOutputText(payload);
  if (!text) throw new Error("AIから感想を取得できませんでした。");
  return text.replace(/^['\"]|['\"]$/g, "").trim().slice(0, 2000);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!GEMINI_API_KEY) return json({ error: "AI機能の設定がまだ完了していません。" }, 503);

  try {
    const token = getBearerToken(request);
    if (!token) return json({ error: "ログインが必要です。" }, 401);

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "ログイン情報を確認できません。" }, 401);

    const body = await request.json().catch(() => null);
    const videoId = typeof body?.videoId === "string" ? body.videoId : "";
    if (!videoId) return json({ error: "動画IDがありません。" }, 400);

    const { data: video, error: videoError } = await admin
      .from("videos")
      .select("id,user_id,title,description,video_url,storage_path,platform")
      .eq("id", videoId)
      .maybeSingle();
    if (videoError) throw videoError;
    if (!video) return json({ error: "動画が見つかりません。" }, 404);

    const { data: existing, error: existingError } = await admin
      .from("comments")
      .select("id,body,created_at,is_ai,ai_model")
      .eq("video_id", videoId)
      .eq("is_ai", true)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return json({ comment: existing, reused: true });

    let mediaUrl = video.video_url;
    let mediaType: Record<string, unknown>;

    if (video.storage_path) {
      const { data: signed, error: signedError } = await admin.storage
        .from("videos")
        .createSignedUrl(video.storage_path, 10 * 60);
      if (signedError || !signed?.signedUrl) {
        return json({ error: "動画ファイルをAIに渡せませんでした。" }, 422);
      }
      mediaUrl = signed.signedUrl;
      mediaType = { type: "video", uri: mediaUrl, mime_type: guessMimeType(video.storage_path) };
    } else if (isYouTubeUrl(mediaUrl)) {
      mediaType = { type: "video", uri: mediaUrl };
    } else {
      mediaType = { type: "video", uri: mediaUrl, mime_type: guessMimeType(mediaUrl) };
    }

    const prompt = `あなたはStickman videoの公式AIレビュアー「Stickman AI」です。\nこの動画を実際に見て、映像と音声・音楽の両方から分かる範囲で、投稿者が嬉しくなる自然な日本語の感想を書いてください。\nタイトルや説明だけから内容を想像してはいけません。動画から確認できる内容を中心にしてください。\n短すぎず長すぎない、2〜5文程度の具体的な感想にしてください。\n音楽が含まれている場合は、聞き取れる範囲で曲調、雰囲気、歌声や演奏などにも触れてください。\n不確かなことは断定しないでください。\nタイトル: ${video.title}\n説明: ${video.description ?? "なし"}`;

    const review = await createInteraction([mediaType, { type: "text", text: prompt }]);

    const { data: inserted, error: insertError } = await admin
      .from("comments")
      .insert({
        video_id: videoId,
        user_id: video.user_id,
        body: review,
        is_ai: true,
        ai_model: GEMINI_MODEL,
      })
      .select("id,body,created_at,is_ai,ai_model")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        const { data: raceWinner } = await admin
          .from("comments")
          .select("id,body,created_at,is_ai,ai_model")
          .eq("video_id", videoId)
          .eq("is_ai", true)
          .maybeSingle();
        if (raceWinner) return json({ comment: raceWinner, reused: true });
      }
      throw insertError;
    }

    return json({ comment: inserted, reused: false });
  } catch (error) {
    console.error("ai-video-review error", error);
    return json({ error: error instanceof Error ? error.message : "AI感想の生成に失敗しました。" }, 500);
  }
});
