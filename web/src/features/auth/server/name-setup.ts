import "server-only";
import { redirect } from "next/navigation";
import { isAuthConfigured } from "@/lib/config/server-env";
import { createServerClient } from "@/lib/supabase/server";

// Navigation recovery only. The database independently blocks pending-name attempt inserts.
export async function redirectPendingStudent() {
  if (!isAuthConfigured()) return;
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user?.app_metadata?.role !== "student") return;
  const profile = await supabase.from("profiles").select("requires_display_name").eq("id", data.user.id).maybeSingle();
  if (profile.error) throw profile.error;
  if (profile.data?.requires_display_name) redirect("/thiet-lap-ten");
}
