import { listStudents } from "@/features/roster/server/admin-accounts";
import { requireActor } from "@/lib/api/guard";
import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getServerEnv } from "@/lib/config/server-env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Full roster is admin-only (LA-PRV-001/004); students get 404.
export const GET = route(async (_request, requestId) => {
  const { actor } = await requireActor();
  if (actor.role !== "admin") throw new ApiError(404, "not_found", "Không tìm thấy.");
  return ok(await listStudents(createServiceRoleClient(getServerEnv())), requestId);
});
