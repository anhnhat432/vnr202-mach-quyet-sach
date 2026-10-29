import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RosterImport } from "@/features/roster/ui/roster-import";
import { isAuthConfigured } from "@/lib/config/server-env";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Quản trị · Danh sách lớp", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function RosterAdminPage() {
  if (!isAuthConfigured()) redirect("/");
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user?.app_metadata?.role !== "admin") redirect("/");
  return (
    <div className="page-shell">
      <header className="page-intro">
        <p className="eyebrow">Quản trị</p>
        <h1>Danh sách lớp</h1>
        <p>Tải tệp danh sách lớp, kiểm tra bản xem trước rồi mới tạo tài khoản. Tất cả tài khoản dùng mật khẩu mặc định do máy chủ cấu hình; mật khẩu chung không bảo đảm danh tính — chỉ dùng cho thi đua lớp học.</p>
      </header>
      <RosterImport />
    </div>
  );
}
