import type { Metadata } from "next";

export const metadata: Metadata = { title: "Đăng nhập" };

export default function LoginPlaceholderPage() {
  return (
    <div className="page-shell login-shell">
      <section>
        <p className="eyebrow">Student Access</p>
        <h1>Đăng nhập Live Arena</h1>
        <p>Đăng nhập thật và cơ chế một lượt/game được triển khai ở Phase 3-4. Bản công khai hiện không thu thập mã sinh viên hoặc mật khẩu.</p>
        <label>Mã số sinh viên<input disabled placeholder="VD: HE176543" /></label>
        <label>Mật khẩu<input disabled type="password" placeholder="••••••••" /></label>
        <button disabled type="button">Chưa mở đăng nhập</button>
      </section>
    </div>
  );
}
