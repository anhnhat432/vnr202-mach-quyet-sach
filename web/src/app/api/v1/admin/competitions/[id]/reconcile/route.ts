import { emptyBody, uuidParam } from "@/features/arena/contracts/arena";
import { rpc } from "@/features/arena/server/arena-service";
import { requireAdmin } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { pathParam } from "@/lib/api/params";
import { ok } from "@/lib/api/response";

// Settles expired questions and closes starts after the deadline; safe to call repeatedly (a scheduler or the admin screen).
export const POST = route(async (request, requestId) => {
  const ctx = await requireAdmin(request);
  await readJson(request, emptyBody);
  const id = pathParam(request, 1, uuidParam);
  return ok(await rpc(ctx.admin, "reconcile_competition", { p_competition_id: id }), requestId);
});
