"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "@/features/admin/ui/admin-control-center.css";
import { ArenaApiError, request } from "@/features/arena/client/api";
import { readCsrfCookie } from "@/lib/security/csrf-client";

type PreviewRow = {
  rowNumber: number;
  studentId: string;
  fullName: string;
  displayName: string;
  displayNameSuffix?: number | null;
  status: "valid" | "warning" | "error";
  issues?: string[];
  code?: string | null;
  message?: string | null;
};

type PreviewData = {
  importId: string;
  classCode?: string;
  validCount: number;
  warningCount: number;
  errorCount: number;
  rows: PreviewRow[];
  omittedCount?: number;
};

const ISSUE_LABEL: Record<string, string> = {
  duplicate_in_file: "MSSV trùng trong tệp",
  already_exists: "MSSV đã tồn tại",
  missing_student_id: "Thiếu MSSV",
  missing_full_name: "Thiếu họ tên",
  numeric_cell: "Ô MSSV là số — có thể đã mất số 0 đầu",
  formula_prefix: "MSSV bắt đầu bằng ký tự công thức",
  invalid_characters: "MSSV có ký tự không hợp lệ",
  too_long: "MSSV quá dài",
  pattern_mismatch: "MSSV không khớp mẫu đã cấu hình",
  full_name_too_long: "Họ tên quá dài",
  row_limit_exceeded: "Vượt giới hạn số hàng",
};

type StudentRecord = {
  id: string;
  student_id: string;
  full_name: string;
  display_name: string;
  display_name_suffix: number | null;
  status: string;
  updated_at: string;
};

type ClassInfo = {
  id: string;
  code: string;
  name: string;
};

