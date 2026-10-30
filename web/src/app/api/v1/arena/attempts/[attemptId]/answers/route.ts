import { answerBody, idempotencyKey, uuidParam } from "@/features/arena/contracts/arena";
import { bindSession, rpc } from "@/features/arena/server/arena-service";
import { requireStudent } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { idempotencyKeyFrom, pathParam } from "@/lib/api/params";
import { ok } from "@/lib/api/response";

// Submit a choice. The body carries only the question and the chosen option: correctness, points and
// timing are decided by the database from its own clock (LA-ANTI-003). Responses never include the
// correct answer before the competition is Finalized (LA-FB-001/003).
export const POST = route(async (request, requestId) => {
  const ctx = await requireStudent(request, { mutating: true });
  const key = idempotencyKeyFrom(request, idempotencyKey);
  const body = await readJson(request, answerBody);
  const attemptId = pathParam(request, 1, uuidParam);
  const version = await bindSession(ctx.admin, ctx.actor.userId, attemptId, ctx.authSessionId);
  return ok(await rpc(ctx.admin, "submit_answer", { p_profile_id: ctx.actor.userId, p_attempt_id: attemptId, p_allocation_id: body.allocationId, p_option_id: body.optionId, p_idempotency_key: key, p_session_version: version }), requestId);
});
