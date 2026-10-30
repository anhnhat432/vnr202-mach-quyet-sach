"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { arenaApi } from "@/features/arena/client/api";
import type { Game, Leaderboard } from "@/features/arena/client/types";
import { createBrowserClient } from "@/lib/supabase/browser";

// Leaderboard sync (realtime-contracts §3): the API is the only source of truth. A public Broadcast
// `leaderboard.changed` is just a hint to fetch sooner; events with a version not above the rendered
// one, of the wrong shape or for another topic are ignored. Periodic sync covers missed events, and
// focus/online trigger an immediate resync. Rank movement is computed by comparing two authoritative
// boards, never from event payloads.
export type RankChange = { delta: number; at: number };

const LIVE_SYNC_MS = 15000;
const FALLBACK_SYNC_MS = 4000;
const DEBOUNCE_MS = 200;

export function useLeaderboard(publicId: string | null, game: Game) {
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [channel, setChannel] = useState<"live" | "polling">("polling");
  const [online, setOnline] = useState(true);
  const [changes, setChanges] = useState<Record<string, RankChange>>({});
  const [leaderChangedAt, setLeaderChangedAt] = useState<number | null>(null);
  const version = useRef(-1);
  const ranks = useRef(new Map<string, number>());
  const leader = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const inFlight = useRef(false);

  const fetchBoard = useCallback(async () => {
    if (!publicId || inFlight.current) return;
    inFlight.current = true;
    try {
      const next = await arenaApi.leaderboard(publicId, game);
      setOnline(true);
      if (next.version < version.current) return; // never go backwards
      const now = performance.now();
      const moved: Record<string, RankChange> = {};
      for (const e of next.entries) {
        const before = ranks.current.get(e.entryId);
        if (before !== undefined && before !== e.rank) moved[e.entryId] = { delta: before - e.rank, at: now };
      }
      const top = next.entries[0]?.entryId ?? null;
      if (leader.current && top && top !== leader.current) setLeaderChangedAt(now);
      leader.current = top;
      ranks.current = new Map(next.entries.map((e) => [e.entryId, e.rank]));
      version.current = next.version;
      if (Object.keys(moved).length) setChanges((current) => ({ ...current, ...moved }));
      setBoard(next);
    } catch {
      setOnline(false);
    } finally {
      inFlight.current = false;
    }
  }, [game, publicId]);

  const soon = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void fetchBoard(), DEBOUNCE_MS);
  }, [fetchBoard]);

  // periodic sync + focus / online resync
  useEffect(() => {
    if (!publicId) return;
    const first = window.setTimeout(() => void fetchBoard(), 0);
    const interval = window.setInterval(() => void fetchBoard(), channel === "live" ? LIVE_SYNC_MS : FALLBACK_SYNC_MS);
    const resync = () => void fetchBoard();
    const onVisible = () => { if (document.visibilityState === "visible") resync(); };
    window.addEventListener("online", resync);
    window.addEventListener("focus", resync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
      window.removeEventListener("online", resync);
      window.removeEventListener("focus", resync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [channel, fetchBoard, publicId]);

  // Broadcast hint
  useEffect(() => {
    if (!publicId) return;
    let supabase: ReturnType<typeof createBrowserClient>;
    try {
      supabase = createBrowserClient();
    } catch {
      return; // no public env: polling only
    }
    const topic = `leaderboard:${publicId}:${game}`;
    const ch = supabase.channel(topic, { config: { private: false } });
    const onEvent = ({ payload }: { payload: unknown }) => {
      const p = payload as { aggregate?: { type?: string; publicId?: string; version?: unknown } };
      if (p?.aggregate?.type !== "leaderboard" || p.aggregate.publicId !== `${publicId}:${game}`) return;
      if (typeof p.aggregate.version !== "number" || p.aggregate.version <= version.current) return;
      soon();
    };
    ch.on("broadcast", { event: "leaderboard.changed" }, onEvent)
      .on("broadcast", { event: "leaderboard.finalized" }, onEvent)
      .subscribe((status) => {
        setChannel(status === "SUBSCRIBED" ? "live" : "polling");
        if (status === "SUBSCRIBED") soon(); // catch up on anything missed while connecting
      });
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [game, publicId, soon]);

  return { board, channel, online, changes, leaderChangedAt, refresh: fetchBoard };
}
