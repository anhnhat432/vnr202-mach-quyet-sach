import { NextResponse } from "next/server";
import { z } from "zod";

import { signInAdmin } from "@/features/auth/server/sign-in";
import { ApiError } from "@/lib/api/errors";
import { clientIp, deviceLabel } from "@/lib/api/client-info";
import { CSRF_COOKIE, isSameOrigin, issueCsrfToken } from "@/lib/api/csrf";
import { readJson, route } from "@/lib/api/handler";
import { requestIdFrom } from "@/lib/api/request-id";
import { getServerEnv, trustedProxyHops } from "@/lib/config/server-env";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const body = z.object({ email: z.email().max(254), password: z.string().min(1).max(72) }).strict();

export const POST = route(async (request) => {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!isSameOrigin(request, site ? [new URL(site).origin] : [])) throw new ApiError(403, "csrf_failed", "Yêu cầu không hợp lệ.");
  const input = await readJson(request, body);
  const env = getServerEnv();
  const result = await signInAdmin(
    { admin: createServiceRoleClient(env), auth: await createServerClient(), env },
    { email: input.email, password: input.password, ip: clientIp(request, trustedProxyHops(env)), device: deviceLabel(request) },
  );
  if (!result.ok) {
    if (result.reason === "rate_limited") throw new ApiError(429, "rate_limited", "Thử lại sau ít phút.");
    throw new ApiError(401, "invalid_credentials", "Thông tin đăng nhập không đúng.");
  }
  const csrfToken = issueCsrfToken(env.CSRF_SIGNING_SECRET, result.userId);
  const response = NextResponse.json({ data: { displayName: result.displayName, role: result.role, csrfToken }, meta: { requestId: requestIdFrom(request) } });
  response.cookies.set(CSRF_COOKIE, csrfToken, { httpOnly: false, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  return response;
});
