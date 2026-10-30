import { transitionSchema } from "@/features/questions/contracts/question";
import { transitionQuestionVersion } from "@/features/questions/server/question-service";
import { ApiError } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";

// Review / publish / reject / retire. The actor is always the signed-in administrator; nothing in
// the body can name another reviewer (AI cannot review or publish, LA-CONTENT-003).
export const POST = route(async (request, requestId) => {
  const ctx = await requireAdmin(request);
  const id = new URL(request.url).pathname.split("/").at(-2) ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found", "Không tìm thấy.");
  const { action, note } = await readJson(request, transitionSchema);
  return ok(await transitionQuestionVersion(ctx.admin, ctx.actor.userId, id, action, note), requestId);
});
