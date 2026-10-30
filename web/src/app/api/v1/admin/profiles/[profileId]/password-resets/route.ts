import { z } from "zod";

import { resetPasswordToDefault } from "@/features/roster/server/admin-accounts";
import { ApiError } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";

const body = z.object({ reason: z.string().trim().min(3).max(300) }).strict();

export const POST = route(async (request, requestId) => {
  const ctx = await requireAdmin(request);
  const profileId = new URL(request.url).pathname.split("/").at(-2) ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) throw new ApiError(404, "not_found", "Không tìm thấy.");
  const { reason } = await readJson(request, body);
  await resetPasswordToDefault({ admin: ctx.admin, env: ctx.env }, { actorId: ctx.actor.userId, profileId, reason, requestId });
  return ok({ reset: true }, requestId);
});
