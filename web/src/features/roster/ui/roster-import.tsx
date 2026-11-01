"use client";

import { useState } from "react";
import { request } from "@/features/arena/client/api";

type Row = { rowNumber: number; studentId: string; fullName: string; displayName: string; displayNameSuffix: number | null; status: "valid" | "warning" | "error"; issues: string[] };
type Preview = { importId: string; rows: Row[]; validCount: number; warningCount: number; errorCount: number };

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

// Admin roster import: upload -> preview with per-row issues -> confirm warnings -> apply (LA-AC-018).
export function RosterImport() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const body = new FormData(event.currentTarget);
    try {
      setPreview(await request<Preview>("POST", "/admin/roster-imports", { body }));
      setConfirmed(new Set());
      setOverrides({});
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không đọc được tệp."); }
    finally { setBusy(false); }
  }

  async function apply() {
    if (!preview) return;
    setBusy(true);
    try {
      const result = await request<{ created: number }>("POST", `/admin/roster-imports/${preview.importId}/apply`, { body: { confirmedWarningRows: [...confirmed], displayNameOverrides: overrides } });
      setMessage(`Đã tạo ${result.created} tài khoản.`);
      setPreview(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không áp dụng được."); }
    finally { setBusy(false); }
  }

  const pendingWarnings = preview ? preview.rows.filter((r) => r.status === "warning" && !confirmed.has(r.rowNumber)).length : 0;

  return (
    <div className="roster-import">
      <form onSubmit={upload}>
        <label>Mã lớp<input name="classCode" required maxLength={40} /></label>
        <label>Tên lớp<input name="className" maxLength={120} /></label>
        <label>Tệp danh sách (.xlsx hoặc .csv)<input name="file" type="file" accept=".xlsx,.csv" required /></label>
        <label className="adm__check"><input type="checkbox" name="collectNamesOnSignIn" /> Chỉ nhập MSSV; sinh viên tự nhập tên khi đăng nhập lần đầu.</label>
        <button type="submit" disabled={busy}>Xem trước</button>
      </form>
      <p role="status" aria-live="polite">{message}</p>
      {preview ? (
        <section aria-label="Bản xem trước">
          <p>
            {preview.rows.length} hàng · hợp lệ {preview.validCount} · cảnh báo {preview.warningCount} · lỗi {preview.errorCount}. Chưa có tài khoản nào được tạo.
          </p>
          <div className="roster-import__table" role="region" aria-label="Chi tiết danh sách xem trước" tabIndex={0}>
            <table>
              <thead><tr><th>Hàng</th><th>MSSV</th><th>Họ tên</th><th>Tên hiển thị</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber} data-status={row.status}>
                    <td>{row.rowNumber}</td>
                    <td>{row.studentId}</td>
                    <td>{row.fullName}</td>
                    <td>
                      {row.status === "error" ? row.displayName : (
                        <input aria-label={`Tên hiển thị hàng ${row.rowNumber}`} maxLength={40} value={overrides[row.rowNumber] ?? row.displayName} onChange={(e) => setOverrides({ ...overrides, [row.rowNumber]: e.target.value })} />
                      )}
                      {row.displayNameSuffix ? ` (${row.displayNameSuffix})` : ""}
                    </td>
                    <td>
                      {row.status === "valid" ? "Hợp lệ" : row.issues.map((i) => ISSUE_LABEL[i] ?? i).join("; ")}
                      {row.status === "warning" ? (
                        <label><input type="checkbox" checked={confirmed.has(row.rowNumber)} onChange={(e) => { const next = new Set(confirmed); if (e.target.checked) next.add(row.rowNumber); else next.delete(row.rowNumber); setConfirmed(next); }} /> Xác nhận</label>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={apply} disabled={busy || pendingWarnings > 0 || preview.validCount + confirmed.size === 0}>
            Tạo {preview.validCount + confirmed.size} tài khoản
          </button>
          {pendingWarnings > 0 ? <p>Còn {pendingWarnings} hàng cảnh báo chưa xác nhận.</p> : null}
        </section>
      ) : null}
    </div>
  );
}
