import { emptyBody, uuidParam } from "@/features/arena/contracts/arena";
import { bindSession, rpc } from "@/features/arena/server/arena-service";
import { requireStudent } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { pathParam } from "@/lib/api/params";
import { ok } from "@/lib/api/response";

// The only way question text leaves the server. Held up to 1 s until `available_at`, otherwise 425
// with `availableInMs` and no content (LA-TIME-013..017). POST because it records the first release.
export const POST = route(async (request, requestId) => {
  const ctx = await requireStudent(request, { mutating: true });
  await readJson(request, emptyBody);
  const allocationId = pathParam(request, 1, uuidParam);
  const attemptId = pathParam(request, 3, uuidParam);
  const version = await bindSession(ctx.admin, ctx.actor.userId, attemptId, ctx.authSessionId);
  return ok(await rpc(ctx.admin, "get_interaction_content", { p_profile_id: ctx.actor.userId, p_attempt_id: attemptId, p_allocation_id: allocationId, p_session_version: version }), requestId);
});
