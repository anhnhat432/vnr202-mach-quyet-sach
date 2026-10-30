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
// full name, never more than 10 rows, no authentication needed. Rate limited per trusted client IP.
export const GET = route(async (request, requestId) => {
  const game = pathParam(request, 0, gameParam);
  const publicId = pathParam(request, 1, uuidParam);
  const env = getServerEnv();
  const admin = createServiceRoleClient(env);
  const ip = clientIp(request, trustedProxyHops(env));
  if (ip) {
    const { data } = await admin.rpc("consume_rate_limit", { p_key_hash: hashIdentifier(env.AUTH_PASSWORD_PEPPER, "rate:arena-board:ip", ip), p_limit: 300, p_window_seconds: 60 });
    if (data === false) throw new ApiError(429, "rate_limited", "Thử lại sau ít giây.");
  }
  return ok(await rpc(admin, "get_leaderboard", { p_competition_public_id: publicId, p_game: game, p_limit: 10 }), requestId);
});
