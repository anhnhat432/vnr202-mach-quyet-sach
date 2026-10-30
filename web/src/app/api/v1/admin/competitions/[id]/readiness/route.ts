import { uuidParam } from "@/features/arena/contracts/arena";
import { rpc } from "@/features/arena/server/arena-service";
import { ApiError } from "@/lib/api/errors";
import { requireActor } from "@/lib/api/guard";
import { route } from "@/lib/api/handler";
import { pathParam } from "@/lib/api/params";
import { ok } from "@/lib/api/response";
import { getServerEnv } from "@/lib/config/server-env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { z } from "zod";

// Blockers and the 168-question target (LA-CONTENT-007/011/013/014), admin only.
export const GET = route(async (request, requestId) => {
  const { actor } = await requireActor();
  if (actor.role !== "admin") throw new ApiError(404, "not_found", "Không tìm thấy.");
  const id = pathParam(request, 1, uuidParam);
  const expectedAttempts = z.coerce.number().int().min(1).max(500).parse(new URL(request.url).searchParams.get("expectedAttempts") ?? "60");
  return ok(await rpc(createServiceRoleClient(getServerEnv()), "competition_readiness", { p_competition_id: id, p_expected_attempts: expectedAttempts }), requestId);
});
