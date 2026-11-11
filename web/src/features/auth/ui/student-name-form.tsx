"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArenaApiError, request } from "@/features/arena/client/api";
import { classroomDisplayName } from "@/features/roster/domain/display-name";

export function StudentNameForm() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      await request("POST", "/me/display-name", { body: { name } });
      router.push("/live-arena");
      router.refresh();
    } catch (error) {
      if (error instanceof ArenaApiError && error.code === "display_name_already_set") {
        router.push("/live-arena");
        router.refresh();
      } else setMessage(error instanceof ArenaApiError ? error.message : "Không lưu được tên. Hãy kiểm tra kết nối rồi thử lại.");
    } finally { setBusy(false); }
  }
  return <form onSubmit={submit}>
    <label>Tên gọi hoặc họ tên<input name="name" autoComplete="name" maxLength={100} required disabled={busy} value={name} onChange={(event) => setName(event.target.value)} /></label>
    <p>Tên công khai dự kiến: <strong>{classroomDisplayName(name) || "Chưa nhập tên"}</strong></p>
    <p>Bảng xếp hạng chỉ hiện tên gọi hoặc tên viết tắt. Không nhập MSSV. Tên được lưu một lần; cần sửa sau đó hãy liên hệ người tổ chức.</p>
    {message ? <p role="status" aria-live="polite" className="login-message">{message}</p> : null}
    <button type="submit" disabled={busy || !name.trim()}>{busy ? "Đang lưu…" : "Lưu tên và vào sảnh"}</button>
  </form>;
}
