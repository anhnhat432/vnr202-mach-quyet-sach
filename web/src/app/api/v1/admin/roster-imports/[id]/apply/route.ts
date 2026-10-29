import { z } from "zod";

import { applyRosterImport } from "@/features/roster/server/roster-service";
import { ApiError } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";

const body = z
  .object({
    confirmedWarningRows: z.array(z.number().int().positive()).max(1000).default([]),
    displayNameOverrides: z.record(z.string().regex(/^\d+$/), z.string().max(120)).default({}),
  })
  .strict();

export const POST = route(async (request, requestId) => {
  const ctx = await requireAdmin(request);
  const id = new URL(request.url).pathname.split("/").at(-2) ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found", "Không tìm thấy.");
  const input = await readJson(request, body);
  const result = await applyRosterImport({ admin: ctx.admin, env: ctx.env }, { actorId: ctx.actor.userId, importId: id, ...input, requestId });
  return ok(result, requestId);
});
