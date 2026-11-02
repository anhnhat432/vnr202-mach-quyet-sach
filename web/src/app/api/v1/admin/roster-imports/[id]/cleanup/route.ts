import { retryRosterCleanup } from "@/features/roster/server/roster-service";
import { ApiError } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/guard";
import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";

export const POST = route(async (request, requestId) => {
  const ctx = await requireAdmin(request);
  const id = new URL(request.url).pathname.split("/").at(-2) ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found", "Không tìm thấy.");
  return ok(await retryRosterCleanup({ admin: ctx.admin, env: ctx.env }, { actorId: ctx.actor.userId, importId: id, requestId }), requestId);
});
