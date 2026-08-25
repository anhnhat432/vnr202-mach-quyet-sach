"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { sampleRound, type TimelineEvent } from "@/features/arena/practice-events";

const ROUND_SIZE = 6;
const BEST_KEY = "vnr202:practice:dong-chay:best:v1";

type Phase = "idle" | "playing" | "result";

type Scored = {
  correctPositions: number;
  total: number;
  score: number;
  perfect: boolean;
};

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function scoreRound(order: TimelineEvent[], elapsed: number): Scored {
  const solution = [...order].sort((a, b) => a.sortKey - b.sortKey);
  let correctPositions = 0;
  order.forEach((event, index) => {
    if (solution[index]?.id === event.id) correctPositions += 1;
  });
  const total = order.length;
  const perfect = correctPositions === total;
  const accuracy = correctPositions * 130;
  const speedBonus = perfect ? Math.max(0, 220 - elapsed * 2) : 0;
  return { correctPositions, total, score: accuracy + speedBonus, perfect };
}

export function TimelineGame() {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const [order, setOrder] = useState<TimelineEvent[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<Scored | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const liveRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(BEST_KEY);
    const parsed = stored ? Number.parseInt(stored, 10) || null : null;
    const frame = window.requestAnimationFrame(() => setBest(parsed));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const startRound = useCallback(() => {
    setOrder(sampleRound(ROUND_SIZE));
    setElapsed(0);
    setResult(null);
    setPhase("playing");
  }, []);

  const move = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= order.length || from === to) return;
      setOrder((current) => {
        const next = [...current];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        if (liveRef.current) {
          liveRef.current.textContent = `${item.title} chuyển đến vị trí ${to + 1}`;
        }
        return next;
      });
    },
    [order.length],
  );

  const check = useCallback(() => {
    const scored = scoreRound(order, elapsed);
    setResult(scored);
    setPhase("result");
    setBest((current) => {
      const next = current === null ? scored.score : Math.max(current, scored.score);
      window.localStorage.setItem(BEST_KEY, String(next));
      return next;
    });
  }, [order, elapsed]);

  const solution =
    phase === "result" ? [...order].sort((a, b) => a.sortKey - b.sortKey) : [];
  const correctIdFor = (index: number) => solution[index]?.id;

  return (
    <section className="timeline-game" aria-label="Game Dòng Chảy Lịch Sử">
      <div className="timeline-game__hud" role="group" aria-label="Bảng điều khiển">
        <div className="timeline-game__stat">
          <span>Thời gian</span>
          <strong>{formatClock(elapsed)}</strong>
        </div>
        <div className="timeline-game__stat">
          <span>Số sự kiện</span>
          <strong>{phase === "idle" ? ROUND_SIZE : order.length}</strong>
        </div>
        <div className="timeline-game__stat">
          <span>Kỷ lục cục bộ</span>
          <strong>{best === null ? "—" : `${best} điểm`}</strong>
        </div>
      </div>

      {phase === "idle" && (
        <div className="timeline-game__intro">
          <p>
            Kéo thả hoặc dùng nút <span aria-hidden="true">↑ ↓</span> để xếp {ROUND_SIZE} sự kiện theo đúng thứ tự
            thời gian, từ sớm nhất đến muộn nhất. Bấm kiểm tra để chấm điểm.
          </p>
          <button className="scenario-action" type="button" onClick={startRound}>
            Bắt đầu luyện tập
          </button>
        </div>
      )}

      {phase !== "idle" && (
        <>
          <ol className="timeline-game__list" aria-label="Chuỗi sự kiện đang xếp">
            <AnimatePresence initial={false}>
              {order.map((event, index) => {
                const state =
                  phase === "result"
                    ? correctIdFor(index) === event.id
                      ? "correct"
                      : "wrong"
                    : "playing";
                return (
                  <motion.li
                    key={event.id}
                    layout={!reduceMotion}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="timeline-card"
                    data-state={state}
                    draggable={phase === "playing"}
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(dragEvent) => {
                      dragEvent.preventDefault();
                      if (dragIndex !== null && dragIndex !== index) {
                        move(dragIndex, index);
                        setDragIndex(index);
                      }
                    }}
                    onDragEnd={() => setDragIndex(null)}
                  >
                    <span className="timeline-card__rank">{index + 1}</span>
                    <span className="timeline-card__body">
                      <strong>{event.title}</strong>
                      {phase === "result" && (
                        <small>
                          {event.dateLabel}
                          {state === "wrong" && correctIdFor(index) ? " · đúng ra là sự kiện khác" : ""}
                        </small>
                      )}
                    </span>
                    {phase === "playing" && (
                      <span className="timeline-card__controls">
                        <button
                          type="button"
                          aria-label={`Chuyển "${event.title}" lên trên`}
                          disabled={index === 0}
                          onClick={() => move(index, index - 1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={`Chuyển "${event.title}" xuống dưới`}
                          disabled={index === order.length - 1}
                          onClick={() => move(index, index + 1)}
                        >
                          ↓
                        </button>
                      </span>
                    )}
                    {phase === "result" && (
                      <span className="timeline-card__mark" aria-hidden="true">
                        {state === "correct" ? "✓" : "✕"}
                      </span>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ol>
          <p ref={liveRef} className="sr-only" aria-live="polite" />
        </>
      )}

      <AnimatePresence>
        {phase === "result" && result && (
          <motion.div
            className="timeline-game__result"
            data-perfect={result.perfect}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <p className="scenario-kicker">{result.perfect ? "Hoàn hảo!" : "Kết quả vòng này"}</p>
            <div className="timeline-game__scoreline">
              <span>
                <b>{result.correctPositions}</b>/{result.total} đúng vị trí
              </span>
              <span>
                <b>{result.score}</b> điểm
              </span>
              <span>
                thời gian <b>{formatClock(elapsed)}</b>
              </span>
            </div>
            <button className="scenario-action" type="button" onClick={startRound}>
              Chơi lại vòng mới
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === "playing" && (
        <div className="timeline-game__footer">
          <button className="scenario-action" type="button" onClick={check}>
            Kiểm tra thứ tự
          </button>
        </div>
      )}
    </section>
  );
}
