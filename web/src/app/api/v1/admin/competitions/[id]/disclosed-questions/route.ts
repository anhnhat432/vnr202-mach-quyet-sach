import { uuidParam } from "@/features/arena/contracts/arena";
import { rpc } from "@/features/arena/server/arena-service";
import { ApiError } from "@/lib/api/errors";
import { requireActor } from "@/lib/api/guard";
import { route } from "@/lib/api/handler";
import { pathParam } from "@/lib/api/params";
import { ok } from "@/lib/api/response";
import { getServerEnv } from "@/lib/config/server-env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Questions whose answers an earlier competition disclosed; an official competition excludes them unless
// an admin confirms each one explicitly (LA-CONTENT-009).
export const GET = route(async (request, requestId) => {
  const { actor } = await requireActor();
  if (actor.role !== "admin") throw new ApiError(404, "not_found", "Không tìm thấy.");
  const id = pathParam(request, 1, uuidParam);
  return ok(await rpc(createServiceRoleClient(getServerEnv()), "arena_admin_disclosed", { p_actor: actor.userId, p_competition_id: id }), requestId);
});
