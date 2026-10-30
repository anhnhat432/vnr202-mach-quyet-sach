import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CompetitionAdmin } from "@/features/admin/ui/competition-admin";
import { isAuthConfigured } from "@/lib/config/server-env";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Quản trị · Cuộc thi Live Arena", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  if (!isAuthConfigured()) redirect("/");
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user?.app_metadata?.role !== "admin") redirect("/quan-tri/dang-nhap");
  return (
    <div className="page-shell">
      <header className="page-intro">
        <p className="eyebrow">Quản trị</p>
        <h1>Cuộc thi Live Arena</h1>
        <p>Tạo và điều khiển cuộc thi, theo dõi người chơi trực tiếp. Quản trị viên không sửa điểm, thời gian hay lượt thi; không có lượt mới hoặc lượt thay thế.</p>
      </header>
      <CompetitionAdmin />
    </div>
  );
}
