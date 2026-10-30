"use client";

import { Bomb, Check, Gem, CircleQuestionMark, Shield, Timer, X, Zap } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { useArenaSound } from "@/features/arena/client/sound";
import type { BoardCell } from "@/features/arena/client/types";
import { useArenaGame, useNow } from "@/features/arena/client/use-arena-game";
import {
  ArenaFrame, ArenaTopBar, ConnectionBanner, DIFFICULTY_LABEL, FeedbackFlash, QuestionPanel, StandingChip, TransferDialog, questionLimitMs, useTransient,
} from "@/features/arena/ui/arena-ui";
import { FinishedScreen, GameIntro, StatusScreen } from "@/features/arena/ui/game-screens";

const COLS = 5;

function cellLabel(cell: BoardCell) {
  if (!cell.opened) return `Ô ${cell.index + 1}, chưa mở`;
  const names = { question: "câu hỏi", bomb: "bom", double: "x2", shield: "khiên", chest: "rương" } as const;
  const outcome = cell.outcome === "correct" ? ", đúng" : cell.outcome === "incorrect" ? ", sai" : cell.outcome === "timed_out" ? ", hết giờ" : "";
  return `Ô ${cell.index + 1}, ${names[cell.kind ?? "question"]}${cell.difficulty && cell.kind === "question" ? ` ${DIFFICULTY_LABEL[cell.difficulty]}` : ""}${outcome}`;
}

function CellFace({ cell, pending }: { cell: BoardCell; pending: boolean }) {
  if (!cell.opened) return <span className="ax-cell__seal"><span className="ax-cell__num">{cell.index + 1}</span><CircleQuestionMark aria-hidden /></span>;
  const mark = cell.outcome === "correct" ? <Check aria-hidden className="ax-mark ax-mark--ok" /> : cell.outcome === "incorrect" ? <X aria-hidden className="ax-mark ax-mark--bad" /> : cell.outcome === "timed_out" ? <Timer aria-hidden className="ax-mark ax-mark--late" /> : null;
  switch (cell.kind) {
    case "question":
      return <span className={`ax-cell__face ax-diff--${cell.difficulty}`}><b>{cell.difficulty ? DIFFICULTY_LABEL[cell.difficulty] : "?"}</b>{pending ? <em>đang mở</em> : mark}</span>;
    case "bomb":
      return <span className="ax-cell__face ax-cell__face--bomb"><Bomb aria-hidden />{pending ? <em>gỡ bom</em> : mark}</span>;
    case "chest":
      return <span className="ax-cell__face ax-cell__face--chest"><Gem aria-hidden /><b>+40</b></span>;
    case "shield":
      return <span className="ax-cell__face ax-cell__face--shield"><Shield aria-hidden /><b>Khiên</b></span>;
    case "double":
      return <span className="ax-cell__face ax-cell__face--double"><Zap aria-hidden /><b>x2</b></span>;
    default:
      return null;
  }
}

