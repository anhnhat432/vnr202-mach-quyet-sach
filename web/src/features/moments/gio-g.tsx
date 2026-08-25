"use client";

import { motion, useReducedMotion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { MOMENTS } from "@/features/moments/moments";
import { getLiveClient, liveConfig, makeRoomCode, roomChannelName } from "@/features/moments/live-sync";

/**
 * Giờ G — chế độ dẫn cho cả lớp / máy chiếu.
 * Mặc định: người dẫn đếm phiếu "giơ tay" bằng chạm (hoặc phím 1/2/3), bấm "Lật bài" để lộ đáp án.
 * Nếu đã cấu hình Supabase: mỗi điện thoại quét QR vào /gio-g/vote và phiếu chảy thẳng lên màn hình.
 */
export function GioGHost() {
  const reduceMotion = useReducedMotion();
  const live = useMemo(() => liveConfig() !== null, []);
  const [mi, setMi] = useState(0);
  const [tallies, setTallies] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState(false);
  const [origin, setOrigin] = useState("");
  const [room, setRoom] = useState("");
  const [liveReady, setLiveReady] = useState(false);

  const moment = MOMENTS[mi];

  const miRef = useRef(mi);
  const revealedRef = useRef(revealed);
  const momentRef = useRef(moment);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    miRef.current = mi;
    revealedRef.current = revealed;
    momentRef.current = moment;
  });

  useEffect(() => {
    queueMicrotask(() => {
      setOrigin(window.location.origin);
      if (live) setRoom(makeRoomCode());
    });
  }, [live]);

  // Kết nối kênh realtime khi đã có mã phòng và cấu hình Supabase.
  useEffect(() => {
    if (!live || !room) return;
    const supabase = getLiveClient();
    if (!supabase) return;
    const channel = supabase.channel(roomChannelName(room), { config: { broadcast: { self: false } } });
    channelRef.current = channel;
    channel.on("broadcast", { event: "vote" }, ({ payload }) => {
      const data = payload as { momentId?: string; choiceId?: string } | undefined;
      if (data?.momentId === momentRef.current.id && data.choiceId) {
        const choiceId = data.choiceId;
        setTallies((current) => ({ ...current, [choiceId]: (current[choiceId] ?? 0) + 1 }));
      }
    });
    channel.on("broadcast", { event: "hello" }, () => {
      channel.send({ type: "broadcast", event: "state", payload: { momentIndex: miRef.current, revealed: revealedRef.current } });
    });
    channel.subscribe((status) => setLiveReady(status === "SUBSCRIBED"));
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      setLiveReady(false);
    };
  }, [live, room]);

  // Phát trạng thái hiện tại cho các điện thoại đang theo dõi.
  useEffect(() => {
    if (liveReady) {
      channelRef.current?.send({ type: "broadcast", event: "state", payload: { momentIndex: mi, revealed } });
    }
  }, [mi, revealed, liveReady]);

  const total = useMemo(() => Object.values(tallies).reduce((sum, value) => sum + value, 0), [tallies]);

  const bump = useCallback(
    (choiceId: string, delta: number) => {
      if (revealed) return;
      setTallies((current) => ({ ...current, [choiceId]: Math.max(0, (current[choiceId] ?? 0) + delta) }));
    },
    [revealed],
  );

  const resetRound = useCallback(() => {
    setTallies({});
    setRevealed(false);
  }, []);

  const go = useCallback((dir: -1 | 1) => {
    setMi((value) => {
      const nextIndex = value + dir;
      if (nextIndex < 0 || nextIndex >= MOMENTS.length) return value;
      return nextIndex;
    });
    setTallies({});
    setRevealed(false);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "1" || event.key === "2" || event.key === "3") {
        const choice = momentRef.current.choices[Number(event.key) - 1];
        if (choice) bump(choice.id, 1);
      } else if (event.key.toLowerCase() === "r") {
        setRevealed(true);
      } else if (event.key === "ArrowRight") {
        go(1);
      } else if (event.key === "ArrowLeft") {
        go(-1);
      } else if (event.key.toLowerCase() === "n") {
        resetRound();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bump, go, resetRound]);

  const pct = (choiceId: string) => (total > 0 ? Math.round(((tallies[choiceId] ?? 0) / total) * 100) : 0);
  const joinUrl = origin ? (live && room ? `${origin}/gio-g/vote?room=${room}` : `${origin}/khoanh-khac`) : "";

  return (
    <section className="giog" aria-label="Giờ G — chế độ dẫn cả lớp">
      <header className="giog__bar">
        <div className="giog__nav">
          <button type="button" onClick={() => go(-1)} disabled={mi === 0} aria-label="Khoảnh khắc trước">←</button>
          <span>{mi + 1}/{MOMENTS.length}</span>
          <button type="button" onClick={() => go(1)} disabled={mi === MOMENTS.length - 1} aria-label="Khoảnh khắc sau">→</button>
        </div>
        <div className="giog__tools">
          <span className="giog__count">{total} phiếu</span>
          <button type="button" className="giog__reset" onClick={resetRound}>Đặt lại</button>
        </div>
      </header>

      <div className="giog__join-panel">
        {joinUrl && (
          <div className="giog__qr" aria-hidden="true">
            <QRCodeSVG value={joinUrl} size={112} bgColor="#ffffff" fgColor="#182126" level="M" />
          </div>
        )}
        <div className="giog__join-copy">
          {live ? (
            <>
              <p className="giog__join-title">
                Cả lớp quét mã để bỏ phiếu trực tiếp
                <span className={`giog__live ${liveReady ? "is-on" : ""}`}>{liveReady ? "● Trực tiếp" : "○ đang kết nối"}</span>
              </p>
              <p className="giog__join-sub">Mã phòng <b>{room || "…"}</b> · {origin ? origin.replace(/^https?:\/\//, "") : "…"}/gio-g/vote</p>
            </>
          ) : (
            <>
              <p className="giog__join-title">Cả lớp mở trên điện thoại để chơi</p>
              <p className="giog__join-sub">
                <b>{origin ? origin.replace(/^https?:\/\//, "") : "…"}/khoanh-khac</b>
                <br />
                <small>Đếm phiếu giơ tay thủ công. Bật bỏ phiếu trực tiếp bằng cách cấu hình Supabase.</small>
              </p>
            </>
          )}
        </div>
      </div>

      <motion.div
        key={moment.id}
        className="giog__stage"
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="giog__eyebrow">{moment.chapterLabel} · {moment.year}</p>
        <h2 className="giog__title">{moment.title}</h2>
        <p className="giog__setup">{moment.setup}</p>
        <p className="giog__prompt">{moment.prompt}</p>

        <div className="giog__choices" data-revealed={revealed}>
          {moment.choices.map((choice, choiceIndex) => {
            const isHistory = choice.id === moment.historicalChoiceId;
            return (
              <button
                key={choice.id}
                type="button"
                className="giog__choice"
                data-history={revealed && isHistory}
                data-dim={revealed && !isHistory}
                onClick={() => bump(choice.id, 1)}
                aria-label={`Cộng phiếu cho: ${choice.label}`}
              >
                <span className="giog__choice__key" aria-hidden="true">{choiceIndex + 1}</span>
                <span className="giog__choice__glyph" aria-hidden="true">{choice.glyph}</span>
                <span className="giog__choice__label">{choice.label}</span>
                <span className="giog__choice__count">{tallies[choice.id] ?? 0}</span>
                <span className="giog__choice__bar">
                  <motion.span
                    className="giog__choice__fill"
                    initial={false}
                    animate={{ width: `${pct(choice.id)}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </span>
                <span className="giog__choice__pct">{pct(choice.id)}%</span>
                {revealed && isHistory && <span className="giog__choice__flag">Lịch sử chọn ✓</span>}
                {!revealed && (
                  <span
                    className="giog__choice__minus"
                    role="button"
                    tabIndex={0}
                    aria-label={`Bớt một phiếu: ${choice.label}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      bump(choice.id, -1);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        bump(choice.id, -1);
                      }
                    }}
                  >
                    −
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {!revealed ? (
          <div className="giog__actions">
            <button type="button" className="giog__reveal" onClick={() => setRevealed(true)}>
              Lật bài 🎊
            </button>
            <p className="giog__hint">Chạm vào ô để cộng phiếu · phím 1/2/3 · R để lật · ←/→ đổi khoảnh khắc</p>
          </div>
        ) : (
          <motion.div
            className="giog__fact"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <p>{moment.fact}</p>
            <p className="giog__why">{moment.why}</p>
            <div className="giog__actions">
              <button type="button" className="giog__reveal giog__reveal--ghost" onClick={resetRound}>Chơi lại vòng này</button>
              <button type="button" className="giog__reveal" onClick={() => go(1)} disabled={mi === MOMENTS.length - 1}>
                Khoảnh khắc sau →
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </section>
  );
}
