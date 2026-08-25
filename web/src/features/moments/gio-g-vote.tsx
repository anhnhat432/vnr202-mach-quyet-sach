"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { MOMENTS } from "@/features/moments/moments";
import { getLiveClient, liveConfig, roomChannelName } from "@/features/moments/live-sync";

type Phase = "loading" | "noroom" | "nolive" | "waiting" | "active";

export function GioGVote() {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("loading");
  const [room, setRoom] = useState("");
  const [momentIndex, setMomentIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [voted, setVoted] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastMomentRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const params = new URLSearchParams(window.location.search);
      const code = (params.get("room") ?? "").trim();
      if (!code) {
        setPhase("noroom");
        return;
      }
      setRoom(code);
      const supabase = liveConfig() === null ? null : getLiveClient();
      if (!supabase) {
        setPhase("nolive");
        return;
      }
      setPhase("waiting");
      const channel = supabase.channel(roomChannelName(code), { config: { broadcast: { self: false } } });
      channelRef.current = channel;
      channel.on("broadcast", { event: "state" }, ({ payload }) => {
        const data = payload as { momentIndex?: number; revealed?: boolean } | undefined;
        if (typeof data?.momentIndex !== "number") return;
        setMomentIndex(data.momentIndex);
        setRevealed(Boolean(data.revealed));
        setPhase("active");
        if (lastMomentRef.current !== data.momentIndex) {
          lastMomentRef.current = data.momentIndex;
          setVoted(null);
        }
      });
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.send({ type: "broadcast", event: "hello", payload: {} });
        }
      });
    });
    return () => {
      cancelled = true;
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, []);

  function vote(choiceId: string) {
    if (voted || momentIndex === null) return;
    const moment = MOMENTS[momentIndex];
    setVoted(choiceId);
    channelRef.current?.send({ type: "broadcast", event: "vote", payload: { momentId: moment.id, choiceId } });
  }

  if (phase === "loading") {
    return <p className="vote-msg">Đang tải…</p>;
  }
  if (phase === "noroom") {
    return <p className="vote-msg">Thiếu mã phòng. Hãy quét lại mã QR mà người dẫn đang chiếu.</p>;
  }
  if (phase === "nolive") {
    return (
      <p className="vote-msg">
        Chế độ bỏ phiếu trực tiếp chưa được bật (cần cấu hình Supabase). Bạn vẫn có thể tự chơi ở trang <b>/khoanh-khac</b>.
      </p>
    );
  }
  if (phase === "waiting" || momentIndex === null) {
    return (
      <div className="vote-shell">
        <p className="vote-room">Phòng {room}</p>
        <p className="vote-msg">Đã kết nối ✓ — chờ người dẫn mở khoảnh khắc…</p>
      </div>
    );
  }

  const moment = MOMENTS[momentIndex];

  return (
    <div className="vote-shell">
      <p className="vote-room">Phòng {room} · {moment.year}</p>
      <h1 className="vote-title">{moment.title}</h1>
      <p className="vote-prompt">{moment.prompt}</p>

      <div className="vote-choices">
        {moment.choices.map((choice) => {
          const isHistory = choice.id === moment.historicalChoiceId;
          const isMine = choice.id === voted;
          return (
            <motion.button
              key={choice.id}
              type="button"
              className="vote-choice"
              data-mine={isMine}
              data-history={revealed && isHistory}
              disabled={voted !== null || revealed}
              onClick={() => vote(choice.id)}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            >
              <span className="vote-choice__glyph" aria-hidden="true">{choice.glyph}</span>
              <span className="vote-choice__label">{choice.label}</span>
              {isMine && <span className="vote-choice__mine">Bạn chọn</span>}
              {revealed && isHistory && <span className="vote-choice__history">Lịch sử ✓</span>}
            </motion.button>
          );
        })}
      </div>

      {revealed ? (
        <div className="vote-reveal">
          <p>{moment.fact}</p>
        </div>
      ) : voted ? (
        <p className="vote-status">Đã gửi phiếu ✓ — chờ người dẫn lật bài trên màn hình lớn.</p>
      ) : (
        <p className="vote-status">Chạm một lựa chọn để bỏ phiếu 👆</p>
      )}
    </div>
  );
}
