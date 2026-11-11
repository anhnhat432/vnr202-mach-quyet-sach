import { listFilterSchema, questionInputSchema } from "@/features/questions/contracts/question";
import { listQuestions, upsertQuestionDraft } from "@/features/questions/server/question-service";
import { ApiError } from "@/lib/api/errors";
import { requireActor, requireAdmin } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getServerEnv } from "@/lib/config/server-env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Create or update a Draft. The route cannot review or publish (separate transition route) and
// always creates origin = bank questions; fixtures never come through the API.
export const POST = route(async (request, requestId) => {
  const ctx = await requireAdmin(request);
  const input = await readJson(request, questionInputSchema);
  const result = await upsertQuestionDraft(ctx.admin, ctx.actor.userId, input);
  return ok(result, requestId, { status: result.outcome === "created" ? 201 : 200 });
});

export const GET = route(async (request, requestId) => {
  const { actor } = await requireActor();
  if (actor.role !== "admin") throw new ApiError(404, "not_found", "Không tìm thấy.");
  const filter = listFilterSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await listQuestions(createServiceRoleClient(getServerEnv()), filter), requestId);
});
