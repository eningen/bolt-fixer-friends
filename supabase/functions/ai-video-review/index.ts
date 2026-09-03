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
const GEMINI_MODEL = "gemini-3.7-flash";

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

function guessMimeType(url: string, contentType?: string | null) {
  const normalized = contentType?.split(";")[0].trim().toLowerCase();
  if (normalized?.startsWith("video/")) return normalized;
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".webm")) return "video/webm";
  if (clean.endsWith(".mov")) return "video/quicktime";
  if (clean.endsWith(".avi")) return "video/x-msvideo";
  if (clean.endsWith(".mkv")) return "video/x-matroska";
  return "video/mp4";
}

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  if (typeof payload?.text === "string") return payload.text.trim();

  const steps = Array.isArray(payload?.steps) ? payload.steps : [];
  const modelOutputs = steps.filter((step: any) => step?.type === "model_output");
  const candidates = modelOutputs.length ? modelOutputs : steps;

  return candidates
    .flatMap((step: any) => Array.isArray(step?.content) ? step.content : [])
    .filter((part: any) => part?.type === "text" && typeof part?.text === "string")
    .map((part: any) => part.text)
    .join("\n")
    .trim();
}

async function uploadVideoToGemini(videoUrl: string) {
  const source = await fetch(videoUrl);
  if (!source.ok || !source.body) {
    throw new Error(`動画ファイルを取得できませんでした (HTTP ${source.status})`);
  }

  const contentLengthHeader = source.headers.get("content-length");
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : NaN;
  if (Number.isFinite(contentLength) && contentLength > 100 * 1024 * 1024) {
    throw new Error("動画が大きすぎます。100MB以下の動画を使用してください。");
  }

  const bytes = new Uint8Array(await source.arrayBuffer());
  if (bytes.byteLength > 100 * 1024 * 1024) {
    throw new Error("動画が大きすぎます。100MB以下の動画を使用してください。");
  }

  const mimeType = guessMimeType(videoUrl, source.headers.get("content-type"));
  const start = await fetch("https://generativelanguage.googleapis.com/upload/v1beta/files", {
    method: "POST",
    headers: {
      "x-goog-api-key": GEMINI_API_KEY!,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: "stickman-video-chat-aet" } }),
  });

  if (!start.ok) {
    const detail = await start.text();
    throw new Error(`Gemini Files APIの開始に失敗しました (HTTP ${start.status}): ${detail.slice(0, 500)}`);
  }

  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini Files APIのアップロードURLを取得できませんでした。");

  const upload = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });

  const filePayload = await upload.json().catch(() => ({}));
  if (!upload.ok || !filePayload?.file?.name || !filePayload?.file?.uri) {
    throw new Error(`Gemini Files APIへの動画アップロードに失敗しました (HTTP ${upload.status})`);
  }

  const fileName = filePayload.file.name as string;
  let file = filePayload.file;
  for (let attempt = 0; attempt < 30; attempt++) {
    const state = file?.state;
    if (state === "ACTIVE") return { uri: file.uri as string, mimeType: file.mimeType || mimeType };
    if (state === "FAILED") throw new Error("Geminiで動画の処理に失敗しました。");

    await new Promise((resolve) => setTimeout(resolve, 2000));
    const statusResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}`, {
      headers: { "x-goog-api-key": GEMINI_API_KEY! },
    });
    const statusPayload = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) {
      throw new Error(`Gemini動画ファイルの状態確認に失敗しました (HTTP ${statusResponse.status})`);
    }
    file = statusPayload;
  }

  throw new Error("Geminiでの動画処理がタイムアウトしました。");
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
      response_format: { type: "text" },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Gemini interaction failed", response.status, payload);
    const message = payload?.error?.message || payload?.message || "不明なエラー";
    throw new Error(`AIサービスへの接続に失敗しました (HTTP ${response.status}): ${message}`);
  }

  const text = extractOutputText(payload);
  if (!text) throw new Error("Chat AETから動画の説明を取得できませんでした。");
  return text.replace(/^['\"]|['\"]$/g, "").trim().slice(0, 4000);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!GEMINI_API_KEY) return json({ error: "Chat AETのAI設定がまだ完了していません。GEMINI_API_KEYを設定してください。" }, 503);

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
      .select("id,user_id,title,description,video_url,platform,youtube_id,thumbnail_url")
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

    const mediaUrl = video.video_url;
    if (!mediaUrl) return json({ error: "動画URLがありません。" }, 422);

    let mediaInput: Record<string, unknown>;
    if (isYouTubeUrl(mediaUrl)) {
      // Gemini supports public YouTube URLs directly.
      mediaInput = {
        type: "video",
        uri: mediaUrl,
        processing: "agentic",
      };
    } else {
      // Supabase Storage and other ordinary URLs are downloaded and uploaded
      // to Gemini Files API first, which avoids relying on Gemini fetching an
      // arbitrary external media URL directly.
      const uploaded = await uploadVideoToGemini(mediaUrl);
      mediaInput = {
        type: "video",
        uri: uploaded.uri,
        mime_type: uploaded.mimeType,
        processing: "agentic",
      };
    }

    const prompt = `あなたはStickman Videoに組み込まれたAI「Chat AET」です。
この動画そのものを確認して、映像と音声から分かる内容を日本語で説明してください。
タイトルや説明文だけから内容を推測せず、動画から確認できたことを中心にしてください。
次の形式を基本にしてください。

📌 概要
動画全体を2〜3文で説明

🎬 主な場面
時間が分かる場合は、おおよその時刻を付けて重要な場面を箇条書き

🔎 詳細
映像に映っている人物・物・場所・ゲーム画面など、確認できるものを説明

🎧 音声・音楽
聞き取れる会話、効果音、音楽などがあれば説明。聞き取れない場合は無理に推測しない

💡 見どころ
動画の中で特に注目できる場面を1〜2個

不確かな情報は「確認できません」と明示してください。
過度に長くせず、読みやすい日本語でまとめてください。

動画タイトル: ${video.title}
投稿者の説明: ${video.description ?? "なし"}`;

    const explanation = await createInteraction([
      mediaInput,
      { type: "text", text: prompt },
    ]);

    const { data: inserted, error: insertError } = await admin
      .from("comments")
      .insert({
        video_id: videoId,
        user_id: video.user_id,
        body: explanation,
        is_ai: true,
        ai_model: `Chat AET (${GEMINI_MODEL})`,
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
      console.error("Chat AET comment insert failed", insertError);
      return json({ error: `Chat AETの説明は生成できましたが、保存に失敗しました: ${insertError.message}` }, 500);
    }

    return json({ comment: inserted, reused: false });
  } catch (error) {
    console.error("ai-video-review error", error);
    return json({ error: error instanceof Error ? error.message : "Chat AETの動画解析に失敗しました。" }, 500);
  }
});
