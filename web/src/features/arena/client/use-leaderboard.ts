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
const HINT_DELAY_MS = 200; // gather a burst of hints into one read
const MIN_INTERVAL_MS = 500; // at most two hinted reads per second per board, even under a constant stream
const SETTLE_MS = 1200; // hints are paced to one per second per game: read once more after the last one

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
  const hinted = useRef(-1);
  const lastHintAt = useRef(0);
  const lastRead = useRef(0);
  const again = useRef<() => void>(() => undefined);
  const settleTimer = useRef<number | null>(null);

  const fetchBoard = useCallback(async (hintedVersion?: number, settle = false): Promise<boolean> => {
    if (!publicId || inFlight.current) return false;
    inFlight.current = true;
    lastRead.current = performance.now();
    try {
      const next = await arenaApi.leaderboard(publicId, game, hintedVersion, settle);
      setOnline(true);
      if (next.version < version.current) return true; // never go backwards
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
      return true;
    } catch {
      setOnline(false);
      return true;
    } finally {
      inFlight.current = false;
    }
  }, [game, publicId]);

  // A hint schedules one read; later hints never push it back (a constant stream of answers must not
  // starve the board). Reads are spaced by MIN_INTERVAL_MS and a hint that arrives meanwhile is kept.
  const soon = useCallback((hintedVersion?: number) => {
    if (hintedVersion !== undefined) hinted.current = Math.max(hinted.current, hintedVersion);
    if (timer.current) return;
    const wait = Math.max(HINT_DELAY_MS, lastRead.current + MIN_INTERVAL_MS - performance.now());
    timer.current = window.setTimeout(async () => {
      timer.current = null;
      const target = hinted.current > version.current ? hinted.current : undefined;
      const startedAt = performance.now();
      await fetchBoard(target);
      if (hinted.current > version.current) {
        // read again only for a hint that arrived during this read; a version the server did not confirm
        // (stale, or forged on the public channel) is dropped instead of polling for it
        if (lastHintAt.current > startedAt && navigator.onLine) again.current();
        else hinted.current = version.current;
      }
    }, wait);
  }, [fetchBoard]);
  useEffect(() => {
    again.current = () => soon();
  }, [soon]);

  // Changes that fell inside a paced second have no hint of their own: one read after the last hint.
  const settleLater = useCallback(() => {
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    const run = async () => {
      settleTimer.current = null;
      if (!(await fetchBoard(hinted.current, true))) settleTimer.current = window.setTimeout(() => void run(), 250); // a read was in flight
    };
    settleTimer.current = window.setTimeout(() => void run(), SETTLE_MS);
  }, [fetchBoard]);
  useEffect(() => () => { if (settleTimer.current) window.clearTimeout(settleTimer.current); }, []);

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
      if (typeof p.aggregate.version !== "number") return;
      lastHintAt.current = performance.now();
      hinted.current = Math.max(hinted.current, p.aggregate.version);
      settleLater(); // even for a version already shown: changes right after it may have been paced
      if (p.aggregate.version > version.current) soon(p.aggregate.version);
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
  }, [game, publicId, soon, settleLater]);

  return { board, channel, online, changes, leaderChangedAt, refresh: fetchBoard };
}
