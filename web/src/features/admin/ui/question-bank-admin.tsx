"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ArenaApiError, request } from "@/features/arena/client/api";

type Version = { id: string; version: number; status: "draft" | "reviewed" | "published"; ai_assisted: boolean; retired_at: string | null; content_public: { prompt: string; options: Array<{ id: string; label: string }> }; content_private: { correctOptionId: string; explanation: string }; question_source_links: Array<{ source_id: string; locator: string }> };
type Question = { id: string; external_key: string | null; game_type: "minefield" | "race"; pool: string; chapter: string; topic: string; question_type: string; difficulty: string; origin: "bank" | "fixture"; question_versions: Version[] };
type Readiness = { ready: boolean; blockers: string[]; target: { meetsTarget: boolean; expectedAttempts: number } };

const STATUS: Record<Version["status"], string> = { draft: "Nháp", reviewed: "Đã duyệt", published: "Đã xuất bản" };
const ACTIONS: Record<Version["status"], Array<{ action: string; label: string }>> = {
  draft: [{ action: "review", label: "Duyệt học thuật" }, { action: "reject", label: "Từ chối" }],
  reviewed: [{ action: "publish", label: "Xuất bản" }, { action: "reject", label: "Trả về nháp" }],
  published: [{ action: "retire", label: "Ngừng sử dụng" }],
};

// Question bank governance (LA-CONTENT-002/003): a signed-in human administrator reviews and publishes;
// the database refuses review without verified sources and AI-assisted drafts without a reviewer note.
// Fixtures ([GIẢ LẬP]) are listed separately and can never enter an official competition.
export function QuestionBankAdmin() {
  const [items, setItems] = useState<Question[] | null>(null);
  const [filter, setFilter] = useState({ origin: "bank", game: "", status: "" });
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const abort = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    const current = ++seq.current;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const q = new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as Array<[string, string]>);
    try {
      const next = await request<Question[]>("GET", `/admin/questions?${q.toString()}`, { signal: controller.signal });
      if (current === seq.current) setItems(next);
    } catch (e) {
      if ((e as Error).name === "AbortError" || current !== seq.current) return;
      setMessage(e instanceof ArenaApiError ? e.message : "Không tải được ngân hàng câu hỏi.");
    }
  }, [filter]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    request<Readiness>("GET", "/admin/question-bank/readiness?kind=official").then(setReadiness).catch(() => undefined);
    return () => {
      window.clearTimeout(t);
      abort.current?.abort();
    };
  }, [load]);

  function updateFilter(patch: Partial<typeof filter>) {
    seq.current += 1;
    abort.current?.abort();
    setItems(null);
    setFilter((current) => ({ ...current, ...patch }));
  }

  async function transition(version: Version, action: string) {
    const note = action === "review" || action === "reject" || action === "retire"
      ? window.prompt(version.ai_assisted && action === "review" ? "Câu do AI hỗ trợ soạn: ghi nhận xét của người duyệt (bắt buộc)" : "Ghi chú (không bắt buộc)") ?? undefined
      : undefined;
    setBusy(true);
    setMessage(null);
    try {
      await request("POST", `/admin/question-versions/${version.id}/transitions`, { body: note ? { action, note } : { action } });
      setMessage("Đã cập nhật.");
      await load();
    } catch (e) {
      setMessage(e instanceof ArenaApiError ? `${e.message}${e.details.length ? ` — ${e.details.map((d) => d.code).join(", ")}` : ""}` : "Không thực hiện được.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm adm--single">
      {readiness ? (
        <p className={`adm__ready ${readiness.ready ? "is-ok" : "is-bad"}`}>
          Cuộc thi chính thức: {readiness.ready ? "ngân hàng đủ điều kiện" : `chưa đủ (${readiness.blockers.slice(0, 4).join(", ")}${readiness.blockers.length > 4 ? "…" : ""})`}
          {readiness.target && !readiness.target.meetsTarget ? " · chưa đạt mục tiêu 168 câu" : ""}
        </p>
      ) : null}
      <div className="adm__filters">
        <label>Nguồn<select value={filter.origin} onChange={(e) => updateFilter({ origin: e.target.value })}><option value="bank">Ngân hàng thật</option><option value="fixture">Giả lập</option></select></label>
        <label>Game<select value={filter.game} onChange={(e) => updateFilter({ game: e.target.value })}><option value="">Cả hai</option><option value="minefield">Bãi Mìn</option><option value="race">Đường Đua</option></select></label>
        <label>Trạng thái<select value={filter.status} onChange={(e) => updateFilter({ status: e.target.value })}><option value="">Tất cả</option><option value="draft">Nháp</option><option value="reviewed">Đã duyệt</option><option value="published">Đã xuất bản</option></select></label>
      </div>
      {message ? <p className="adm__message" role="status">{message}</p> : null}
      {items === null ? <p>Đang tải…</p> : items.length === 0 ? <p>Không có câu hỏi phù hợp.</p> : (
        <ul className="adm__questions">
          {items.map((q) => {
            const v = [...q.question_versions].sort((a, b) => b.version - a.version)[0];
            if (!v) return null;
            return (
              <li key={q.id}>
                <header>
                  <span className={`adm__status adm__status--${v.status}`}>{STATUS[v.status]}{v.retired_at ? " · ngừng dùng" : ""}</span>
                  <span>{q.game_type === "minefield" ? "Bãi Mìn" : "Đường Đua"} · {q.pool} · {q.difficulty} · {q.chapter}</span>
                  {v.ai_assisted ? <span className="adm__ai">AI hỗ trợ soạn</span> : null}
                  {q.origin === "fixture" ? <span className="adm__ai">GIẢ LẬP</span> : null}
                </header>
                <p className="adm__prompt">{v.content_public.prompt}</p>
                <ol className="adm__options">
                  {v.content_public.options.map((o) => <li key={o.id} className={o.id === v.content_private.correctOptionId ? "is-correct" : ""}>{o.label}</li>)}
                </ol>
                <p className="adm__explain">{v.content_private.explanation}</p>
                <p className="adm__hint">Nguồn: {v.question_source_links.length ? v.question_source_links.map((l) => l.locator).join("; ") : "chưa có"} · {q.external_key}</p>
                {q.origin === "bank" && !v.retired_at ? (
                  <div className="adm__actions">
                    {ACTIONS[v.status].map((a) => <button key={a.action} type="button" disabled={busy} onClick={() => void transition(v, a.action)}>{a.label}</button>)}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
