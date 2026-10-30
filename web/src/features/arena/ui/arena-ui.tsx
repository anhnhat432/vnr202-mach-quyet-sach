"use client";

import { ArrowLeft, Crown, MonitorSmartphone, Timer, TrendingUp, Volume2, VolumeX, Wifi, WifiOff } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import type { Feedback } from "@/features/arena/client/use-arena-game";
import type { Difficulty, Game, PlayerStanding, QuestionContent, Standing } from "@/features/arena/client/types";

import "./arena.css";

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Dễ", medium: "Trung bình", hard: "Khó" };
export const STANDING_LABEL: Record<Standing, string> = { rehearsal: "Diễn tập", provisional: "Tạm thời", official: "Chính thức" };

export function formatClock(ms: number, tenths = false) {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const base = `${m}:${String(s).padStart(2, "0")}`;
  return tenths && safe < 10_000 ? `${Math.floor(safe / 1000)}.${Math.floor((safe % 1000) / 100)}` : base;
}

// Display scale for the countdown bar only (the server owns every deadline). Game 2 difficulty
// follows the fixed 5/7/3 order, so it is known from the sequence without asking the server.
export function questionLimitMs(game: Game, role: "main" | "defuse", difficulty: Difficulty | undefined, sequence: number) {
  if (role === "defuse") return 5000;
  if (game === "minefield") return difficulty === "hard" ? 10000 : difficulty === "medium" ? 8000 : 6000;
  return sequence > 12 ? 9000 : sequence > 5 ? 7000 : 5000;
}

export function raceDifficulty(sequence: number): Difficulty {
  return sequence > 12 ? "hard" : sequence > 5 ? "medium" : "easy";
}

// Full-screen arena surface laid over the site chrome; leaving goes back to the hub.
export function ArenaFrame({ game, children, className }: { game: "minefield" | "race"; children: ReactNode; className?: string }) {
  return (
    <div className={`ax-frame ax-frame--${game} ${className ?? ""}`} data-game={game}>
      <div className="ax-frame__bg" aria-hidden />
      {children}
    </div>
  );
}

export function ArenaTopBar(props: {
  title: string;
  standing?: Standing;
  attemptRemainingMs?: number | null;
  score?: number;
  connection: "online" | "reconnecting";
  sound: { enabled: boolean; toggle: () => void };
  children?: ReactNode;
}) {
  const low = props.attemptRemainingMs !== null && props.attemptRemainingMs !== undefined && props.attemptRemainingMs < 20_000;
  return (
    <header className="ax-top">
      <Link className="ax-top__back" href="/live-arena" aria-label="Về sảnh Live Arena">
        <ArrowLeft aria-hidden size={18} />
      </Link>
      <div className="ax-top__title">
        <strong>{props.title}</strong>
        {props.standing ? <span className={`ax-badge ax-badge--${props.standing}`}>{STANDING_LABEL[props.standing]}</span> : null}
      </div>
      {props.children}
      {props.attemptRemainingMs !== undefined && props.attemptRemainingMs !== null ? (
        <div className={`ax-clock ${low ? "is-low" : ""}`} role="timer" aria-label={`Thời gian còn lại ${formatClock(props.attemptRemainingMs)}`}>
          <Timer aria-hidden size={18} />
          <span>{formatClock(props.attemptRemainingMs)}</span>
        </div>
      ) : null}
      {props.score !== undefined ? (
        <div className="ax-score" aria-label={`Điểm ${props.score}`}>
          <motion.span key={props.score} initial={{ y: -6, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }}>
            {props.score.toLocaleString("vi-VN")}
          </motion.span>
          <small>điểm</small>
        </div>
      ) : null}
      <span className={`ax-net ${props.connection === "online" ? "is-online" : "is-off"}`} title={props.connection === "online" ? "Đã kết nối" : "Mất kết nối – đang thử lại"}>
        {props.connection === "online" ? <Wifi aria-hidden size={16} /> : <WifiOff aria-hidden size={16} />}
        <span className="sr-only">{props.connection === "online" ? "Đã kết nối" : "Mất kết nối, đang thử lại. Đồng hồ vẫn chạy trên máy chủ."}</span>
      </span>
      <button type="button" className="ax-icon-btn" onClick={props.sound.toggle} aria-pressed={props.sound.enabled} aria-label={props.sound.enabled ? "Tắt âm thanh" : "Bật âm thanh"}>
        {props.sound.enabled ? <Volume2 aria-hidden size={18} /> : <VolumeX aria-hidden size={18} />}
      </button>
    </header>
  );
}

