"use client";

import { Activity, Download, ExternalLink, FileClock, Layers, Play, RefreshCw, ShieldAlert, Square, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "@/features/admin/ui/admin-control-center.css";
import { translateReadinessBlocker } from "@/features/admin/ui/question-bank-admin";
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

type RosterStudent = {
  id: string;
  student_id: string;
  full_name: string;
  display_name: string;
  display_name_suffix: number | null;
  status: string;
  updated_at: string;
};

type StudentPlayStatus = "not_entered" | "active" | "half_done" | "both_done" | "disconnected";

type StudentSummary = {
  profileId: string;
  studentId: string;
  displayName: string;
  accountStatus: string;
  minefield: MonitorRow | null;
  race: MonitorRow | null;
  totalScore: number;
  playStatus: StudentPlayStatus;
  isOnline: boolean;
  isDisconnected: boolean;
  heartbeatAgoMs: number | null;
  timeouts: number;
  deviceTransfers: number;
  incidents: Incident[];
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

const ATTEMPT_STATE_LABEL: Record<string, string> = {
  active: "Đang chơi",
  completed: "Hoàn thành",
  timed_out: "Hết giờ",
  voided: "Vô hiệu",
};

const PLAY_STATUS_LABEL: Record<StudentPlayStatus, string> = {
  not_entered: "Chưa vào",
  active: "Đang chơi",
  half_done: "Xong 1/2 trò",
  both_done: "Xong cả hai",
  disconnected: "Mất kết nối",
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
  settling: [{ target: "finalize", label: "Kết thúc & công bố", tone: "danger" }],
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

function isAttemptDone(row: MonitorRow | null): boolean {
  if (!row) return false;
  return row.state === "completed" || row.state === "timed_out";
}

function computeStudentPlayStatus(minefield: MonitorRow | null, race: MonitorRow | null): {
  playStatus: StudentPlayStatus;
  isOnline: boolean;
  isDisconnected: boolean;
  heartbeatAgoMs: number | null;
} {
  const activeAttempt = minefield?.state === "active" ? minefield : race?.state === "active" ? race : null;
  if (activeAttempt) {
    const lost = activeAttempt.heartbeatAgoMs === null || activeAttempt.heartbeatAgoMs >= 12_000;
    return {
      playStatus: lost ? "disconnected" : "active",
      isOnline: !lost,
      isDisconnected: lost,
      heartbeatAgoMs: activeAttempt.heartbeatAgoMs,
    };
  }
  const mDone = isAttemptDone(minefield);
  const rDone = isAttemptDone(race);
  if (mDone && rDone) {
    return { playStatus: "both_done", isOnline: false, isDisconnected: false, heartbeatAgoMs: null };
  }
  if (mDone || rDone || minefield?.state === "voided" || race?.state === "voided") {
    return { playStatus: "half_done", isOnline: false, isDisconnected: false, heartbeatAgoMs: null };
  }
  return { playStatus: "not_entered", isOnline: false, isDisconnected: false, heartbeatAgoMs: null };
}

function exportLeaderboardCsv(compName: string, students: StudentSummary[]) {
  const sorted = [...students].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.studentId.localeCompare(b.studentId, "vi");
  });

  const headers = [
    "STT",
    "MSSV",
    "Tên hiển thị",
    "Trạng thái",
    "Bãi Mìn Tri Thức (Số câu)",
    "Bãi Mìn Tri Thức (Điểm)",
    "Đường Đua Lịch Sử (Số câu)",
    "Đường Đua Lịch Sử (Điểm)",
    "Tổng điểm",
    "Đổi thiết bị",
    "Câu hết giờ",
    "Sự cố / Ghi chú",
  ];

  const rows = sorted.map((s, idx) => {
    const mineProgress = s.minefield
      ? `${s.minefield.mainAnswered}/${s.minefield.mainTotal} (${s.minefield.mainCorrect} đúng)`
      : "Chưa thi";
    const raceProgress = s.race
      ? `${s.race.mainAnswered}/${s.race.mainTotal} (${s.race.mainCorrect} đúng)`
      : "Chưa thi";
    const statusText =
      s.accountStatus === "locked" ? "Tài khoản bị khóa" : PLAY_STATUS_LABEL[s.playStatus];
    const incidentNotes = s.incidents
      .map((i) => `${INCIDENT_LABEL[i.action] || i.action}: ${i.reason}`)
      .join("; ");

    return [
      idx + 1,
      `"${s.studentId}"`,
      `"${s.displayName.replace(/"/g, '""')}"`,
      `"${statusText}"`,
      `"${mineProgress}"`,
      s.minefield?.score ?? 0,
      `"${raceProgress}"`,
      s.race?.score ?? 0,
      s.totalScore,
      s.deviceTransfers,
      s.timeouts,
      `"${incidentNotes.replace(/"/g, '""')}"`,
    ].join(",");
  });

  const bom = "\uFEFF";
  const csvContent = bom + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = (compName || "Cuoc_thi").replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, "_");
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `Bang_Diem_${safeName}_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type WorkspaceTab = "operations" | "rehearsal";

const READABLE_ERROR_MAP: Record<string, string> = {
  attempts_still_active: "Vẫn còn sinh viên đang làm bài nên chưa thể kết thúc cuộc thi. Hãy chờ hoặc chốt các lượt đã hết giờ.",
  readiness_blocked: "Ngân hàng câu hỏi chưa đủ điều kiện bắt buộc để mở cuộc thi.",
  bank_acknowledgement_required: "Ngân hàng chưa đạt mục tiêu phân bổ; cần tích xác nhận rủi ro và nhập lý do.",
  bank_assessment_required: "Cuộc thi cần được kiểm tra & chuẩn bị ngân hàng câu hỏi trước khi mở.",
  official_competition_currently_open: "Đang có cuộc thi chính thức mở. Không thể mở thêm cuộc thi khác lúc này.",
  official_competition_protected: "Cuộc thi chính thức được bảo vệ, không cho phép xóa hoặc đặt lại.",
  already_voided: "Lượt thi này đã bị vô hiệu trước đó.",
  competition_finalized: "Cuộc thi đã công bố kết quả; chỉ có thể thêm ghi chú sự cố.",
  reason_required: "Vui lòng nhập lý do (ít nhất 3 ký tự).",
  confirmation_closed: "Chỉ xác nhận được khi cuộc thi còn ở trạng thái Nháp.",
};

function friendlyErrorText(error: unknown) {
  if (error instanceof ArenaApiError) {
    return READABLE_ERROR_MAP[error.code] ?? error.message ?? "Đã xảy ra lỗi khi xử lý yêu cầu.";
  }
  return "Đã xảy ra lỗi khi xử lý yêu cầu.";
}

export function CompetitionAdmin() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("operations");
  const [list, setList] = useState<Competition[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [monitor, setMonitor] = useState<MonitorRow[]>([]);
  const [rosterStudents, setRosterStudents] = useState<RosterStudent[]>([]);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [notice, setNotice] = useState<{ tone: "teal" | "amber" | "red"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ name: string; kind: "rehearsal" | "official" }>({
    name: "Diễn tập Live Arena",
    kind: "rehearsal",
  });
  const [incidentFor, setIncidentFor] = useState<string | null>(null);
  const [auditTick, setAuditTick] = useState(0);
  const [expectedAttempts, setExpectedAttempts] = useState<number | null>(null);
  const [expectedAttemptsEdited, setExpectedAttemptsEdited] = useState(false);
  const [openMinutes, setOpenMinutes] = useState(60);
  const [acknowledgeRisk, setAcknowledgeRisk] = useState(false);
  const [bankReason, setBankReason] = useState("");
  const [confirmOfficialOpenModal, setConfirmOfficialOpenModal] = useState(false);
  const [confirmFinalizeModal, setConfirmFinalizeModal] = useState(false);

  // Sync & staleness tracking
  const [lastUpdatedText, setLastUpdatedText] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncDelayed, setSyncDelayed] = useState(false);

  // Monitor filters & view mode
  const [monitorViewMode, setMonitorViewMode] = useState<"unified" | "split">("unified");
  const [monitorSearch, setMonitorSearch] = useState("");
  const [monitorGameFilter, setMonitorGameFilter] = useState<"" | "minefield" | "race">("");
  const [monitorStateFilter, setMonitorStateFilter] = useState<string>("");
  const [monitorHealthFilter, setMonitorHealthFilter] = useState<"" | "disconnected" | "timeout" | "incident">("");
  const mountedRef = useRef(true);
  const confirmOpenBtnRef = useRef<HTMLButtonElement>(null);
  const confirmFinalizeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Auto-hide success notices after a few seconds
  useEffect(() => {
    if (!notice || notice.tone !== "teal") return;
    const t = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [notice]);

  // Modal focus & Escape key handling for official open & finalize modals
  useEffect(() => {
    if (!confirmOfficialOpenModal && !confirmFinalizeModal) return;
    const focusTimer = window.setTimeout(() => {
      if (confirmOfficialOpenModal) confirmOpenBtnRef.current?.focus();
      else if (confirmFinalizeModal) confirmFinalizeBtnRef.current?.focus();
    }, 0);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        setConfirmOfficialOpenModal(false);
        setConfirmFinalizeModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [confirmOfficialOpenModal, confirmFinalizeModal, busy]);

  // Load class roster so official competitions show all students (including "Chưa vào")
  const loadRoster = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/admin/students", { cache: "no-store" });
      if (!mountedRef.current || !response.ok) return;
      const body = (await response.json().catch(() => null)) as {
        data?: RosterStudent[] | { students?: RosterStudent[] };
      } | null;
      if (!mountedRef.current || !body?.data) return;
      const listData = Array.isArray(body.data) ? body.data : (body.data.students ?? []);
      setRosterStudents(listData);
    } catch {
      /* ignore background roster fetch failure here */
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void loadRoster(), 0);
    return () => window.clearTimeout(t);
  }, [loadRoster]);

  const load = useCallback(async () => {
    const startedAt = Date.now();
    try {
      const l = await request<Competition[]>("GET", "/admin/competitions");
      if (!mountedRef.current) return;
      const durationMs = Date.now() - startedAt;
      setList(l);
      setSyncError(null);
      setSyncDelayed(durationMs > 8000);
      setLastUpdatedText(new Date().toLocaleTimeString("vi-VN"));
      setSelected((s) => {
        if (s && l.some((c) => c.id === s)) return s;
        const openComp = l.find((c) => c.state === "open");
        if (openComp) return openComp.id;
        const scheduledOfficial = l.find((c) => c.kind === "official" && c.state === "scheduled");
        if (scheduledOfficial) return scheduledOfficial.id;
        if (l.length === 1) return l[0]!.id;
        return null;
      });
    } catch (e) {
      if (!mountedRef.current) return;
      const errText = friendlyErrorText(e);
      setSyncError(errText);
    }
  }, []);

  // Periodic competition list refresh (~5s, paused when document is hidden)
  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void load();
    }, 5000);
    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void load();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  const current = list?.find((c) => c.id === selected) ?? null;
  const openCompetition = useMemo(() => list?.find((c) => c.state === "open") ?? null, [list]);

  // Effective expectedAttempts defaults to readiness.classSize (or roster length) when not manually edited
  const effectiveExpectedAttempts =
    expectedAttempts ?? readiness?.classSize ?? (rosterStudents.length > 0 ? rosterStudents.length : 60);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    const pull = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const startedAt = Date.now();
      try {
        const m = await request<{ attempts: MonitorRow[] }>("GET", `/admin/competitions/${selected}/monitor`);
        if (alive) {
          const durationMs = Date.now() - startedAt;
          setMonitor(m.attempts ?? []);
          setSyncError(null);
          setSyncDelayed(durationMs > 8000);
          setLastUpdatedText(new Date().toLocaleTimeString("vi-VN"));
        }
      } catch (e) {
        if (alive) setSyncError(friendlyErrorText(e));
      }
    };
    const first = window.setTimeout(() => void pull(), 0);
    const timer = window.setInterval(() => void pull(), 4000);

    const queryAttempts = expectedAttemptsEdited && expectedAttempts !== null
      ? expectedAttempts
      : readiness?.classSize ?? (rosterStudents.length > 0 ? rosterStudents.length : 60);

    request<Readiness>("GET", `/admin/competitions/${selected}/readiness?expectedAttempts=${queryAttempts}`)
      .then((r) => {
        if (!alive) return;
        setReadiness(r);
        if (!expectedAttemptsEdited && typeof r.classSize === "number" && r.classSize > 0) {
          setExpectedAttempts(r.classSize);
          if (r.target.expectedAttempts !== r.classSize) {
            request<Readiness>("GET", `/admin/competitions/${selected}/readiness?expectedAttempts=${r.classSize}`)
              .then((r2) => alive && setReadiness(r2))
              .catch(() => undefined);
          }
        }
      })
      .catch(() => undefined);

    return () => {
      alive = false;
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [selected, auditTick, expectedAttempts, expectedAttemptsEdited, readiness?.classSize, rosterStudents.length]);

  function incidentDone(text: string) {
    setIncidentFor(null);
    setNotice({ tone: "teal", text });
    setAuditTick((t) => t + 1);
    void load();
  }

  async function create() {
    setBusy(true);
    setNotice(null);
    try {
      const c = await request<{ id: string }>("POST", "/admin/competitions", {
        body: {
          name: form.name,
          kind: form.kind,
          opensAt: new Date(Date.now() - 60_000).toISOString(),
          startDeadlineAt: new Date(Date.now() + openMinutes * 60_000).toISOString(),
        },
        key: newKey("create"),
      });
      setSelected(c.id);
      setExpectedAttempts(null);
      setExpectedAttemptsEdited(false);
      await load();
      setNotice({
        tone: "teal",
        text:
          form.kind === "official"
            ? "Đã tạo cuộc thi chính thức (Nháp)."
            : "Đã tạo cuộc thi diễn tập (Nháp).",
      });
    } catch (e) {
      setNotice({ tone: "red", text: friendlyErrorText(e) });
    } finally {
      setBusy(false);
    }
  }

  async function executeTransition(target: string) {
    if (!current) return;
    setBusy(true);
    setNotice(null);
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
            ...(target === "scheduled" ? { expectedAttempts: effectiveExpectedAttempts } : {}),
            ...(belowTarget
              ? {
                  bankAcknowledgement: {
                    expectedAttempts: effectiveExpectedAttempts,
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
      setNotice({
        tone: "teal",
        text: `Đã chuyển trạng thái: ${STATE_LABEL[target === "finalize" ? "finalized" : target]}.`,
      });
    } catch (e) {
      setNotice({ tone: "red", text: friendlyErrorText(e) });
    } finally {
      setBusy(false);
    }
  }

  function handleActionClick(target: string) {
    if (!current) return;
    if (target === "open" && current.kind === "official") {
      setConfirmOfficialOpenModal(true);
      return;
    }
    if (target === "finalize") {
      setConfirmFinalizeModal(true);
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
      setNotice({
        tone: "teal",
        text: `Đã chốt ${r.reconciled} lượt hết giờ; còn ${r.activeAttempts} lượt đang chơi${
          r.startClosed ? "; đã tự đóng nhận lượt mới" : ""
        }.`,
      });
      await load();
    } catch (e) {
      setNotice({ tone: "red", text: friendlyErrorText(e) });
    } finally {
      setBusy(false);
    }
  }

  // Build unified class student rows (merging roster with monitor for official competitions)
  const allUnifiedStudents = useMemo(() => {
    const map = new Map<string, StudentSummary>();

    if (current?.kind === "official" && rosterStudents.length > 0) {
      for (const st of rosterStudents) {
        const displayName = st.display_name_suffix
          ? `${st.display_name} (${st.display_name_suffix})`
          : st.display_name;
        map.set(st.id, {
          profileId: st.id,
          studentId: st.student_id,
          displayName,
          accountStatus: st.status,
          minefield: null,
          race: null,
          totalScore: 0,
          playStatus: "not_entered",
          isOnline: false,
          isDisconnected: false,
          heartbeatAgoMs: null,
          timeouts: 0,
          deviceTransfers: 0,
          incidents: [],
        });
      }
    }

    for (const m of monitor) {
      const key = m.profileId || m.studentId;
      let s = map.get(key);
      if (!s && m.studentId) {
        // Fallback match by studentId if profileId key differed
        for (const existing of map.values()) {
          if (existing.studentId === m.studentId) {
            s = existing;
            break;
          }
        }
      }
      if (!s) {
        s = {
          profileId: m.profileId,
          studentId: m.studentId,
          displayName: m.displayName,
          accountStatus: m.accountStatus,
          minefield: null,
          race: null,
          totalScore: 0,
          playStatus: "not_entered",
          isOnline: false,
          isDisconnected: false,
          heartbeatAgoMs: null,
          timeouts: 0,
          deviceTransfers: 0,
          incidents: [],
        };
        map.set(key, s);
      }

      if (m.game === "minefield") {
        s.minefield = m;
      } else if (m.game === "race") {
        s.race = m;
      }

      s.totalScore = (s.minefield?.score ?? 0) + (s.race?.score ?? 0);
      s.timeouts = (s.minefield?.timeouts ?? 0) + (s.race?.timeouts ?? 0);
      s.deviceTransfers = (s.minefield?.deviceTransfers ?? 0) + (s.race?.deviceTransfers ?? 0);
      if (m.incidents?.length) {
        s.incidents.push(...m.incidents);
      }
      if (m.accountStatus === "locked") {
        s.accountStatus = "locked";
      }
    }

    for (const s of map.values()) {
      const computed = computeStudentPlayStatus(s.minefield, s.race);
      s.playStatus = computed.playStatus;
      s.isOnline = computed.isOnline;
      s.isDisconnected = computed.isDisconnected;
      s.heartbeatAgoMs = computed.heartbeatAgoMs;
    }

    return Array.from(map.values());
  }, [current?.kind, rosterStudents, monitor]);

  // All pulse bar counts come from a single source: allUnifiedStudents (derived from monitor + roster)
  const pulseCounts = useMemo(() => {
    const total = allUnifiedStudents.length;
    const notEntered = allUnifiedStudents.filter((s) => s.playStatus === "not_entered").length;
    const active = allUnifiedStudents.filter((s) => s.playStatus === "active").length;
    const halfDone = allUnifiedStudents.filter((s) => s.playStatus === "half_done").length;
    const bothDone = allUnifiedStudents.filter((s) => s.playStatus === "both_done").length;
    const disconnected = allUnifiedStudents.filter((s) => s.playStatus === "disconnected").length;
    const incident = allUnifiedStudents.filter((s) => s.incidents.length > 0 || s.accountStatus === "locked").length;
    return { total, notEntered, active, halfDone, bothDone, disconnected, incident };
  }, [allUnifiedStudents]);

  const filteredMonitor = useMemo(() => {
    const q = monitorSearch.trim().toLowerCase();
    return monitor.filter((m) => {
      if (monitorGameFilter && m.game !== monitorGameFilter) return false;
      if (monitorStateFilter) {
        if (monitorStateFilter === "disconnected") {
          const lost = m.state === "active" && (m.heartbeatAgoMs === null || m.heartbeatAgoMs >= 12_000);
          if (!lost) return false;
        } else if (m.state !== monitorStateFilter) {
          return false;
        }
      }
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

  const unifiedStudents = useMemo(() => {
    const q = monitorSearch.trim().toLowerCase();
    return allUnifiedStudents
      .filter((s) => {
        if (monitorHealthFilter === "disconnected" && !s.isDisconnected) return false;
        if (monitorHealthFilter === "timeout" && s.timeouts === 0) return false;
        if (monitorHealthFilter === "incident" && s.incidents.length === 0 && s.accountStatus !== "locked")
          return false;
        if (monitorStateFilter) {
          if (monitorStateFilter === "not_entered" && s.playStatus !== "not_entered") return false;
          if (monitorStateFilter === "active" && s.playStatus !== "active") return false;
          if (monitorStateFilter === "half_done" && s.playStatus !== "half_done") return false;
          if (monitorStateFilter === "both_done" && s.playStatus !== "both_done") return false;
          if (monitorStateFilter === "disconnected" && s.playStatus !== "disconnected") return false;
        }
        if (q) {
          const hay = `${s.studentId ?? ""} ${s.displayName} ${s.accountStatus}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isDisconnected !== b.isDisconnected) return a.isDisconnected ? -1 : 1;
        if ((a.accountStatus === "locked") !== (b.accountStatus === "locked"))
          return a.accountStatus === "locked" ? -1 : 1;
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        return a.studentId.localeCompare(b.studentId, "vi");
      });
  }, [allUnifiedStudents, monitorSearch, monitorHealthFilter, monitorStateFilter]);

  const groupedCompetitions = useMemo(() => {
    if (!list) return null;
    return {
      open: list.filter((c) => c.state === "open"),
      upcoming: list.filter((c) => c.state === "draft" || c.state === "scheduled"),
      finished: list.filter((c) => c.state === "start_closed" || c.state === "settling" || c.state === "finalized"),
      archived: list.filter((c) => c.state === "archived"),
    };
  }, [list]);

  const activeStepIndex = current ? LIFECYCLE_STEPS.findIndex((s) => s.key === current.state) : -1;

  function renderCompCard(c: Competition) {
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
            setExpectedAttempts(null);
            setExpectedAttemptsEdited(false);
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
          <strong style={{ fontSize: "0.95rem" }}>{c.name}</strong>
          <span style={{ fontSize: "0.78rem", color: "var(--acc-muted)" }}>
            {c.kind === "rehearsal" ? "Diễn tập" : "Chính thức"} · {STATE_LABEL[c.state] ?? c.state} · {c.attempts} lượt
            ({c.active} đang chơi)
          </span>
        </button>
      </li>
    );
  }

  return (
    <main aria-label="Admin Control Center">
      {/* Top Notification Banner (item 14) */}
      {notice ? (
        <div
          className="acc-banner adm__message"
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

      {/* Sync / Failure Banner (item 1) — only when a real fetch failed or was delayed */}
      {(syncError || syncDelayed) && (
        <div className="acc-banner" data-tone={syncError ? "red" : "amber"} role="alert">
          <div>
            <strong>{syncError ? "Không tải được dữ liệu mới:" : "Phản hồi từ máy chủ bị trễ:"}</strong>{" "}
            {syncError ?? "Lần tải gần nhất mất nhiều thời gian hơn bình thường. Hãy kiểm tra kết nối mạng."}
          </div>
          <button
            type="button"
            className="acc-btn"
            onClick={() => {
              void load();
              setAuditTick((t) => t + 1);
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Sticky Student Visibility Bar (item 7) */}
      <div
        className="acc-student-live-strip"
        data-tone={
          openCompetition
            ? openCompetition.kind === "rehearsal"
              ? "rehearsal-open"
              : "official-open"
            : "waiting"
        }
        role="region"
        aria-label="Trạng thái hiển thị phía sinh viên"
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
          <span
            className="acc-status-dot"
            data-status={openCompetition ? (openCompetition.kind === "rehearsal" ? "disconnected" : "online") : "idle"}
          />
          {openCompetition ? (
            <span>
              Sinh viên đang thấy: <strong>{openCompetition.name}</strong> ·{" "}
              <strong>{openCompetition.kind === "official" ? "Chính thức" : "Diễn tập"}</strong> ·{" "}
              <strong>{STATE_LABEL[openCompetition.state] ?? openCompetition.state}</strong>
            </span>
          ) : (
            <span>Chưa có cuộc thi nào mở; sinh viên đang ở màn hình chờ</span>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.55rem" }}>
          {lastUpdatedText && (
            <span className="acc-badge" data-tone={syncError || syncDelayed ? "amber" : "teal"}>
              Cập nhật: {lastUpdatedText}
            </span>
          )}
          <button
            type="button"
            className="acc-btn"
            style={{ minHeight: "1.95rem", padding: "0.2rem 0.65rem", fontSize: "0.78rem" }}
            disabled={busy}
            onClick={() => {
              void load();
              setAuditTick((t) => t + 1);
            }}
          >
            Làm mới ngay
          </button>
        </div>
      </div>

      {/* Primary Action & Status Bar right under Sticky Strip (item 8) — fits above the fold on 1366x768 */}
      {activeTab === "operations" && current ? (
        <section
          className="acc-panel adm__head"
          aria-label="Điều khiển nhanh cuộc thi đang chọn"
          style={{ padding: "0.85rem 1.1rem", marginBottom: "0.85rem" }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", alignItems: "center" }}>
                <span className="acc-badge" data-tone={current.kind === "official" ? "red" : "teal"}>
                  {current.kind === "official" ? "Chính thức" : "Diễn tập"}
                </span>
                <span className="acc-badge" data-tone={current.state === "open" ? "amber" : "teal"}>
                  {STATE_LABEL[current.state] ?? current.state}
                </span>
                <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800 }}>{current.name}</h1>
              </div>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.84rem", color: "var(--acc-text-Soft)" }}>
                {STATE_LABEL[current.state]} · nhãn bảng: <b>{STANDING_LABEL[current.standing]}</b>
                {current.state === "draft" || current.state === "scheduled"
                  ? " · chờ bạn bấm Mở cuộc thi"
                  : ` · nhận lượt tới ${new Date(current.startDeadlineAt).toLocaleString("vi-VN")}`}
              </p>
            </div>

            <div className="adm__actions" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.55rem" }}>
              {current.state === "draft" && current.kind === "official" ? (
                <label className="acc-field" style={{ flexDirection: "row", alignItems: "center", gap: "0.4rem" }}>
                  <span>Sĩ số dự kiến</span>
                  <input
                    className="acc-input"
                    style={{ width: "5.2rem", minHeight: "2.2rem", padding: "0.3rem 0.5rem" }}
                    type="number"
                    min={1}
                    max={500}
                    value={effectiveExpectedAttempts}
                    onChange={(e) => {
                      setExpectedAttempts(Number(e.target.value));
                      setExpectedAttemptsEdited(true);
                      setAcknowledgeRisk(false);
                      setReadiness(null);
                    }}
                  />
                </label>
              ) : null}

              {current.state === "scheduled" ? (
                <label className="acc-field" style={{ flexDirection: "row", alignItems: "center", gap: "0.4rem" }}>
                  <span>Nhận lượt mới sau khi mở (phút)</span>
                  <input
                    className="acc-input"
                    style={{ width: "5.2rem", minHeight: "2.2rem", padding: "0.3rem 0.5rem" }}
                    type="number"
                    min={1}
                    max={1440}
                    value={openMinutes}
                    onChange={(e) => setOpenMinutes(Number(e.target.value))}
                  />
                </label>
              ) : null}

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

              <button
                type="button"
                className="acc-btn is-ghost"
                disabled={busy}
                onClick={() => void reconcile()}
              >
                <RefreshCw aria-hidden size={15} /> Chốt các lượt đã hết giờ
              </button>
            </div>
          </div>

          {readiness && current.state === "draft" ? (
            <div
              className={`adm__ready ${readiness.ready ? "is-ok" : "is-bad"}`}
              style={{ marginTop: "0.65rem", display: "grid", gap: "0.4rem", fontSize: "0.86rem" }}
            >
              <p style={{ margin: 0 }}>
                {readiness.ready
                  ? "Ngân hàng câu đủ điều kiện bắt buộc."
                  : `Chưa đủ điều kiện: ${readiness.blockers.map(translateReadinessBlocker).join("; ")}`}
              </p>
              {current.kind === "official" && readiness.classSize != null ? (
                <p
                  role={readiness.classSize !== effectiveExpectedAttempts ? "alert" : undefined}
                  style={{
                    margin: 0,
                    padding:
                      readiness.classSize !== effectiveExpectedAttempts ? "0.45rem 0.7rem" : undefined,
                    borderRadius: "6px",
                    background:
                      readiness.classSize !== effectiveExpectedAttempts
                        ? "rgba(240, 170, 60, 0.15)"
                        : undefined,
                    color:
                      readiness.classSize !== effectiveExpectedAttempts ? "#fde68a" : undefined,
                  }}
                >
                  Danh sách lớp hiện có {readiness.classSize} sinh viên
                  {readiness.classSize !== effectiveExpectedAttempts
                    ? `, khác sĩ số dự kiến ${effectiveExpectedAttempts}. Hãy kiểm tra trước khi xác nhận.`
                    : "."}
                </p>
              ) : null}
              {current.kind === "official" && !readiness.target.meetsTarget ? (
                <>
                  <p style={{ margin: 0, color: "var(--acc-text-Soft)" }}>
                    Sĩ số dự kiến {effectiveExpectedAttempts}: chưa đạt mục tiêu tối đa{" "}
                    {readiness.target.maxPerQuestion} lượt phân bổ mỗi câu. Một câu có thể được nhiều sinh viên nhận,
                    tăng rủi ro chia sẻ đáp án.
                  </p>
                  {readiness.ready ? (
                    <div style={{ display: "grid", gap: "0.45rem" }}>
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
                          rows={2}
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
        </section>
      ) : null}

      {/* Primary Mode Switcher Tabs (item 9: removed duplicate Incidents/Audit tab) */}
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
          <span>Phòng thi thử khép kín</span>
          <span className="acc-badge" data-tone="teal" style={{ padding: "0.1rem 0.45rem", fontSize: "0.68rem" }}>
            THI THỬ
          </span>
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

      {/* TAB 1: Competition Operations Control Room */}
      {activeTab === "operations" && (
        <div className="adm acc-ops-grid">
          {/* Left Column: Competition Selector (grouped) & Collapsed Create Form */}
          <section className="acc-panel adm__panel acc-ops-sidebar" style={{ marginBottom: 0, minWidth: 0, maxWidth: "100%" }}>
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
              <div className="adm__list" style={{ display: "grid", gap: "0.75rem", marginBottom: "1rem" }}>
                {groupedCompetitions && groupedCompetitions.open.length > 0 && (
                  <div>
                    <div className="acc-group-label">Đang mở ({groupedCompetitions.open.length})</div>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.45rem" }}>
                      {groupedCompetitions.open.map(renderCompCard)}
                    </ul>
                  </div>
                )}

                {groupedCompetitions && groupedCompetitions.upcoming.length > 0 && (
                  <div>
                    <div className="acc-group-label">Sắp mở ({groupedCompetitions.upcoming.length})</div>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.45rem" }}>
                      {groupedCompetitions.upcoming.map(renderCompCard)}
                    </ul>
                  </div>
                )}

                {groupedCompetitions && groupedCompetitions.finished.length > 0 && (
                  <div>
                    <div className="acc-group-label">Đã xong ({groupedCompetitions.finished.length})</div>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.45rem" }}>
                      {groupedCompetitions.finished.map(renderCompCard)}
                    </ul>
                  </div>
                )}

                {groupedCompetitions && groupedCompetitions.archived.length > 0 && (
                  <details className="acc-panel-alt" style={{ padding: "0.55rem 0.75rem" }}>
                    <summary style={{ cursor: "pointer", fontSize: "0.82rem", fontWeight: 700, color: "var(--acc-muted)" }}>
                      Lưu trữ ({groupedCompetitions.archived.length})
                    </summary>
                    <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0", display: "grid", gap: "0.45rem" }}>
                      {groupedCompetitions.archived.map(renderCompCard)}
                    </ul>
                  </details>
                )}
              </div>
            )}

            {/* Create Competition Form — Collapsed by default unless list is empty (item 8 & 11) */}
            <details className="acc-panel-alt" open={list !== null && list.length === 0}>
              <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "0.95rem" }}>
                + Tạo cuộc thi mới
              </summary>
              <form
                className="adm__create"
                onSubmit={(e) => {
                  e.preventDefault();
                  void create();
                }}
                style={{ display: "grid", gap: "0.65rem", marginTop: "0.75rem" }}
              >
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

                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--acc-muted)" }}>
                  Diễn tập chỉ lấy bộ câu giả lập <code>[GIẢ LẬP]</code>; cuộc thi chính thức chỉ dùng câu hỏi chính thức
                  đã duyệt học thuật và không cho phép xóa hoặc đặt lại. Số phút mở nhận lượt sẽ được hỏi khi bấm Mở.
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
                  Mật khẩu mặc định chung <b>không bảo đảm danh tính cá nhân</b>: chỉ dùng cho hoạt động thi đua trên lớp.
                </p>

                <button type="submit" disabled={busy} className="acc-btn acc-btn-primary">
                  Tạo (Nháp)
                </button>
              </form>
            </details>
          </section>

          {/* Right Wide Column: Live Monitor & Audit */}
          <section
            className="acc-panel adm__panel adm__panel--wide acc-ops-main"
            style={{ marginBottom: 0, minWidth: 0, maxWidth: "100%" }}
          >
            {current ? (
              <>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.55rem",
                  }}
                >
                  <span style={{ fontSize: "0.8rem", color: "var(--acc-muted)" }}>
                    💡 Phím tắt màn chiếu: <b>1</b> (Bãi Mìn Tri Thức), <b>2</b> (Đường Đua Lịch Sử), <b>0</b> (Cả 2 bảng)
                  </span>
                  <div className="adm__links" style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    <Link href="/trinh-chieu" target="_blank" className="acc-btn acc-btn-amber" style={{ minHeight: "2rem", padding: "0.25rem 0.65rem", fontSize: "0.78rem" }}>
                      <Trophy aria-hidden size={14} /> Màn chiếu cả 2 bảng <ExternalLink aria-hidden size={11} />
                    </Link>
                    <Link href="/trinh-chieu?game=minefield" target="_blank" className="acc-btn" style={{ minHeight: "2rem", padding: "0.25rem 0.65rem", fontSize: "0.78rem" }}>
                      Chiếu Bãi Mìn ↗
                    </Link>
                    <Link href="/trinh-chieu?game=race" target="_blank" className="acc-btn" style={{ minHeight: "2rem", padding: "0.25rem 0.65rem", fontSize: "0.78rem" }}>
                      Chiếu Đường Đua ↗
                    </Link>
                    <Link href="/live-arena/bang-xep-hang" target="_blank" className="acc-btn" style={{ minHeight: "2rem", padding: "0.25rem 0.65rem", fontSize: "0.78rem" }}>
                      Bảng xếp hạng <ExternalLink aria-hidden size={11} />
                    </Link>
                  </div>
                </div>

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

                {/* Class Pulse Bar — Single Click-to-Filter KPI Row (item 2 & 5) */}
                <div className="acc-pulse-bar" role="region" aria-label="Nhịp độ lớp học">
                  <button
                    type="button"
                    className="acc-pulse-card"
                    data-active={!monitorHealthFilter && !monitorStateFilter}
                    onClick={() => {
                      setMonitorHealthFilter("");
                      setMonitorStateFilter("");
                    }}
                  >
                    <span className="acc-pulse-label">Tổng danh sách</span>
                    <span className="acc-pulse-val">{pulseCounts.total}</span>
                  </button>

                  <button
                    type="button"
                    className="acc-pulse-card"
                    data-active={monitorStateFilter === "not_entered"}
                    onClick={() => setMonitorStateFilter(monitorStateFilter === "not_entered" ? "" : "not_entered")}
                  >
                    <span className="acc-pulse-label">Chưa vào</span>
                    <span className="acc-pulse-val">{pulseCounts.notEntered}</span>
                  </button>

                  <button
                    type="button"
                    className="acc-pulse-card"
                    data-active={monitorStateFilter === "active"}
                    onClick={() => setMonitorStateFilter(monitorStateFilter === "active" ? "" : "active")}
                  >
                    <span className="acc-pulse-label">Đang chơi</span>
                    <span className="acc-pulse-val" style={{ color: "var(--acc-amber)" }}>
                      {pulseCounts.active}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="acc-pulse-card"
                    data-active={monitorStateFilter === "half_done"}
                    onClick={() => setMonitorStateFilter(monitorStateFilter === "half_done" ? "" : "half_done")}
                  >
                    <span className="acc-pulse-label">Xong 1/2 trò</span>
                    <span className="acc-pulse-val" style={{ color: "#60a5fa" }}>{pulseCounts.halfDone}</span>
                  </button>

                  <button
                    type="button"
                    className="acc-pulse-card"
                    data-active={monitorStateFilter === "both_done"}
                    onClick={() => setMonitorStateFilter(monitorStateFilter === "both_done" ? "" : "both_done")}
                  >
                    <span className="acc-pulse-label">Xong cả hai</span>
                    <span className="acc-pulse-val" style={{ color: "#10b981" }}>{pulseCounts.bothDone}</span>
                  </button>

                  <button
                    type="button"
                    className="acc-pulse-card"
                    data-tone={pulseCounts.disconnected > 0 ? "red" : undefined}
                    data-active={monitorStateFilter === "disconnected" || monitorHealthFilter === "disconnected"}
                    onClick={() => {
                      setMonitorHealthFilter("");
                      setMonitorStateFilter(monitorStateFilter === "disconnected" ? "" : "disconnected");
                    }}
                  >
                    <span className="acc-pulse-label">Mất kết nối</span>
                    <span className="acc-pulse-val" style={{ color: pulseCounts.disconnected > 0 ? "var(--acc-red)" : "inherit" }}>
                      {pulseCounts.disconnected}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="acc-pulse-card"
                    data-active={monitorHealthFilter === "incident"}
                    onClick={() => setMonitorHealthFilter(monitorHealthFilter === "incident" ? "" : "incident")}
                  >
                    <span className="acc-pulse-label">Sự cố / Khóa</span>
                    <span className="acc-pulse-val">{pulseCounts.incident}</span>
                  </button>
                </div>

                {/* Monitor Controls & Toolbar */}
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", marginBottom: "0.85rem" }}>
                  <div className="acc-view-switcher" role="tablist" aria-label="Chế độ hiển thị bảng">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={monitorViewMode === "unified"}
                      data-active={monitorViewMode === "unified"}
                      className="acc-view-btn"
                      onClick={() => {
                        setMonitorViewMode("unified");
                        setMonitorStateFilter("");
                      }}
                    >
                      <Users aria-hidden size={14} style={{ verticalAlign: "middle", marginRight: "0.3rem" }} />
                      Bảng hợp nhất cả lớp ({unifiedStudents.length})
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={monitorViewMode === "split"}
                      data-active={monitorViewMode === "split"}
                      className="acc-view-btn"
                      onClick={() => {
                        setMonitorViewMode("split");
                        setMonitorStateFilter("");
                      }}
                    >
                      <Layers aria-hidden size={14} style={{ verticalAlign: "middle", marginRight: "0.3rem" }} />
                      Tách chi tiết 2 trò
                    </button>
                  </div>

                  <button
                    type="button"
                    className="acc-btn acc-btn-primary"
                    style={{ minHeight: "2rem", padding: "0.3rem 0.8rem", fontSize: "0.82rem" }}
                    onClick={() => exportLeaderboardCsv(current?.name ?? "Live_Arena", allUnifiedStudents)}
                    disabled={allUnifiedStudents.length === 0}
                  >
                    <Download aria-hidden size={15} /> Xuất bảng điểm (CSV)
                  </button>
                </div>

                {/* Monitor Filter Bar (item 5 & 12: every state filter option works in its view mode) */}
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
                  {monitorViewMode === "split" && (
                    <label className="acc-field">
                      <span>Lọc theo trò</span>
                      <select
                        className="acc-select"
                        value={monitorGameFilter}
                        onChange={(e) => setMonitorGameFilter(e.target.value as "" | "minefield" | "race")}
                      >
                        <option value="">Cả 2 trò</option>
                        <option value="minefield">Bãi Mìn Tri Thức</option>
                        <option value="race">Đường Đua Lịch Sử</option>
                      </select>
                    </label>
                  )}
                  <label className="acc-field">
                    <span>Lọc trạng thái</span>
                    {monitorViewMode === "unified" ? (
                      <select
                        className="acc-select"
                        value={monitorStateFilter}
                        onChange={(e) => setMonitorStateFilter(e.target.value)}
                      >
                        <option value="">Tất cả trạng thái</option>
                        <option value="not_entered">Chưa vào</option>
                        <option value="active">Đang chơi</option>
                        <option value="half_done">Xong 1/2 trò</option>
                        <option value="both_done">Xong cả hai</option>
                        <option value="disconnected">Mất kết nối</option>
                      </select>
                    ) : (
                      <select
                        className="acc-select"
                        value={monitorStateFilter}
                        onChange={(e) => setMonitorStateFilter(e.target.value)}
                      >
                        <option value="">Tất cả trạng thái lượt</option>
                        <option value="active">Đang chơi</option>
                        <option value="completed">Hoàn thành</option>
                        <option value="timed_out">Hết giờ</option>
                        <option value="voided">Vô hiệu</option>
                      </select>
                    )}
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
                <div
                  className="adm__monitor"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr)",
                    gap: "0.95rem",
                    marginBottom: "1rem",
                    minWidth: 0,
                    maxWidth: "100%",
                  }}
                >
                  {monitorViewMode === "unified" ? (
                    <div className="acc-panel-alt">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "0.65rem",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                        }}
                      >
                        <h3 style={{ margin: 0, fontSize: "0.98rem", display: "flex", alignItems: "center", gap: "0.45rem" }}>
                          <Users aria-hidden size={16} /> Bảng điều hành cả lớp · {unifiedStudents.length} sinh viên
                        </h3>
                        <span style={{ fontSize: "0.8rem", color: "var(--acc-muted)" }}>
                          Tự động đồng bộ mỗi 4 giây · Chọn đúng lượt trò chơi để xử lý sự cố
                        </span>
                      </div>
                      <div className="acc-table-wrap">
                        <table className="acc-table">
                          <thead>
                            <tr>
                              <th>MSSV & Họ tên</th>
                              <th>Trạng thái</th>
                              <th>Bãi Mìn Tri Thức</th>
                              <th>Đường Đua Lịch Sử</th>
                              <th>Tổng điểm</th>
                              <th>Ghi nhận</th>
                              <th>Sự cố</th>
                              <th>Thao tác theo lượt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {unifiedStudents.length === 0 ? (
                              <tr>
                                <td colSpan={8} style={{ textAlign: "center", color: "var(--acc-muted)", padding: "1.5rem" }}>
                                  Chưa có lượt thi nào hoặc không tìm thấy sinh viên phù hợp bộ lọc.
                                </td>
                              </tr>
                            ) : (
                              unifiedStudents.map((s) => (
                                <tr key={s.profileId || s.studentId}>
                                  <td>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                                      <code>{s.studentId}</code>
                                      <strong style={{ fontSize: "0.95rem" }}>{s.displayName}</strong>
                                    </div>
                                  </td>
                                  <td>
                                    {s.playStatus === "disconnected" ? (
                                      <span
                                        className="acc-badge"
                                        data-tone="red"
                                        title={`Mất tín hiệu kết nối ${Math.round((s.heartbeatAgoMs ?? 0) / 1000)} s`}
                                      >
                                        <span className="acc-status-dot" data-status="disconnected" /> Mất kết nối · mất{" "}
                                        {Math.round((s.heartbeatAgoMs ?? 0) / 1000)} s
                                      </span>
                                    ) : s.playStatus === "active" ? (
                                      <span className="acc-badge" data-tone="amber">
                                        <span className="acc-status-dot" data-status="online" /> Đang chơi
                                      </span>
                                    ) : s.playStatus === "both_done" ? (
                                      <span className="acc-badge" data-tone="teal">
                                        <span className="acc-status-dot" data-status="online" /> Xong cả hai
                                      </span>
                                    ) : s.playStatus === "half_done" ? (
                                      <span className="acc-badge" data-tone="blue">
                                        <span className="acc-status-dot" data-status="idle" /> Xong 1/2 trò
                                      </span>
                                    ) : (
                                      <span className="acc-badge" style={{ color: "var(--acc-muted)" }}>
                                        <span className="acc-status-dot" data-status="idle" /> Chưa vào
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    {s.minefield ? (
                                      <div>
                                        <span style={{ fontWeight: 600 }}>
                                          {s.minefield.mainAnswered}/{s.minefield.mainTotal} câu
                                        </span>{" "}
                                        <small style={{ color: "var(--acc-muted)" }}>
                                          ({ATTEMPT_STATE_LABEL[s.minefield.state] ?? s.minefield.state})
                                        </small>
                                        <div style={{ fontSize: "0.82rem", color: "var(--acc-amber)" }}>
                                          +{s.minefield.score} điểm
                                        </div>
                                      </div>
                                    ) : (
                                      <span style={{ color: "var(--acc-muted)", fontSize: "0.82rem" }}>Chưa chơi</span>
                                    )}
                                  </td>
                                  <td>
                                    {s.race ? (
                                      <div>
                                        <span style={{ fontWeight: 600 }}>
                                          {s.race.mainAnswered}/{s.race.mainTotal} câu
                                        </span>{" "}
                                        <small style={{ color: "var(--acc-muted)" }}>
                                          ({ATTEMPT_STATE_LABEL[s.race.state] ?? s.race.state})
                                        </small>
                                        <div style={{ fontSize: "0.82rem", color: "var(--acc-amber)" }}>
                                          +{s.race.score} điểm
                                        </div>
                                      </div>
                                    ) : (
                                      <span style={{ color: "var(--acc-muted)", fontSize: "0.82rem" }}>Chưa chơi</span>
                                    )}
                                  </td>
                                  <td>
                                    <b style={{ fontSize: "1.15rem", color: "var(--acc-amber)" }}>{s.totalScore}</b>
                                  </td>
                                  <td>
                                    {[
                                      s.deviceTransfers ? `${s.deviceTransfers} lần đổi thiết bị` : null,
                                      s.timeouts ? `${s.timeouts} câu hết giờ` : null,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ") || "—"}
                                  </td>
                                  <td>
                                    {s.accountStatus === "locked" ? (
                                      <span className="adm__tag is-bad acc-badge" data-tone="red" style={{ marginRight: "0.3rem" }}>
                                        TK bị khóa
                                      </span>
                                    ) : null}
                                    {s.incidents.length ? (
                                      <span
                                        title={s.incidents
                                          .map((i) => `${INCIDENT_LABEL[i.action]}: ${i.reason}`)
                                          .join("\n")}
                                      >
                                        {s.incidents.length} ghi nhận · {INCIDENT_LABEL[s.incidents.at(-1)!.action]}
                                      </span>
                                    ) : s.accountStatus === "locked" ? null : (
                                      "—"
                                    )}
                                  </td>
                                  <td>
                                    {/* Per-attempt incident buttons (item 3): Bãi Mìn / Đường Đua */}
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                                      {s.minefield && (
                                        <button
                                          type="button"
                                          className="adm__small acc-btn"
                                          style={{ minHeight: "1.9rem", padding: "0.2rem 0.55rem", fontSize: "0.76rem" }}
                                          aria-expanded={incidentFor === s.minefield.attemptId}
                                          onClick={() =>
                                            setIncidentFor(
                                              incidentFor === s.minefield!.attemptId ? null : s.minefield!.attemptId,
                                            )
                                          }
                                        >
                                          Xử lý Bãi Mìn
                                        </button>
                                      )}
                                      {s.race && (
                                        <button
                                          type="button"
                                          className="adm__small acc-btn"
                                          style={{ minHeight: "1.9rem", padding: "0.2rem 0.55rem", fontSize: "0.76rem" }}
                                          aria-expanded={incidentFor === s.race.attemptId}
                                          onClick={() =>
                                            setIncidentFor(incidentFor === s.race!.attemptId ? null : s.race!.attemptId)
                                          }
                                        >
                                          Xử lý Đường Đua
                                        </button>
                                      )}
                                      {!s.minefield && !s.race && (
                                        <span style={{ fontSize: "0.78rem", color: "var(--acc-muted)" }}>Chưa có lượt</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    (["minefield", "race"] as const)
                      .filter((game) => !monitorGameFilter || monitorGameFilter === game)
                      .map((game) => (
                        <div key={game} className="acc-panel-alt">
                          <h3
                            style={{
                              margin: "0 0 0.6rem",
                              fontSize: "0.98rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.45rem",
                            }}
                          >
                            <Activity aria-hidden size={16} />{" "}
                            {game === "minefield" ? "Bãi Mìn Tri Thức" : "Đường Đua Lịch Sử"} · {byGame(game).length}{" "}
                            lượt
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
                                  <th>Thao tác</th>
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
                                          {ATTEMPT_STATE_LABEL[m.state] ?? m.state}
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
                                          {m.game === "minefield" ? "Xử lý Bãi Mìn" : "Xử lý Đường Đua"}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))
                  )}
                </div>

                {incidentFor && monitor.find((m) => m.attemptId === incidentFor) ? (
                  <IncidentModal
                    key={incidentFor}
                    row={monitor.find((m) => m.attemptId === incidentFor)!}
                    onDone={incidentDone}
                    onClose={() => setIncidentFor(null)}
                  />
                ) : null}

                {current.kind === "official" ? (
                  <DisclosedQuestions key={current.id} competitionId={current.id} onDone={incidentDone} />
                ) : null}

                <AuditLog competitionId={current.id} refresh={auditTick} />
              </>
            ) : (
              <div className="acc-panel-alt" role="status">
                <strong>Chưa chọn cuộc thi điều hành:</strong> Chọn hoặc tạo một cuộc thi ở cột bên trái để bắt đầu
                điều hành.
              </div>
            )}
          </section>
        </div>
      )}

      {/* Confirmation Modal for Opening an Official Competition (item 4 & 13) */}
      {confirmOfficialOpenModal && current && (
        <div
          className="acc-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-official-open-title"
          onClick={() => {
            if (!busy) setConfirmOfficialOpenModal(false);
          }}
        >
          <div className="acc-modal" onClick={(e) => e.stopPropagation()}>
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
                <strong style={{ color: "#fca5a5" }}>Chính thức</strong>
              </div>
              {typeof readiness?.classSize === "number" ? (
                <div className="acc-modal-row">
                  <span>Sĩ số lớp:</span>
                  <strong>{readiness.classSize} sinh viên</strong>
                </div>
              ) : null}
              <div className="acc-modal-row">
                <span>Thời gian nhận lượt:</span>
                <strong style={{ color: "var(--acc-amber)" }}>{openMinutes} phút</strong>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
              <button
                type="button"
                className="acc-btn"
                disabled={busy}
                onClick={() => setConfirmOfficialOpenModal(false)}
              >
                Hủy
              </button>
              <button
                ref={confirmOpenBtnRef}
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

      {/* Confirmation Modal for Finalizing a Competition (replaces window.confirm, item 13) */}
      {confirmFinalizeModal && current && (
        <div
          className="acc-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-finalize-title"
          onClick={() => {
            if (!busy) setConfirmFinalizeModal(false);
          }}
        >
          <div className="acc-modal" onClick={(e) => e.stopPropagation()}>
            <p className="acc-kicker" style={{ color: "#fca5a5" }}>
              Xác nhận kết thúc & công bố
            </p>
            <h3 id="confirm-finalize-title" style={{ margin: "0 0 0.5rem", fontSize: "1.25rem" }}>
              Kết thúc & công bố kết quả cuộc thi?
            </h3>
            <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", color: "var(--acc-text-Soft)" }}>
              Khi kết thúc cuộc thi <strong>{current.name}</strong>, đáp án và giải thích sẽ mở cho sinh viên đã tham
              gia và bảng xếp hạng được chốt kết quả.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
              <button
                type="button"
                className="acc-btn"
                disabled={busy}
                onClick={() => setConfirmFinalizeModal(false)}
              >
                Hủy
              </button>
              <button
                ref={confirmFinalizeBtnRef}
                type="button"
                className="acc-btn acc-btn-danger-solid"
                disabled={busy}
                onClick={() => {
                  setConfirmFinalizeModal(false);
                  void executeTransition("finalize");
                }}
              >
                Xác nhận kết thúc & công bố
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function IncidentModal({
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const gameName = row.game === "minefield" ? "Bãi Mìn Tri Thức" : "Đường Đua Lịch Sử";
  const attemptStateText = ATTEMPT_STATE_LABEL[row.state] ?? row.state;

  useEffect(() => {
    const focusTimer = window.setTimeout(() => textareaRef.current?.focus(), 0);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [busy, onClose]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await request("POST", `/admin/attempts/${row.attemptId}/incidents`, { body: { action, reason } });
      onDone(`${INCIDENT_LABEL[action]} (${gameName}): ${row.displayName}.`);
    } catch (e) {
      setError(friendlyErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="acc-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="incident-modal-title"
      onClick={() => {
        if (!reason.trim() && !busy) {
          onClose();
        }
      }}
    >
      <div
        className="acc-modal"
        style={{ width: "min(100%, 36rem)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <form
          className="adm__incident acc-panel-alt"
          aria-label={`Xử lý sự cố: ${row.displayName} (${gameName} · ${attemptStateText})`}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          style={{ display: "grid", gap: "0.65rem" }}
        >
          <h3
            id="incident-modal-title"
            style={{ margin: 0, fontSize: "1.02rem", display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}
          >
            <ShieldAlert aria-hidden size={16} /> Xử lý sự cố · {row.studentId} · {row.displayName} ·{" "}
            <span className="acc-badge" data-tone="amber">
              {gameName} ({attemptStateText})
            </span>
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
            <div className="acc-quick-preset-grid">
              {[
                "Mất kết nối mạng tại lớp",
                "Đổi sang thiết bị khác (hết pin/sập nguồn)",
                "Sinh viên yêu cầu cấp lại mật khẩu",
                "Nghi vấn vi phạm quy chế",
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="acc-preset-chip"
                  onClick={() => setReason(preset)}
                >
                  + {preset}
                </button>
              ))}
            </div>
            <textarea
              ref={textareaRef}
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
            <button type="button" className="acc-btn is-ghost" disabled={busy} onClick={onClose}>
              Đóng
            </button>
          </div>
        </form>
      </div>
    </div>
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    request<Disclosed>("GET", `/admin/competitions/${competitionId}/disclosed-questions`)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(friendlyErrorText(e)));
    return () => {
      alive = false;
    };
  }, [competitionId, version]);

  useEffect(() => {
    if (!confirmOpen) return;
    const focusTimer = window.setTimeout(() => confirmBtnRef.current?.focus(), 0);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        setConfirmOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [confirmOpen, busy]);

  if (!data) return error ? <p className="adm__message is-bad">{error}</p> : null;
  const editable = data.competitionState === "draft";

  async function executeConfirm() {
    setConfirmOpen(false);
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
      setError(friendlyErrorText(e));
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
                    {q.game === "race" ? "Đường Đua Lịch Sử" : "Bãi Mìn Tri Thức"} · {q.pool} · {q.difficulty} · {q.chapter}
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
            setConfirmOpen(true);
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

      {confirmOpen && (
        <div
          className="acc-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="disclosed-confirm-title"
          onClick={() => {
            if (!busy) setConfirmOpen(false);
          }}
        >
          <div className="acc-modal" onClick={(e) => e.stopPropagation()}>
            <h3 id="disclosed-confirm-title" style={{ margin: "0 0 0.5rem", fontSize: "1.15rem" }}>
              Xác nhận dùng lại {picked.length} câu đã công bố đáp án?
            </h3>
            <p style={{ margin: "0 0 1rem", fontSize: "0.88rem", color: "var(--acc-text-Soft)" }}>
              Cho phép dùng lại {picked.length} câu đã công bố đáp án trong cuộc thi chính thức này? Thao tác sẽ được ghi
              vào nhật ký kèm lý do của bạn.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.55rem" }}>
              <button type="button" className="acc-btn" disabled={busy} onClick={() => setConfirmOpen(false)}>
                Hủy
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                className="acc-btn acc-btn-amber"
                disabled={busy}
                onClick={() => void executeConfirm()}
              >
                Đồng ý dùng lại
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
