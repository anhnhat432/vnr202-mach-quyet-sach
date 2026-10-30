import { emptyBody, gameParam, idempotencyKey, uuidParam } from "@/features/arena/contracts/arena";
import { bindSession, rpc } from "@/features/arena/server/arena-service";
import { requireStudent } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { idempotencyKeyFrom, pathParam } from "@/lib/api/params";
import { ok } from "@/lib/api/response";

type Started = { result: { resumed: boolean }; projection: { attempt: { id: string; sessionVersion: number } } };

// Start or resume the one attempt a student has per game and competition (LA-TRY-001..004).
// Resuming from a new Auth session takes over control from the old one (LA-TRY-006).
export const POST = route(async (request, requestId) => {
  const ctx = await requireStudent(request, { mutating: true });
  const key = idempotencyKeyFrom(request, idempotencyKey);
  await readJson(request, emptyBody);
  const game = pathParam(request, 1, gameParam);
  const publicId = pathParam(request, 3, uuidParam);
  const profile = ctx.actor.userId;
  const started = await rpc<Started>(ctx.admin, "start_or_resume_attempt", { p_profile_id: profile, p_competition_public_id: publicId, p_game: game, p_idempotency_key: key });
  const attemptId = started.projection.attempt.id;
  const version = await bindSession(ctx.admin, profile, attemptId, ctx.authSessionId, true);
  const projection = version === started.projection.attempt.sessionVersion
    ? started.projection
    : await rpc(ctx.admin, "get_attempt_projection", { p_profile_id: profile, p_attempt_id: attemptId, p_session_version: version });
  return ok({ resumed: started.result.resumed, projection }, requestId, { status: started.result.resumed ? 200 : 201 });
});
