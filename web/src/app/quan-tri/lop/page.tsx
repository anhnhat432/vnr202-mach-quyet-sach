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
    <div className="acc-container">
      <RosterImport />
    </div>
  );
}
