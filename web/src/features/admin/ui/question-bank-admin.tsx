"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

const POOL_LABEL: Record<string, string> = {
  minefield_main: "Câu chính Bãi Mìn",
  minefield_defuse: "Câu gỡ mìn",
  race: "Câu Đường Đua",
};

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Dễ",
  medium: "Trung bình",
  hard: "Khó",
};

const CHAPTER_LABEL: Record<string, string> = {
  chapter_1: "Chương 1",
  chapter_2: "Chương 2",
  chapter_3: "Chương 3",
};

export function translateReadinessBlocker(code: string): string {
  const poolMatch = /^insufficient_pool:([^:/]+)\/([^:/]+)(?:\/([^:/]+))?$/.exec(code);
  if (poolMatch) {
    const [, first, second, third] = poolMatch;
    if (third) {
      const gameLabel = first === "minefield" ? "Bãi Mìn Tri Thức" : first === "race" ? "Đường Đua Lịch Sử" : first;
      const poolLabel = POOL_LABEL[second] ?? second;
      const diffLabel = DIFFICULTY_LABEL[third] ?? third;
      return `Thiếu câu hỏi ${gameLabel} (${poolLabel}, mức ${diffLabel})`;
    }
    const poolLabel = POOL_LABEL[first] ?? (first === "race" ? "Đường Đua Lịch Sử" : first);
    const diffLabel = DIFFICULTY_LABEL[second] ?? second;
    return `Thiếu câu hỏi ${poolLabel} (mức ${diffLabel})`;
  }
  if (code === "two_option_cap_unsatisfiable:race" || code === "two_option_cap_unsatisfiable") {
    return "Trò Đường Đua Lịch Sử có quá nhiều câu 2 lựa chọn (vượt giới hạn 5 câu)";
  }
  const overLenMatch = /^over_length:([^:]+):(\d+)$/.exec(code);
  if (overLenMatch) {
    const [, game, count] = overLenMatch;
    const gameLabel = game === "minefield" ? "Bãi Mìn Tri Thức" : game === "race" ? "Đường Đua Lịch Sử" : game;
    return `Có ${count} câu hỏi ở ${gameLabel} vượt giới hạn độ dài hiển thị`;
  }
  return `Lý do khác (mã: ${code})`;
}

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

const PAGE_SIZE = 20;

