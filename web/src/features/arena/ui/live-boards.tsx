"use client";

import { Crown, Maximize2, TrendingUp, Volume2, VolumeX } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVisibleRefresh } from "@/features/arena/client/use-visible-refresh";

import { currentCompetition, type CurrentCompetition } from "@/features/arena/client/api";
import { useArenaSound } from "@/features/arena/client/sound";
import type { Game } from "@/features/arena/client/types";
import { useLeaderboard } from "@/features/arena/client/use-leaderboard";
import { useNow } from "@/features/arena/client/use-arena-game";
import { STANDING_LABEL } from "@/features/arena/ui/arena-ui";
import { GAME_TITLE, LeaderboardBoard } from "@/features/arena/ui/leaderboard-board";

function useCurrentCompetition() {
  const [comp, setComp] = useState<CurrentCompetition | undefined>(undefined);
  const mounted = useRef(false);
  const pending = useRef(false);
  const load = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    try {
      const next = await currentCompetition();
      if (mounted.current) setComp(next);
    } catch { /* retain the last verified state and retry on the next visible refresh */ }
    finally { pending.current = false; }
  }, []);
  useVisibleRefresh(load, true);
  useEffect(() => {
    mounted.current = true;
    const first = window.setTimeout(() => void load(), 0);
    return () => {
      mounted.current = false;
      window.clearTimeout(first);
    };
  }, [load]);
  return comp;
}

// Public page: the two independent Top 10 boards (LA-LB-001/003).
export function LiveBoardsPage() {
  const comp = useCurrentCompetition();
  const now = useNow(500);
  const mine = useLeaderboard(comp?.publicId ?? null, "minefield");
  const race = useLeaderboard(comp?.publicId ?? null, "race");
  if (comp === undefined) return <p className="ax-lb-page__note">Đang tải…</p>;
  if (comp === null) return <p className="ax-lb-page__note">Chưa có cuộc thi nào để hiển thị.</p>;
  return (
    <div className="ax-lb-page">
      <p className="ax-lb-page__note">
        <strong>{comp.name}</strong> · <span className={`ax-badge ax-badge--${comp.standing}`}>{STANDING_LABEL[comp.standing]}</span> · Hai bảng độc lập, chỉ hiển thị tên lớp học.
      </p>
      <div className="ax-lb-grid">
        <LeaderboardBoard game="minefield" {...mine} now={now} />
        <LeaderboardBoard game="race" {...race} now={now} />
      </div>
    </div>
  );
}

type Toast = { id: string; text: string; tone: "up" | "lead" };

// 1920x1080 projector (LA-LB-003/004): both Top 10 boards side by side, or one game enlarged
// (keys 1 / 2, 0 for both). Overtakes and a new leader are announced from two consecutive
// authoritative boards; nothing here can change a score.
export function ProjectorBoards() {
  const comp = useCurrentCompetition();
  const now = useNow(250);
  const reduce = useReducedMotion();
  const sound = useArenaSound();
  const [zoom, setZoom] = useState<Game | null>(null);
  const mine = useLeaderboard(comp?.publicId ?? null, "minefield");
  const race = useLeaderboard(comp?.publicId ?? null, "race");
  const announced = useRef(new Set<string>());
  const { play, toggle } = sound;

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("game");
    const t = window.setTimeout(() => setZoom(fromUrl === "minefield" || fromUrl === "race" ? fromUrl : null), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1") setZoom("minefield");
      if (e.key === "2") setZoom("race");
      if (e.key === "0" || e.key === "Escape") setZoom(null);
      if (e.key.toLowerCase() === "m") toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [toggle]);

  const toasts = useMemo<Toast[]>(() => {
    const list: Toast[] = [];
    for (const [game, lb] of [["minefield", mine], ["race", race]] as const) {
      if (!lb.board) continue;
      if (lb.leaderChangedAt && now - lb.leaderChangedAt < 5000 && lb.board.entries[0]) {
        list.push({ id: `lead-${game}-${lb.leaderChangedAt}`, tone: "lead", text: `${lb.board.entries[0].displayName} dẫn đầu ${GAME_TITLE[game]}!` });
      }
      for (const e of lb.board.entries) {
        const c = lb.changes[e.entryId];
        if (c && c.delta > 0 && now - c.at < 4000 && e.rank > 1) list.push({ id: `up-${e.entryId}-${c.at}`, tone: "up", text: `${e.displayName} vượt lên hạng ${e.rank} · ${GAME_TITLE[game]}` });
      }
    }
    return list.slice(0, 3);
  }, [mine, race, now]);

  useEffect(() => {
    for (const t of toasts) {
      if (announced.current.has(t.id)) continue;
      announced.current.add(t.id);
      play(t.tone === "lead" ? "lead" : "overtake");
    }
  }, [play, toasts]);

  const players = (mine.board?.players ?? 0) + (race.board?.players ?? 0);
  return (
    <div className="ax-frame ax-proj" data-zoom={zoom ?? "both"}>
      <div className="ax-frame__bg" aria-hidden />
      <header className="ax-proj__head">
        <div className="ax-proj__brand"><span>VNR202</span> LIVE ARENA</div>
        <div className="ax-proj__title">
          <strong>{comp?.name ?? "Chưa có cuộc thi"}</strong>
          {comp ? <span className={`ax-badge ax-badge--${comp.standing} ax-proj__badge`}>{STANDING_LABEL[comp.standing]}</span> : null}
        </div>
        <div className="ax-proj__stats">
          <span>{players} lượt chơi</span>
          <div className="ax-proj__zoom" role="group" aria-label="Chế độ hiển thị">
            <button type="button" aria-pressed={zoom === null} onClick={() => setZoom(null)}>Hai bảng</button>
            <button type="button" aria-pressed={zoom === "minefield"} onClick={() => setZoom("minefield")}><Maximize2 aria-hidden size={14} /> Bãi Mìn</button>
            <button type="button" aria-pressed={zoom === "race"} onClick={() => setZoom("race")}><Maximize2 aria-hidden size={14} /> Đường Đua</button>
            <button
              type="button"
              aria-pressed={sound.enabled}
              aria-label={sound.enabled ? "Tắt âm thanh" : "Bật âm thanh"}
              onClick={sound.toggle}
            >
              {sound.enabled ? <Volume2 aria-hidden size={14} /> : <VolumeX aria-hidden size={14} />} Âm thanh
            </button>
          </div>
        </div>
      </header>
      <div className="ax-proj__boards">
        {zoom !== "race" ? <LeaderboardBoard game="minefield" {...mine} now={now} size="projector" waiting={comp === null} /> : null}
        {zoom !== "minefield" ? <LeaderboardBoard game="race" {...race} now={now} size="projector" waiting={comp === null} /> : null}
      </div>
      <div className="ax-proj__toasts" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} className={`ax-proj__toast ax-proj__toast--${t.tone}`} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }}>
              {t.tone === "lead" ? <Crown aria-hidden /> : <TrendingUp aria-hidden />} {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
