"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ArenaApiError, arenaApi, newKey } from "@/features/arena/client/api";
import type { CellResult, Game, Lobby, PlayerStanding, Projection, QuestionContent, ResolveResult } from "@/features/arena/client/types";

// One attempt, driven entirely by server projections. The client only:
//   - asks for question content when the server says a question exists (never before, never ahead),
//   - counts down from the `remainingMs` the server returned (display only),
//   - sends the student's choice with an Idempotency-Key that is reused on retries,
//   - resynchronises from the server after F5, reconnects, focus, expiry or any doubt.
export type Phase = "loading" | "signed_out" | "no_competition" | "intro" | "playing" | "finished" | "stale" | "error";

export type Feedback =
  | { kind: "answer"; result: ResolveResult; at: number }
  | { kind: "cell"; result: CellResult; at: number }
  | { kind: "timeout"; at: number };

const HEARTBEAT_MS = 5000;
const STANDING_MS = 12000;
const EXPIRY_SETTLE_MS = 700; // latency allowance + reconcile grace (400 + 250) and a little margin

export function useArenaGame(game: Game) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [question, setQuestion] = useState<QuestionContent | null>(null);
  const [questionEndsAt, setQuestionEndsAt] = useState<number | null>(null);
  const [attemptEndsAt, setAttemptEndsAt] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [connection, setConnection] = useState<"online" | "reconnecting">("online");
  const [standing, setStanding] = useState<PlayerStanding | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [staleAttemptId, setStaleAttemptId] = useState<string | null>(null);

  const attemptRef = useRef<string | null>(null);
  const fetchingRef = useRef<string | null>(null);
  const answerKeys = useRef(new Map<string, string>());
  const startKey = useRef<string | null>(null);
  const mounted = useRef(true);
  const phaseRef = useRef<Phase>("loading");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const applyProjection = useCallback((p: Projection) => {
    attemptRef.current = p.attempt.id;
    setProjection(p);
    setAttemptEndsAt(performance.now() + p.attempt.remainingMs);
    setQuestion((current) => (current && p.interaction?.allocationId === current.allocationId && p.attempt.state === "active" ? current : null));
    if (p.interaction?.status === "released" && typeof p.interaction.remainingMs === "number") {
      setQuestionEndsAt(performance.now() + p.interaction.remainingMs);
    }
    setPhase(p.attempt.state === "active" ? "playing" : "finished");
  }, []);

  const handleError = useCallback((error: unknown, attemptId?: string | null) => {
    if (!(error instanceof ArenaApiError)) {
      if ((error as Error)?.name !== "AbortError") setNotice("Đã xảy ra lỗi. Đang đồng bộ lại…");
      return "other" as const;
    }
    if (error.offline || error.status === 503) {
      setConnection("reconnecting");
      return "retry" as const;
    }
    if (error.code === "stale_session") {
      setStaleAttemptId(attemptId ?? attemptRef.current);
      setPhase("stale");
      return "stale" as const;
    }
    if (error.status === 401) {
      setPhase("signed_out");
      return "stale" as const;
    }
    return "other" as const;
  }, []);

  const loadStanding = useCallback(async () => {
    const id = attemptRef.current;
    if (!id) return;
    try {
      const s = await arenaApi.standing(id);
      if (mounted.current) setStanding(s);
    } catch {
      /* standing is informative only */
    }
  }, []);

  const refresh = useCallback(async () => {
    const id = attemptRef.current;
    if (!id) return;
    try {
      const p = await arenaApi.projection(id);
      if (!mounted.current) return;
      setConnection("online");
      applyProjection(p);
    } catch (error) {
      handleError(error, id);
    }
  }, [applyProjection, handleError]);

  // ---- initial load: lobby, then the attempt for this game if it exists --------------------------
  const load = useCallback(async () => {
    try {
      const l = await arenaApi.lobby();
      if (!mounted.current) return;
      setLobby(l);
      if (!l.competition) return setPhase("no_competition");
      const mine = l.games.find((g) => g.game === game);
      if (!mine?.attemptId) return setPhase("intro");
      attemptRef.current = mine.attemptId;
      try {
        applyProjection(await arenaApi.projection(mine.attemptId));
        void loadStanding();
      } catch (error) {
        if (handleError(error, mine.attemptId) === "other") setPhase("error");
      }
    } catch (error) {
      if (error instanceof ArenaApiError && error.status === 401) return setPhase("signed_out");
      setPhase("error");
    }
  }, [applyProjection, game, handleError, loadStanding]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // ---- start / take control ----------------------------------------------------------------------
  const start = useCallback(async () => {
    if (!lobby?.competition || busy) return;
    setBusy(true);
    setNotice(null);
    startKey.current ??= newKey("start");
    try {
      const res = await arenaApi.start(lobby.competition.publicId, game, startKey.current);
      applyProjection(res.projection);
      void loadStanding();
    } catch (error) {
      if (error instanceof ArenaApiError && error.code === "another_attempt_active") {
        setNotice("another_attempt_active");
      } else if (error instanceof ArenaApiError && error.code === "stale_session") {
        const mine = lobby.games.find((g) => g.game === game);
        setStaleAttemptId(mine?.attemptId ?? null);
        setPhase("stale");
      } else if (error instanceof ArenaApiError && error.status !== 0) {
        setNotice(error.message);
      } else {
        setNotice("Không kết nối được. Hãy thử lại.");
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [applyProjection, busy, game, loadStanding, lobby]);

  const takeControl = useCallback(async () => {
    const id = staleAttemptId ?? attemptRef.current;
    if (!id) return load();
    setBusy(true);
    try {
      attemptRef.current = id;
      fetchingRef.current = null;
      applyProjection(await arenaApi.transfer(id));
      setStaleAttemptId(null);
      void loadStanding();
    } catch (error) {
      if (handleError(error, id) === "other") setPhase("error");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [applyProjection, handleError, load, loadStanding, staleAttemptId]);

  // ---- question content: only when the server has a question, long-polled, never ahead -------------
  const loadContent = useCallback(
    async (allocationId: string, resyncAfter: boolean) => {
      const id = attemptRef.current;
      if (!id || fetchingRef.current === allocationId) return;
      fetchingRef.current = allocationId;
      try {
        for (let tries = 0; tries < 40 && mounted.current && phaseRef.current === "playing"; tries += 1) {
          try {
            const c = await arenaApi.content(id, allocationId);
            if (!mounted.current) return;
            setConnection("online");
            setQuestion(c);
            setQuestionEndsAt(performance.now() + c.remainingMs);
            if (resyncAfter) await refresh();
            return;
          } catch (error) {
            if (error instanceof ArenaApiError && error.code === "too_early") {
              await new Promise((r) => setTimeout(r, Math.max(40, Number(error.detail("availableInMs") ?? 200))));
              continue;
            }
            const kind = handleError(error, id);
            if (kind === "retry") {
              await new Promise((r) => setTimeout(r, 800));
              continue;
            }
            if (kind === "stale") return;
            await refresh(); // expired, already answered, never released: the projection tells what is next
            return;
          }
        }
      } finally {
        if (fetchingRef.current === allocationId) fetchingRef.current = null;
      }
    },
    [handleError, refresh],
  );

  useEffect(() => {
    if (phase !== "playing" || !projection) return;
    const it = projection.interaction;
    if (!it) return;
    if ((it.status === "pending" || it.status === "released") && question?.allocationId !== it.allocationId) {
      void loadContent(it.allocationId, false);
    } else if (it.status === "expired" && it.upcoming) {
      void loadContent(it.upcoming.allocationId, true);
    }
  }, [loadContent, phase, projection, question]);

  // ---- expiry: show "hết giờ" at once, then let the server settle and resync ---------------------
  useEffect(() => {
    if (phase !== "playing" || !projection?.interaction) return;
    const it = projection.interaction;
    const showingThis = question?.allocationId === it.allocationId;
    let wait: number | null = null;
    if (showingThis && questionEndsAt && !answering) wait = questionEndsAt - performance.now() + EXPIRY_SETTLE_MS;
    else if (it.status === "expired" && !it.upcoming) wait = 900;
    else if (it.status === "unavailable") wait = (attemptEndsAt ?? performance.now()) - performance.now() + EXPIRY_SETTLE_MS;
    if (wait === null) return;
    const timer = window.setTimeout(() => {
      if (showingThis) setFeedback({ kind: "timeout", at: performance.now() });
      void refresh();
    }, Math.max(150, wait));
    return () => window.clearTimeout(timer);
  }, [answering, attemptEndsAt, phase, projection, question, questionEndsAt, refresh]);

  useEffect(() => {
    if (phase !== "playing" || attemptEndsAt === null) return;
    const timer = window.setTimeout(() => void refresh(), Math.max(200, attemptEndsAt - performance.now() + EXPIRY_SETTLE_MS));
    return () => window.clearTimeout(timer);
  }, [attemptEndsAt, phase, refresh]);

  // ---- actions ------------------------------------------------------------------------------------
  const answer = useCallback(
    async (optionId: string) => {
      const id = attemptRef.current;
      if (!id || !question || answering) return;
      const allocationId = question.allocationId;
      const key = answerKeys.current.get(allocationId) ?? newKey("answer");
      answerKeys.current.set(allocationId, key);
      setAnswering(true);
      try {
        for (let tries = 0; tries < 4; tries += 1) {
          try {
            const res = await arenaApi.answer(id, allocationId, optionId, key);
            if (!mounted.current) return;
            setConnection("online");
            answerKeys.current.delete(allocationId);
            setFeedback({ kind: "answer", result: res.result, at: performance.now() });
            setQuestion(null);
            applyProjection(res.projection);
            void loadStanding();
            return;
          } catch (error) {
            const kind = handleError(error, id);
            if (kind === "retry" && tries < 3) {
              await new Promise((r) => setTimeout(r, 500 * (tries + 1))); // same key: never scored twice
              continue;
            }
            if (kind !== "stale") await refresh();
            return;
          }
        }
      } finally {
        if (mounted.current) setAnswering(false);
      }
    },
    [answering, applyProjection, handleError, loadStanding, question, refresh],
  );

  const openCell = useCallback(
    async (cell: number) => {
      const id = attemptRef.current;
      if (!id || busy || projection?.interaction || phaseRef.current !== "playing") return;
      setBusy(true);
      const key = newKey("cell");
      try {
        for (let tries = 0; tries < 3; tries += 1) {
          try {
            const res = await arenaApi.openCell(id, cell, key);
            if (!mounted.current) return;
            setConnection("online");
            setFeedback({ kind: "cell", result: res.result, at: performance.now() });
            applyProjection(res.projection);
            if (res.result.kind === "chest") void loadStanding();
            return;
          } catch (error) {
            const kind = handleError(error, id);
            if (kind === "retry" && tries < 2) {
              await new Promise((r) => setTimeout(r, 500));
              continue;
            }
            if (kind !== "stale") await refresh();
            return;
          }
        }
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [applyProjection, busy, handleError, loadStanding, projection, refresh],
  );

  // ---- liveness: heartbeat, reconnect, focus ------------------------------------------------------
  useEffect(() => {
    if (phase !== "playing") return;
    let failed = false;
    const timer = window.setInterval(async () => {
      const id = attemptRef.current;
      if (!id) return;
      try {
        await arenaApi.heartbeat(id);
        if (failed) {
          failed = false;
          setConnection("online");
          void refresh();
        }
      } catch (error) {
        if (handleError(error, id) === "retry") failed = true;
      }
    }, HEARTBEAT_MS);
    const standingTimer = window.setInterval(() => void loadStanding(), STANDING_MS);
    const onOnline = () => {
      setConnection("online");
      void refresh();
    };
    const onOffline = () => setConnection("reconnecting");
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(standingTimer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [handleError, loadStanding, phase, refresh]);

  useEffect(() => {
    if (phase === "finished") void loadStanding();
  }, [loadStanding, phase]);

  return {
    phase, lobby, projection, question, questionEndsAt, attemptEndsAt, feedback, connection, standing, notice, busy, answering,
    start, takeControl, answer, openCell, refresh, clearNotice: () => setNotice(null),
    reload: () => {
      setPhase("loading");
      void load();
    },
  };
}

export function useNow(intervalMs = 100) {
  const [now, setNow] = useState(() => (typeof performance === "undefined" ? 0 : performance.now()));
  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
