import { z } from "zod";

import { provisionRehearsalAccounts } from "@/features/rehearsal/server/rehearsal-service";
import { requireAdmin } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";

const provisionBody = z
  .object({
    count: z.number().int().min(1).max(30),
  })
  .strict();

export const POST = route(async (request, requestId) => {
  const ctx = await requireAdmin(request);
  const { count } = await readJson(request, provisionBody);
  const result = await provisionRehearsalAccounts(
    { admin: ctx.admin, env: ctx.env },
    { actorId: ctx.actor.userId, count, requestId },
  );
  return ok(result, requestId, { status: 201 });
});
