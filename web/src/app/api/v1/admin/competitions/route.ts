import { createCompetitionBody } from "@/features/arena/contracts/arena";
import { rpc } from "@/features/arena/server/arena-service";
import { ApiError } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";

// Create a Draft competition with its two games. Rules fixed by the spec (points, limits, board) are
// not accepted from the client; only the schedule, the trial timing parameters and the kind.
export const POST = route(async (request, requestId) => {
  const ctx = await requireAdmin(request);
  const body = await readJson(request, createCompetitionBody);
  if (Date.parse(body.startDeadlineAt) <= Date.parse(body.opensAt)) throw new ApiError(422, "validation_error", "Hạn bắt đầu phải sau giờ mở.");
  const created = await rpc(ctx.admin, "create_competition", {
    p_actor: ctx.actor.userId, p_name: body.name, p_kind: body.kind, p_opens_at: body.opensAt, p_start_deadline_at: body.startDeadlineAt,
    p_latency_allowance_ms: body.latencyAllowanceMs ?? 400, p_lock_wait_limit_ms: body.lockWaitLimitMs ?? 2000,
    p_minefield_duration_ms: body.minefieldDurationMs ?? 180000, p_race_duration_ms: body.raceDurationMs ?? 150000,
    p_offsets: body.offsets ?? null, p_reconcile_grace_ms: body.reconcileGraceMs ?? 250,
  });
  return ok(created, requestId, { status: 201 });
});
