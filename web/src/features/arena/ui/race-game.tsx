"use client";

import { Flag, Flame, Gauge } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";

import { useArenaSound } from "@/features/arena/client/sound";
import { useArenaGame, useNow } from "@/features/arena/client/use-arena-game";
import {
  ArenaFrame, ArenaTopBar, ConnectionBanner, DIFFICULTY_LABEL, FeedbackFlash, QuestionPanel, StandingChip, TransferDialog, questionLimitMs, raceDifficulty, useTransient,
} from "@/features/arena/ui/arena-ui";
import { FinishedScreen, GameIntro, StatusScreen } from "@/features/arena/ui/game-screens";

const TOTAL = 15;

// The track shows the player's own progress through 15 questions; it never simulates other players
// racing at the same time (RACE-010): starts are individual.
function Track({ answered, current, reduce }: { answered: number; current: number | null; reduce: boolean | null }) {
  const position = Math.min(TOTAL, current ?? answered + 1);
  const pct = ((position - 1) / (TOTAL - 1)) * 100;
  return (
    <div className="ax-track" aria-label={`Tiến độ: đã xử lý ${answered} trên ${TOTAL} câu`}>
      <div className="ax-track__lane">
        <div className="ax-track__sprint" aria-hidden><span>NƯỚC RÚT</span></div>
        <motion.div className="ax-track__fill" initial={false} animate={{ width: `${pct}%` }} transition={{ duration: reduce ? 0 : 0.5, ease: "easeOut" }} />
        <ol className="ax-track__nodes">
          {Array.from({ length: TOTAL }, (_, i) => {
            const seq = i + 1;
            const state = seq <= answered ? "done" : seq === position ? "current" : "next";
            return (
              <li key={seq} className={`ax-node ax-node--${state} ax-diff--${raceDifficulty(seq)}`}>
                <span>{seq}</span>
              </li>
            );
          })}
        </ol>
        <motion.div className="ax-runner" aria-hidden initial={false} animate={{ left: `${pct}%` }} transition={{ type: reduce ? false : "spring", stiffness: 120, damping: 18 }}>
          <Gauge />
        </motion.div>
      </div>
      <div className="ax-track__labels" aria-hidden>
        <span>Dễ · +100</span><span>Trung bình · +150</span><span>Khó · +200</span><Flag size={16} />
      </div>
    </div>
  );
}

function Combo({ streak, awards }: { streak: number; awards: number }) {
  const inSet = streak % 3;
  return (
    <div className={`ax-combo ${streak > 0 ? "is-hot" : ""}`} aria-label={`Chuỗi đúng ${streak}, đã nhận ${awards} lần combo`}>
      <Flame aria-hidden />
      <div className="ax-combo__dots" aria-hidden>
        {[0, 1, 2].map((i) => <i key={i} className={i < inSet || (streak > 0 && inSet === 0) ? "is-lit" : ""} />)}
      </div>
      <span>Chuỗi <b>{streak}</b></span>
      <span className="ax-combo__awards">Combo {awards}/5</span>
    </div>
  );
}

export function RaceGame() {
  const g = useArenaGame("race");
  const sound = useArenaSound();
  const now = useNow(100);
  const reduce = useReducedMotion();
  const transient = useTransient(g.feedback, 850);
  // LA-FB-002: feedback never covers the next question; it disappears as soon as that question shows.
  const flash = transient && !(transient.kind === "answer" && g.question && g.question.allocationId !== transient.result.allocationId) ? transient : null;
  const { play } = sound;

  useEffect(() => {
    const f = g.feedback;
    if (f?.kind === "answer") play(f.result.comboBonus ? "combo" : f.result.outcome === "correct" ? "correct" : "wrong");
    if (f?.kind === "timeout") play("wrong");
  }, [g.feedback, play]);

  const p = g.projection;
  const attemptRemaining = g.attemptEndsAt === null ? null : Math.max(0, g.attemptEndsAt - now);

  if (g.phase === "loading" || g.phase === "signed_out" || g.phase === "no_competition" || g.phase === "error") {
    return <ArenaFrame game="race"><StatusScreen phase={g.phase} onRetry={g.reload} /></ArenaFrame>;
  }
  if (g.phase === "stale") return <ArenaFrame game="race"><TransferDialog busy={g.busy} onConfirm={g.takeControl} /></ArenaFrame>;
  if (g.phase === "intro" || !p) return <ArenaFrame game="race"><GameIntro game="race" lobby={g.lobby} busy={g.busy} notice={g.notice} onStart={g.start} /></ArenaFrame>;
  if (g.phase === "finished") return <ArenaFrame game="race"><FinishedScreen game="race" projection={p} standing={g.standing} /></ArenaFrame>;

  const it = p.interaction;
  const seq = it?.sequence ?? null;
  const sprint = (seq ?? 0) >= 13;
  const showQuestion = g.question && it && g.question.allocationId === it.allocationId;

  return (
    <ArenaFrame game="race" className={sprint ? "is-sprint" : ""}>
      <ArenaTopBar title="Đường Đua Lịch Sử" standing={p.competition.standing} attemptRemainingMs={attemptRemaining} score={p.attempt.score} connection={g.connection} sound={sound} />
      <ConnectionBanner connection={g.connection} />
      <div className="ax-race">
        <Track answered={p.attempt.mainAnswered} current={seq} reduce={reduce} />
        <div className="ax-race__bar">
          <Combo streak={p.attempt.streak ?? 0} awards={p.attempt.comboAwards ?? 0} />
          <StandingChip standing={g.standing} />
        </div>
        <div className="ax-race__stage">
          <AnimatePresence>
          {sprint && seq === 13 && !reduce ? (
            <motion.div key="sprint" className="ax-sprint-banner" initial={{ x: "-100%" }} animate={{ x: "0%" }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
              NƯỚC RÚT · 3 câu Khó · +200
            </motion.div>
          ) : null}
        </AnimatePresence>
          {showQuestion && it ? (
            <QuestionPanel
              question={g.question!}
              endsAt={g.questionEndsAt}
              now={now}
              answering={g.answering}
              onAnswer={g.answer}
              limitMs={questionLimitMs("race", "main", undefined, it.sequence)}
              kicker={<span className={`ax-chip ax-diff--${raceDifficulty(it.sequence)}`}>Câu {it.sequence}/15 · {DIFFICULTY_LABEL[raceDifficulty(it.sequence)]}</span>}
            />
          ) : (
            <div className="ax-reveal" aria-live="polite">
              {it?.status === "expired" ? <strong>Hết giờ – câu tiếp theo đang đến…</strong> : <strong>{seq ? `Câu ${seq} sắp xuất hiện…` : "Đang đồng bộ…"}</strong>}
            </div>
          )}
          <FeedbackFlash feedback={flash} game="race" placement="top" />
        </div>
      </div>
    </ArenaFrame>
  );
}
