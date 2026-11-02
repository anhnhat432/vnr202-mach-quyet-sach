"use client";

import { Activity, ExternalLink, FileClock, Play, RefreshCw, ShieldAlert, Square, Trophy } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "@/features/admin/ui/admin-control-center.css";
import { RehearsalStudio } from "@/features/admin/ui/rehearsal-studio";
import { ArenaApiError, newKey, request } from "@/features/arena/client/api";
import type { Standing } from "@/features/arena/client/types";
import { STANDING_LABEL, formatClock } from "@/features/arena/ui/arena-ui";

type Competition = {
  id: string;
  publicId: string;
  name: string;
  kind: "official" | "rehearsal";
  state: string;
  opensAt: string;
  startDeadlineAt: string;
  standing: Standing;
  attempts: number;
  active: number;
  completed?: number;
  voided?: number;
  participants?: number;
};

type IncidentAction = "note" | "void_attempt" | "revoke_sessions" | "lock_account" | "unlock_account";
type Incident = { action: IncidentAction; reason: string; at: string };

type MonitorRow = {
  attemptId: string;
  profileId: string;
  accountStatus: string;
  incidents: Incident[];
  game: "minefield" | "race";
  state: string;
  studentId: string;
  displayName: string;
  score: number;
  mainAnswered: number;
  mainTotal: number;
  mainCorrect: number;
  remainingMs: number;
  completionDurationMs: number | null;
  heartbeatAgoMs: number | null;
  deviceTransfers: number;
  timeouts: number;
  pendingQuestion: boolean;
};

type AuditRow = {
  at: string;
  action: string;
  targetType: string;
  actor: string;
  after: { reason?: string } | null;
};

type Disclosed = {
  kind: string;
  competitionState: string;
  questions: Array<{
    versionId: string;
    game: string;
    pool: string;
    difficulty: string;
    chapter: string;
    prompt: string;
    confirmed: boolean;
    disclosedBy: Array<{ competition: string; at: string }> | null;
  }>;
};

type Readiness = {
  ready: boolean;
  blockers: string[];
  classSize: number | null;
  target: { meetsTarget: boolean; expectedAttempts: number; maxPerQuestion: number };
  games: Record<
    string,
    {
      slots?: Array<{
        pool: string;
        difficulty: string;
        needed: number;
        available: number;
        expectedAllocationsPerQuestion: number | null;
      }>;
    }
  >;
};

const STATE_LABEL: Record<string, string> = {
  draft: "Nháp",
  scheduled: "Đã chuẩn bị",
  open: "Đang mở",
  start_closed: "Đóng nhận lượt",
  settling: "Chốt kết quả",
  finalized: "Đã kết thúc",
  archived: "Lưu trữ",
};

const LIFECYCLE_STEPS = [
  { key: "draft", label: "1. Nháp" },
  { key: "scheduled", label: "2. Đã chuẩn bị" },
  { key: "open", label: "3. Đang mở" },
  { key: "start_closed", label: "4. Đóng nhận lượt" },
  { key: "settling", label: "5. Chốt kết quả" },
  { key: "finalized", label: "6. Đã kết thúc" },
] as const;

const NEXT_ACTIONS: Record<string, Array<{ target: string; label: string; tone?: "primary" | "amber" | "danger" }>> = {
  draft: [{ target: "scheduled", label: "Kiểm tra & chuẩn bị cuộc thi", tone: "primary" }],
  scheduled: [{ target: "open", label: "Mở cuộc thi", tone: "amber" }],
  open: [{ target: "start_closed", label: "Đóng nhận lượt mới", tone: "danger" }],
  start_closed: [{ target: "settling", label: "Chuyển sang chốt kết quả", tone: "amber" }],
  settling: [{ target: "finalize", label: "Kết thúc & công bố (Finalized)", tone: "danger" }],
  finalized: [{ target: "archived", label: "Lưu trữ" }],
};

const INCIDENT_LABEL: Record<IncidentAction, string> = {
  note: "Ghi chú sự cố",
  revoke_sessions: "Thu hồi mọi phiên đăng nhập",
  lock_account: "Khóa tài khoản",
  unlock_account: "Mở khóa tài khoản",
  void_attempt: "Vô hiệu lượt thi",
};

const INCIDENT_WARNING: Partial<Record<IncidentAction, string>> = {
  void_attempt:
    "Lượt bị loại khỏi bảng xếp hạng. Điểm, lịch sử câu trả lời và sự cố vẫn được giữ; không thể hoàn tác và không tạo lượt thay thế.",
  lock_account:
    "Sinh viên bị đăng xuất khỏi mọi thiết bị và không đăng nhập được. Đồng hồ lượt đang chơi vẫn chạy.",
  revoke_sessions:
    "Sinh viên bị đăng xuất khỏi mọi thiết bị. Đồng hồ lượt đang chơi vẫn chạy.",
};

type WorkspaceTab = "operations" | "rehearsal" | "incidents";

function errorText(error: unknown) {
  if (error instanceof ArenaApiError) return `${error.message} (${error.code})`;
  return "Đã xảy ra lỗi.";
}

