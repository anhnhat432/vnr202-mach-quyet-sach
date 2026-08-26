"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import {
  CLAMP_MAX,
  CLAMP_MIN,
  LESSON,
  METERS,
  ROUNDS,
  type CrisisChoice,
  type MeterId,
} from "@/features/crisis/crisis-scenario";

type Phase = "intro" | "round" | "consequence" | "ending";
type Meters = Record<MeterId, number>;
type Pick = { roundId: string; choice: CrisisChoice };

const startMeters = (): Meters =>
  METERS.reduce((acc, meter) => {
    acc[meter.id] = meter.start;
    return acc;
  }, {} as Meters);

const clamp = (value: number) => Math.max(CLAMP_MIN, Math.min(CLAMP_MAX, value));

function meterState(value: number): "ok" | "warn" | "dead" {
  if (value <= 0) return "dead";
  if (value <= 18) return "warn";
  return "ok";
}

const ease = [0.22, 1, 0.36, 1] as const;

function CrisisHud({ meters, big = false }: { meters: Meters; big?: boolean }) {
  return (
    <div className={`crisis-hud${big ? " crisis-hud--big" : ""}`} aria-label="Trạng thái đất nước">
      {METERS.map((meter) => {
        const value = meters[meter.id];
        const status = meterState(value);
        return (
          <div className="crisis-meter" data-meter={meter.id} data-status={status} key={meter.id}>
            <div className="crisis-meter__top">
              <span className="crisis-meter__label">
                <span aria-hidden="true">{meter.glyph}</span> {meter.label}
              </span>
              <span className="crisis-meter__value">{value}</span>
            </div>
            <div className="crisis-meter__track">
              <span className="crisis-meter__fill" style={{ width: `${value}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CrisisGame() {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("intro");
  const [roundIndex, setRoundIndex] = useState(0);
  const [meters, setMeters] = useState<Meters>(startMeters);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [collapsed, setCollapsed] = useState<MeterId | null>(null);

  const round = ROUNDS[roundIndex];
  const lastPick = picks[picks.length - 1] ?? null;
  const historicalCount = useMemo(() => picks.filter((p) => p.choice.historical).length, [picks]);

  const start = useCallback(() => {
    setMeters(startMeters());
    setPicks([]);
    setCollapsed(null);
    setRoundIndex(0);
    setPhase("round");
  }, []);

  const choose = useCallback(
    (choice: CrisisChoice) => {
      setMeters((current) => {
        const next = { ...current };
        let firstDead: MeterId | null = null;
        for (const meter of METERS) {
          const delta = choice.effects[meter.id] ?? 0;
          next[meter.id] = clamp(current[meter.id] + delta);
          if (next[meter.id] <= 0 && firstDead === null) firstDead = meter.id;
        }
        if (firstDead) setCollapsed((prev) => prev ?? firstDead);
        return next;
      });
      setPicks((prev) => [...prev, { roundId: round.id, choice }]);
      setPhase("consequence");
    },
    [round],
  );

  const advance = useCallback(() => {
    if (roundIndex + 1 >= ROUNDS.length) {
      setPhase("ending");
      return;
    }
    setRoundIndex((value) => value + 1);
    setPhase("round");
  }, [roundIndex]);

  const enter = reduceMotion
    ? {}
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, ease } };

  // ---------- Màn mở đầu ----------
  if (phase === "intro") {
    return (
      <section className="crisis" aria-label="Ngàn cân treo sợi tóc — mở đầu">
        <motion.div className="crisis-intro" {...enter}>
          <p className="crisis-eyebrow">Mô phỏng · Mùa đông 1945 – 1946</p>
          <h1 className="crisis-intro__title">Ngàn cân treo sợi tóc</h1>
          <p className="crisis-intro__lead">
            Ngày 2/9/1945, bạn tuyên bố độc lập. Ba tuần sau, đất nước đứng bên bờ vực:
            <b> giặc đói, giặc dốt, giặc ngoại xâm</b> ập đến cùng lúc. Ngân khố gần như trống rỗng, chưa một
            nước nào công nhận bạn.
          </p>
          <p className="crisis-intro__lead crisis-intro__lead--tight">
            Bạn là những người lãnh đạo. Sáu quyết định. Ba thứ phải giữ. <b>Bạn có giữ được nước không?</b>
          </p>

          <div className="crisis-intro__meters">
            {METERS.map((meter) => (
              <div className="crisis-intro__meter" key={meter.id} data-meter={meter.id}>
                <span className="crisis-intro__meter-name">
                  <span aria-hidden="true">{meter.glyph}</span> {meter.label}
                  <b>{meter.start}</b>
                </span>
                <span className="crisis-intro__meter-blurb">{meter.blurb}</span>
              </div>
            ))}
          </div>

          <button type="button" className="crisis-btn crisis-btn--go" onClick={start}>
            Bắt đầu — Vòng 1 →
          </button>
          <p className="crisis-intro__foot">Dựa trên bối cảnh có thật 1945–1946 · Giáo trình Lịch sử Đảng, Chương 2</p>
        </motion.div>
      </section>
    );
  }

  // ---------- Màn kết cục ----------
  if (phase === "ending") {
    const survived = collapsed === null && METERS.every((m) => meters[m.id] > 0);
    const rank = !survived
      ? { tag: "Suýt mất nước", tone: "fail" as const }
      : historicalCount >= 5
        ? { tag: "Bản lĩnh 1946", tone: "gold" as const }
        : historicalCount >= 3
          ? { tag: "Giữ được nước", tone: "ok" as const }
          : { tag: "Về đích trong gang tấc", tone: "thin" as const };

    const deadMeter = collapsed ? METERS.find((m) => m.id === collapsed) : null;

    return (
      <section className="crisis" aria-label="Kết cục">
        <motion.div className="crisis-ending" data-tone={rank.tone} {...enter}>
          <p className="crisis-eyebrow">Kết cục · sau sáu quyết định</p>
          <h2 className="crisis-ending__verdict">{survived ? "Giữ được nước" : "Ngàn cân đã đứt"}</h2>
          <p className="crisis-ending__rank">
            <span className="crisis-ending__badge" data-tone={rank.tone}>{rank.tag}</span>
            <span>Khớp đường lối lịch sử: <b>{historicalCount}/{ROUNDS.length}</b></span>
          </p>

          {survived ? (
            <p className="crisis-ending__note">
              Chính quyền non trẻ đứng vững qua giai đoạn hiểm nghèo nhất — đúng như lịch sử đã làm được.
              {historicalCount < 5 && " Nhưng con đường của bạn chệch đôi chỗ so với quyết sách thật."}
            </p>
          ) : (
            <p className="crisis-ending__note">
              <b>{deadMeter?.label}</b> đã sụp xuống đáy — chính quyền lẽ ra đã đổ ở đây. Trong lịch sử, Đảng
              tránh được kết cục này bằng những nước cờ mềm dẻo mà kiên định. Xem lại từng vòng bên dưới nhé.
            </p>
          )}

          <CrisisHud meters={meters} big />

          <ol className="crisis-recap" aria-label="Đối chiếu từng vòng với lịch sử">
            {picks.map((pick, index) => {
              const source = ROUNDS[index];
              const historicalChoice = source.choices.find((c) => c.historical);
              return (
                <li key={pick.roundId} className="crisis-recap__row" data-match={pick.choice.historical}>
                  <span className="crisis-recap__turn">{source.turn}</span>
                  <span className="crisis-recap__threat">{source.threat}</span>
                  <span className="crisis-recap__pick">
                    <span aria-hidden="true">{pick.choice.glyph}</span> {pick.choice.label}
                  </span>
                  {pick.choice.historical ? (
                    <span className="crisis-recap__tag crisis-recap__tag--ok">Khớp lịch sử ✓</span>
                  ) : (
                    <span className="crisis-recap__tag crisis-recap__tag--diff">
                      Đảng đã chọn: {historicalChoice?.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="crisis-lesson">
            <p className="crisis-lesson__kicker">Bài học lịch sử</p>
            <p className="crisis-lesson__title">“{LESSON.title}”</p>
            <p className="crisis-lesson__body">{LESSON.body}</p>
          </div>

          <div className="crisis-ending__actions">
            <button type="button" className="crisis-btn crisis-btn--go" onClick={start}>
              Chơi lại ↻
            </button>
            <Link className="crisis-btn crisis-btn--ghost" href="/ho-so/giu-chinh-quyen-giua-vong-vay">
              Đọc hồ sơ 1945–46 →
            </Link>
            <Link className="crisis-btn crisis-btn--ghost" href="/gio-g">
              Chơi cả lớp ở Giờ G →
            </Link>
          </div>
        </motion.div>
      </section>
    );
  }

  // ---------- Màn chơi: vòng + hậu quả ----------
  return (
    <section className="crisis" aria-label="Ngàn cân treo sợi tóc">
      <div className="crisis-topline" aria-hidden="true" />
      <CrisisHud meters={meters} />

      <div className="crisis-progress" aria-label={`Vòng ${roundIndex + 1} trên ${ROUNDS.length}`}>
        {ROUNDS.map((item, index) => (
          <span
            key={item.id}
            className="crisis-progress__dot"
            data-done={index < roundIndex}
            data-active={index === roundIndex}
          />
        ))}
      </div>

      <motion.article
        key={`${round.id}-${phase}`}
        className="crisis-card"
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
      >
        <p className="crisis-card__head">
          <span className="crisis-card__turn">{round.turn} · {round.date}</span>
          <span className="crisis-card__threat">{round.threat}</span>
        </p>
        <h2 className="crisis-card__title">{round.title}</h2>

        {phase === "round" && (
          <>
            <p className="crisis-card__situation">{round.situation}</p>
            <p className="crisis-card__question">{round.question}</p>
            <div className="crisis-choices">
              {round.choices.map((choice) => (
                <button key={choice.id} type="button" className="crisis-choice" onClick={() => choose(choice)}>
                  <span className="crisis-choice__glyph" aria-hidden="true">{choice.glyph}</span>
                  <span className="crisis-choice__label">{choice.label}</span>
                </button>
              ))}
            </div>
            <p className="crisis-card__tip">Chọn theo phán đoán của bạn — hậu quả sẽ hiện ngay sau đó.</p>
          </>
        )}

        {phase === "consequence" && lastPick && (
          <motion.div
            className="crisis-outcome"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease }}
            aria-live="polite"
          >
            <p className="crisis-outcome__choice" data-history={lastPick.choice.historical}>
              <span aria-hidden="true">{lastPick.choice.glyph}</span> {lastPick.choice.label}
              {lastPick.choice.historical && <b className="crisis-outcome__flag">Đảng đã chọn ✓</b>}
            </p>
            <p className="crisis-outcome__text">{lastPick.choice.outcome}</p>

            <ul className="crisis-deltas">
              {METERS.map((meter) => {
                const delta = lastPick.choice.effects[meter.id] ?? 0;
                if (delta === 0) return null;
                return (
                  <li key={meter.id} data-dir={delta > 0 ? "up" : "down"}>
                    <span aria-hidden="true">{meter.glyph}</span> {meter.label}
                    <b>{delta > 0 ? `+${delta}` : delta}</b>
                  </li>
                );
              })}
            </ul>

            {METERS.some((m) => meterState(meters[m.id]) !== "ok") && (
              <p className="crisis-outcome__warn">
                {collapsed
                  ? `⚠ ${METERS.find((m) => m.id === collapsed)?.label} đã chạm đáy — chính quyền lung lay tận gốc.`
                  : `⚠ ${METERS.filter((m) => meterState(meters[m.id]) === "warn").map((m) => m.label).join(", ")} đang nguy hiểm.`}
              </p>
            )}

            <p className="crisis-outcome__note">
              <span className="crisis-outcome__note-tag">Sử thật</span> {lastPick.choice.note}
            </p>

            <button type="button" className="crisis-btn crisis-btn--go" onClick={advance}>
              {roundIndex + 1 >= ROUNDS.length ? "Xem kết cục →" : `Vòng ${roundIndex + 2} →`}
            </button>
          </motion.div>
        )}
      </motion.article>
    </section>
  );
}
