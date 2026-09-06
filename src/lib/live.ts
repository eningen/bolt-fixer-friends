import { useEffect, useMemo, useRef, useState } from "react";
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type LiveStatus = "preparing" | "live" | "ended";

export type LiveStreamRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: string;
  transport: string;
  thumbnail_url: string | null;
  viewer_count: number;
  peak_viewer_count: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  profile: { username: string; display_name: string; avatar_url: string | null } | null;
};

const LIVE_SELECT =
  "id,user_id,title,description,status,transport,thumbnail_url,viewer_count,peak_viewer_count,started_at,ended_at,created_at,profile:profiles!live_streams_user_id_fkey(username,display_name,avatar_url)";

export const liveStreamsQuery = queryOptions({
  queryKey: ["live", "list"],
  refetchInterval: 15000,
  queryFn: async (): Promise<LiveStreamRow[]> => {
    const { data, error } = await supabase
      .from("live_streams")
      .select(LIVE_SELECT)
      .eq("status", "live")
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as unknown as LiveStreamRow[];
  },
});

/** 配信履歴（将来のアーカイブ表示にも使う） */
export function liveHistoryQuery(userId: string | undefined) {
  return queryOptions({
    queryKey: ["live", "history", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<LiveStreamRow[]> => {
      const { data, error } = await supabase
        .from("live_streams")
        .select(LIVE_SELECT)
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as LiveStreamRow[];
    },
  });
}

export function liveStreamQuery(streamId: string) {
  return queryOptions({
    queryKey: ["live", "stream", streamId],
    refetchInterval: 10000,
    queryFn: async (): Promise<LiveStreamRow | null> => {
      const { data, error } = await supabase
        .from("live_streams")
        .select(LIVE_SELECT)
        .eq("id", streamId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as LiveStreamRow) ?? null;
    },
  });
}

export function liveLikesQuery(streamId: string) {
  return queryOptions({
    queryKey: ["live", "stream", streamId, "likes"],
    queryFn: async (): Promise<{ count: number; likedBy: string[] }> => {
      const { data, error } = await supabase.from("live_likes").select("user_id").eq("stream_id", streamId);
      if (error) throw error;
      return { count: data?.length ?? 0, likedBy: (data ?? []).map((row) => row.user_id) };
    },
  });
}

const VIEWER_WINDOW_MS = 45000;

export function liveViewerCountQuery(streamId: string) {
  return queryOptions({
    queryKey: ["live", "stream", streamId, "viewers"],
    refetchInterval: 10000,
    queryFn: async (): Promise<number> => {
      const since = new Date(Date.now() - VIEWER_WINDOW_MS).toISOString();
      const { count, error } = await supabase
        .from("live_viewers")
        .select("id", { count: "exact", head: true })
        .eq("stream_id", streamId)
        .gte("last_seen_at", since);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** ブラウザ内で固定の視聴セッションキー（WebRTCの相手識別に使う） */
export function useSessionKey() {
  return useMemo(() => {
    if (typeof window === "undefined") return "ssr";
    try {
      const saved = window.sessionStorage.getItem("stickman-live-key");
      if (saved) return saved;
      const next = Math.random().toString(36).slice(2, 12);
      window.sessionStorage.setItem("stickman-live-key", next);
      return next;
    } catch {
      return Math.random().toString(36).slice(2, 12);
    }
  }, []);
}

const HOST_KEY = "host";
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] }],
};

type SignalRow = {
  id: string;
  stream_id: string;
  sender_key: string;
  recipient_key: string | null;
  kind: string;
  payload: unknown;
};

async function sendSignal(streamId: string, senderKey: string, recipientKey: string | null, kind: string, payload: unknown) {
  await supabase.from("live_signals").insert({
    stream_id: streamId,
    sender_key: senderKey,
    recipient_key: recipientKey,
    kind,
    payload: payload as never,
  } as never);
}

function subscribeSignals(streamId: string, onSignal: (row: SignalRow) => void) {
  const channel = supabase
    .channel(`live-signals-${streamId}-${Math.random().toString(36).slice(2, 8)}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "live_signals", filter: `stream_id=eq.${streamId}` },
      (payload) => onSignal(payload.new as SignalRow),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/** 配信者側：視聴者ごとにP2P接続を張り、自分のカメラ映像を送る */
export function useLiveHostBroadcast(streamId: string | null, stream: MediaStream | null) {
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const [peerCount, setPeerCount] = useState(0);

  useEffect(() => {
    if (!streamId || !stream) return;
    const peers = peersRef.current;
    let disposed = false;

    const ensurePeer = (viewerKey: string) => {
      const existing = peers.get(viewerKey);
      if (existing) {
        existing.close();
        peers.delete(viewerKey);
      }
      const pc = new RTCPeerConnection(RTC_CONFIG);
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
      pc.onicecandidate = (event) => {
        if (event.candidate) void sendSignal(streamId, HOST_KEY, viewerKey, "candidate", event.candidate.toJSON());
      };
      pc.onconnectionstatechange = () => {
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
          peers.delete(viewerKey);
          if (!disposed) setPeerCount(peers.size);
        }
      };
      peers.set(viewerKey, pc);
      setPeerCount(peers.size);
      return pc;
    };

    const unsubscribe = subscribeSignals(streamId, (row) => {
      void (async () => {
        try {
          if (row.kind === "join" && row.sender_key !== HOST_KEY) {
            const pc = ensurePeer(row.sender_key);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await sendSignal(streamId, HOST_KEY, row.sender_key, "offer", { sdp: offer.sdp, type: offer.type });
            return;
          }
          if (row.recipient_key !== HOST_KEY) return;
          const pc = peers.get(row.sender_key);
          if (!pc) return;
          if (row.kind === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(row.payload as RTCSessionDescriptionInit));
          } else if (row.kind === "candidate") {
            await pc.addIceCandidate(new RTCIceCandidate(row.payload as RTCIceCandidateInit));
          }
        } catch (error) {
          console.error("live host signal error", error);
        }
      })();
    });

    return () => {
      disposed = true;
      unsubscribe();
      for (const pc of peers.values()) pc.close();
      peers.clear();
      setPeerCount(0);
    };
  }, [streamId, stream]);

  return { peerCount };
}

/** 視聴者側：配信者に接続要求を出して映像を受け取る */
export function useLiveViewerStream(streamId: string, enabled: boolean) {
  const sessionKey = useSessionKey();
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [state, setState] = useState<"idle" | "connecting" | "connected" | "failed">("idle");

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let pc: RTCPeerConnection | null = null;
    let cancelled = false;
    setState("connecting");

    const unsubscribe = subscribeSignals(streamId, (row) => {
      void (async () => {
        if (row.recipient_key !== sessionKey || !pc) return;
        try {
          if (row.kind === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(row.payload as RTCSessionDescriptionInit));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendSignal(streamId, sessionKey, HOST_KEY, "answer", { sdp: answer.sdp, type: answer.type });
          } else if (row.kind === "candidate") {
            await pc.addIceCandidate(new RTCIceCandidate(row.payload as RTCIceCandidateInit));
          }
        } catch (error) {
          console.error("live viewer signal error", error);
        }
      })();
    });

    pc = new RTCPeerConnection(RTC_CONFIG);
    pc.onicecandidate = (event) => {
      if (event.candidate) void sendSignal(streamId, sessionKey, HOST_KEY, "candidate", event.candidate.toJSON());
    };
    pc.ontrack = (event) => {
      const [incoming] = event.streams;
      if (incoming && !cancelled) {
        setRemoteStream(incoming);
        setState("connected");
      }
    };
    pc.onconnectionstatechange = () => {
      if (!pc || cancelled) return;
      if (pc.connectionState === "connected") setState("connected");
      if (pc.connectionState === "failed") setState("failed");
    };

    // 少し待ってから参加要求（購読が張られてから合図を送る）
    const timer = window.setTimeout(() => {
      void sendSignal(streamId, sessionKey, HOST_KEY, "join", {});
    }, 700);
    // 接続できないときは定期的に再要求
    const retry = window.setInterval(() => {
      if (pc && pc.connectionState !== "connected") void sendSignal(streamId, sessionKey, HOST_KEY, "join", {});
    }, 12000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(retry);
      unsubscribe();
      pc?.close();
      setRemoteStream(null);
      setState("idle");
    };
  }, [streamId, enabled, sessionKey]);

  return { remoteStream, state };
}

/** 視聴者の在席を一定間隔で記録して、視聴者数の集計に使う */
export function useViewerHeartbeat(streamId: string, userId: string | undefined, active: boolean) {
  const sessionKey = useSessionKey();

  useEffect(() => {
    if (!active || !userId || typeof window === "undefined") return;
    let stopped = false;

    const beat = async () => {
      if (stopped) return;
      await supabase.from("live_viewers").upsert(
        { stream_id: streamId, user_id: userId, session_key: sessionKey, last_seen_at: new Date().toISOString() } as never,
        { onConflict: "stream_id,session_key" },
      );
    };
    void beat();
    const timer = window.setInterval(() => void beat(), 20000);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      void supabase.from("live_viewers").delete().eq("stream_id", streamId).eq("session_key", sessionKey);
    };
  }, [streamId, userId, active, sessionKey]);
}
