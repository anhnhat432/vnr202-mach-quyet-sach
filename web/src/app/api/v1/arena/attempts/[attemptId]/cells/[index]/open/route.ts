import { cellIndexParam, emptyBody, idempotencyKey, uuidParam } from "@/features/arena/contracts/arena";
import { bindSession, rpc } from "@/features/arena/server/arena-service";
import { requireStudent } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { idempotencyKeyFrom, pathParam } from "@/lib/api/params";
import { ok } from "@/lib/api/response";

// Game 1: open one board cell (MINE-BOARD-007/008). Replaying returns the recorded result.
export const POST = route(async (request, requestId) => {
  const ctx = await requireStudent(request, { mutating: true });
  const key = idempotencyKeyFrom(request, idempotencyKey);
  await readJson(request, emptyBody);
  const cell = pathParam(request, 1, cellIndexParam);
  const attemptId = pathParam(request, 3, uuidParam);
  const version = await bindSession(ctx.admin, ctx.actor.userId, attemptId, ctx.authSessionId);
  return ok(await rpc(ctx.admin, "open_minefield_cell", { p_profile_id: ctx.actor.userId, p_attempt_id: attemptId, p_cell_index: cell, p_idempotency_key: key, p_session_version: version }), requestId);
});
