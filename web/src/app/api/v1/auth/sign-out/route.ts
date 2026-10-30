import { NextResponse } from "next/server";

import { recordAuthEvent } from "@/features/auth/server/audit";
import { clientIp, deviceLabel } from "@/lib/api/client-info";
import { CSRF_COOKIE } from "@/lib/api/csrf";
import { assertCsrf, requireActor } from "@/lib/api/guard";
import { route } from "@/lib/api/handler";
import { getServerEnv, trustedProxyHops } from "@/lib/config/server-env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const POST = route(async (request) => {
  const { actor, supabase } = await requireActor();
  await assertCsrf(request, actor.userId);
  const env = getServerEnv();
  await recordAuthEvent(createServiceRoleClient(env), env.AUTH_PASSWORD_PEPPER, "sign_out", { profileId: actor.userId, ip: clientIp(request, trustedProxyHops(env)) ?? undefined, device: deviceLabel(request) });
  await supabase.auth.signOut({ scope: "local" });
  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete(CSRF_COOKIE);
  return response;
});
