import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { CSRF_COOKIE, isSameOrigin, issueCsrfToken, verifyCsrfToken } from "@/lib/api/csrf";
import { requireActor } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { getServerEnv } from "@/lib/config/server-env";

// Restores a lost form token, not an Auth session. No business state or permission changes.
export const POST = route(async (request, requestId) => {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!isSameOrigin(request, site ? [new URL(site).origin] : [])) throw new ApiError(403, "csrf_failed", "Yêu cầu không hợp lệ.");
  await readJson(request, z.object({}).strict());
  const { actor } = await requireActor();
  const env = getServerEnv();
  const current = (await cookies()).get(CSRF_COOKIE)?.value;
  const csrfToken = current && verifyCsrfToken(env.CSRF_SIGNING_SECRET, actor.userId, current, current)
    ? current : issueCsrfToken(env.CSRF_SIGNING_SECRET, actor.userId);
  const response = NextResponse.json({ data: { csrfToken }, meta: { requestId } }, { headers: { "cache-control": "private, no-store" } });
  response.cookies.set(CSRF_COOKIE, csrfToken, { httpOnly: false, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  return response;
});
