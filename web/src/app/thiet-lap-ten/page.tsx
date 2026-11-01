import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StudentNameForm } from "@/features/auth/ui/student-name-form";
import { isAuthConfigured } from "@/lib/config/server-env";
import { createServerClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "Tên hiển thị của bạn", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NameSetupPage() {
  if (!isAuthConfigured()) redirect("/dang-nhap");
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user?.app_metadata?.role !== "student") redirect("/dang-nhap");
  const profile = await supabase.from("profiles").select("requires_display_name, status").eq("id", data.user.id).maybeSingle();
  if (profile.error) throw profile.error;
  if (!profile.data || profile.data.status !== "active") redirect("/dang-nhap");
  if (!profile.data.requires_display_name) redirect("/live-arena");
  return <div className="page-shell login-shell"><section><p className="eyebrow">Trước khi vào chơi</p><h1>Bạn muốn được gọi là gì?</h1><StudentNameForm /></section></div>;
}
