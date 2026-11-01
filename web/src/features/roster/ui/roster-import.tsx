"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import "@/features/admin/ui/admin-control-center.css";
import { readCsrfCookie } from "@/lib/security/csrf-client";

type PreviewRow = {
  rowNumber: number;
  studentId: string;
  fullName: string;
  displayName: string;
  status: "valid" | "warning" | "error";
  code: string | null;
  message: string | null;
};

type PreviewData = {
  importId: string;
  classCode: string;
  validCount: number;
  warningCount: number;
  errorCount: number;
  rows: PreviewRow[];
  omittedCount?: number;
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

export function RosterImport() {
  const [tab, setTab] = useState<"directory" | "import">("directory");
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "locked">("");

  // Student support modal state
  const [supportStudent, setSupportStudent] = useState<StudentRecord | null>(null);
  const [supportAction, setSupportAction] = useState<
    "reset_password" | "display_name" | "revoke_sessions" | "lock_account" | "unlock_account"
  >("reset_password");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [supportReason, setSupportReason] = useState("");
  const [supportBusy, setSupportBusy] = useState(false);

  // Roster import state
  const [classCode, setClassCode] = useState("VNR202");
  const [className, setClassName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [confirmed, setConfirmed] = useState<Record<number, boolean>>({});
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [cleanupConfirmed, setCleanupConfirmed] = useState(false);
  const [cleanupReason, setCleanupReason] = useState("");
  const [message, setMessage] = useState<{ tone: "teal" | "amber" | "red"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadDirectory = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/admin/students", { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as {
        data?: StudentRecord[] | { classInfo: ClassInfo | null; students: StudentRecord[] };
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
      }
    } finally {
      setLoadingDirectory(false);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => void loadDirectory(), 0);
    return () => clearTimeout(initial);
  }, [loadDirectory]);

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
        await loadDirectory();
      }
    } catch {
      setMessage({ tone: "red", text: "Lỗi kết nối máy chủ khi hỗ trợ sinh viên." });
    } finally {
      setSupportBusy(false);
    }
  }

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setMessage(null);
    const form = new FormData();
    form.set("classCode", classCode);
    if (className) form.set("className", className);
    form.set("file", file);
    const response = await fetch("/api/v1/admin/roster-imports", {
      method: "POST",
      headers: { "x-csrf-token": readCsrfCookie() },
      body: form,
    });
    const body = (await response.json().catch(() => null)) as {
      data?: PreviewData;
      error?: { message?: string };
    } | null;
    setBusy(false);
    if (!response.ok || !body?.data) {
      setMessage({ tone: "red", text: body?.error?.message ?? "Không thể kiểm tra tệp danh sách." });
      return;
    }
    setPreview(body.data);
    setConfirmed({});
    setOverrides({});
  }

  async function handleApply() {
    if (!preview) return;
    setBusy(true);
    setMessage(null);
    const confirmedWarningRows = Object.entries(confirmed)
      .filter(([, v]) => v)
      .map(([k]) => Number(k));
    const response = await fetch(`/api/v1/admin/roster-imports/${preview.importId}/apply`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": readCsrfCookie() },
      body: JSON.stringify({ confirmedWarningRows, displayNameOverrides: overrides }),
    });
    const body = (await response.json().catch(() => null)) as {
      data?: { created: number; updated: number; omittedCount: number; idempotent?: boolean };
      error?: { message?: string };
    } | null;
    setBusy(false);
    if (!response.ok || !body?.data) {
      setMessage({ tone: "red", text: body?.error?.message ?? "Không thể áp dụng danh sách." });
      return;
    }
    setPreview((p) => (p ? { ...p, omittedCount: body.data!.omittedCount } : p));
    setMessage({
      tone: "teal",
      text: `Đã áp dụng: tạo mới ${body.data.created}, cập nhật ${body.data.updated}. Sinh viên vắng trong tệp (giữ nguyên): ${body.data.omittedCount}.`,
    });
    await loadDirectory();
  }

  async function handleCleanup() {
    if (!preview) return;
    setBusy(true);
    const response = await fetch(`/api/v1/admin/roster-imports/${preview.importId}/cleanup`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": readCsrfCookie() },
      body: JSON.stringify({ confirmed: cleanupConfirmed, reason: cleanupReason }),
    });
    const body = (await response.json().catch(() => null)) as {
      data?: { removed: number; keptWithHistory: number };
      error?: { message?: string };
    } | null;
    setBusy(false);
    if (!response.ok || !body?.data) {
      setMessage({ tone: "red", text: body?.error?.message ?? "Không thể dọn danh sách." });
      return;
    }
    setMessage({
      tone: "amber",
      text: `Đã xóa ${body.data.removed} tài khoản chưa có lịch sử; giữ nguyên ${body.data.keptWithHistory} tài khoản đã từng dự thi.`,
    });
    await loadDirectory();
  }

  const activeStudentsCount = students.filter((s) => s.status === "active").length;
  const lockedStudentsCount = students.filter((s) => s.status !== "active").length;

  return (
    <main aria-label="Quản lý danh sách lớp">
      <header className="acc-page-header">
        <div>
          <p className="acc-kicker">Quản lý định danh & Hỗ trợ tại lớp</p>
          <h1 className="acc-title">Danh sách lớp · {classInfo?.code ?? "VNR202"}</h1>
          <p className="acc-subtitle">
            Tra cứu nhanh sinh viên khi đứng lớp, đặt lại mật khẩu mặc định, đổi tên hiển thị hoặc nhập tệp CSV/TSV
            danh sách lớp chính thức. Tài khoản phòng thi thử (<code>THU001...</code>) được cách ly riêng và không tính
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

      {/* Mode Switcher */}
      <div className="acc-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "directory"}
          className="acc-tab"
          onClick={() => setTab("directory")}
        >
          <span>Tra cứu & Hỗ trợ sinh viên</span>
          <span className="acc-tab-count">{students.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "import"}
          className="acc-tab"
          onClick={() => setTab("import")}
        >
          <span>Nhập / Cập nhật tệp CSV danh sách lớp</span>
        </button>
      </div>

      {message && (
        <div className="acc-banner" data-tone={message.tone} role="status">
          <span>{message.text}</span>
          <button type="button" className="acc-btn" onClick={() => setMessage(null)}>
            Đóng
          </button>
        </div>
      )}

      {/* TAB 1: Student Directory & Support */}
      {tab === "directory" && (
        <section className="acc-panel" aria-label="Danh bạ sinh viên">
          <div className="acc-panel-header">
            <div>
              <h2 className="acc-panel-title">
                Danh sách sinh viên chính thức ({filteredStudents.length}/{students.length})
              </h2>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.84rem", color: "var(--acc-muted)" }}>
                Họ tên và MSSV chỉ hiển thị cho quản trị viên; bảng xếp hạng công khai chỉ hiển thị tên rút gọn (ví dụ:{" "}
                <em>An N.V.</em>).
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
              gap: "0.75rem",
              marginBottom: "0.9rem",
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
                <option value="active">Đang hoạt động (active)</option>
                <option value="locked">Đang bị khóa (locked)</option>
              </select>
            </label>
          </div>

          {loadingDirectory ? (
            <p style={{ color: "var(--acc-muted)" }}>Đang tải danh sách lớp...</p>
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
      )}

      {/* TAB 2: CSV / TSV Roster Import */}
      {tab === "import" && (
        <section className="acc-panel" aria-label="Nhập tệp danh sách lớp">
          <div className="acc-panel-header">
            <div>
              <h2 className="acc-panel-title">Nhập tệp CSV/TSV danh sách lớp</h2>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.84rem", color: "var(--acc-muted)" }}>
                Tệp CSV/TSV có hai cột <code>MSSV</code> và <code>Họ và tên</code>. Mật khẩu mặc định lấy từ cấu hình
                máy chủ, không bao giờ xuất hiện trong tệp hay trên màn hình.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleUpload}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))",
              gap: "0.75rem",
              alignItems: "end",
            }}
          >
            <label className="acc-field">
              <span>Mã lớp</span>
              <input
                required
                value={classCode}
                onChange={(e) => setClassCode(e.target.value)}
                className="acc-input"
              />
            </label>
            <label className="acc-field">
              <span>Tên lớp (tùy chọn)</span>
              <input
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="acc-input"
              />
            </label>
            <label className="acc-field">
              <span>Tệp danh sách (.csv, .tsv, .txt)</span>
              <input
                required
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="acc-input"
              />
            </label>
            <button disabled={busy || !file} type="submit" className="acc-btn acc-btn-primary">
              Kiểm tra danh sách
            </button>
          </form>

          {preview && (
            <div style={{ marginTop: "1.25rem", display: "grid", gap: "0.85rem" }}>
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

              <div className="acc-table-wrap">
                <table className="acc-table">
                  <thead>
                    <tr>
                      <th>Dòng</th>
                      <th>MSSV</th>
                      <th>Họ và tên</th>
                      <th>Tên hiển thị</th>
                      <th>Trạng thái</th>
                      <th>Xác nhận / Chỉnh tên</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.rowNumber}>
                        <td>{row.rowNumber}</td>
                        <td>
                          <code>{row.studentId}</code>
                        </td>
                        <td>{row.fullName}</td>
                        <td>{overrides[row.rowNumber] ?? row.displayName}</td>
                        <td>{row.message ?? "Hợp lệ"}</td>
                        <td>
                          {row.status === "warning" && (
                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                              <label style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(confirmed[row.rowNumber])}
                                  onChange={(e) =>
                                    setConfirmed({ ...confirmed, [row.rowNumber]: e.target.checked })
                                  }
                                />
                                <span>Duyệt</span>
                              </label>
                              <input
                                placeholder="Tên hiển thị thay thế"
                                value={overrides[row.rowNumber] ?? ""}
                                onChange={(e) =>
                                  setOverrides({ ...overrides, [row.rowNumber]: e.target.value })
                                }
                                className="acc-input"
                                style={{ maxWidth: "11rem" }}
                              />
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <button disabled={busy} type="button" onClick={handleApply} className="acc-btn acc-btn-primary">
                  Áp dụng danh sách
                </button>
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
        </section>
      )}

      {/* Student Support Confirmation Modal */}
      {supportStudent && (
        <div className="acc-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="support-modal-title">
          <form className="acc-modal" onSubmit={handleSupportSubmit}>
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
                  required
                  maxLength={100}
                  className="acc-input"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                />
              </label>
            )}

            <label className="acc-field" style={{ marginBottom: "1rem" }}>
              <span>Lý do kiểm toán (bắt buộc, tối thiểu 3 ký tự)</span>
              <input
                required
                minLength={3}
                maxLength={300}
                className="acc-input"
                value={supportReason}
                onChange={(e) => setSupportReason(e.target.value)}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
              <button type="button" className="acc-btn" onClick={() => setSupportStudent(null)}>
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
    </main>
  );
}
