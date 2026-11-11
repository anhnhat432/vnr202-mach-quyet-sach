import { readinessQuerySchema } from "@/features/questions/contracts/question";
import { questionBankReadiness } from "@/features/questions/server/question-service";
import { ApiError } from "@/lib/api/errors";
import { requireActor } from "@/lib/api/guard";
import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getServerEnv } from "@/lib/config/server-env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const GET = route(async (request, requestId) => {
  const { actor } = await requireActor();
  if (actor.role !== "admin") throw new ApiError(404, "not_found", "Không tìm thấy.");
  const query = readinessQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await questionBankReadiness(createServiceRoleClient(getServerEnv()), query), requestId);
});
