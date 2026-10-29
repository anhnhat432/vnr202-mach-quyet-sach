import type { Metadata } from "next";

import { LoginForm } from "@/features/auth/ui/login-form";

export const metadata: Metadata = { title: "Đăng nhập" };

export default function LoginPage() {
  return (
    <div className="page-shell login-shell">
      <section>
        <p className="eyebrow">Student Access</p>
        <h1>Đăng nhập Live Arena</h1>
        <p>Dùng mã số sinh viên và mật khẩu do giảng viên cung cấp. Các trải nghiệm lịch sử công khai không cần đăng nhập.</p>
        <LoginForm />
      </section>
    </div>
  );
}
