import { rpc } from "@/features/arena/server/arena-service";
import { requireStudent } from "@/lib/api/guard";
import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";

// What the student can start or resume right now (open competition, per-game attempt state).
export const GET = route(async (request, requestId) => {
  const ctx = await requireStudent(request, { mutating: false });
  return ok(await rpc(ctx.admin, "arena_lobby", { p_profile_id: ctx.actor.userId }), requestId);
});