export function CompetitionAdmin() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("operations");
  const [list, setList] = useState<Competition[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [monitor, setMonitor] = useState<MonitorRow[]>([]);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ name: string; minutes: number; kind: "rehearsal" | "official" }>({
    name: "Diễn tập Live Arena",
    minutes: 60,
    kind: "rehearsal",
  });
  const [incidentFor, setIncidentFor] = useState<string | null>(null);
  const [auditTick, setAuditTick] = useState(0);
  const [expectedAttempts, setExpectedAttempts] = useState(60);
  const [openMinutes, setOpenMinutes] = useState(60);
  const [acknowledgeRisk, setAcknowledgeRisk] = useState(false);
  const [bankReason, setBankReason] = useState("");
  const [confirmOfficialOpenModal, setConfirmOfficialOpenModal] = useState(false);

  // Sync & staleness tracking
  const [lastUpdatedText, setLastUpdatedText] = useState<string | null>(null);
  const [lastSyncMs, setLastSyncMs] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  // Monitor filters
  const [monitorSearch, setMonitorSearch] = useState("");
  const [monitorGameFilter, setMonitorGameFilter] = useState<"" | "minefield" | "race">("");
  const [monitorStateFilter, setMonitorStateFilter] = useState<string>("");
  const [monitorHealthFilter, setMonitorHealthFilter] = useState<"" | "disconnected" | "timeout" | "incident">("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const l = await request<Competition[]>("GET", "/admin/competitions");
      if (!mountedRef.current) return;
      setList(l);
      setSyncError(null);
      setLastUpdatedText(new Date().toLocaleTimeString("vi-VN"));
      setLastSyncMs(Date.now());
      // Prevent accidental selection of an unopened official competition when multiple competitions exist:
      // Auto-select if a competition is currently 'open', or if there is only 1 competition in the list.
      setSelected((s) => {
        if (s && l.some((c) => c.id === s)) return s;
        const openComp = l.find((c) => c.state === "open");
        if (openComp) return openComp.id;
        if (l.length === 1) return l[0]!.id;
        return null;
      });
    } catch (e) {
      if (!mountedRef.current) return;
      const errText = errorText(e);
      setMessage(errText);
      setSyncError(errText);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);

  const current = list?.find((c) => c.id === selected) ?? null;

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    const pull = async () => {
      try {
        const m = await request<{ attempts: MonitorRow[] }>("GET", `/admin/competitions/${selected}/monitor`);
        if (alive) {
          setMonitor(m.attempts ?? []);
          setSyncError(null);
          setLastUpdatedText(new Date().toLocaleTimeString("vi-VN"));
          setLastSyncMs(Date.now());
        }
      } catch (e) {
        if (alive) setSyncError(errorText(e));
      }
    };
    const first = window.setTimeout(() => void pull(), 0);
    const timer = window.setInterval(() => void pull(), 4000);
    request<Readiness>("GET", `/admin/competitions/${selected}/readiness?expectedAttempts=${expectedAttempts}`)
      .then((r) => alive && setReadiness(r))
      .catch(() => undefined);
    return () => {
      alive = false;
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [selected, auditTick, expectedAttempts]);

  function incidentDone(text: string) {
    setIncidentFor(null);
    setMessage(text);
    setAuditTick((t) => t + 1);
    void load();
  }

  async function create() {
    setBusy(true);
    setMessage(null);
    try {
      const c = await request<{ id: string }>("POST", "/admin/competitions", {
        body: {
          name: form.name,
          kind: form.kind,
          opensAt: new Date(Date.now() - 60_000).toISOString(),
          startDeadlineAt: new Date(Date.now() + form.minutes * 60_000).toISOString(),
        },
        key: newKey("create"),
      });
      setSelected(c.id);
      setOpenMinutes(form.minutes);
      await load();
      setMessage(
        form.kind === "official"
          ? "Đã tạo cuộc thi chính thức (Nháp)."
          : "Đã tạo cuộc thi diễn tập (Nháp).",
      );
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function executeTransition(target: string) {
    if (!current) return;
    if (
      target === "finalize" &&
      !window.confirm(
        "Kết thúc cuộc thi? Đáp án sẽ mở cho người đã chơi và bảng được gắn nhãn chính thức (với cuộc thi chính thức).",
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (target === "finalize") {
        await request("POST", `/admin/competitions/${current.id}/finalize`);
      } else {
        const belowTarget =
          current.kind === "official" &&
          target === "scheduled" &&
          readiness &&
          !readiness.target.meetsTarget;
        await request("POST", `/admin/competitions/${current.id}/transitions`, {
          body: {
            target,
            ...(target === "open" ? { startWindowMinutes: openMinutes } : {}),
            ...(target === "scheduled" ? { expectedAttempts } : {}),
            ...(belowTarget
              ? {
                  bankAcknowledgement: {
                    expectedAttempts,
                    confirmed: acknowledgeRisk,
                    reason: bankReason,
                  },
                }
              : {}),
          },
        });
      }
      await load();
      setAuditTick((t) => t + 1);
      setMessage(`Đã chuyển: ${STATE_LABEL[target === "finalize" ? "finalized" : target]}.`);
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function handleActionClick(target: string) {
    if (!current) return;
    // Opening an official competition requires an explicit confirmation modal showing Name, Kind, Class Size, and Window
    if (target === "open" && current.kind === "official") {
      setConfirmOfficialOpenModal(true);
      return;
    }
    void executeTransition(target);
  }

  async function reconcile() {
    if (!current) return;
    setBusy(true);
    try {
      const r = await request<{ reconciled: number; activeAttempts: number; startClosed: boolean }>(
        "POST",
        `/admin/competitions/${current.id}/reconcile`,
      );
      setMessage(
        `Đã đối soát ${r.reconciled} lượt; còn ${r.activeAttempts} lượt đang chơi${
          r.startClosed ? "; đã tự đóng nhận lượt mới" : ""
        }.`,
      );
      await load();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const isDataStale = lastSyncMs !== null && nowTick - lastSyncMs > 15_000;

  const disconnectedCount = useMemo(
    () =>
      monitor.filter(
        (m) => m.state === "active" && (m.heartbeatAgoMs === null || m.heartbeatAgoMs >= 12_000),
      ).length,
    [monitor],
  );
  const completedCount = useMemo(
    () =>
      current?.completed ??
      monitor.filter((m) => m.state === "completed" || m.state === "timed_out").length,
    [current, monitor],
  );
  const participantCount = useMemo(
    () => current?.participants ?? new Set(monitor.map((m) => m.profileId)).size,
    [current, monitor],
  );

  const filteredMonitor = useMemo(() => {
    const q = monitorSearch.trim().toLowerCase();
    return monitor.filter((m) => {
      if (monitorGameFilter && m.game !== monitorGameFilter) return false;
      if (monitorStateFilter && m.state !== monitorStateFilter) return false;
      if (monitorHealthFilter === "disconnected") {
        const lost = m.state === "active" && (m.heartbeatAgoMs === null || m.heartbeatAgoMs >= 12_000);
        if (!lost) return false;
      } else if (monitorHealthFilter === "timeout" && m.timeouts === 0) {
        return false;
      } else if (monitorHealthFilter === "incident" && m.incidents.length === 0 && m.accountStatus !== "locked") {
        return false;
      }
      if (q) {
        const hay = `${m.studentId ?? ""} ${m.displayName} ${m.accountStatus}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [monitor, monitorSearch, monitorGameFilter, monitorStateFilter, monitorHealthFilter]);

  const byGame = (game: "minefield" | "race") => filteredMonitor.filter((m) => m.game === game);
  const activeStepIndex = current ? LIFECYCLE_STEPS.findIndex((s) => s.key === current.state) : -1;

  return (
    <main aria-label="Admin Control Center">
      {/* Command Header */}
      <header className="acc-page-header">
        <div>
          <p className="acc-kicker">Trung tâm chỉ huy trực tiếp · Live Arena</p>
          <h1 className="acc-title">Điều hành cuộc thi</h1>
          <p className="acc-subtitle">
            Giám sát thời gian thực, điều phối cuộc thi chính thức và vận hành Phòng thi thử khép kín. Quản trị viên
            không sửa điểm, thời gian hay lượt thi; không tạo lượt thay thế.
          </p>
        </div>

        <div className="acc-sync-bar">
          {lastUpdatedText && (
            <span className="acc-badge" data-tone={isDataStale || syncError ? "amber" : "teal"}>
              Cập nhật lần cuối: {lastUpdatedText}
            </span>
          )}
          <button
            type="button"
            className="acc-btn"
            disabled={busy}
            onClick={() => {
              void load();
              setAuditTick((t) => t + 1);
            }}
          >
            Làm mới ngay
          </button>
        </div>
      </header>

      {/* Stale data or API error warning banner */}
      {(syncError || isDataStale) && (
        <div className="acc-banner" data-tone={syncError ? "red" : "amber"} role="alert">
          <div>
            <strong>{syncError ? "Cảnh báo lỗi kết nối API:" : "Cảnh báo dữ liệu giám sát đã cũ:"}</strong>{" "}
            {syncError ?? "Dữ liệu chưa được cập nhật trong hơn 15 giây qua. Hãy kiểm tra đường truyền mạng."}
          </div>
          <button type="button" className="acc-btn" onClick={() => void load()}>
            Đồng bộ lại
          </button>
        </div>
      )}

      {/* Overview KPI Dashboard Cards */}
      <section aria-label="Chỉ số tổng quan" className="acc-kpi-grid">
        <div className="acc-kpi-card" data-tone={current?.state === "open" ? "teal" : "amber"}>
          <span className="acc-kpi-label">Trạng thái cuộc thi</span>
          <span className="acc-kpi-value" style={{ fontSize: "1.2rem" }}>
            {current ? (STATE_LABEL[current.state] ?? current.state) : "Chưa chọn"}
          </span>
          <span className="acc-kpi-meta">
            {current
              ? `${current.kind === "official" ? "Chính thức" : "Diễn tập"} · ${current.name}`
              : `${list?.length ?? 0} cuộc thi trên hệ thống`}
          </span>
        </div>

        <div className="acc-kpi-card" data-tone="teal">
          <span className="acc-kpi-label">Người tham gia / Sĩ số</span>
          <span className="acc-kpi-value">
            {participantCount}
            {readiness?.classSize ? ` / ${readiness.classSize}` : ""}
          </span>
          <span className="acc-kpi-meta">Tổng lượt đã tạo: {current?.attempts ?? monitor.length} lượt</span>
        </div>

        <div className="acc-kpi-card" data-tone={(current?.active ?? 0) > 0 ? "amber" : undefined}>
          <span className="acc-kpi-label">Đang chơi trực tiếp</span>
          <span className="acc-kpi-value">{current?.active ?? monitor.filter((m) => m.state === "active").length}</span>
          <span className="acc-kpi-meta">Bãi Mìn & Đường Đua thời gian thực</span>
        </div>

        <div className="acc-kpi-card" data-tone="teal">
          <span className="acc-kpi-label">Đã hoàn thành</span>
          <span className="acc-kpi-value">{completedCount}</span>
          <span className="acc-kpi-meta">Đã nộp hết câu hoặc hết giờ</span>
        </div>

        <div className="acc-kpi-card" data-tone={disconnectedCount > 0 ? "red" : "teal"}>
          <span className="acc-kpi-label">Cảnh báo kết nối & sự cố</span>
          <span className="acc-kpi-value">{disconnectedCount}</span>
          <span className="acc-kpi-meta">
            {disconnectedCount > 0
              ? `${disconnectedCount} phiên mất nhịp tim >=12s`
              : "Tín hiệu kết nối ổn định"}
          </span>
        </div>
      </section>

      {/* Primary Mode Switcher Tabs */}
      <div className="acc-tabs" role="tablist" aria-label="Chế độ điều hành">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "operations"}
          className="acc-tab"
          onClick={() => setActiveTab("operations")}
        >
          <span>Điều hành & Giám sát trực tiếp</span>
          <span className="acc-tab-count">{list?.length ?? 0}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "rehearsal"}
          className="acc-tab"
          onClick={() => setActiveTab("rehearsal")}
        >
          <span>Phòng thi thử khép kín (Rehearsal Studio)</span>
          <span className="acc-badge" data-tone="teal" style={{ padding: "0.1rem 0.45rem", fontSize: "0.68rem" }}>
            SANDBOX
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "incidents"}
          className="acc-tab"
          onClick={() => setActiveTab("incidents")}
        >
          <span>Sự cố & Nhật ký Audit</span>
        </button>
      </div>

      {/* TAB 2: Closed-loop Rehearsal Studio */}
      {activeTab === "rehearsal" && (
        <RehearsalStudio
          onCompetitionChanged={() => {
            void load();
            setAuditTick((t) => t + 1);
          }}
        />
      )}

      {/* TAB 1 & 3: Competition Operations & Incident/Audit Control Room */}
      {activeTab !== "rehearsal" && (
        <div
          className="adm"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(20rem, 1fr))",
            gap: "1rem",
            alignItems: "start",
          }}
        >
          {/* Left Column: Competition Selector & Create Form */}
          <section className="acc-panel adm__panel" style={{ marginBottom: 0 }}>
            <div className="acc-panel-header">
              <h2 className="acc-panel-title">Cuộc thi ({list?.length ?? 0})</h2>
              <button
                type="button"
                className="acc-btn acc-btn-amber"
                style={{ minHeight: "2rem", padding: "0.25rem 0.65rem", fontSize: "0.78rem" }}
                onClick={() => setActiveTab("rehearsal")}
              >
                Phòng thi thử →
              </button>
            </div>

            {list === null ? (
              <p style={{ color: "var(--acc-muted)" }}>Đang tải…</p>
            ) : list.length === 0 ? (
              <p style={{ color: "var(--acc-muted)" }}>Chưa có cuộc thi nào.</p>
            ) : (
              <ul
                className="adm__list"
                style={{ listStyle: "none", padding: 0, margin: "0 0 1.1rem", display: "grid", gap: "0.55rem" }}
              >
                {list.map((c) => {
                  const isSelected = c.id === selected;
                  const isOfficial = c.kind === "official";
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        data-selected={isSelected}
                        onClick={() => {
                          setSelected(c.id);
                          setAcknowledgeRisk(false);
                          setBankReason("");
                          setReadiness(null);
                        }}
                        className="acc-comp-card"
                        style={{ width: "100%" }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: "0.4rem" }}>
                          <span className="acc-badge" data-tone={isOfficial ? "red" : "teal"}>
                            {isOfficial ? "Chính thức" : "Diễn tập"}
                          </span>
                          <span
                            className="acc-badge"
                            data-tone={c.state === "open" ? "amber" : c.state === "finalized" ? "teal" : undefined}
                          >
                            {STATE_LABEL[c.state] ?? c.state}
                          </span>
                        </div>
                        <strong style={{ fontSize: "0.98rem" }}>{c.name}</strong>
                        <span style={{ fontSize: "0.8rem", color: "var(--acc-muted)" }}>
                          {c.kind === "rehearsal" ? "Diễn tập" : "Chính thức"} · {STATE_LABEL[c.state] ?? c.state} ·{" "}
                          {c.attempts} lượt ({c.active} đang chơi)
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <form
              className="adm__create acc-panel-alt"
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
              style={{ display: "grid", gap: "0.65rem" }}
            >
              <h3 style={{ margin: 0, fontSize: "1rem" }}>Tạo cuộc thi</h3>
              <label className="acc-field">
                <span>Loại cuộc thi</span>
                <select
                  className="acc-select"
                  value={form.kind}
                  onChange={(e) => {
                    const kind = e.target.value as "rehearsal" | "official";
                    setForm({
                      ...form,
                      kind,
                      name:
                        form.name === "Diễn tập Live Arena" || form.name === "Cuộc thi Live Arena"
                          ? kind === "official"
                            ? "Cuộc thi Live Arena"
                            : "Diễn tập Live Arena"
                          : form.name,
                    });
                  }}
                >
                  <option value="rehearsal">Diễn tập</option>
                  <option value="official">Chính thức</option>
                </select>
              </label>

              <label className="acc-field">
                <span>Tên</span>
                <input
                  className="acc-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  minLength={3}
                  maxLength={120}
                  required
                />
              </label>

              <label className="acc-field">
                <span>Nhận lượt mới trong (phút)</span>
                <input
                  className="acc-input"
                  type="number"
                  min={5}
                  max={720}
                  value={form.minutes}
                  onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })}
                />
              </label>

              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--acc-muted)" }}>
                Diễn tập chỉ lấy bộ câu giả lập <code>[GIẢ LẬP]</code>; cuộc thi chính thức chỉ dùng câu{" "}
                <code>Published</code> đã duyệt học thuật và không cho phép xóa/reset.
              </p>

              <p
                role="note"
                style={{
                  margin: 0,
                  padding: "0.5rem 0.65rem",
                  borderRadius: "6px",
                  background: "rgba(240, 170, 60, 0.12)",
                  border: "1px solid rgba(240, 170, 60, 0.35)",
                  fontSize: "0.78rem",
                  color: "#fde68a",
                }}
              >
                <ShieldAlert aria-hidden size={14} style={{ verticalAlign: "middle", marginRight: "0.25rem" }} />
                Mật khẩu mặc định chung <b>không bảo đảm danh tính</b>: chỉ dùng cho thi đua lớp học (LA-ACC-006).
              </p>

              <button type="submit" disabled={busy} className="acc-btn acc-btn-primary">
                Tạo (Nháp)
              </button>
            </form>
          </section>

          {/* Right Wide Column: Selected Competition Control Panel & Live Monitor */}
          <section
            className="acc-panel adm__panel adm__panel--wide acc-col-span-2"
            style={{ marginBottom: 0 }}
          >
            {current ? (
              <>
                <header className="acc-panel-header adm__head">
                  <div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginBottom: "0.3rem" }}>
                      <span className="acc-badge" data-tone={current.kind === "official" ? "red" : "teal"}>
                        {current.kind === "official" ? "Chính thức" : "Diễn tập"}
                      </span>
                      <span className="acc-badge" data-tone={current.state === "open" ? "amber" : "teal"}>
                        {STATE_LABEL[current.state]}
                      </span>
                    </div>
                    <h2 style={{ margin: 0, fontSize: "1.35rem" }}>{current.name}</h2>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.86rem", color: "var(--acc-text-Soft)" }}>
                      {STATE_LABEL[current.state]} · nhãn bảng: <b>{STANDING_LABEL[current.standing]}</b>
                      {current.state === "draft" || current.state === "scheduled"
                        ? " · chờ bạn bấm Mở cuộc thi"
                        : ` · nhận lượt tới ${new Date(current.startDeadlineAt).toLocaleString("vi-VN")}`}
                    </p>
                  </div>
                  <div className="adm__links" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    <Link href="/trinh-chieu" target="_blank" className="acc-btn">
                      <Trophy aria-hidden size={16} /> Trình chiếu <ExternalLink aria-hidden size={12} />
                    </Link>
                    <Link href="/live-arena/bang-xep-hang" target="_blank" className="acc-btn">
                      Bảng xếp hạng <ExternalLink aria-hidden size={12} />
                    </Link>
                  </div>
                </header>

                {/* Lifecycle Stepper */}
                <div className="acc-stepper" aria-label="Tiến trình trạng thái cuộc thi">
                  {LIFECYCLE_STEPS.map((step, idx) => (
                    <div
                      key={step.key}
                      className="acc-step"
                      data-active={current.state === step.key}
                      data-done={activeStepIndex > idx}
                    >
                      <span>{step.label}</span>
                    </div>
                  ))}
                </div>

                {/* Readiness & Window Controls */}
                <div className="acc-panel-alt" style={{ marginBottom: "0.9rem", display: "grid", gap: "0.65rem" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem", alignItems: "center" }}>
                    {current.state === "draft" && current.kind === "official" ? (
                      <label className="acc-field" style={{ flexDirection: "row", alignItems: "center", gap: "0.45rem" }}>
                        <span>Sĩ số dự kiến</span>
                        <input
                          className="acc-input"
                          style={{ width: "6rem" }}
                          type="number"
                          min={1}
                          max={500}
                          value={expectedAttempts}
                          onChange={(e) => {
                            setExpectedAttempts(Number(e.target.value));
                            setAcknowledgeRisk(false);
                            setReadiness(null);
                          }}
                        />
                      </label>
                    ) : null}

                    {current.state === "scheduled" ? (
                      <label className="acc-field" style={{ flexDirection: "row", alignItems: "center", gap: "0.45rem" }}>
                        <span>Nhận lượt mới sau khi mở (phút)</span>
                        <input
                          className="acc-input"
                          style={{ width: "6rem" }}
                          type="number"
                          min={1}
                          max={1440}
                          value={openMinutes}
                          onChange={(e) => setOpenMinutes(Number(e.target.value))}
                        />
                      </label>
                    ) : null}
                  </div>

                  {readiness && current.state === "draft" ? (
                    <div className={`adm__ready ${readiness.ready ? "is-ok" : "is-bad"}`} style={{ display: "grid", gap: "0.45rem" }}>
                      <p style={{ margin: 0 }}>
                        {readiness.ready
                          ? "Ngân hàng câu đủ điều kiện bắt buộc."
                          : `Chưa đủ điều kiện: ${readiness.blockers.join(", ")}`}
                      </p>
                      {current.kind === "official" && readiness.classSize != null ? (
                        <p
                          role={readiness.classSize !== readiness.target.expectedAttempts ? "alert" : undefined}
                          style={{
                            margin: 0,
                            padding:
                              readiness.classSize !== readiness.target.expectedAttempts ? "0.5rem 0.75rem" : undefined,
                            borderRadius: "6px",
                            background:
                              readiness.classSize !== readiness.target.expectedAttempts
                                ? "rgba(240, 170, 60, 0.15)"
                                : undefined,
                            color:
                              readiness.classSize !== readiness.target.expectedAttempts ? "#fde68a" : undefined,
                          }}
                        >
                          Danh sách lớp hiện có {readiness.classSize} sinh viên
                          {readiness.classSize !== readiness.target.expectedAttempts
                            ? `, khác sĩ số dự kiến ${readiness.target.expectedAttempts}. Hãy kiểm tra trước khi xác nhận.`
                            : "."}
                        </p>
                      ) : null}
                      {current.kind === "official" && !readiness.target.meetsTarget ? (
                        <>
                          <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--acc-text-Soft)" }}>
                            Sĩ số dự kiến {readiness.target.expectedAttempts}: chưa đạt mục tiêu tối đa{" "}
                            {readiness.target.maxPerQuestion} lượt phân bổ mỗi câu. Một câu có thể được nhiều sinh viên
                            nhận, tăng rủi ro chia sẻ đáp án.
                          </p>
                          {readiness.ready ? (
                            <div style={{ display: "grid", gap: "0.5rem" }}>
                              <label style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={acknowledgeRisk}
                                  onChange={(e) => setAcknowledgeRisk(e.target.checked)}
                                />
                                <span>Tôi đã xem và chấp nhận rủi ro phân bổ lặp.</span>
                              </label>
                              <label className="acc-field">
                                <span>Lý do xác nhận</span>
                                <textarea
                                  className="acc-textarea"
                                  value={bankReason}
                                  minLength={3}
                                  maxLength={300}
                                  onChange={(e) => setBankReason(e.target.value)}
                                />
                              </label>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Action Buttons — Separated Normal vs Danger */}
                  <div
                    className="adm__actions"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      gap: "0.65rem",
                      paddingTop: "0.35rem",
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
                      {(NEXT_ACTIONS[current.state] ?? []).map((a) => {
                        const isBlockedSchedule =
                          a.target === "scheduled" &&
                          current.kind === "official" &&
                          (!readiness ||
                            !readiness.ready ||
                            (!readiness.target.meetsTarget && (!acknowledgeRisk || bankReason.trim().length < 3)));
                        const btnClass =
                          a.tone === "danger"
                            ? "acc-btn acc-btn-danger-solid"
                            : a.tone === "amber"
                              ? "acc-btn acc-btn-amber"
                              : "acc-btn acc-btn-primary";
                        return (
                          <button
                            key={a.target}
                            type="button"
                            className={btnClass}
                            disabled={busy || isBlockedSchedule}
                            onClick={() => handleActionClick(a.target)}
                          >
                            {a.target === "open" ? (
                              <Play aria-hidden size={16} />
                            ) : a.target === "start_closed" ? (
                              <Square aria-hidden size={16} />
                            ) : null}{" "}
                            {a.label}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      className="acc-btn is-ghost"
                      disabled={busy}
                      onClick={() => void reconcile()}
                    >
                      <RefreshCw aria-hidden size={16} /> Đối soát các lượt
                    </button>
                  </div>
                </div>

                {message ? (
                  <div className="acc-banner adm__message" data-tone="amber" role="status">
                    <span>{message}</span>
                  </div>
                ) : null}

                {/* Monitor Filter Bar */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))",
                    gap: "0.6rem",
                    marginBottom: "0.85rem",
                  }}
                >
                  <label className="acc-field">
                    <span>Tìm kiếm sinh viên</span>
                    <input
                      className="acc-input"
                      placeholder="Nhập MSSV hoặc tên hiển thị..."
                      value={monitorSearch}
                      onChange={(e) => setMonitorSearch(e.target.value)}
                    />
                  </label>
                  <label className="acc-field">
                    <span>Lọc theo Game</span>
                    <select
                      className="acc-select"
                      value={monitorGameFilter}
                      onChange={(e) => setMonitorGameFilter(e.target.value as "" | "minefield" | "race")}
                    >
                      <option value="">Tất cả 2 game</option>
                      <option value="minefield">Bãi Mìn Tri Thức</option>
                      <option value="race">Đường Đua Lịch Sử</option>
                    </select>
                  </label>
                  <label className="acc-field">
                    <span>Lọc trạng thái</span>
                    <select
                      className="acc-select"
                      value={monitorStateFilter}
                      onChange={(e) => setMonitorStateFilter(e.target.value)}
                    >
                      <option value="">Tất cả trạng thái</option>
                      <option value="active">Đang chơi</option>
                      <option value="completed">Hoàn thành</option>
                      <option value="timed_out">Hết giờ</option>
                      <option value="voided">Vô hiệu</option>
                    </select>
                  </label>
                  <label className="acc-field">
                    <span>Lọc cảnh báo</span>
                    <select
                      className="acc-select"
                      value={monitorHealthFilter}
                      onChange={(e) =>
                        setMonitorHealthFilter(e.target.value as "" | "disconnected" | "timeout" | "incident")
                      }
                    >
                      <option value="">Tất cả tín hiệu</option>
                      <option value="disconnected">Mất kết nối (&gt;=12s)</option>
                      <option value="timeout">Có câu hết giờ</option>
                      <option value="incident">Có sự cố / TK khóa</option>
                    </select>
                  </label>
                </div>

                {/* Live Monitor Tables (.adm__monitor) */}
                <div className="adm__monitor" style={{ display: "grid", gap: "0.95rem", marginBottom: "1rem" }}>
                  {(["minefield", "race"] as const)
                    .filter((game) => !monitorGameFilter || monitorGameFilter === game)
                    .map((game) => (
                      <div key={game} className="acc-panel-alt">
                        <h3 style={{ margin: "0 0 0.6rem", fontSize: "0.98rem", display: "flex", alignItems: "center", gap: "0.45rem" }}>
                          <Activity aria-hidden size={16} />{" "}
                          {game === "minefield" ? "Bãi Mìn Tri Thức" : "Đường Đua Lịch Sử"} · {byGame(game).length} lượt
                        </h3>
                        <div className="acc-table-wrap">
                          <table className="acc-table">
                            <thead>
                              <tr>
                                <th>MSSV</th>
                                <th>Tên hiển thị</th>
                                <th>Trạng thái</th>
                                <th>Tiến độ</th>
                                <th>Điểm</th>
                                <th>Thời gian</th>
                                <th>Kết nối</th>
                                <th>Ghi nhận</th>
                                <th>Sự cố</th>
                                <th>
                                  <span className="sr-only">Thao tác</span>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {byGame(game).map((m) => {
                                const isDisconnected =
                                  m.state === "active" && (m.heartbeatAgoMs === null || m.heartbeatAgoMs >= 12_000);
                                return (
                                  <tr key={m.attemptId}>
                                    <td>
                                      <code>{m.studentId}</code>
                                    </td>
                                    <td>
                                      <strong>{m.displayName}</strong>
                                    </td>
                                    <td>
                                      <span
                                        className="acc-badge"
                                        data-tone={
                                          m.state === "active"
                                            ? "amber"
                                            : m.state === "completed"
                                              ? "teal"
                                              : m.state === "voided"
                                                ? "red"
                                                : undefined
                                        }
                                      >
                                        {m.state === "active"
                                          ? "Đang chơi"
                                          : m.state === "completed"
                                            ? "Hoàn thành"
                                            : m.state === "timed_out"
                                              ? "Hết giờ"
                                              : "Vô hiệu"}
                                      </span>
                                    </td>
                                    <td>
                                      {m.mainAnswered}/{m.mainTotal} ({m.mainCorrect} đúng)
                                    </td>
                                    <td>
                                      <b style={{ color: "var(--acc-amber)" }}>{m.score}</b>
                                    </td>
                                    <td>
                                      {m.state === "active"
                                        ? `còn ${formatClock(m.remainingMs)}`
                                        : m.completionDurationMs !== null
                                          ? formatClock(m.completionDurationMs)
                                          : "—"}
                                    </td>
                                    <td>
                                      {m.state !== "active" ? (
                                        "—"
                                      ) : m.heartbeatAgoMs === null ? (
                                        <span className="acc-badge" data-tone="red">
                                          chưa có
                                        </span>
                                      ) : !isDisconnected ? (
                                        <span className="acc-badge" data-tone="teal">
                                          tốt
                                        </span>
                                      ) : (
                                        <span className="acc-badge" data-tone="red">
                                          mất {Math.round(m.heartbeatAgoMs / 1000)} s
                                        </span>
                                      )}
                                    </td>
                                    <td>
                                      {[
                                        m.deviceTransfers ? `${m.deviceTransfers} lần đổi thiết bị` : null,
                                        m.timeouts ? `${m.timeouts} câu hết giờ` : null,
                                      ]
                                        .filter(Boolean)
                                        .join(" · ") || "—"}
                                    </td>
                                    <td>
                                      {m.accountStatus === "locked" ? (
                                        <span className="adm__tag is-bad acc-badge" data-tone="red">
                                          TK bị khóa
                                        </span>
                                      ) : null}
                                      {m.incidents.length ? (
                                        <span
                                          title={m.incidents
                                            .map((i) => `${INCIDENT_LABEL[i.action]}: ${i.reason}`)
                                            .join("\n")}
                                        >
                                          {m.incidents.length} ghi nhận ·{" "}
                                          {INCIDENT_LABEL[m.incidents.at(-1)!.action]}
                                        </span>
                                      ) : m.accountStatus === "locked" ? null : (
                                        "—"
                                      )}
                                    </td>
                                    <td>
                                      <button
                                        type="button"
                                        className="adm__small acc-btn"
                                        style={{ minHeight: "1.95rem", padding: "0.2rem 0.6rem", fontSize: "0.78rem" }}
                                        aria-expanded={incidentFor === m.attemptId}
                                        onClick={() =>
                                          setIncidentFor(incidentFor === m.attemptId ? null : m.attemptId)
                                        }
                                      >
                                        Xử lý
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                </div>

                {incidentFor && monitor.find((m) => m.attemptId === incidentFor) ? (
                  <IncidentPanel
                    key={incidentFor}
                    row={monitor.find((m) => m.attemptId === incidentFor)!}
                    onDone={incidentDone}
                    onClose={() => setIncidentFor(null)}
                  />
                ) : null}

                {current.kind === "official" ? (
                  <DisclosedQuestions key={current.id} competitionId={current.id} onDone={incidentDone} />
                ) : null}

                <AuditLog
                  competitionId={current.id}
                  refresh={auditTick}
                  defaultOpen={activeTab === "incidents"}
                />
              </>
            ) : (
              <div className="acc-panel-alt" role="status">
                <strong>Chưa chọn cuộc thi điều hành:</strong> Chọn hoặc tạo một cuộc thi ở cột bên trái để bắt đầu
                điều hành (hệ thống không tự chọn cuộc thi chính thức chưa mở để tránh thao tác nhầm).
              </div>
            )}
          </section>
        </div>
      )}

      {/* Confirmation Modal for Opening an Official Competition */}
      {confirmOfficialOpenModal && current && (
        <div
          className="acc-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-official-open-title"
        >
          <div className="acc-modal">
            <p className="acc-kicker" style={{ color: "#fca5a5" }}>
              Xác nhận vận hành chính thức
            </p>
            <h3 id="confirm-official-open-title" style={{ margin: "0 0 0.5rem", fontSize: "1.25rem" }}>
              Xác nhận mở cuộc thi chính thức?
            </h3>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--acc-text-Soft)" }}>
              Khi mở cuộc thi chính thức, sinh viên trong danh sách lớp sẽ bắt đầu vào làm bài trực tiếp. Hãy kiểm tra
              kỹ các thông số dưới đây trước khi xác nhận:
            </p>
            <div className="acc-modal-summary">
              <div className="acc-modal-row">
                <span>Tên cuộc thi:</span>
                <strong>{current.name}</strong>
              </div>
              <div className="acc-modal-row">
                <span>Loại cuộc thi:</span>
                <strong style={{ color: "#fca5a5" }}>Chính thức (Official)</strong>
              </div>
              <div className="acc-modal-row">
                <span>Sĩ số lớp / Dự kiến:</span>
                <strong>
                  {typeof readiness?.classSize === "number"
                    ? `${readiness.classSize} sinh viên (dự kiến ${expectedAttempts})`
                    : `${expectedAttempts} sinh viên`}
                </strong>
              </div>
              <div className="acc-modal-row">
                <span>Thời gian nhận lượt:</span>
                <strong style={{ color: "var(--acc-amber)" }}>{openMinutes} phút</strong>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
              <button
                type="button"
                className="acc-btn"
                onClick={() => setConfirmOfficialOpenModal(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="acc-btn acc-btn-amber"
                disabled={busy}
                onClick={() => {
                  setConfirmOfficialOpenModal(false);
                  void executeTransition("open");
                }}
              >
                Xác nhận mở cuộc thi chính thức
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function IncidentPanel({
  row,
  onDone,
  onClose,
}: {
  row: MonitorRow;
  onDone: (text: string) => void;
  onClose: () => void;
}) {
  const [action, setAction] = useState<IncidentAction>("note");
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const warning = INCIDENT_WARNING[action];
  const actions = (Object.keys(INCIDENT_LABEL) as IncidentAction[]).filter((a) =>
    a === "lock_account"
      ? row.accountStatus !== "locked"
      : a === "unlock_account"
        ? row.accountStatus === "locked"
        : a === "void_attempt"
          ? row.state !== "voided"
          : true,
  );

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await request("POST", `/admin/attempts/${row.attemptId}/incidents`, { body: { action, reason } });
      onDone(`${INCIDENT_LABEL[action]}: ${row.displayName}.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="adm__incident acc-panel-alt"
      aria-label={`Xử lý sự cố: ${row.displayName}`}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      style={{ marginBottom: "1rem", display: "grid", gap: "0.65rem" }}
    >
      <h3 style={{ margin: 0, fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.45rem" }}>
        <ShieldAlert aria-hidden size={16} /> Xử lý sự cố · {row.studentId} · {row.displayName}
      </h3>
      <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--acc-muted)" }}>
        Không thể sửa điểm, sửa đồng hồ, tạo lượt thay thế hay xóa lịch sử. Mọi thao tác được ghi nhật ký kèm lý do.
      </p>
      <fieldset style={{ border: "1px solid var(--acc-border)", borderRadius: "6px", padding: "0.6rem 0.75rem" }}>
        <legend style={{ fontSize: "0.8rem", color: "var(--acc-muted)" }}>Thao tác</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          {actions.map((a) => (
            <label key={a} className="adm__radio" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <input
                type="radio"
                name="incident-action"
                value={a}
                checked={action === a}
                onChange={() => {
                  setAction(a);
                  setAck(false);
                }}
              />{" "}
              {INCIDENT_LABEL[a]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="acc-field">
        <span>Lý do (bắt buộc)</span>
        <textarea
          className="acc-textarea"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          minLength={3}
          maxLength={300}
          required
          rows={2}
        />
      </label>
      {warning ? (
        <label className="adm__confirm" style={{ display: "flex", gap: "0.45rem", alignItems: "flex-start", fontSize: "0.85rem", color: "#fca5a5" }}>
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>{warning}</span>
        </label>
      ) : null}
      {error ? (
        <p className="adm__message is-bad" role="alert">
          {error}
        </p>
      ) : null}
      <div className="adm__actions" style={{ display: "flex", gap: "0.55rem" }}>
        <button
          type="submit"
          disabled={busy || reason.trim().length < 3 || (Boolean(warning) && !ack)}
          className={
            action === "void_attempt" || action === "lock_account"
              ? "acc-btn acc-btn-danger-solid"
              : "acc-btn acc-btn-primary"
          }
        >
          {INCIDENT_LABEL[action]}
        </button>
        <button type="button" className="acc-btn is-ghost" onClick={onClose}>
          Đóng
        </button>
      </div>
    </form>
  );
}

function AuditLog({
  competitionId,
  refresh,
  defaultOpen = false,
}: {
  competitionId: string;
  refresh: number;
  defaultOpen?: boolean;
}) {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    request<AuditRow[]>("GET", `/admin/competitions/${competitionId}/audit`)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [competitionId, refresh]);
  return (
    <details className="adm__audit acc-panel-alt" open={defaultOpen} style={{ marginTop: "0.85rem" }}>
      <summary style={{ cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.45rem" }}>
        <FileClock aria-hidden size={16} /> Nhật ký thao tác {rows ? `(${rows.length})` : ""}
      </summary>
      {rows && rows.length ? (
        <ol style={{ margin: "0.65rem 0 0", paddingLeft: "1.2rem", maxHeight: "16rem", overflowY: "auto", display: "grid", gap: "0.3rem", fontSize: "0.84rem" }}>
          {rows.map((r, i) => (
            <li key={`${r.at}-${i}`}>
              <time dateTime={r.at}>{new Date(r.at).toLocaleString("vi-VN")}</time> · <b>{r.actor}</b> ·{" "}
              <code>{r.action}</code>
              {r.after?.reason ? <> · {r.after.reason}</> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p style={{ margin: "0.5rem 0 0", color: "var(--acc-muted)" }}>Chưa có thao tác nào.</p>
      )}
    </details>
  );
}

function DisclosedQuestions({ competitionId, onDone }: { competitionId: string; onDone: (text: string) => void }) {
  const [data, setData] = useState<Disclosed | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    request<Disclosed>("GET", `/admin/competitions/${competitionId}/disclosed-questions`)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(errorText(e)));
    return () => {
      alive = false;
    };
  }, [competitionId, version]);
  if (!data) return error ? <p className="adm__message is-bad">{error}</p> : null;
  const editable = data.competitionState === "draft";
  async function confirm() {
    if (
      !window.confirm(
        `Cho phép dùng lại ${picked.length} câu đã công bố đáp án trong cuộc thi chính thức này? Thao tác được ghi nhật ký.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await request<{ confirmed: number }>(
        "POST",
        `/admin/competitions/${competitionId}/disclosed-question-confirmations`,
        { body: { questionVersionIds: picked, reason } },
      );
      setPicked([]);
      setReason("");
      setVersion((v) => v + 1);
      onDone(`Đã xác nhận dùng lại ${r.confirmed} câu đã công bố.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="adm__disclosed acc-panel-alt" aria-labelledby="disclosed-title" style={{ marginTop: "0.85rem" }}>
      <h3 id="disclosed-title" style={{ margin: "0 0 0.35rem", fontSize: "0.96rem" }}>
        Câu đã công bố đáp án ({data.questions.length})
      </h3>
      <p style={{ margin: "0 0 0.6rem", fontSize: "0.82rem", color: "var(--acc-muted)" }}>
        Mặc định các câu này bị loại khỏi cuộc thi chính thức. Chỉ chọn khi thật cần, kèm lý do;{" "}
        {editable ? "chỉ làm được khi cuộc thi còn Nháp." : "cuộc thi đã qua Nháp nên không thể thay đổi."}
      </p>
      {data.questions.length === 0 ? (
        <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--acc-muted)" }}>
          Không có câu nào đã công bố đáp án trong nguồn câu của cuộc thi này.
        </p>
      ) : (
        <ul className="adm__qlist" style={{ listStyle: "none", padding: 0, margin: "0 0 0.65rem", display: "grid", gap: "0.4rem" }}>
          {data.questions.map((q) => (
            <li key={q.versionId}>
              <label style={{ display: "flex", gap: "0.45rem", alignItems: "flex-start", fontSize: "0.85rem" }}>
                <input
                  type="checkbox"
                  disabled={!editable || q.confirmed}
                  checked={q.confirmed || picked.includes(q.versionId)}
                  onChange={(e) =>
                    setPicked((p) => (e.target.checked ? [...p, q.versionId] : p.filter((x) => x !== q.versionId)))
                  }
                />
                <span>
                  <b>
                    {q.game === "race" ? "Đường Đua" : "Bãi Mìn"} · {q.pool} · {q.difficulty} · {q.chapter}
                  </b>
                  {q.confirmed ? " · đã xác nhận" : ""}
                  <br />
                  {q.prompt}
                  <br />
                  <small style={{ color: "var(--acc-muted)" }}>
                    Đã công bố ở:{" "}
                    {(q.disclosedBy ?? [])
                      .map((d) => `${d.competition} (${new Date(d.at).toLocaleDateString("vi-VN")})`)
                      .join(", ")}
                  </small>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {editable && data.questions.length ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void confirm();
          }}
          style={{ display: "grid", gap: "0.55rem" }}
        >
          <label className="acc-field">
            <span>Lý do dùng lại (bắt buộc)</span>
            <textarea
              className="acc-textarea"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={3}
              maxLength={300}
              rows={2}
              required
            />
          </label>
          {error ? (
            <p className="adm__message is-bad" role="alert">
              {error}
            </p>
          ) : null}
          <div>
            <button
              type="submit"
              disabled={busy || picked.length === 0 || reason.trim().length < 3}
              className="acc-btn acc-btn-amber"
            >
              Xác nhận dùng lại {picked.length} câu
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