export function QuestionBankAdmin() {
  const [items, setItems] = useState<Question[] | null>(null);
  const [bankSummaryItems, setBankSummaryItems] = useState<Question[] | null>(null);
  const [filter, setFilter] = useState({ origin: "bank", game: "", status: "" });
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [notice, setNotice] = useState<{ tone: "teal" | "amber" | "red"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [transitionModal, setTransitionModal] = useState<{ version: Version; action: string; note: string } | null>(null);

  const seq = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const modalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const locked = busy || confirming || Boolean(transitionModal);

  useEffect(() => {
    if (!notice || notice.tone !== "teal") return;
    const t = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!transitionModal) return;
    const focusTimer = window.setTimeout(() => modalTextareaRef.current?.focus(), 0);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        setTransitionModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [transitionModal, busy]);

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

  const visibleRows = rows.slice(0, visibleCount);

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
    const isUnfilteredBank = filter.origin === "bank" && !filter.game && !filter.status;
    const q = new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as Array<[string, string]>);
    try {
      const next = await request<Question[]>("GET", `/admin/questions?${q.toString()}`, {
        signal: controller.signal,
      });
      if (current === seq.current) {
        setItems(next);
        if (isUnfilteredBank) {
          setBankSummaryItems(next);
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError" || current !== seq.current) return;
      setNotice({
        tone: "red",
        text: e instanceof ArenaApiError ? e.message : "Không tải được ngân hàng câu hỏi.",
      });
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
    setVisibleCount(PAGE_SIZE);
    setFilter((current) => ({ ...current, ...patch }));
  }

  async function reconcile() {
    setSelected([]);
    setItems(null);
    await Promise.all([load(), refreshReadiness()]);
  }

  async function submitTransition(version: Version, action: string, rawNote?: string) {
    if (busy) return;
    const cleanNote = rawNote?.trim();
    if (version.ai_assisted && action === "review" && !cleanNote) return;
    setBusy(true);
    setNotice(null);
    try {
      await request("POST", `/admin/question-versions/${version.id}/transitions`, {
        body: cleanNote ? { action, note: cleanNote } : { action },
      });
      setTransitionModal(null);
      setNotice({ tone: "teal", text: "Đã cập nhật trạng thái câu hỏi." });
    } catch (e) {
      setNotice({
        tone: "red",
        text: e instanceof ArenaApiError ? e.message : "Không thực hiện được.",
      });
    } finally {
      await reconcile();
      setBusy(false);
    }
  }

  function handleActionClick(version: Version, action: string) {
    if (locked) return;
    if (action === "review" || action === "reject" || action === "retire") {
      setTransitionModal({ version, action, note: "" });
      return;
    }
    void submitTransition(version, action);
  }

  // Whole-bank totals (do not change when filtering by difficulty/search/game/status)
  const summaryVersions = useMemo(() => {
    const summarySource = bankSummaryItems ?? items ?? [];
    return summarySource.flatMap((question) => {
      if (question.origin !== "bank") return [];
      const version = question.current_version_id
        ? question.question_versions.find((v) => v.id === question.current_version_id)
        : undefined;
      return version ? [version] : [];
    });
  }, [bankSummaryItems, items]);
  const totalDraftCount = summaryVersions.filter((v) => v.status === "draft").length;
  const totalReviewedCount = summaryVersions.filter((v) => v.status === "reviewed").length;
  const totalPublishedCount = summaryVersions.filter((v) => v.status === "published").length;

  return (
    <main aria-label="Quản lý ngân hàng câu hỏi">
      {notice ? (
        <div
          className="acc-banner"
          data-tone={notice.tone}
          role={notice.tone === "red" ? "alert" : "status"}
          aria-live="polite"
        >
          <span>{notice.text}</span>
          <button type="button" className="acc-btn" onClick={() => setNotice(null)}>
            Đóng
          </button>
        </div>
      ) : null}

      <header className="acc-page-header">
        <div>
          <p className="acc-kicker">Kiểm duyệt học thuật · VNR202</p>
          <h1 className="acc-title">Ngân hàng câu hỏi</h1>
          <p className="acc-subtitle">
            Tìm kiếm, lọc theo trò chơi/độ khó/trạng thái và duyệt học thuật theo nhóm. Câu do AI hỗ trợ soạn nháp bắt
            buộc có người duyệt xác nhận đối chiếu nguồn chính thống trước khi xuất bản.
          </p>
        </div>

        <div className="acc-sync-bar">
          <button
            type="button"
            className="acc-btn"
            disabled={locked}
            onClick={() => {
              setNotice(null);
              void reconcile();
            }}
          >
            Tải lại ngân hàng
          </button>
        </div>
      </header>

      {readiness ? (
        <section className="acc-kpi-grid" aria-label="Tổng quan ngân hàng câu hỏi">
          <div className="acc-kpi-card adm__ready" data-tone={readiness.ready ? "teal" : "red"}>
            <span className="acc-kpi-label">Cuộc thi chính thức</span>
            <span className="acc-kpi-value" style={{ fontSize: "1.1rem" }}>
              {readiness.ready
                ? "ngân hàng đủ điều kiện"
                : `chưa đủ (${readiness.blockers.slice(0, 3).map(translateReadinessBlocker).join("; ")}${
                    readiness.blockers.length > 3 ? "…" : ""
                  })`}
            </span>
            <span className="acc-kpi-meta">
              {readiness.target && !readiness.target.meetsTarget
                ? "chưa đạt mục tiêu 168 câu"
                : "Đạt chuẩn phân phối câu hỏi"}
            </span>
          </div>

          <div className="acc-kpi-card" data-tone="teal">
            <span className="acc-kpi-label">Đã xuất bản</span>
            <span className="acc-kpi-value">{totalPublishedCount}</span>
            <span className="acc-kpi-meta">Tổng toàn ngân hàng chính thức</span>
          </div>

          <div className="acc-kpi-card" data-tone={totalDraftCount + totalReviewedCount > 0 ? "amber" : undefined}>
            <span className="acc-kpi-label">Chờ duyệt / Chờ xuất bản</span>
            <span className="acc-kpi-value">
              {totalDraftCount} / {totalReviewedCount}
            </span>
            <span className="acc-kpi-meta">Nháp / Đã duyệt (toàn ngân hàng)</span>
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
              <option value="minefield">Bãi Mìn Tri Thức</option>
              <option value="race">Đường Đua Lịch Sử</option>
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
                setVisibleCount(PAGE_SIZE);
                setDifficultyFilter(e.target.value);
              }}
              className="acc-select"
            >
              <option value="">Tất cả độ khó</option>
              <option value="easy">Dễ</option>
              <option value="medium">Trung bình</option>
              <option value="hard">Khó</option>
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

          <label className="acc-field acc-col-span-2">
            <span>Tìm kiếm câu hỏi</span>
            <input
              disabled={locked}
              placeholder="Nhập từ khóa câu hỏi, chủ đề hoặc mã câu..."
              value={searchQuery}
              onChange={(e) => {
                if (locked) return;
                setSelected([]);
                setVisibleCount(PAGE_SIZE);
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

      {items === null ? (
        <div className="acc-panel">
          <p style={{ margin: 0 }}>
            {notice?.tone === "red" ? "Danh sách chưa được xác nhận. Hãy tải lại ngân hàng." : "Đang tải…"}
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="acc-panel">
          <p style={{ margin: 0 }}>Không có câu hỏi phù hợp.</p>
        </div>
      ) : (
        <>
          <ul className="adm__questions" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.75rem" }}>
            {visibleRows.map(({ question: q, version: v }) => (
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
                      {q.game_type === "minefield" ? "Bãi Mìn Tri Thức" : "Đường Đua Lịch Sử"} ·{" "}
                      {POOL_LABEL[q.pool] ?? q.pool} · {DIFFICULTY_LABEL[q.difficulty] ?? q.difficulty} ·{" "}
                      {CHAPTER_LABEL[q.chapter] ?? q.chapter}
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
                        onClick={() => handleActionClick(v, a.action)}
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

          {rows.length > visibleCount ? (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "1rem" }}>
              <button
                type="button"
                className="acc-btn acc-btn-amber"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              >
                Xem thêm 20 câu ({visibleCount}/{rows.length})
              </button>
            </div>
          ) : null}
        </>
      )}

      {/* In-Page Transition Note Modal (replaces window.prompt) */}
      {transitionModal && (
        <div
          className="acc-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="question-transition-modal-title"
          onClick={() => {
            if (!transitionModal.note.trim() && !busy) {
              setTransitionModal(null);
            }
          }}
        >
          <form
            className="acc-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              void submitTransition(transitionModal.version, transitionModal.action, transitionModal.note);
            }}
          >
            <p className="acc-kicker">Kiểm duyệt câu hỏi</p>
            <h3 id="question-transition-modal-title" style={{ margin: "0 0 0.5rem", fontSize: "1.2rem" }}>
              {transitionModal.action === "review"
                ? "Duyệt học thuật câu hỏi"
                : transitionModal.action === "retire"
                  ? "Ngừng sử dụng câu hỏi"
                  : "Từ chối / Trả về nháp"}
            </h3>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.88rem", color: "var(--acc-text-Soft)" }}>
              {transitionModal.version.content_public.prompt}
            </p>
            <label className="acc-field" style={{ marginBottom: "1rem" }}>
              <span>
                {transitionModal.version.ai_assisted && transitionModal.action === "review"
                  ? "Câu do AI hỗ trợ soạn: ghi nhận xét của người duyệt (bắt buộc)"
                  : transitionModal.action === "retire"
                    ? "Lý do ngừng sử dụng (bắt buộc)"
                    : "Ghi chú (không bắt buộc)"}
              </span>
              <textarea
                ref={modalTextareaRef}
                className="acc-textarea"
                rows={3}
                maxLength={500}
                required={
                  (transitionModal.version.ai_assisted && transitionModal.action === "review") ||
                  transitionModal.action === "retire"
                }
                value={transitionModal.note}
                onChange={(e) => setTransitionModal({ ...transitionModal, note: e.target.value })}
              />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
              <button
                type="button"
                className="acc-btn"
                disabled={busy}
                onClick={() => setTransitionModal(null)}
              >
                Hủy
              </button>
              <button
                type="submit"
                className={
                  transitionModal.action === "retire" ? "acc-btn acc-btn-danger-solid" : "acc-btn acc-btn-primary"
                }
                disabled={
                  busy ||
                  ((transitionModal.version.ai_assisted && transitionModal.action === "review") ||
                  transitionModal.action === "retire"
                    ? !transitionModal.note.trim()
                    : false)
                }
              >
                {busy ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
