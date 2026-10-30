import { emptyBody, uuidParam } from "@/features/arena/contracts/arena";
import { bindSession, rpc } from "@/features/arena/server/arena-service";
import { requireStudent } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { pathParam } from "@/lib/api/params";
import { ok } from "@/lib/api/response";

// Connection status only; it never moves a clock (LA-TIME-012).
export const POST = route(async (request, requestId) => {
  const ctx = await requireStudent(request, { mutating: true });
  await readJson(request, emptyBody);
  const attemptId = pathParam(request, 1, uuidParam);
  const version = await bindSession(ctx.admin, ctx.actor.userId, attemptId, ctx.authSessionId);
  return ok(await rpc(ctx.admin, "heartbeat_attempt", { p_profile_id: ctx.actor.userId, p_attempt_id: attemptId, p_session_version: version }), requestId);
});
