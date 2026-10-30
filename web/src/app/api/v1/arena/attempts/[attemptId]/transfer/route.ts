import { emptyBody, idempotencyKey, uuidParam } from "@/features/arena/contracts/arena";
import { bindSession, rpc } from "@/features/arena/server/arena-service";
import { requireStudent } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { idempotencyKeyFrom, pathParam } from "@/lib/api/params";
import { ok } from "@/lib/api/response";

// Take control of the attempt from this Auth session (new device). The old session is refused on its
// next call; no clock, score or state changes (LA-TRY-006).
export const POST = route(async (request, requestId) => {
  const ctx = await requireStudent(request, { mutating: true });
  idempotencyKeyFrom(request, idempotencyKey);
  await readJson(request, emptyBody);
  const attemptId = pathParam(request, 1, uuidParam);
  const version = await bindSession(ctx.admin, ctx.actor.userId, attemptId, ctx.authSessionId, true);
  return ok(await rpc(ctx.admin, "get_attempt_projection", { p_profile_id: ctx.actor.userId, p_attempt_id: attemptId, p_session_version: version }), requestId);
});
