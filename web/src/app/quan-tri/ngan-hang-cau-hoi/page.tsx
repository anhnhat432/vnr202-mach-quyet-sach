import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { QuestionBankAdmin } from "@/features/admin/ui/question-bank-admin";
import { isAuthConfigured } from "@/lib/config/server-env";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Quản trị · Ngân hàng câu hỏi", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  if (!isAuthConfigured()) redirect("/");
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user?.app_metadata?.role !== "admin") redirect("/quan-tri/dang-nhap");
  return (
    <div className="acc-container">
      <QuestionBankAdmin />
    </div>
  );
}