function cleanRosterError(error: unknown, fallback: string) {
  if (error instanceof ArenaApiError) return error.message || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

export function RosterImport() {
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "locked">("");

  // Student support modal state
  const [supportStudent, setSupportStudent] = useState<StudentRecord | null>(null);
  const [supportAction, setSupportAction] = useState<
    "reset_password" | "display_name" | "revoke_sessions" | "lock_account" | "unlock_account"
  >("reset_password");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [supportReason, setSupportReason] = useState("");
  const [supportDirty, setSupportDirty] = useState(false);
  const [supportBusy, setSupportBusy] = useState(false);

  // Roster import state
  const [classCode, setClassCode] = useState("VNR202");
  const [className, setClassName] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [confirmed, setConfirmed] = useState<Record<number, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [cleanupConfirmed, setCleanupConfirmed] = useState(false);
  const [cleanupReason, setCleanupReason] = useState("");
  const [message, setMessage] = useState<{ tone: "teal" | "amber" | "red"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Quick add student & export state
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickStudentText, setQuickStudentText] = useState("");
  const [quickPreview, setQuickPreview] = useState<PreviewData | null>(null);
  const [quickConfirmed, setQuickConfirmed] = useState<Record<number, boolean>>({});
  const [quickOverrides, setQuickOverrides] = useState<Record<string, string>>({});

  const supportReasonInputRef = useRef<HTMLInputElement>(null);
  const supportNameInputRef = useRef<HTMLInputElement>(null);
  const quickAddTextareaRef = useRef<HTMLTextAreaElement>(null);

  const loadDirectory = useCallback(async () => {
    setLoadingDirectory(true);
    setDirectoryError(null);
    try {
      const response = await fetch("/api/v1/admin/students", { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as {
        data?: StudentRecord[] | { classInfo: ClassInfo | null; students: StudentRecord[] };
        error?: { message?: string };
      } | null;
      if (response.ok && body?.data) {
        if (Array.isArray(body.data)) {
          setStudents(body.data);
        } else {
          setClassInfo(body.data.classInfo);
          setStudents(body.data.students ?? []);
          if (body.data.classInfo?.code) {
            setClassCode(body.data.classInfo.code);
          }
        }
      } else {
        setDirectoryError(body?.error?.message ?? "Không tải được danh sách lớp.");
      }
    } catch {
      setDirectoryError("Mất kết nối tới máy chủ khi tải danh sách lớp.");
    } finally {
      setLoadingDirectory(false);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => void loadDirectory(), 0);
    return () => clearTimeout(initial);
  }, [loadDirectory]);

  // Auto-hide success notifications after a few seconds
  useEffect(() => {
    if (!message || message.tone !== "teal") return;
    const timer = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  // Modal focus & Escape key handling
  useEffect(() => {
    if (!supportStudent && !showQuickAddModal) return;
    const focusTimer = window.setTimeout(() => {
      if (supportStudent) {
        if (supportAction === "display_name") {
          supportNameInputRef.current?.focus();
        } else {
          supportReasonInputRef.current?.focus();
        }
      } else if (showQuickAddModal) {
        quickAddTextareaRef.current?.focus();
      }
    }, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (supportStudent && !supportBusy) {
          setSupportStudent(null);
          setSupportDirty(false);
        } else if (showQuickAddModal && !busy) {
          setShowQuickAddModal(false);
          setQuickPreview(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [supportStudent, supportAction, supportBusy, showQuickAddModal, busy]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (q) {
        const hay = `${s.student_id} ${s.full_name} ${s.display_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [students, searchQuery, statusFilter]);

  async function handleSupportSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!supportStudent || supportReason.trim().length < 3) return;
    setSupportBusy(true);
    setMessage(null);
    const csrf = readCsrfCookie();

    try {
      let response: Response;
      if (supportAction === "reset_password") {
        response = await fetch(`/api/v1/admin/profiles/${supportStudent.id}/password-resets`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": csrf },
          body: JSON.stringify({ reason: supportReason.trim() }),
        });
      } else if (supportAction === "display_name") {
        response = await fetch(`/api/v1/admin/profiles/${supportStudent.id}/display-name`, {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-csrf-token": csrf },
          body: JSON.stringify({ displayName: newDisplayName.trim(), reason: supportReason.trim() }),
        });
      } else {
        response = await fetch(`/api/v1/admin/profiles/${supportStudent.id}/incidents`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": csrf },
          body: JSON.stringify({ action: supportAction, reason: supportReason.trim() }),
        });
      }

      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) {
        setMessage({ tone: "red", text: body?.error?.message ?? "Không thực hiện được thao tác hỗ trợ." });
      } else {
        setMessage({
          tone: "teal",
          text: `Đã thực hiện hỗ trợ cho sinh viên ${supportStudent.student_id} (${supportStudent.full_name}).`,
        });
        setSupportStudent(null);
        setSupportReason("");
        setSupportDirty(false);
        await loadDirectory();
      }
    } catch {
      setMessage({ tone: "red", text: "Lỗi kết nối máy chủ khi hỗ trợ sinh viên." });
    } finally {
      setSupportBusy(false);
    }
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const body = new FormData(event.currentTarget);
    try {
      const data = await request<PreviewData>("POST", "/admin/roster-imports", { body });
      setPreview(data);
      setConfirmed({});
      setOverrides({});
    } catch (error) {
      setMessage({ tone: "red", text: cleanRosterError(error, "Không thể kiểm tra tệp danh sách.") });
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickAddPreview(text: string) {
    const rawIds = text
      .split(/[\n,;]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (rawIds.length === 0) return;
    const csvContent = ["student_id", ...rawIds].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const file = new File([blob], "quick_add.csv", { type: "text/csv" });

    const formData = new FormData();
    formData.append("classCode", classCode);
    formData.append("className", className || classCode);
    formData.append("file", file);
    formData.append("collectNamesOnSignIn", "on");

    setBusy(true);
    setMessage(null);
    try {
      const data = await request<PreviewData>("POST", "/admin/roster-imports", { body: formData });
      setQuickPreview(data);
      setQuickConfirmed({});
      setQuickOverrides({});
    } catch (error) {
      setMessage({ tone: "red", text: cleanRosterError(error, "Không thể thêm nhanh sinh viên.") });
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickAddApply() {
    if (!quickPreview) return;
    setBusy(true);
    setMessage(null);
    const confirmedWarningRows = Object.entries(quickConfirmed)
      .filter(([, v]) => v)
      .map(([k]) => Number(k));
    try {
      const result = await request<{ created: number; updated?: number; omittedCount?: number }>(
        "POST",
        `/admin/roster-imports/${quickPreview.importId}/apply`,
        { body: { confirmedWarningRows, displayNameOverrides: quickOverrides } },
      );
      setMessage({
        tone: "teal",
        text: `Đã tạo ${result.created} tài khoản${result.updated ? `, cập nhật ${result.updated}` : ""}.`,
      });
      setShowQuickAddModal(false);
      setQuickPreview(null);
      setQuickStudentText("");
      await loadDirectory();
    } catch (error) {
      setMessage({ tone: "red", text: cleanRosterError(error, "Không thể tạo tài khoản sinh viên.") });
    } finally {
      setBusy(false);
    }
  }

  function handleExportCsv() {
    const headers = ["STT", "MSSV", "Họ và tên", "Tên hiển thị", "Trạng thái", "Ngày cập nhật"];
    const rows = filteredStudents.map((s, idx) =>
      [
        idx + 1,
        `"${s.student_id}"`,
        `"${(s.full_name || "").replace(/"/g, '""')}"`,
        `"${(s.display_name || "").replace(/"/g, '""')}"`,
        `"${s.status === "active" ? "Hoạt động" : "Bị khóa"}"`,
        `"${new Date(s.updated_at).toLocaleDateString("vi-VN")}"`,
      ].join(","),
    );
    const bom = "\uFEFF";
    const csv = bom + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Danh_Sach_Lop_${classCode || "VNR202"}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleApply() {
    if (!preview) return;
    setBusy(true);
    setMessage(null);
    const confirmedWarningRows = Object.entries(confirmed)
      .filter(([, v]) => v)
      .map(([k]) => Number(k));
    try {
      const result = await request<{ created: number; updated?: number; omittedCount?: number; idempotent?: boolean }>(
        "POST",
        `/admin/roster-imports/${preview.importId}/apply`,
        { body: { confirmedWarningRows, displayNameOverrides: overrides } },
      );
      setPreview((p) => (p ? { ...p, omittedCount: result.omittedCount ?? 0 } : p));
      setMessage({
        tone: "teal",
        text: `Đã tạo ${result.created} tài khoản${result.updated ? `, cập nhật ${result.updated}` : ""}.`,
      });
      await loadDirectory();
    } catch (error) {
      setMessage({ tone: "red", text: cleanRosterError(error, "Không thể áp dụng danh sách.") });
    } finally {
      setBusy(false);
    }
  }

  async function handleCleanup() {
    if (!preview) return;
    setBusy(true);
    try {
      const result = await request<{ removed: number; keptWithHistory: number }>(
        "POST",
        `/admin/roster-imports/${preview.importId}/cleanup`,
        { body: { confirmed: cleanupConfirmed, reason: cleanupReason } },
      );
      setMessage({
        tone: "teal",
        text: `Đã xóa ${result.removed} tài khoản chưa có lịch sử; giữ nguyên ${result.keptWithHistory} tài khoản đã từng dự thi.`,
      });
      await loadDirectory();
    } catch (error) {
      setMessage({ tone: "red", text: cleanRosterError(error, "Không thể dọn danh sách.") });
    } finally {
      setBusy(false);
    }
  }

  const confirmedCount = Object.values(confirmed).filter(Boolean).length;
  const pendingWarnings = preview
    ? preview.rows.filter((r) => r.status === "warning" && !confirmed[r.rowNumber]).length
    : 0;
  const quickConfirmedCount = Object.values(quickConfirmed).filter(Boolean).length;
  const quickPendingWarnings = quickPreview
    ? quickPreview.rows.filter((r) => r.status === "warning" && !quickConfirmed[r.rowNumber]).length
    : 0;
  const activeStudentsCount = students.filter((s) => s.status === "active").length;
  const lockedStudentsCount = students.filter((s) => s.status !== "active").length;

  return (
    <main aria-label="Quản lý danh sách lớp" style={{ minWidth: 0, maxWidth: "100%" }}>
      {message && (
        <div
          className="acc-banner"
          data-tone={message.tone}
          role={message.tone === "red" ? "alert" : "status"}
          aria-live="polite"
        >
          <span>{message.text}</span>
          <button type="button" className="acc-btn" onClick={() => setMessage(null)}>
            Đóng
          </button>
        </div>
      )}

      <header className="acc-page-header">
        <div style={{ minWidth: 0 }}>
          <p className="acc-kicker">Quản lý định danh & Hỗ trợ tại lớp</p>
          <h1 className="acc-title">Danh sách lớp & Tài khoản · {classInfo?.code ?? "VNR202"}</h1>
          <p className="acc-subtitle">
            Tra cứu nhanh sinh viên khi đứng lớp, đặt lại mật khẩu mặc định, đổi tên hiển thị hoặc nhập tệp
            danh sách lớp chính thức. Tài khoản phòng thi thử (<code>THU001...</code>) được tách riêng và không tính
            vào sĩ số này.
          </p>
        </div>

        <div className="acc-sync-bar">
          <button type="button" className="acc-btn" onClick={() => void loadDirectory()}>
            Làm mới danh sách
          </button>
        </div>
      </header>

      {/* KPI Summary */}
      <section className="acc-kpi-grid" aria-label="Thống kê sĩ số lớp">
        <div className="acc-kpi-card" data-tone="teal">
          <span className="acc-kpi-label">Lớp đang hoạt động</span>
          <span className="acc-kpi-value">{classInfo?.code ?? "VNR202"}</span>
          <span className="acc-kpi-meta">{classInfo?.name ?? "Danh sách lớp chính thức"}</span>
        </div>
        <div className="acc-kpi-card" data-tone="teal">
          <span className="acc-kpi-label">Tổng sĩ số chính thức</span>
          <span className="acc-kpi-value">{students.length}</span>
          <span className="acc-kpi-meta">Không bao gồm tài khoản thử nghiệm</span>
        </div>
        <div className="acc-kpi-card" data-tone="teal">
          <span className="acc-kpi-label">Tài khoản hoạt động</span>
          <span className="acc-kpi-value">{activeStudentsCount}</span>
          <span className="acc-kpi-meta">Sẵn sàng đăng nhập Live Arena</span>
        </div>
        <div className="acc-kpi-card" data-tone={lockedStudentsCount > 0 ? "red" : undefined}>
          <span className="acc-kpi-label">Tài khoản đang khóa</span>
          <span className="acc-kpi-value">{lockedStudentsCount}</span>
          <span className="acc-kpi-meta">Cần mở khóa nếu muốn thi tiếp</span>
        </div>
      </section>

      {/* SECTION 1 (Moved to top): Student Directory & Support */}
      <section className="acc-panel" aria-label="Danh bạ sinh viên">
        <div
          className="acc-panel-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.6rem",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 className="acc-panel-title">
              Danh sách sinh viên chính thức ({filteredStudents.length}/{students.length})
            </h2>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.84rem", color: "var(--acc-muted)" }}>
              Họ tên và MSSV chỉ hiển thị cho quản trị viên; bảng xếp hạng công khai chỉ hiển thị tên rút gọn (ví dụ:{" "}
              <em>An N.V.</em>).
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
            <button
              type="button"
              className="acc-btn acc-btn-primary"
              style={{ minHeight: "2rem", padding: "0.3rem 0.75rem", fontSize: "0.82rem" }}
              onClick={() => {
                setQuickStudentText("");
                setQuickPreview(null);
                setShowQuickAddModal(true);
              }}
            >
              + Thêm nhanh sinh viên
            </button>
            <button
              type="button"
              className="acc-btn"
              style={{ minHeight: "2rem", padding: "0.3rem 0.75rem", fontSize: "0.82rem" }}
              onClick={handleExportCsv}
              disabled={students.length === 0}
            >
              Xuất danh sách CSV
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
            gap: "0.75rem",
            marginBottom: "0.9rem",
            minWidth: 0,
          }}
        >
          <label className="acc-field">
            <span>Tìm kiếm MSSV hoặc Họ tên</span>
            <input
              className="acc-input"
              placeholder="Nhập MSSV (ví dụ SE18...) hoặc tên..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
          <label className="acc-field">
            <span>Trạng thái tài khoản</span>
            <select
              className="acc-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | "active" | "locked")}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="locked">Đang bị khóa</option>
            </select>
          </label>
        </div>

        {loadingDirectory ? (
          <p style={{ color: "var(--acc-muted)" }}>Đang tải danh sách lớp...</p>
        ) : directoryError ? (
          <div className="acc-banner" data-tone="red" role="alert">
            <span>{directoryError}</span>
            <button type="button" className="acc-btn acc-btn-amber" onClick={() => void loadDirectory()}>
              Thử lại
            </button>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="acc-panel-alt" style={{ color: "var(--acc-muted)" }}>
            Không tìm thấy sinh viên phù hợp.
          </div>
        ) : (
          <div className="acc-table-wrap" style={{ maxHeight: "32rem", overflowY: "auto" }}>
            <table className="acc-table">
              <thead>
                <tr>
                  <th>MSSV</th>
                  <th>Họ và tên (Nội bộ)</th>
                  <th>Tên hiển thị bảng điểm</th>
                  <th>Trạng thái</th>
                  <th>Hỗ trợ nhanh tại lớp</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((st) => {
                  const displayLabel = st.display_name_suffix
                    ? `${st.display_name} (${st.display_name_suffix})`
                    : st.display_name;
                  return (
                    <tr key={st.id}>
                      <td>
                        <code style={{ fontWeight: 700, color: "var(--acc-amber)" }}>{st.student_id}</code>
                      </td>
                      <td>{st.full_name}</td>
                      <td>
                        <strong>{displayLabel}</strong>
                      </td>
                      <td>
                        <span className="acc-badge" data-tone={st.status === "active" ? "teal" : "red"}>
                          {st.status === "active" ? "Hoạt động" : "Đã khóa"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                          <button
                            type="button"
                            className="acc-btn"
                            style={{ minHeight: "1.95rem", padding: "0.2rem 0.6rem", fontSize: "0.78rem" }}
                            onClick={() => {
                              setSupportStudent(st);
                              setSupportAction("reset_password");
                              setSupportReason("Hỗ trợ đặt lại mật khẩu mặc định tại lớp");
                              setSupportDirty(false);
                            }}
                          >
                            Đặt lại MK
                          </button>
                          <button
                            type="button"
                            className="acc-btn"
                            style={{ minHeight: "1.95rem", padding: "0.2rem 0.6rem", fontSize: "0.78rem" }}
                            onClick={() => {
                              setSupportStudent(st);
                              setSupportAction("display_name");
                              setNewDisplayName(st.display_name);
                              setSupportReason("Cập nhật tên hiển thị theo yêu cầu tại lớp");
                              setSupportDirty(false);
                            }}
                          >
                            Đổi tên
                          </button>
                          <button
                            type="button"
                            className="acc-btn"
                            style={{ minHeight: "1.95rem", padding: "0.2rem 0.6rem", fontSize: "0.78rem" }}
                            onClick={() => {
                              setSupportStudent(st);
                              setSupportAction("revoke_sessions");
                              setSupportReason("Thu hồi phiên cũ để đăng nhập thiết bị mới");
                              setSupportDirty(false);
                            }}
                          >
                            Thu hồi phiên
                          </button>
                          <button
                            type="button"
                            className={st.status === "active" ? "acc-btn acc-btn-danger" : "acc-btn acc-btn-primary"}
                            style={{ minHeight: "1.95rem", padding: "0.2rem 0.6rem", fontSize: "0.78rem" }}
                            onClick={() => {
                              setSupportStudent(st);
                              setSupportAction(st.status === "active" ? "lock_account" : "unlock_account");
                              setSupportReason(
                                st.status === "active" ? "Tạm khóa tài khoản kiểm tra" : "Mở khóa tài khoản tại lớp",
                              );
                              setSupportDirty(false);
                            }}
                          >
                            {st.status === "active" ? "Khóa" : "Mở khóa"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SECTION 2 (Moved below and collapsed by default): CSV / XLSX Roster Import */}
      <details className="acc-panel" aria-label="Nhập tệp danh sách lớp" open={Boolean(preview)}>
        <summary
          style={{
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "1.05rem",
            color: "var(--acc-text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          <span>Nhập / Cập nhật tệp danh sách lớp (.xlsx hoặc .csv)</span>
          <span className="acc-badge">Nhấn để mở / đóng</span>
        </summary>

        <div style={{ marginTop: "0.9rem" }}>
          <p style={{ margin: "0 0 0.85rem", fontSize: "0.84rem", color: "var(--acc-muted)" }}>
            Tải tệp danh sách lớp (.xlsx hoặc .csv), kiểm tra bản xem trước rồi mới tạo tài khoản. Mật khẩu mặc định
            lấy từ cấu hình máy chủ, không bao giờ xuất hiện trong tệp hay trên màn hình.
          </p>

          <form
            onSubmit={handleUpload}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
              gap: "0.75rem",
              alignItems: "end",
              minWidth: 0,
              maxWidth: "100%",
            }}
          >
            <label className="acc-field">
              <span>Mã lớp</span>
              <input
                name="classCode"
                required
                maxLength={40}
                value={classCode}
                onChange={(e) => setClassCode(e.target.value)}
                className="acc-input"
              />
            </label>
            <label className="acc-field">
              <span>Tên lớp</span>
              <input
                name="className"
                maxLength={120}
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="acc-input"
              />
            </label>
            <label className="acc-field">
              <span>Tệp danh sách (.xlsx hoặc .csv)</span>
              <input
                name="file"
                required
                type="file"
                accept=".xlsx,.csv,.tsv,.txt"
                className="acc-input"
              />
            </label>
            <label
              className="adm__check"
              style={{
                display: "flex",
                gap: "0.5rem",
                alignItems: "flex-start",
                gridColumn: "1 / -1",
                fontSize: "0.86rem",
                color: "var(--acc-text)",
                minWidth: 0,
              }}
            >
              <input type="checkbox" name="collectNamesOnSignIn" style={{ marginTop: "0.2rem" }} />
              <span>Chỉ nhập MSSV; sinh viên tự nhập tên khi đăng nhập lần đầu.</span>
            </label>
            <div style={{ gridColumn: "1 / -1" }}>
              <button disabled={busy} type="submit" className="acc-btn acc-btn-primary">
                Xem trước
              </button>
            </div>
          </form>

          {preview && (
            <div style={{ marginTop: "1.25rem", display: "grid", gap: "0.85rem", minWidth: 0, maxWidth: "100%" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                <span className="acc-badge" data-tone="teal">
                  Hợp lệ: {preview.validCount}
                </span>
                <span className="acc-badge" data-tone="amber">
                  Cảnh báo: {preview.warningCount}
                </span>
                <span className="acc-badge" data-tone="red">
                  Lỗi: {preview.errorCount}
                </span>
              </div>

              <div className="acc-table-wrap" role="region" aria-label="Chi tiết danh sách xem trước" tabIndex={0}>
                <table className="acc-table">
                  <thead>
                    <tr>
                      <th>Hàng</th>
                      <th>MSSV</th>
                      <th>Họ và tên</th>
                      <th>Tên hiển thị</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => {
                      const rowStatusText =
                        row.status === "valid"
                          ? "Hợp lệ"
                          : row.message ??
                            (row.issues?.map((i) => ISSUE_LABEL[i] ?? i).join("; ") || "Cần kiểm tra");
                      return (
                        <tr key={row.rowNumber} data-status={row.status}>
                          <td>{row.rowNumber}</td>
                          <td>
                            <code>{row.studentId}</code>
                          </td>
                          <td>{row.fullName}</td>
                          <td>
                            {row.status === "error" ? (
                              row.displayName
                            ) : (
                              <input
                                aria-label={`Tên hiển thị hàng ${row.rowNumber}`}
                                maxLength={40}
                                value={overrides[row.rowNumber] ?? row.displayName}
                                onChange={(e) => setOverrides({ ...overrides, [row.rowNumber]: e.target.value })}
                                className="acc-input"
                                style={{ maxWidth: "11rem" }}
                              />
                            )}
                            {row.displayNameSuffix ? ` (${row.displayNameSuffix})` : ""}
                          </td>
                          <td>
                            <div>{rowStatusText}</div>
                            {row.status === "warning" && (
                              <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", marginTop: "0.25rem" }}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(confirmed[row.rowNumber])}
                                  onChange={(e) =>
                                    setConfirmed({ ...confirmed, [row.rowNumber]: e.target.checked })
                                  }
                                />
                                <span>Xác nhận</span>
                              </label>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
                <button
                  disabled={busy || pendingWarnings > 0 || preview.validCount + confirmedCount === 0}
                  type="button"
                  onClick={handleApply}
                  className="acc-btn acc-btn-primary"
                >
                  Tạo {preview.validCount + confirmedCount} tài khoản
                </button>
                {pendingWarnings > 0 && (
                  <span style={{ fontSize: "0.84rem", color: "var(--acc-amber)" }}>
                    Còn {pendingWarnings} hàng cảnh báo chưa xác nhận.
                  </span>
                )}
              </div>

              {(preview.omittedCount ?? 0) > 0 && (
                <div className="acc-panel-alt" style={{ display: "grid", gap: "0.6rem" }}>
                  <p style={{ margin: 0 }}>
                    Có <strong>{preview.omittedCount}</strong> sinh viên đang có trong lớp nhưng không nằm trong tệp
                    vừa nhập. Mặc định các tài khoản này được giữ nguyên.
                  </p>
                  <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={cleanupConfirmed}
                      onChange={(e) => setCleanupConfirmed(e.target.checked)}
                    />
                    <span>Tôi xác nhận xóa các tài khoản vắng mặt chưa có lịch sử dự thi</span>
                  </label>
                  <label className="acc-field">
                    <span>Lý do kiểm toán</span>
                    <input
                      value={cleanupReason}
                      onChange={(e) => setCleanupReason(e.target.value)}
                      className="acc-input"
                    />
                  </label>
                  <div>
                    <button
                      disabled={busy || !cleanupConfirmed || cleanupReason.trim().length < 3}
                      type="button"
                      onClick={handleCleanup}
                      className="acc-btn acc-btn-danger-solid"
                    >
                      Xóa sinh viên không còn trong danh sách
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </details>

      {/* Student Support Confirmation Modal */}
      {supportStudent && (
        <div
          className="acc-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-modal-title"
          onClick={() => {
            if (!supportDirty && !supportBusy) {
              setSupportStudent(null);
            }
          }}
        >
          <form
            className="acc-modal"
            onSubmit={handleSupportSubmit}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="acc-kicker">Hỗ trợ sinh viên tại lớp</p>
            <h3 id="support-modal-title" style={{ margin: "0 0 0.5rem", fontSize: "1.2rem" }}>
              {supportAction === "reset_password" && "Đặt lại mật khẩu mặc định"}
              {supportAction === "display_name" && "Đổi tên hiển thị bảng xếp hạng"}
              {supportAction === "revoke_sessions" && "Thu hồi phiên đăng nhập"}
              {supportAction === "lock_account" && "Khóa tài khoản sinh viên"}
              {supportAction === "unlock_account" && "Mở khóa tài khoản sinh viên"}
            </h3>

            <div className="acc-modal-summary">
              <div className="acc-modal-row">
                <span>MSSV:</span>
                <code>{supportStudent.student_id}</code>
              </div>
              <div className="acc-modal-row">
                <span>Họ và tên:</span>
                <strong>{supportStudent.full_name}</strong>
              </div>
              <div className="acc-modal-row">
                <span>Tên hiển thị hiện tại:</span>
                <strong>{supportStudent.display_name}</strong>
              </div>
            </div>

            {supportAction === "display_name" && (
              <label className="acc-field" style={{ marginBottom: "0.75rem" }}>
                <span>Tên hiển thị mới (không chứa MSSV)</span>
                <input
                  ref={supportNameInputRef}
                  required
                  maxLength={100}
                  className="acc-input"
                  value={newDisplayName}
                  onChange={(e) => {
                    setNewDisplayName(e.target.value);
                    setSupportDirty(true);
                  }}
                />
              </label>
            )}

            <label className="acc-field" style={{ marginBottom: "1rem" }}>
              <span>Lý do kiểm toán (bắt buộc, tối thiểu 3 ký tự)</span>
              <input
                ref={supportReasonInputRef}
                required
                minLength={3}
                maxLength={300}
                className="acc-input"
                value={supportReason}
                onChange={(e) => {
                  setSupportReason(e.target.value);
                  setSupportDirty(true);
                }}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
              <button
                type="button"
                className="acc-btn"
                disabled={supportBusy}
                onClick={() => {
                  setSupportStudent(null);
                  setSupportDirty(false);
                }}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={supportBusy || supportReason.trim().length < 3}
                className={
                  supportAction === "lock_account" ? "acc-btn acc-btn-danger-solid" : "acc-btn acc-btn-primary"
                }
              >
                {supportBusy ? "Đang xử lý..." : "Xác nhận thực hiện"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Add Student Modal */}
      {showQuickAddModal && (
        <div
          className="acc-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-add-modal-title"
          onClick={() => {
            if (!quickStudentText.trim() && !quickPreview && !busy) {
              setShowQuickAddModal(false);
            }
          }}
        >
          <div
            className="acc-modal"
            style={{ width: "min(100%, 40rem)", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="quick-add-modal-title" style={{ margin: "0 0 0.4rem", fontSize: "1.2rem" }}>
              Thêm nhanh sinh viên vào lớp
            </h3>
            <p style={{ margin: "0 0 0.85rem", fontSize: "0.84rem", color: "var(--acc-text-Soft)" }}>
              Nhập một hoặc nhiều MSSV (mỗi MSSV một dòng, hoặc cách nhau bởi dấu phẩy). Sinh viên sẽ tự nhập họ tên
              hiển thị khi đăng nhập lần đầu.
            </p>
            <label className="acc-field" style={{ marginBottom: "0.95rem" }}>
              <span>Danh sách MSSV</span>
              <textarea
                ref={quickAddTextareaRef}
                className="acc-textarea"
                rows={4}
                placeholder="Ví dụ:&#10;SE180001&#10;SE180002"
                value={quickStudentText}
                onChange={(e) => {
                  setQuickStudentText(e.target.value);
                  setQuickPreview(null);
                }}
              />
            </label>

            {quickPreview && (
              <div
                className="acc-panel-alt"
                style={{ marginBottom: "0.95rem", display: "grid", gap: "0.65rem" }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                  <span className="acc-badge" data-tone="teal">
                    Hợp lệ: {quickPreview.validCount}
                  </span>
                  <span className="acc-badge" data-tone="amber">
                    Cảnh báo: {quickPreview.warningCount}
                  </span>
                  <span className="acc-badge" data-tone="red">
                    Lỗi: {quickPreview.errorCount}
                  </span>
                </div>

                <div className="acc-table-wrap" style={{ maxHeight: "14rem", overflowY: "auto" }}>
                  <table className="acc-table">
                    <thead>
                      <tr>
                        <th>Hàng</th>
                        <th>MSSV</th>
                        <th>Tên hiển thị</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quickPreview.rows.map((row) => {
                        const rowStatusText =
                          row.status === "valid"
                            ? "Hợp lệ"
                            : row.message ??
                              (row.issues?.map((i) => ISSUE_LABEL[i] ?? i).join("; ") || "Cần kiểm tra");
                        return (
                          <tr key={row.rowNumber} data-status={row.status}>
                            <td>{row.rowNumber}</td>
                            <td>
                              <code>{row.studentId}</code>
                            </td>
                            <td>
                              {row.status === "error" ? (
                                row.displayName
                              ) : (
                                <input
                                  aria-label={`Tên hiển thị xem trước hàng ${row.rowNumber}`}
                                  maxLength={40}
                                  value={quickOverrides[row.rowNumber] ?? row.displayName}
                                  onChange={(e) =>
                                    setQuickOverrides({ ...quickOverrides, [row.rowNumber]: e.target.value })
                                  }
                                  className="acc-input"
                                  style={{ maxWidth: "10rem" }}
                                />
                              )}
                            </td>
                            <td>
                              <div>{rowStatusText}</div>
                              {row.status === "warning" && (
                                <label
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.35rem",
                                    marginTop: "0.25rem",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={Boolean(quickConfirmed[row.rowNumber])}
                                    onChange={(e) =>
                                      setQuickConfirmed({ ...quickConfirmed, [row.rowNumber]: e.target.checked })
                                    }
                                  />
                                  <span>Xác nhận</span>
                                </label>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.55rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="acc-btn"
                disabled={busy}
                onClick={() => {
                  setShowQuickAddModal(false);
                  setQuickPreview(null);
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                className="acc-btn"
                disabled={busy || !quickStudentText.trim()}
                onClick={() => void handleQuickAddPreview(quickStudentText)}
              >
                {busy && !quickPreview ? "Đang kiểm tra..." : "Xem trước"}
              </button>
              {quickPreview && (
                <button
                  type="button"
                  className="acc-btn acc-btn-primary"
                  disabled={busy || quickPendingWarnings > 0 || quickPreview.validCount + quickConfirmedCount === 0}
                  onClick={() => void handleQuickAddApply()}
                >
                  {busy
                    ? "Đang tạo..."
                    : `Tạo ${quickPreview.validCount + quickConfirmedCount} tài khoản tại chỗ`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
