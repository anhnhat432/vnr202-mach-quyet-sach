import { disclosedConfirmationBody, uuidParam } from "@/features/arena/contracts/arena";
import { rpc } from "@/features/arena/server/arena-service";
import { requireAdmin } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { pathParam } from "@/lib/api/params";
import { ok } from "@/lib/api/response";

// Explicit, audited reuse of selected disclosed questions in a Draft official competition.
export const POST = route(async (request, requestId) => {
  const ctx = await requireAdmin(request);
  const id = pathParam(request, 1, uuidParam);
  const { questionVersionIds, reason } = await readJson(request, disclosedConfirmationBody);
  const confirmed = await rpc<number>(ctx.admin, "arena_confirm_disclosed", { p_actor: ctx.actor.userId, p_competition_id: id, p_version_ids: questionVersionIds, p_reason: reason });
  return ok({ confirmed }, requestId);
});
