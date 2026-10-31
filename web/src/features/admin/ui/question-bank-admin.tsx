"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ArenaApiError, request } from "@/features/arena/client/api";
import type { BankQuestion as Question, BulkQuestionTarget, QuestionVersion as Version } from "./question-bank-types";
import { QuestionBulkActions } from "./question-bulk-actions";

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
  const [confirming, setConfirming] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const seq = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const locked = busy || confirming;

  const rows = items?.flatMap((question) => {
    // A status-filtered relation can contain an old Draft while the current version is Published.
    // Never substitute that historical version for the server's current-version pointer.
    const version = question.current_version_id
      ? question.question_versions.find((version) => version.id === question.current_version_id)
      : question.origin === "fixture" ? [...question.question_versions].sort((a, b) => b.version - a.version)[0] : undefined;
    return version ? [{ question, version }] : [];
  }) ?? [];
  const selectable: BulkQuestionTarget[] = rows.flatMap(({ question, version }) =>
    question.origin === "bank" && !version.retired_at && version.status !== "published"
      ? [{ versionId: version.id, label: question.external_key ?? question.id, status: version.status }]
      : []);
  const selectedTargets = selectable.filter((target) => selected.includes(target.versionId));

  const refreshReadiness = useCallback(async () => {
    try {
      setReadiness(await request<Readiness>("GET", "/admin/question-bank/readiness?kind=official"));
    } catch {
      setReadiness(null);
    }
  }, []);

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
    const t = window.setTimeout(() => {
      void load();
      void refreshReadiness();
    }, 0);
    return () => {
      window.clearTimeout(t);
      abort.current?.abort();
    };
  }, [load, refreshReadiness]);

  function updateFilter(patch: Partial<typeof filter>) {
    if (locked) return;
    seq.current += 1;
    abort.current?.abort();
    setItems(null);
    setSelected([]);
    setFilter((current) => ({ ...current, ...patch }));
  }

  async function reconcile() {
    setSelected([]);
    setItems(null);
    await Promise.all([load(), refreshReadiness()]);
  }

  async function transition(version: Version, action: string) {
    if (locked) return;
    const note = action === "review" || action === "reject" || action === "retire"
      ? window.prompt(version.ai_assisted && action === "review" ? "Câu do AI hỗ trợ soạn: ghi nhận xét của người duyệt (bắt buộc)" : "Ghi chú (không bắt buộc)")
      : undefined;
    if (note === null) return;
    setBusy(true);
    setMessage(null);
    try {
      await request("POST", `/admin/question-versions/${version.id}/transitions`, { body: note ? { action, note } : { action } });
      setMessage("Đã cập nhật.");
    } catch (e) {
      setMessage(e instanceof ArenaApiError ? `${e.message}${e.details.length ? ` — ${e.details.map((d) => d.code).join(", ")}` : ""}` : "Không thực hiện được.");
    } finally {
      await reconcile();
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
        <label>Nguồn<select disabled={locked} value={filter.origin} onChange={(e) => updateFilter({ origin: e.target.value })}><option value="bank">Ngân hàng thật</option><option value="fixture">Giả lập</option></select></label>
        <label>Game<select disabled={locked} value={filter.game} onChange={(e) => updateFilter({ game: e.target.value })}><option value="">Cả hai</option><option value="minefield">Bãi Mìn</option><option value="race">Đường Đua</option></select></label>
        <label>Trạng thái<select disabled={locked} value={filter.status} onChange={(e) => updateFilter({ status: e.target.value })}><option value="">Tất cả</option><option value="draft">Nháp</option><option value="reviewed">Đã duyệt</option><option value="published">Đã xuất bản</option></select></label>
        <button type="button" className="is-ghost" disabled={locked} onClick={() => { setMessage(null); void reconcile(); }}>Tải lại ngân hàng</button>
      </div>
      {filter.origin === "bank" ? <>
        {items !== null && selectable.length > 0 ? <label className="adm__check">
          <input type="checkbox" disabled={locked} checked={selectedTargets.length === selectable.length} onChange={(event) => {
            if (!locked) setSelected(event.target.checked ? selectable.map((target) => target.versionId) : []);
          }} />Chọn tất cả {selectable.length} câu đang hiển thị
        </label> : null}
        <QuestionBulkActions selected={selectedTargets} busy={busy} onConfirmingChange={setConfirming} onBusyChange={setBusy} onComplete={reconcile} />
      </> : null}
      {message ? <p className="adm__message" role="status">{message}</p> : null}
      {items === null ? <p>{message ? "Danh sách chưa được xác nhận. Hãy tải lại ngân hàng." : "Đang tải…"}</p> : rows.length === 0 ? <p>Không có câu hỏi phù hợp.</p> : (
        <ul className="adm__questions">
          {rows.map(({ question: q, version: v }) => {
            return (
              <li key={q.id}>
                <header>
                  {q.origin === "bank" && !v.retired_at && v.status !== "published" ? <label className="adm__check">
                    <input type="checkbox" aria-label={`Chọn câu ${q.external_key ?? q.id} phiên bản ${v.version}`} disabled={locked} checked={selected.includes(v.id)} onChange={(event) => {
                      if (!locked) setSelected((current) => event.target.checked ? [...current, v.id] : current.filter((id) => id !== v.id));
                    }} />Chọn
                  </label> : null}
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
                    {ACTIONS[v.status].map((a) => <button key={a.action} type="button" disabled={locked} onClick={() => void transition(v, a.action)}>{a.label}</button>)}
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
