"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { MeterGlyph } from "@/features/brand/artwork";

import {
  CLAMP_MAX,
  CLAMP_MIN,
  METERS,
  ROUNDS,
  type CrisisChoice,
  type MeterId,
} from "@/features/crisis/crisis-scenario";

const meterAccent: Record<MeterId, string> = {
  longDan: "var(--command-red)",
  theNuoc: "var(--signal-amber)",
  thucLuc: "var(--evidence-teal)",
};

const clamp = (v: number) => Math.max(CLAMP_MIN, Math.min(CLAMP_MAX, v));
const round = ROUNDS[0]; // Vòng 1 — giặc đói

const ease = [0.22, 1, 0.36, 1] as const;

/** Một nước đi chơi thử ngay trên trang chủ — tái dùng đúng dữ liệu game. */
export function CrisisTeaser() {
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState<CrisisChoice | null>(null);

  const base = useMemo(
    () => METERS.reduce((acc, m) => ({ ...acc, [m.id]: m.start }), {} as Record<MeterId, number>),
    [],
  );

  return (
    <section className="teaser" aria-label="Chơi thử một nước đi">
      <div className="teaser__intro">
        <p className="teaser__eyebrow">Thử một nước đi</p>
        <span className="teaser__kicker">{round.threat} · {round.date}</span>
        <h2 className="teaser__title">{round.title}</h2>
        <p className="teaser__q">{round.question}</p>
      </div>

      <div className="teaser__stage">
        <div className="teaser__meters" aria-label="Trạng thái đất nước">
          {METERS.map((m) => {
            const delta = picked ? picked.effects[m.id] ?? 0 : 0;
            const value = clamp(base[m.id] + delta);
            return (
              <div className="teaser-meter" key={m.id} style={{ ["--m-accent" as string]: meterAccent[m.id] }}>
                <span className="teaser-meter__top">
                  <span className="teaser-meter__name">
                    <MeterGlyph id={m.id} className="meter-glyph" /> {m.label}
                  </span>
                  <span className="teaser-meter__val">
                    {value}
                    <AnimatePresence>
                      {delta !== 0 && (
                        <motion.i
                          key={`${picked?.id}-${m.id}`}
                          className="teaser-meter__delta"
                          data-dir={delta > 0 ? "up" : "down"}
                          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, ease }}
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </motion.i>
                      )}
                    </AnimatePresence>
                  </span>
                </span>
                <span className="teaser-meter__track">
                  <span className="teaser-meter__fill" style={{ width: `${value}%` }} />
                </span>
              </div>
            );
          })}
        </div>

        <div className="teaser__action">
          {!picked ? (
            <div className="teaser__choices">
              {round.choices.map((c) => (
                <button key={c.id} type="button" className="teaser-choice" onClick={() => setPicked(c)}>
                  <span className="teaser-choice__glyph" aria-hidden="true">{c.glyph}</span>
                  <span className="teaser-choice__label">{c.label}</span>
                  <span className="teaser-choice__go" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          ) : (
            <motion.div
              className="teaser__result"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease }}
              aria-live="polite"
            >
              <p className="teaser__pick" data-history={picked.historical}>
                <span aria-hidden="true">{picked.glyph}</span> {picked.label}
                {picked.historical && <b className="teaser__flag">Đảng đã chọn ✓</b>}
              </p>
              <p className="teaser__line">{picked.result}</p>
              <p className="teaser__note">
                <span className="teaser__note-tag">Sử thật</span> {picked.note}
              </p>
              <div className="teaser__cta-row">
                <Link
                  className="cold-cta"
                  href="/ngan-can"
                  onClick={() => {
                    // Mang nước vừa chọn sang game — thành Vòng 1 thật, vào thẳng Vòng 2.
                    try {
                      sessionStorage.setItem("nc_warmup", picked.id);
                    } catch {}
                  }}
                >
                  Chơi tiếp — 5 nước còn lại <span aria-hidden="true">→</span>
                </Link>
                <button type="button" className="teaser__retry" onClick={() => setPicked(null)}>
                  ↺ Thử nước khác
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
