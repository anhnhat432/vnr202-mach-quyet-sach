"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

import { ChapterEmblem } from "@/features/brand/artwork";
import { MOMENTS, type DecisionMoment } from "@/features/moments/moments";

const VOTES_KEY = "vnr202:moments:votes:v1";

type Scope = "all" | 1 | 2 | 3;

type VoteStore = Record<string, Record<string, number>>;

function readVotes(): VoteStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(VOTES_KEY);
    return raw ? (JSON.parse(raw) as VoteStore) : {};
  } catch {
    return {};
  }
}

/** Ghi một phiếu và trả về phần trăm cho mỗi lựa chọn (đã gộp phiếu mồi + phiếu thật). */
function castVote(moment: DecisionMoment, choiceId: string): Record<string, number> {
  const store = readVotes();
  const current = store[moment.id] ?? {};
  const merged: Record<string, number> = {};
  let total = 0;
  for (const choice of moment.choices) {
    const value = (moment.seedVotes[choice.id] ?? 0) + (current[choice.id] ?? 0) + (choice.id === choiceId ? 1 : 0);
    merged[choice.id] = value;
    total += value;
  }
  const nextCurrent = { ...current, [choiceId]: (current[choiceId] ?? 0) + 1 };
  try {
    window.localStorage.setItem(VOTES_KEY, JSON.stringify({ ...store, [moment.id]: nextCurrent }));
  } catch {
    // Bỏ qua nếu trình duyệt chặn localStorage — trải nghiệm vẫn chạy với phiếu mồi.
  }
  const percents: Record<string, number> = {};
  for (const choice of moment.choices) {
    percents[choice.id] = total > 0 ? Math.round((merged[choice.id] / total) * 100) : 0;
  }
  return percents;
}

const CHAPTERS: Array<{ scope: Scope; glyph: string; title: string; note: string }> = [
  { scope: 1, glyph: "🚩", title: "Chương 1 · Giành chính quyền", note: "1930 – 1945 · 5 khoảnh khắc" },
  { scope: 2, glyph: "🕊️", title: "Chương 2 · Kháng chiến & thống nhất", note: "1945 – 1975 · 5 khoảnh khắc" },
  { scope: 3, glyph: "🌅", title: "Chương 3 · Đổi mới", note: "1975 – nay · 5 khoảnh khắc" },
  { scope: "all", glyph: "🎲", title: "Chơi tất cả", note: "Cả 15 khoảnh khắc, một mạch" },
];

