import { ok } from "@/lib/api/response";
import { requireActor } from "@/lib/api/guard";
import { route } from "@/lib/api/handler";
import { requestIdFrom } from "@/lib/api/request-id";
import { getServerEnv } from "@/lib/config/server-env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Redacted profile of the signed-in user: never MSSV of others, never internal email.
export const GET = route(async (request) => {
  const { actor, supabase } = await requireActor();
  const { data, error } = await supabase.from("profiles").select("role, full_name, display_name, student_id, class_id").eq("id", actor.userId).maybeSingle();
  if (error) throw error;
  if (!data) return ok({ role: actor.role }, requestIdFrom(request));
  let className: string | null = null;
  if (data.class_id) {
    const result = await createServiceRoleClient(getServerEnv()).from("classes").select("name").eq("id", data.class_id).maybeSingle();
    if (result.error) throw result.error;
    className = result.data?.name ?? null;
  }
  return ok({ role: data.role, fullName: data.full_name, displayName: data.display_name, studentId: data.student_id, className }, requestIdFrom(request));
});
