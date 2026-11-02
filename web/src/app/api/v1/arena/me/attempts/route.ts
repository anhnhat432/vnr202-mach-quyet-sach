import { rpc } from "@/features/arena/server/arena-service";
import { requireStudent } from "@/lib/api/guard";
import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";

// The signed-in student's own attempts, with whether the post-final review is available.
export const GET = route(async (request, requestId) => {
  const ctx = await requireStudent(request, { mutating: false });
  return ok(await rpc(ctx.admin, "arena_my_attempts", { p_profile_id: ctx.actor.userId }), requestId);
});
