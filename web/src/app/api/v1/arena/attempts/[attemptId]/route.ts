import { uuidParam } from "@/features/arena/contracts/arena";
import { bindSession, rpc } from "@/features/arena/server/arena-service";
import { requireStudent } from "@/lib/api/guard";
import { route } from "@/lib/api/handler";
import { pathParam } from "@/lib/api/params";
import { ok } from "@/lib/api/response";

// Current authoritative state of the student's own attempt (also settles an expired question).
// Never contains question text, answers or unopened board cells.
export const GET = route(async (request, requestId) => {
  const ctx = await requireStudent(request, { mutating: false });
  const attemptId = pathParam(request, 0, uuidParam);
  const version = await bindSession(ctx.admin, ctx.actor.userId, attemptId, ctx.authSessionId);
  return ok(await rpc(ctx.admin, "get_attempt_projection", { p_profile_id: ctx.actor.userId, p_attempt_id: attemptId, p_session_version: version }), requestId);
});
