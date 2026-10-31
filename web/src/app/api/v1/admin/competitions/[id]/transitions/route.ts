import { competitionTransitionBody, uuidParam } from "@/features/arena/contracts/arena";
import { rpc } from "@/features/arena/server/arena-service";
import { requireAdmin } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { pathParam } from "@/lib/api/params";
import { ok } from "@/lib/api/response";

// Draft -> Scheduled (readiness + question snapshot) -> Open -> StartClosed -> Settling -> (finalize) -> Archived.
export const POST = route(async (request, requestId) => {
  const ctx = await requireAdmin(request);
  const { target, expectedAttempts, bankAcknowledgement } = await readJson(request, competitionTransitionBody);
  const id = pathParam(request, 1, uuidParam);
  return ok(await rpc(ctx.admin, "transition_competition_confirmed", { p_competition_id: id, p_actor: ctx.actor.userId, p_target: target, p_expected_attempts: bankAcknowledgement?.expectedAttempts ?? expectedAttempts ?? 60, p_confirmed: bankAcknowledgement?.confirmed ?? false, p_reason: bankAcknowledgement?.reason ?? null }), requestId);
});