export function DecisionMomentPlayer() {
  const reduceMotion = useReducedMotion();
  const [scope, setScope] = useState<Scope | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [percents, setPercents] = useState<Record<string, number>>({});
  const [showWhy, setShowWhy] = useState(false);
  const [earned, setEarned] = useState(0);
  const [finished, setFinished] = useState(false);
  const seen = useRef<Set<string>>(new Set());

  const list = useMemo(
    () => (scope === null || scope === "all" ? MOMENTS : MOMENTS.filter((item) => item.chapter === scope)),
    [scope],
  );
  const moment = list[index];
  const total = list.length;
  const matched = moment ? picked === moment.historicalChoiceId : false;

  const choose = useCallback(
    (choiceId: string) => {
      if (picked || !moment) return;
      setPicked(choiceId);
      setPercents(castVote(moment, choiceId));
      if (!seen.current.has(moment.id)) {
        seen.current.add(moment.id);
        setEarned((value) => value + 1);
      }
    },
    [moment, picked],
  );

  const next = useCallback(() => {
    if (index + 1 >= total) {
      setFinished(true);
      return;
    }
    setIndex((value) => value + 1);
    setPicked(null);
    setPercents({});
    setShowWhy(false);
  }, [index, total]);

  const start = useCallback((chosen: Scope) => {
    seen.current = new Set();
    setScope(chosen);
    setIndex(0);
    setPicked(null);
    setPercents({});
    setShowWhy(false);
    setEarned(0);
    setFinished(false);
  }, []);

  const backToMenu = useCallback(() => {
    setScope(null);
    setFinished(false);
  }, []);

  const enter = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
      };

  // ---- Màn chọn nhanh (nhẹ, không ép đi hết) ----
  if (scope === null) {
    return (
      <section className="moment-stage" aria-label="Chọn phần muốn chơi">
        <p className="moment-menu-hint">Chọn một chương để chơi nhanh — hoặc chơi tất cả.</p>
        <div className="moment-menu">
          {CHAPTERS.map((item) => (
            <button key={String(item.scope)} type="button" className="moment-menu__card" data-scope={String(item.scope)} onClick={() => start(item.scope)}>
              <span className="moment-menu__glyph" aria-hidden="true">
                {item.scope === "all" ? (
                  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="5" width="9" height="9" rx="1.6" />
                    <rect x="18" y="5" width="9" height="9" rx="1.6" />
                    <rect x="5" y="18" width="9" height="9" rx="1.6" />
                    <rect x="18" y="18" width="9" height="9" rx="1.6" />
                  </svg>
                ) : (
                  <ChapterEmblem chapter={item.scope} />
                )}
              </span>
              <strong>{item.title}</strong>
              <small>{item.note}</small>
            </button>
          ))}
        </div>
      </section>
    );
  }

  // ---- Màn tổng kết ----
  if (finished) {
    const rank = earned >= 5 ? "Bậc thầy quyết sách" : earned >= 3 ? "Nhà chiến lược lịch sử" : "Người ra quyết định";
    return (
      <section className="moment-stage" aria-label="Kết quả hành trình">
        <motion.div className="moment-summary" {...enter}>
          <span className="moment-summary__spark" aria-hidden="true">🎉</span>
          <p className="moment-kicker">Bạn đã đi qua {total} khúc quyết định của lịch sử</p>
          <h2>{rank}</h2>
          <p className="moment-summary__badges">
            <b>{earned}</b> huy hiệu quyết sách
          </p>
          <p className="moment-summary__note">Mỗi lựa chọn của lịch sử đều có lý do — và giờ bạn đã tự mình đi qua chúng.</p>
          <div className="moment-summary__actions">
            <button className="moment-btn moment-btn--go" type="button" onClick={backToMenu}>
              Chơi chương khác
            </button>
            <Link className="moment-btn moment-btn--ghost" href="/ho-so">
              Đào sâu 15 hồ sơ →
            </Link>
          </div>
        </motion.div>
      </section>
    );
  }

  if (!moment) return null;

  return (
    <section className="moment-stage" aria-label="Khoảnh khắc quyết sách">
      <div className="moment-topbar">
        <div className="moment-progress" aria-label={`Khoảnh khắc ${index + 1} trên ${total}`}>
          <span className="moment-progress__count">{index + 1}/{total}</span>
          <span className="moment-progress__track">
            <span className="moment-progress__fill" style={{ width: `${(index / total) * 100}%` }} />
          </span>
        </div>
        <span className="moment-badge-chip" aria-live="polite">
          <span aria-hidden="true">🏅</span> {earned} huy hiệu
        </span>
      </div>

      <motion.article
        key={moment.id}
        className="moment-card"
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="moment-kicker">{moment.chapterLabel} · {moment.year}</p>
        <h2 className="moment-title">{moment.title}</h2>
        <p className="moment-setup">{moment.setup}</p>

        {!picked && (
          <div className="moment-ask">
            <p className="moment-prompt">{moment.prompt}</p>
            <div className="moment-choices">
              {moment.choices.map((choice) => (
                <button key={choice.id} type="button" className="moment-choice" onClick={() => choose(choice.id)}>
                  <span className="moment-choice__glyph" aria-hidden="true">{choice.glyph}</span>
                  <span className="moment-choice__label">{choice.label}</span>
                </button>
              ))}
            </div>
            <p className="moment-hint">Không có câu trả lời sai — cứ chọn theo trực giác 👆</p>
          </div>
        )}

        {picked && (
          <motion.div
            className="moment-reveal"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            aria-live="polite"
          >
            <p className="moment-verdict" data-match={matched}>
              {matched ? "🎉 Bạn nghĩ như lịch sử!" : "🤔 Khác lịch sử một chút — xem nhé"}
            </p>

            <ul className="moment-bars">
              {moment.choices.map((choice) => {
                const isHistory = choice.id === moment.historicalChoiceId;
                const isMine = choice.id === picked;
                const pct = percents[choice.id] ?? 0;
                return (
                  <li key={choice.id} data-history={isHistory} data-mine={isMine}>
                    <div className="moment-bars__head">
                      <span>
                        <span aria-hidden="true">{choice.glyph}</span> {choice.label}
                        {isHistory && <b className="moment-tag moment-tag--history">Lịch sử chọn ✓</b>}
                        {isMine && <b className="moment-tag moment-tag--mine">Bạn chọn</b>}
                      </span>
                      <strong>{pct}%</strong>
                    </div>
                    <div className="moment-bars__track">
                      <motion.span
                        className="moment-bars__fill"
                        initial={reduceMotion ? false : { width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="moment-bars__note">Tỷ lệ trong số người đã chơi trên thiết bị này.</p>

            <div className="moment-fact">
              <p>{moment.fact}</p>
            </div>

            <button
              type="button"
              className="moment-more"
              aria-expanded={showWhy}
              onClick={() => setShowWhy((value) => !value)}
            >
              {showWhy ? "Thu gọn" : "😲 Vì sao lại thế?"}
            </button>
            {showWhy && (
              <div className="moment-why">
                <p>{moment.why}</p>
                <p className="moment-source">Nguồn: {moment.source}</p>
              </div>
            )}

            <div className="moment-reveal__actions">
              <button className="moment-btn moment-btn--go" type="button" onClick={next}>
                {index + 1 >= total ? "Xem kết quả 🎊" : "Khoảnh khắc tiếp theo →"}
              </button>
            </div>
          </motion.div>
        )}
      </motion.article>
    </section>
  );
}
