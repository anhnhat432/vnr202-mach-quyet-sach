"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Administrator sign-in (email + own password; role from app_metadata). Errors stay generic.
export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/auth/admin-sign-in", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      if (response.ok) {
        router.push("/quan-tri/cuoc-thi");
        router.refresh();
        return;
      }
      setMessage(response.status === 429 ? "Thử lại sau ít phút." : "Email hoặc mật khẩu không đúng.");
    } catch {
      setMessage("Không kết nối được.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} noValidate>
      <label>Email quản trị<input name="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>Mật khẩu<input name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      <p role="status" aria-live="polite" className="login-message">{message}</p>
      <button type="submit" disabled={busy || !email || !password}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</button>
    </form>
  );
}
