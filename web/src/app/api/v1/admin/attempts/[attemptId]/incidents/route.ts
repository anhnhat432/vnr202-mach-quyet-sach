import { attemptIncidentBody, uuidParam } from "@/features/arena/contracts/arena";
import { rpc } from "@/features/arena/server/arena-service";
import { revokeSessions, setAccountStatus } from "@/features/roster/server/admin-accounts";
import { ApiError } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { pathParam } from "@/lib/api/params";
import { ok } from "@/lib/api/response";

// Incident handling for one attempt (LA-ADMIN-003). Account actions reuse the stage B account functions
// and are then logged against the attempt; note and void are recorded by the database in one transaction.
// Nothing here can change a score, a clock or a rank, create a replacement attempt or delete history.
export const POST = route(async (request, requestId) => {
  const ctx = await requireAdmin(request);
  const attemptId = pathParam(request, 1, uuidParam);
  const { action, reason } = await readJson(request, attemptIncidentBody);
  const { data: attempt } = await ctx.admin.from("attempts").select("profile_id").eq("id", attemptId).maybeSingle();
  if (!attempt) throw new ApiError(404, "not_found", "Không tìm thấy.");
  const deps = { admin: ctx.admin, env: ctx.env };
  const base = { actorId: ctx.actor.userId, profileId: attempt.profile_id as string, reason, requestId };
  if (action === "revoke_sessions") await revokeSessions(deps, base);
  if (action === "lock_account" || action === "unlock_account") await setAccountStatus(deps, { ...base, status: action === "lock_account" ? "locked" : "active" });
  const result = await rpc(ctx.admin, "record_attempt_incident", { p_actor: ctx.actor.userId, p_attempt_id: attemptId, p_action: action, p_reason: reason });
  return ok(result, requestId);
});
