import { getRehearsalStudioState } from "@/features/rehearsal/server/rehearsal-service";
import { ApiError } from "@/lib/api/errors";
import { requireActor } from "@/lib/api/guard";
import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getServerEnv } from "@/lib/config/server-env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const GET = route(async (_request, requestId) => {
  const { actor } = await requireActor();
  if (actor.role !== "admin") throw new ApiError(404, "not_found", "Không tìm thấy.");
  const state = await getRehearsalStudioState(createServiceRoleClient(getServerEnv()), actor.userId);
  return ok(state, requestId);
});
