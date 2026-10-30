import type { Metadata } from "next";

import { AdminLoginForm } from "@/features/admin/ui/admin-login";

export const metadata: Metadata = { title: "Đăng nhập quản trị", robots: { index: false } };

export default function AdminLoginPage() {
  return (
    <div className="page-shell login-shell">
      <section>
        <p className="eyebrow">Quản trị</p>
        <h1>Đăng nhập quản trị</h1>
        <p>Dành cho giảng viên và trợ giảng có tài khoản quản trị.</p>
        <AdminLoginForm />
      </section>
    </div>
  );
}
