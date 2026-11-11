import { z } from "zod";

import {
  closeActiveRehearsalRound,
  ensureRehearsalFixtures,
  openOrResetRehearsalRound,
} from "@/features/rehearsal/server/rehearsal-service";
import { requireAdmin } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";

const roundActionBody = z
  .object({
    action: z.enum(["open_or_reset", "close", "seed_fixtures"]),
    name: z.string().trim().max(120).optional(),
    startWindowMinutes: z.number().int().min(5).max(1440).optional(),
  })
  .strict();

export const POST = route(async (request, requestId) => {
  const ctx = await requireAdmin(request);
  const body = await readJson(request, roundActionBody);
  if (body.action === "seed_fixtures") {
    return ok(await ensureRehearsalFixtures(ctx.admin), requestId);
  }
  if (body.action === "close") {
    return ok(await closeActiveRehearsalRound(ctx.admin, ctx.actor.userId), requestId);
  }
  const result = await openOrResetRehearsalRound(ctx.admin, ctx.actor.userId, {
    name: body.name,
    startWindowMinutes: body.startWindowMinutes,
    requestId,
  });
  return ok(result, requestId, { status: 201 });
});