export function ConnectionBanner({ connection }: { connection: "online" | "reconnecting" }) {
  return (
    <AnimatePresence>
      {connection === "reconnecting" ? (
        <motion.div className="ax-banner" role="status" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}>
          <WifiOff aria-hidden size={16} /> Mất kết nối – đang thử lại. Đồng hồ trên máy chủ vẫn chạy.
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function StandingChip({ standing }: { standing: PlayerStanding | null }) {
  if (!standing || standing.rank === null) return null;
  let detail = "";
  if (standing.label === "leading_alone") detail = "Đang dẫn đầu";
  else if (standing.label === "tied_first") detail = "Đồng hạng 1";
  else if (standing.label === "leading") detail = `Dẫn trước hạng 2: ${standing.leadOverSecond ?? 0} điểm`;
  else if (typeof standing.gapToTenth === "number") detail = `Cách hạng 10: ${standing.gapToTenth} điểm`;
  else if (typeof standing.gapToAbove === "number") detail = `Cách người trên: ${standing.gapToAbove} điểm`;
  return (
    <div className="ax-standing" aria-live="polite">
      {standing.rank === 1 ? <Crown aria-hidden size={16} /> : <TrendingUp aria-hidden size={16} />}
      <strong>Hạng {standing.rank}</strong>
      {standing.players ? <span>/{standing.players}</span> : null}
      {detail ? <em>{detail}</em> : null}
    </div>
  );
}

// The question as released by the server. Options keep the server's per-attempt order; letters carry
// no meaning across attempts. Keys 1-3 / A-C answer; nothing here knows the correct option.
export function QuestionPanel(props: {
  question: QuestionContent;
  endsAt: number | null;
  now: number;
  answering: boolean;
  onAnswer: (optionId: string) => void;
  tone?: "defuse" | "main";
  kicker?: ReactNode;
  limitMs: number;
}) {
  const { question, endsAt, now, answering, onAnswer, limitMs } = props;
  const reduce = useReducedMotion();
  const remaining = endsAt === null ? question.remainingMs : Math.max(0, endsAt - now);
  const ratio = Math.max(0, Math.min(1, remaining / Math.max(1, limitMs)));
  const expired = remaining <= 0;
  const firstButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    firstButton.current?.focus({ preventScroll: true });
  }, [question.allocationId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (answering || expired || event.metaKey || event.ctrlKey || event.altKey) return;
      const k = event.key.toLowerCase();
      const index = ["1", "2", "3"].indexOf(k) >= 0 ? ["1", "2", "3"].indexOf(k) : ["a", "b", "c"].indexOf(k);
      if (index >= 0 && question.options[index]) {
        event.preventDefault();
        onAnswer(question.options[index].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answering, expired, onAnswer, question.options]);

  return (
    <motion.section
      key={question.allocationId}
      className={`ax-question ${props.tone === "defuse" ? "ax-question--defuse" : ""} ${expired ? "is-expired" : ""}`}
      aria-labelledby={`q-${question.allocationId}`}
      initial={reduce ? false : { opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="ax-question__meter" aria-hidden>
        <span style={{ transform: `scaleX(${ratio})` }} className={ratio < 0.3 ? "is-low" : ""} />
      </div>
      <div className="ax-question__head">
        {props.kicker}
        <span className={`ax-question__time ${ratio < 0.3 ? "is-low" : ""}`} role="timer" aria-label={`Còn ${Math.ceil(remaining / 1000)} giây`}>
          {expired ? "Hết giờ" : formatClock(remaining, true)}
        </span>
      </div>
      <h2 id={`q-${question.allocationId}`} className="ax-question__prompt">{question.prompt}</h2>
      <div className={`ax-options ax-options--${question.options.length}`} role="group" aria-label="Chọn đáp án">
        {question.options.map((option, index) => (
          <button
            key={option.id}
            ref={index === 0 ? firstButton : undefined}
            type="button"
            className="ax-option"
            disabled={answering || expired}
            onClick={() => onAnswer(option.id)}
          >
            <kbd>{String.fromCharCode(65 + index)}</kbd>
            <span>{option.label}</span>
          </button>
        ))}
      </div>
      <p className="ax-hint">
        Phím <kbd>A</kbd>/<kbd>B</kbd>{question.options.length > 2 ? <>/<kbd>C</kbd></> : null} hoặc <kbd>1</kbd>–<kbd>{question.options.length}</kbd> để chọn
      </p>
    </motion.section>
  );
}

// Short, non-blocking result flash (LA-FB-001/002): correct / wrong / timeout and points only.
export function FeedbackFlash({ feedback, game, placement = "center" }: { feedback: Feedback | null; game: "minefield" | "race"; placement?: "center" | "top" }) {
  const reduce = useReducedMotion();
  let content: { tone: string; title: string; detail?: string } | null = null;
  if (feedback?.kind === "timeout") content = { tone: "timeout", title: "Hết giờ" };
  if (feedback?.kind === "answer") {
    const r = feedback.result;
    if (r.role === "defuse") {
      content = r.outcome === "correct"
        ? { tone: "good", title: "Gỡ bom thành công" }
        : r.effect === "shield_consumed"
          ? { tone: "shield", title: r.outcome === "timed_out" ? "Hết giờ – khiên đã đỡ" : "Khiên đã đỡ quả bom" }
          : { tone: "bad", title: "Bom nổ!", detail: r.awardedPoints < 0 ? `${r.awardedPoints} điểm` : "Điểm không xuống dưới 0" };
    } else if (r.outcome === "correct") {
      const bonus = [r.doubleApplied ? "x2" : null, r.comboBonus ? `Combo +${r.comboBonus}` : null].filter(Boolean).join(" · ");
      content = { tone: "good", title: `Chính xác +${r.awardedPoints}`, detail: bonus || undefined };
    } else {
      content = { tone: r.outcome === "timed_out" ? "timeout" : "bad", title: r.outcome === "timed_out" ? "Hết giờ" : "Chưa chính xác", detail: game === "race" ? "Chuỗi combo về 0" : undefined };
    }
  }
  if (feedback?.kind === "cell") {
    const c = feedback.result;
    if (c.kind === "chest") content = { tone: "chest", title: "Rương +40" };
    if (c.kind === "shield") content = { tone: "shield", title: "Nhận khiên" };
    if (c.kind === "double") content = { tone: "double", title: "x2 cho câu tiếp theo" };
    if (c.kind === "bomb") content = { tone: "bad", title: "Bom! Gỡ ngay" };
  }
  const key = feedback ? `${feedback.kind}-${feedback.at}` : "none";
  return (
    <div className={`ax-flash-wrap ax-flash-wrap--${placement}`} aria-live="assertive">
      <AnimatePresence>
        {content ? (
          <motion.div
            key={key}
            className={`ax-flash ax-flash--${content.tone}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.16 }}
          >
            <strong>{content.title}</strong>
            {content.detail ? <span>{content.detail}</span> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// Keeps a value visible for `ms` after it changes, without blocking anything (LA-FB-002).
export function useTransient<T>(value: T | null, ms = 950): T | null {
  const [shown, setShown] = useState<T | null>(null);
  useEffect(() => {
    if (!value) return;
    const show = window.setTimeout(() => setShown(value), 0);
    const hide = window.setTimeout(() => setShown((current) => (current === value ? null : current)), ms);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [value, ms]);
  return shown;
}

export function TransferDialog({ busy, onConfirm }: { busy: boolean; onConfirm: () => void }) {
  const button = useRef<HTMLButtonElement | null>(null);
  useEffect(() => button.current?.focus(), []);
  return (
    <div className="ax-modal" role="dialog" aria-modal="true" aria-labelledby="transfer-title">
      <div className="ax-modal__card">
        <MonitorSmartphone aria-hidden size={40} />
        <h2 id="transfer-title">Lượt thi đang mở ở thiết bị khác</h2>
        <p>
          Bạn có muốn tiếp tục lượt thi trên thiết bị này không? Thiết bị kia sẽ không thao tác được nữa.
          Đồng hồ không dừng và không có lượt mới; điểm và câu hỏi giữ nguyên.
        </p>
        <div className="ax-modal__actions">
          <Link className="ax-btn ax-btn--ghost" href="/live-arena">Để sau</Link>
          <button ref={button} type="button" className="ax-btn ax-btn--primary" onClick={onConfirm} disabled={busy}>
            {busy ? "Đang chuyển…" : "Chuyển sang thiết bị này"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CenterCard({ children }: { children: ReactNode }) {
  return <div className="ax-center"><div className="ax-center__card">{children}</div></div>;
}
