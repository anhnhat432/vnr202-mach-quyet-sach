import { z } from "zod";

import { gameParam, uuidParam } from "@/features/arena/contracts/arena";
import { rpc } from "@/features/arena/server/arena-service";
import { hashIdentifier } from "@/features/auth/domain/provider-password";
import { ApiError } from "@/lib/api/errors";
import { clientIp } from "@/lib/api/client-info";
import { route } from "@/lib/api/handler";
import { pathParam } from "@/lib/api/params";
import { ok } from "@/lib/api/response";
import { getServerEnv, trustedProxyHops } from "@/lib/config/server-env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Public Top 10 and aggregates of one game (LA-LB-003, LA-PRV-004): display names only, no MSSV, no
// full name, never more than 10 rows, no authentication needed. Rate limited per trusted client IP (generous: a whole class shares one NAT address).
// The board is identical for every viewer, so the CDN may share it briefly: `?v=<version>` (sent after
// a Broadcast hint) lets hundreds of viewers reading the same new version collapse into one origin read;
// the response is never older than that version because the hint is sent after the commit. Hints are
// paced to one per second, so clients read once more (`settle=1`) after the last hint they received.
const hintedVersion = z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional();
const settleRead = z.literal("1").optional();

export const GET = route(async (request, requestId) => {
  const game = pathParam(request, 0, gameParam);
  const publicId = pathParam(request, 1, uuidParam);
  const query = new URL(request.url).searchParams;
  const v = hintedVersion.safeParse(query.get("v") ?? undefined);
  const settle = settleRead.safeParse(query.get("settle") ?? undefined);
  if (!v.success || !settle.success || (settle.data && v.data === undefined)) {
    throw new ApiError(422, "validation_error", "Tham số không hợp lệ.", [{ field: "v", code: "invalid", message: "v: số nguyên không âm; settle=1 chỉ đi cùng v." }]);
  }
  const env = getServerEnv();
  const admin = createServiceRoleClient(env);
  const ip = clientIp(request, trustedProxyHops(env));
  if (ip) {
    const { data } = await admin.rpc("consume_rate_limit", { p_key_hash: hashIdentifier(env.AUTH_PASSWORD_PEPPER, "rate:arena-board:ip", ip), p_limit: 3000, p_window_seconds: 60 });
    if (data === false) throw new ApiError(429, "rate_limited", "Thử lại sau ít giây.");
  }
  const board = await rpc(admin, "get_leaderboard", { p_competition_public_id: publicId, p_game: game, p_limit: 10 });
  return ok(board, requestId, { headers: { "Cache-Control": `public, max-age=0, s-maxage=${v.data === undefined ? 1 : 10}` } });
});
