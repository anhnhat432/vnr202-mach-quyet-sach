"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Student sign-in (LA-ACC-007/019): MSSV + password, no password-change step. Errors are generic.
export function LoginForm() {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentId, password }),
      });
      if (response.ok) {
        router.push("/live-arena");
        router.refresh();
        return;
      }
      setMessage(response.status === 429 ? "Thử lại sau ít phút." : response.status === 423 ? "Tài khoản đang bị khóa. Hãy liên hệ giảng viên." : "Mã sinh viên hoặc mật khẩu không đúng.");
    } catch {
      setMessage("Không kết nối được. Kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <label>
        Mã số sinh viên
        <input name="studentId" autoComplete="username" autoCapitalize="characters" inputMode="text" required value={studentId} onChange={(e) => setStudentId(e.target.value)} />
      </label>
      <label>
        Mật khẩu
        <input name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <p role="status" aria-live="polite" className="login-message">{message}</p>
      <button type="submit" disabled={busy || studentId.trim() === "" || password === ""}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</button>
    </form>
  );
}
