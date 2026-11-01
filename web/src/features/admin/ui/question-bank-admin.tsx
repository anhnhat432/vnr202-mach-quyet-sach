"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import "@/features/admin/ui/admin-control-center.css";
import { ArenaApiError, request } from "@/features/arena/client/api";
import type { BankQuestion as Question, BulkQuestionTarget, QuestionVersion as Version } from "./question-bank-types";
import { QuestionBulkActions } from "./question-bulk-actions";

type Readiness = {
  ready: boolean;
  blockers: string[];
  classSize?: number;
  target: { meetsTarget: boolean; expectedAttempts: number };
};

const STATUS: Record<Version["status"], string> = {
  draft: "Nháp",
  reviewed: "Đã duyệt",
  published: "Đã xuất bản",
};

const ACTIONS: Record<Version["status"], Array<{ action: string; label: string }>> = {
  draft: [
    { action: "review", label: "Duyệt học thuật" },
    { action: "reject", label: "Từ chối" },
  ],
  reviewed: [
    { action: "publish", label: "Xuất bản" },
    { action: "reject", label: "Trả về nháp" },
  ],
  published: [{ action: "retire", label: "Ngừng sử dụng" }],
};

export function QuestionBankAdmin() {
  const [items, setItems] = useState<Question[] | null>(null);
  const [filter, setFilter] = useState({ origin: "bank", game: "", status: "" });
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const seq = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const locked = busy || confirming;

  const qLower = searchQuery.trim().toLowerCase();
  const rows =
    items?.flatMap((question) => {
      const version = question.current_version_id
        ? question.question_versions.find((v) => v.id === question.current_version_id)
        : question.origin === "fixture"
          ? [...question.question_versions].sort((a, b) => b.version - a.version)[0]
          : undefined;
      if (!version) return [];
      if (difficultyFilter && question.difficulty !== difficultyFilter) return [];
      if (qLower) {
        const hay = `${question.external_key ?? ""} ${question.topic ?? ""} ${version.content_public.prompt}`.toLowerCase();
        if (!hay.includes(qLower)) return [];
      }
      return [{ question, version }];
    }) ?? [];

  const selectable: BulkQuestionTarget[] = rows.flatMap(({ question, version }) =>
    question.origin === "bank" && !version.retired_at && version.status !== "published"
      ? [{ versionId: version.id, label: question.external_key ?? question.id, status: version.status }]
      : [],
  );
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
      const next = await request<Question[]>("GET", `/admin/questions?${q.toString()}`, {
        signal: controller.signal,
      });
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
    const note =
      action === "review" || action === "reject" || action === "retire"
        ? window.prompt(
            version.ai_assisted && action === "review"
              ? "Câu do AI hỗ trợ soạn: ghi nhận xét của người duyệt (bắt buộc)"
              : "Ghi chú (không bắt buộc)",
          )
        : undefined;
    if (note === null) return;
    setBusy(true);
    setMessage(null);
    try {
      await request("POST", `/admin/question-versions/${version.id}/transitions`, {
        body: note ? { action, note } : { action },
      });
      setMessage("Đã cập nhật.");
    } catch (e) {
      setMessage(
        e instanceof ArenaApiError
          ? `${e.message}${e.details.length ? ` — ${e.details.map((d) => d.code).join(", ")}` : ""}`
          : "Không thực hiện được.",
      );
    } finally {
      await reconcile();
      setBusy(false);
    }
  }

  const draftCount = rows.filter((r) => r.version.status === "draft").length;
  const reviewedCount = rows.filter((r) => r.version.status === "reviewed").length;
  const publishedCount = rows.filter((r) => r.version.status === "published").length;

  return (
    <main aria-label="Quản lý ngân hàng câu hỏi">
      <header className="acc-page-header">
        <div>
          <p className="acc-kicker">Kiểm duyệt học thuật · VNR202</p>
          <h1 className="acc-title">Ngân hàng câu hỏi</h1>
          <p className="acc-subtitle">
            Tìm kiếm, lọc theo game/độ khó/trạng thái và duyệt học thuật theo nhóm. Câu do AI hỗ trợ soạn nháp bắt buộc
            có người duyệt xác nhận đối chiếu nguồn chính thống trước khi xuất bản.
          </p>
        </div>

        <div className="acc-sync-bar">
          <button
            type="button"
            className="acc-btn"
            disabled={locked}
            onClick={() => {
              setMessage(null);
              void reconcile();
            }}
          >
            Tải lại ngân hàng
          </button>
        </div>
      </header>

      {readiness ? (
        <section className="acc-kpi-grid" aria-label="Tổng quan ngân hàng câu hỏi">
          <div className="acc-kpi-card" data-tone={readiness.ready ? "teal" : "red"}>
            <span className="acc-kpi-label">Cuộc thi chính thức</span>
            <span className="acc-kpi-value" style={{ fontSize: "1.15rem" }}>
              {readiness.ready
                ? "ngân hàng đủ điều kiện"
                : `chưa đủ (${readiness.blockers.slice(0, 4).join(", ")}${readiness.blockers.length > 4 ? "…" : ""})`}
            </span>
            <span className="acc-kpi-meta">
              {readiness.target && !readiness.target.meetsTarget
                ? "chưa đạt mục tiêu 168 câu"
                : "Đạt chuẩn phân phối câu hỏi"}
            </span>
          </div>

          <div className="acc-kpi-card" data-tone="teal">
            <span className="acc-kpi-label">Đã xuất bản (Published)</span>
            <span className="acc-kpi-value">{publishedCount}</span>
            <span className="acc-kpi-meta">Đang hiển thị theo bộ lọc</span>
          </div>

          <div className="acc-kpi-card" data-tone={draftCount + reviewedCount > 0 ? "amber" : undefined}>
            <span className="acc-kpi-label">Chờ duyệt / Chờ xuất bản</span>
            <span className="acc-kpi-value">
              {draftCount} / {reviewedCount}
            </span>
            <span className="acc-kpi-meta">Nháp (Draft) / Đã duyệt (Reviewed)</span>
          </div>
        </section>
      ) : null}

      <section className="acc-panel" aria-label="Bộ lọc và tìm kiếm câu hỏi">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))",
            gap: "0.7rem",
            alignItems: "end",
          }}
        >
          <label className="acc-field">
            <span>Nguồn</span>
            <select
              disabled={locked}
              value={filter.origin}
              onChange={(e) => updateFilter({ origin: e.target.value })}
              className="acc-select"
            >
              <option value="bank">Ngân hàng thật</option>
              <option value="fixture">Giả lập</option>
            </select>
          </label>

          <label className="acc-field">
            <span>Game</span>
            <select
              disabled={locked}
              value={filter.game}
              onChange={(e) => updateFilter({ game: e.target.value })}
              className="acc-select"
            >
              <option value="">Cả hai</option>
              <option value="minefield">Bãi Mìn</option>
              <option value="race">Đường Đua</option>
            </select>
          </label>

          <label className="acc-field">
            <span>Độ khó</span>
            <select
              disabled={locked}
              value={difficultyFilter}
              onChange={(e) => {
                if (locked) return;
                setSelected([]);
                setDifficultyFilter(e.target.value);
              }}
              className="acc-select"
            >
              <option value="">Tất cả độ khó</option>
              <option value="easy">Dễ (easy)</option>
              <option value="medium">Trung bình (medium)</option>
              <option value="hard">Khó (hard)</option>
            </select>
          </label>

          <label className="acc-field">
            <span>Trạng thái</span>
            <select
              disabled={locked}
              value={filter.status}
              onChange={(e) => updateFilter({ status: e.target.value })}
              className="acc-select"
            >
              <option value="">Tất cả</option>
              <option value="draft">Nháp</option>
              <option value="reviewed">Đã duyệt</option>
              <option value="published">Đã xuất bản</option>
            </select>
          </label>

          <label className="acc-field" style={{ gridColumn: "span 2" }}>
            <span>Tìm kiếm câu hỏi</span>
            <input
              disabled={locked}
              placeholder="Nhập từ khóa câu hỏi, chủ đề hoặc mã câu..."
              value={searchQuery}
              onChange={(e) => {
                if (locked) return;
                setSelected([]);
                setSearchQuery(e.target.value);
              }}
              className="acc-input"
            />
          </label>
        </div>

        {filter.origin === "bank" ? (
          <div className="acc-panel-alt" style={{ marginTop: "0.9rem", display: "grid", gap: "0.65rem" }}>
            {items !== null && selectable.length > 0 ? (
              <label style={{ display: "inline-flex", gap: "0.45rem", alignItems: "center", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  disabled={locked}
                  checked={selectedTargets.length === selectable.length}
                  onChange={(event) => {
                    if (!locked) {
                      setSelected(event.target.checked ? selectable.map((target) => target.versionId) : []);
                    }
                  }}
                />
                <span>Chọn tất cả {selectable.length} câu đang hiển thị</span>
              </label>
            ) : null}
            <QuestionBulkActions
              selected={selectedTargets}
              busy={busy}
              onConfirmingChange={setConfirming}
              onBusyChange={setBusy}
              onComplete={reconcile}
            />
          </div>
        ) : null}
      </section>

      {message ? (
        <div className="acc-banner" data-tone="amber" role="status">
          <span>{message}</span>
        </div>
      ) : null}

      {items === null ? (
        <div className="acc-panel">
          <p style={{ margin: 0 }}>
            {message ? "Danh sách chưa được xác nhận. Hãy tải lại ngân hàng." : "Đang tải…"}
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="acc-panel">
          <p style={{ margin: 0 }}>Không có câu hỏi phù hợp.</p>
        </div>
      ) : (
        <ul className="adm__questions" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.75rem" }}>
          {rows.map(({ question: q, version: v }) => (
            <li key={q.id} className="acc-panel" style={{ marginBottom: 0 }}>
              <header
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.65rem",
                  marginBottom: "0.55rem",
                }}
              >
                <div style={{ display: "inline-flex", flexWrap: "wrap", gap: "0.45rem", alignItems: "center" }}>
                  {q.origin === "bank" && !v.retired_at && v.status !== "published" ? (
                    <label style={{ display: "inline-flex", gap: "0.35rem", alignItems: "center" }}>
                      <input
                        type="checkbox"
                        aria-label={`Chọn câu ${q.external_key ?? q.id} phiên bản ${v.version}`}
                        disabled={locked}
                        checked={selected.includes(v.id)}
                        onChange={(event) => {
                          if (!locked) {
                            setSelected((current) =>
                              event.target.checked
                                ? [...current, v.id]
                                : current.filter((id) => id !== v.id),
                            );
                          }
                        }}
                      />
                      <span>Chọn</span>
                    </label>
                  ) : null}
                  <span
                    className="acc-badge"
                    data-tone={
                      v.status === "published" ? "teal" : v.status === "reviewed" ? "amber" : undefined
                    }
                  >
                    {STATUS[v.status]}
                    {v.retired_at ? " · ngừng dùng" : ""}
                  </span>
                  <span className="acc-badge">
                    {q.game_type === "minefield" ? "Bãi Mìn" : "Đường Đua"} · {q.pool} · {q.difficulty} · {q.chapter}
                  </span>
                  <strong style={{ color: "var(--acc-amber)", fontFamily: "var(--font-mono)" }}>
                    {q.external_key}
                  </strong>
                </div>

                <div style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
                  {v.ai_assisted ? (
                    <span className="adm__ai acc-badge" data-tone="blue">
                      AI hỗ trợ soạn
                    </span>
                  ) : null}
                  {q.origin === "fixture" ? (
                    <span className="adm__ai acc-badge" data-tone="amber">
                      GIẢ LẬP
                    </span>
                  ) : null}
                </div>
              </header>

              <p style={{ margin: "0.45rem 0", fontWeight: 700, fontSize: "1rem" }}>
                {v.content_public.prompt}
              </p>

              <ol style={{ margin: "0.35rem 0", paddingLeft: "1.25rem", display: "grid", gap: "0.2rem" }}>
                {v.content_public.options.map((o) => {
                  const isCorrect = o.id === v.content_private.correctOptionId;
                  return (
                    <li
                      key={o.id}
                      className={isCorrect ? "is-correct" : ""}
                      style={{
                        color: isCorrect ? "#5eead4" : "var(--acc-text-Soft)",
                        fontWeight: isCorrect ? 700 : 400,
                      }}
                    >
                      {o.label}
                    </li>
                  );
                })}
              </ol>

              <p style={{ margin: "0.45rem 0 0", fontSize: "0.86rem", color: "var(--acc-text-Soft)" }}>
                {v.content_private.explanation}
              </p>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--acc-muted)" }}>
                Nguồn:{" "}
                {v.question_source_links.length
                  ? v.question_source_links.map((l) => l.locator).join("; ")
                  : "chưa có"}{" "}
                · {q.external_key}
              </p>

              {q.origin === "bank" && !v.retired_at ? (
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                  {ACTIONS[v.status].map((a) => (
                    <button
                      key={a.action}
                      type="button"
                      disabled={locked}
                      onClick={() => void transition(v, a.action)}
                      className={
                        a.action === "publish"
                          ? "acc-btn acc-btn-primary"
                          : a.action === "review"
                            ? "acc-btn acc-btn-amber"
                            : a.action === "retire"
                              ? "acc-btn acc-btn-danger"
                              : "acc-btn"
                      }
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
