import { z } from "zod";

import { revokeSessions, setAccountStatus } from "@/features/roster/server/admin-accounts";
import { ApiError } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";

// Account-level incident actions (LA-ADMIN-003 a). Attempt-level actions arrive with the attempt tables.
// No action here can create an attempt or change score, rank or time (LA-ADMIN-001/002).
const body = z.object({ action: z.enum(["revoke_sessions", "lock_account", "unlock_account"]), reason: z.string().trim().min(3).max(300) }).strict();

export const POST = route(async (request, requestId) => {
  const ctx = await requireAdmin(request);
  const profileId = new URL(request.url).pathname.split("/").at(-2) ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) throw new ApiError(404, "not_found", "Không tìm thấy.");
  const { action, reason } = await readJson(request, body);
  const deps = { admin: ctx.admin, env: ctx.env };
  const base = { actorId: ctx.actor.userId, profileId, reason, requestId };
  if (action === "revoke_sessions") return ok(await revokeSessions(deps, base), requestId);
  await setAccountStatus(deps, { ...base, status: action === "lock_account" ? "locked" : "active" });
  return ok({ status: action === "lock_account" ? "locked" : "active" }, requestId);
});