export function MinefieldGame() {
  const g = useArenaGame("minefield");
  const sound = useArenaSound();
  const now = useNow(100);
  const reduce = useReducedMotion();
  const flash = useTransient(g.feedback);
  const [focus, setFocus] = useState(0);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { play } = sound;

  useEffect(() => {
    const f = g.feedback;
    if (!f) return;
    if (f.kind === "cell") play(f.result.kind === "chest" ? "chest" : f.result.kind === "bomb" ? "bomb" : f.result.kind === "shield" ? "shield" : f.result.kind === "double" ? "combo" : "tick");
    if (f.kind === "answer") play(f.result.outcome === "correct" ? "correct" : "wrong");
    if (f.kind === "timeout") play("wrong");
  }, [g.feedback, play]);

  const p = g.projection;
  const attemptRemaining = g.attemptEndsAt === null ? null : Math.max(0, g.attemptEndsAt - now);

  if (g.phase === "loading" || g.phase === "signed_out" || g.phase === "no_competition" || g.phase === "error") {
    return <ArenaFrame game="minefield"><StatusScreen phase={g.phase} onRetry={g.reload} /></ArenaFrame>;
  }
  if (g.phase === "stale") {
    return <ArenaFrame game="minefield"><TransferDialog busy={g.busy} onConfirm={g.takeControl} /></ArenaFrame>;
  }
  if (g.phase === "intro" || !p) {
    return <ArenaFrame game="minefield"><GameIntro game="minefield" lobby={g.lobby} busy={g.busy} notice={g.notice} onStart={g.start} /></ArenaFrame>;
  }
  if (g.phase === "finished") {
    return <ArenaFrame game="minefield"><FinishedScreen game="minefield" projection={p} standing={g.standing} /></ArenaFrame>;
  }

  const board = p.board ?? [];
  const pending = p.interaction;
  const locked = Boolean(pending) || g.busy;

  const onGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLS, ArrowUp: -COLS };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = Math.min(19, Math.max(0, focus + moves[event.key]));
    setFocus(next);
    cellRefs.current[next]?.focus();
  };

  return (
    <ArenaFrame game="minefield">
      <ArenaTopBar title="Bãi Mìn Tri Thức" standing={p.competition.standing} attemptRemainingMs={attemptRemaining} score={p.attempt.score} connection={g.connection} sound={sound} />
      <ConnectionBanner connection={g.connection} />
      <div className="ax-mine">
        <aside className="ax-mine__hud" aria-label="Trạng thái lượt">
          <div className="ax-progress">
            <span>Câu chính</span>
            <strong>{p.attempt.mainAnswered}<small>/10</small></strong>
            <div className="ax-progress__ticks" aria-hidden>
              {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < p.attempt.mainAnswered ? "is-done" : ""} />)}
            </div>
          </div>
          <div className="ax-items">
            <div className={`ax-item ${p.attempt.shields ? "is-on" : ""}`} aria-label={`Khiên: ${p.attempt.shields ?? 0} trên 2`}>
              {[0, 1].map((i) => <Shield key={i} aria-hidden className={i < (p.attempt.shields ?? 0) ? "is-filled" : ""} />)}
              <span>Khiên</span>
            </div>
            <div className={`ax-item ax-item--double ${p.attempt.doubleArmed ? "is-on" : ""}`} aria-label={p.attempt.doubleArmed ? "x2 đang sẵn sàng" : "Chưa có x2"}>
              <Zap aria-hidden /><b>x2</b><span>{p.attempt.doubleArmed ? "Sẵn sàng" : "—"}</span>
            </div>
          </div>
          <StandingChip standing={g.standing} />
          <ul className="ax-legend" aria-label="Chú giải">
            <li><i className="ax-diff--easy" /> Dễ +100</li>
            <li><i className="ax-diff--medium" /> TB +200</li>
            <li><i className="ax-diff--hard" /> Khó +300</li>
          </ul>
        </aside>

        <div className="ax-board-wrap">
          <div className={`ax-board ${locked ? "is-locked" : ""}`} role="group" aria-label="Bàn cờ 4 × 5. Dùng phím mũi tên để di chuyển, Enter để mở ô." onKeyDown={onGridKey}>
            {board.map((cell) => {
              const isPending = Boolean(pending && cell.allocationId === pending.allocationId);
              return (
                <motion.button
                  key={`${cell.index}-${cell.opened}`}
                  ref={(el) => { cellRefs.current[cell.index] = el; }}
                  type="button"
                  className={`ax-cell ${cell.opened ? `is-open ax-cell--${cell.kind}` : ""} ${isPending ? "is-pending" : ""}`}
                  aria-label={cellLabel(cell)}
                  tabIndex={cell.index === focus ? 0 : -1}
                  onFocus={() => setFocus(cell.index)}
                  disabled={cell.opened ? false : locked}
                  aria-disabled={cell.opened || locked}
                  onClick={() => { if (!cell.opened && !locked) void g.openCell(cell.index); }}
                  initial={cell.opened && !reduce ? { rotateY: 90, scale: 0.9 } : false}
                  animate={{ rotateY: 0, scale: 1 }}
                  transition={{ duration: 0.32, ease: "easeOut" }}
                  whileHover={!cell.opened && !locked && !reduce ? { y: -3 } : undefined}
                >
                  <CellFace cell={cell} pending={isPending} />
                </motion.button>
              );
            })}
          </div>

          {pending ? (
            <div className="ax-overlay" role="dialog" aria-modal="false" aria-label={pending.role === "defuse" ? "Gỡ bom" : "Câu hỏi"}>
              {g.question && g.question.allocationId === pending.allocationId ? (
                <QuestionPanel
                  question={g.question}
                  endsAt={g.questionEndsAt}
                  now={now}
                  answering={g.answering}
                  onAnswer={g.answer}
                  tone={pending.role === "defuse" ? "defuse" : "main"}
                  limitMs={questionLimitMs("minefield", pending.role, pending.difficulty, pending.sequence)}
                  kicker={pending.role === "defuse"
                    ? <span className="ax-chip ax-chip--bomb"><Bomb aria-hidden size={14} /> Gỡ bom · A/B · 5 giây</span>
                    : <span className={`ax-chip ax-diff--${pending.difficulty}`}>{pending.difficulty ? DIFFICULTY_LABEL[pending.difficulty] : ""}{p.attempt.doubleArmed ? " · x2" : ""}</span>}
                />
              ) : (
                <div className="ax-reveal" aria-live="polite">
                  {pending.status === "expired" || pending.status === "unavailable" ? <strong>Hết giờ – đang chốt kết quả…</strong> : (
                    <>
                      <motion.span className="ax-reveal__icon" animate={reduce ? undefined : { rotate: [0, 8, -8, 0] }} transition={{ duration: 0.5 }}>
                        {pending.role === "defuse" ? <Bomb aria-hidden size={48} /> : <CircleQuestionMark aria-hidden size={48} />}
                      </motion.span>
                      <strong>{pending.role === "defuse" ? "BOM! Chuẩn bị gỡ…" : `Câu ${pending.difficulty ? DIFFICULTY_LABEL[pending.difficulty] : ""}`}</strong>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : null}
          <FeedbackFlash feedback={flash} game="minefield" />
        </div>
      </div>
    </ArenaFrame>
  );
}
