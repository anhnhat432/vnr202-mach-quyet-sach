"use client";

import { ArrowUp, Check, Crown, Radio, Timer } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import type { Game, Leaderboard } from "@/features/arena/client/types";
import type { RankChange } from "@/features/arena/client/use-leaderboard";
import { STANDING_LABEL, formatClock } from "@/features/arena/ui/arena-ui";

import "./arena.css";

export const GAME_TITLE: Record<Game, string> = { minefield: "Bãi Mìn Tri Thức", race: "Đường Đua Lịch Sử" };
const RECENT_MS = 4000;

// One game's Top 10 (LA-LB-003): classroom display names only, shared ranks shown as given by the
// server, row movement animated from two consecutive authoritative boards.
export function LeaderboardBoard(props: {
  game: Game;
  board: Leaderboard | null;
  changes: Record<string, RankChange>;
  channel: "live" | "polling";
  online: boolean;
  now: number;
  size?: "page" | "projector";
}) {
  const { game, board, changes, now } = props;
  const reduce = useReducedMotion();
  const total = game === "minefield" ? 10 : 15;
  return (
    <section className={`ax-lb ax-lb--${props.size ?? "page"} ax-lb--${game}`} aria-labelledby={`lb-${game}`}>
      <header className="ax-lb__head">
        <div>
          <h2 id={`lb-${game}`}>{GAME_TITLE[game]}</h2>
          <p>
            {board ? <>{board.players} người chơi · {board.completed} đã xong</> : "Đang tải…"}
          </p>
        </div>
        <div className="ax-lb__meta">
          {board ? <span className={`ax-badge ax-badge--${board.standing}`}>{STANDING_LABEL[board.standing]}</span> : null}
          <span className={`ax-live ${props.online ? (props.channel === "live" ? "is-live" : "is-poll") : "is-off"}`} title={props.channel === "live" ? "Cập nhật trực tiếp" : "Đồng bộ định kỳ"}>
            <Radio aria-hidden size={14} /> {props.online ? (props.channel === "live" ? "Trực tiếp" : "Đồng bộ") : "Mất kết nối"}
          </span>
        </div>
      </header>
      {board && board.entries.length === 0 ? <p className="ax-lb__empty">Chưa có ai bắt đầu lượt.</p> : null}
      <ol className="ax-lb__rows">
        <AnimatePresence initial={false}>
          {board?.entries.map((e) => {
            const change = changes[e.entryId];
            const recent = change && now - change.at < RECENT_MS && change.delta > 0;
            return (
              <motion.li
                key={e.entryId}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
                className={`ax-lb__row ${e.rank === 1 ? "is-first" : ""} ${recent ? "is-up" : ""}`}
              >
                <span className="ax-lb__rank">{e.rank === 1 ? <Crown aria-hidden size={18} /> : null}{e.rank}</span>
                <span className="ax-lb__name">{e.displayName}</span>
                <span className="ax-lb__state" aria-label={e.state === "playing" ? "Đang chơi" : e.state === "completed" ? "Đã hoàn thành" : "Hết giờ"}>
                  {e.state === "playing" ? <span className="ax-lb__dot" /> : e.state === "completed" ? <Check aria-hidden size={16} /> : <Timer aria-hidden size={16} />}
                  <small>{e.state === "playing" ? `${e.progress}/${total}` : e.completionDurationMs !== null ? formatClock(e.completionDurationMs) : ""}</small>
                </span>
                {recent ? <span className="ax-lb__up"><ArrowUp aria-hidden size={14} />{change.delta}</span> : <span className="ax-lb__up" aria-hidden />}
                <motion.strong key={e.score} className="ax-lb__score" initial={reduce ? false : { scale: 1.25, color: "#f0aa3c" }} animate={{ scale: 1, color: "#f3ebdd" }}>
                  {e.score.toLocaleString("vi-VN")}
                </motion.strong>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </section>
  );
}
