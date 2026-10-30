import { ok } from "@/lib/api/response";
import { requireActor } from "@/lib/api/guard";
import { route } from "@/lib/api/handler";
import { requestIdFrom } from "@/lib/api/request-id";

// Redacted profile of the signed-in user: never MSSV of others, never internal email.
export const GET = route(async (request) => {
  const { actor, supabase } = await requireActor();
  const { data } = await supabase.from("profiles").select("role, full_name, display_name, student_id").eq("id", actor.userId).maybeSingle();
  if (!data) return ok({ role: actor.role }, requestIdFrom(request));
  return ok({ role: data.role, fullName: data.full_name, displayName: data.display_name, studentId: data.student_id }, requestIdFrom(request));
});
