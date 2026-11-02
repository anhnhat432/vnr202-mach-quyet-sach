import { emptyBody, uuidParam } from "@/features/arena/contracts/arena";
import { rpc } from "@/features/arena/server/arena-service";
import { requireAdmin } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { pathParam } from "@/lib/api/params";
import { ok } from "@/lib/api/response";

// Settling -> Finalized: reconciles every attempt, marks the questions players saw as disclosed, opens review (LA-CONTENT-009, LA-FB-004).
export const POST = route(async (request, requestId) => {
  const ctx = await requireAdmin(request);
  await readJson(request, emptyBody);
  const id = pathParam(request, 1, uuidParam);
  return ok(await rpc(ctx.admin, "finalize_competition", { p_competition_id: id, p_actor: ctx.actor.userId }), requestId);
});
