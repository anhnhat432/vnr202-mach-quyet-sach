import { uuidParam } from "@/features/arena/contracts/arena";
import { rpc } from "@/features/arena/server/arena-service";
import { requireStudent } from "@/lib/api/guard";
import { route } from "@/lib/api/handler";
import { pathParam } from "@/lib/api/params";
import { ok } from "@/lib/api/response";

// Own attempt only (the RPC checks ownership). Rank, gaps to the player above and to 10th place, sole/shared leader labels (LA-LB-005).
export const GET = route(async (request, requestId) => {
  const ctx = await requireStudent(request, { mutating: false });
  const attemptId = pathParam(request, 1, uuidParam);
  return ok(await rpc(ctx.admin, "get_player_standing", { p_profile_id: ctx.actor.userId, p_attempt_id: attemptId }), requestId);
});
