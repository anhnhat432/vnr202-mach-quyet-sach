import { NextResponse } from "next/server";
import { z } from "zod";

import { signInStudent } from "@/features/auth/server/sign-in";
import { ApiError } from "@/lib/api/errors";
import { clientIp, deviceLabel } from "@/lib/api/client-info";
import { CSRF_COOKIE, isSameOrigin, issueCsrfToken } from "@/lib/api/csrf";
import { readJson, route } from "@/lib/api/handler";
import { requestIdFrom } from "@/lib/api/request-id";
import { getServerEnv } from "@/lib/config/server-env";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const body = z.object({ studentId: z.string().min(1).max(64), password: z.string().min(1).max(72) }).strict();

export const POST = route(async (request) => {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!isSameOrigin(request, site ? [new URL(site).origin] : [])) throw new ApiError(403, "csrf_failed", "Yêu cầu không hợp lệ.");
  const input = await readJson(request, body);
  const env = getServerEnv();
  const result = await signInStudent(
    { admin: createServiceRoleClient(env), auth: await createServerClient(), env },
    { studentId: input.studentId, password: input.password, ip: clientIp(request), device: deviceLabel(request) },
  );
  if (!result.ok) {
    if (result.reason === "rate_limited") throw new ApiError(429, "rate_limited", "Thử lại sau ít phút.");
    if (result.reason === "account_disabled") throw new ApiError(423, "account_disabled", "Tài khoản đang bị khóa.");
    throw new ApiError(401, "invalid_credentials", "Mã sinh viên hoặc mật khẩu không đúng.");
  }
  const csrfToken = issueCsrfToken(env.CSRF_SIGNING_SECRET, result.userId);
  const response = NextResponse.json({ data: { displayName: result.displayName, role: result.role, csrfToken }, meta: { requestId: requestIdFrom(request) } });
  response.cookies.set(CSRF_COOKIE, csrfToken, { httpOnly: false, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  return response;
});
