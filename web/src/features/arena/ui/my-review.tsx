"use client";

import { Check, Timer, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ArenaApiError, request } from "@/features/arena/client/api";
import { STANDING_LABEL, formatClock } from "@/features/arena/ui/arena-ui";
import type { Standing } from "@/features/arena/client/types";

type MyAttempt = { attemptId: string; game: "minefield" | "race"; state: string; score: number; mainCorrect: number; mainTotal: number; completionDurationMs: number | null; competition: { name: string; kind: string; state: string; standing: Standing }; reviewAvailable: boolean };
type Review = { attemptId: string; score: number; questions: Array<{ sequence: number; role: string; difficulty: string; outcome: string | null; prompt: string; options: Array<{ id: string; label: string }>; submittedOptionId: string | null; correctOptionId: string; explanation: string; sources: Array<{ title: string; locator: string; url: string | null }> }> };

// Post-final review (LA-FB-004/005): private to the student, only questions they actually saw,
// only once the competition is Finalized. Before that the server answers 409 and nothing is shown.
export function MyReview() {
  const [attempts, setAttempts] = useState<MyAttempt[] | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);

  useEffect(() => {
    request<MyAttempt[]>("GET", "/arena/me/attempts").then(setAttempts).catch((e) => {
      if (e instanceof ArenaApiError && e.status === 401) setSignedOut(true);
      else setAttempts([]);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    request<Review>("GET", `/arena/attempts/${open}/review`).then((r) => alive && setReview(r)).catch(() => alive && setReview(null));
    return () => {
      alive = false;
    };
  }, [open]);

  if (signedOut) return <p>Hãy <Link className="text-link" href="/dang-nhap">đăng nhập</Link> để xem lượt thi của bạn.</p>;
  if (!attempts) return <p>Đang tải…</p>;
  if (!attempts.length) return <p>Bạn chưa có lượt thi nào.</p>;
  return (
    <div className="rev">
      <ul className="rev__list">
        {attempts.map((a) => (
          <li key={a.attemptId}>
            <div>
              <strong>{a.game === "minefield" ? "Bãi Mìn Tri Thức" : "Đường Đua Lịch Sử"}</strong> · {a.competition.name} · {STANDING_LABEL[a.competition.standing]}
              <span>{a.score} điểm · {a.mainCorrect}/{a.mainTotal} đúng{a.completionDurationMs !== null ? ` · ${formatClock(a.completionDurationMs)}` : ""}</span>
            </div>
            {a.reviewAvailable
              ? <button type="button" onClick={() => setOpen(open === a.attemptId ? null : a.attemptId)} aria-expanded={open === a.attemptId}>{open === a.attemptId ? "Thu gọn" : "Xem lại đáp án"}</button>
              : <em>Đáp án mở sau khi cuộc thi kết thúc</em>}
          </li>
        ))}
      </ul>
      {open && review ? (
        <ol className="rev__questions">
          {review.questions.length === 0 ? <li>Lượt này không có câu nào đã hiển thị.</li> : review.questions.map((q) => (
            <li key={q.sequence} className={`rev__q rev__q--${q.outcome ?? "none"}`}>
              <header>
                {q.outcome === "correct" ? <Check aria-hidden size={18} /> : q.outcome === "timed_out" ? <Timer aria-hidden size={18} /> : <X aria-hidden size={18} />}
                <span>{q.role === "defuse" ? "Gỡ bom" : `Câu ${q.sequence}`} · {q.outcome === "correct" ? "Đúng" : q.outcome === "timed_out" ? "Hết giờ" : "Sai"}</span>
              </header>
              <p className="rev__prompt">{q.prompt}</p>
              <ul>
                {q.options.map((o) => (
                  <li key={o.id} className={`${o.id === q.correctOptionId ? "is-correct" : ""} ${o.id === q.submittedOptionId ? "is-mine" : ""}`}>
                    {o.label}{o.id === q.correctOptionId ? " ✓ đáp án đúng" : ""}{o.id === q.submittedOptionId && o.id !== q.correctOptionId ? " — bạn chọn" : ""}
                  </li>
                ))}
              </ul>
              <p>{q.explanation}</p>
              {q.sources.length ? <p className="rev__src">Nguồn: {q.sources.map((s) => `${s.title}${s.locator ? `, ${s.locator}` : ""}`).join("; ")}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
