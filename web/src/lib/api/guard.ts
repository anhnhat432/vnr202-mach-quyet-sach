import "server-only";

import { cookies } from "next/headers";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/errors";
import { CSRF_COOKIE, CSRF_HEADER, isSameOrigin, verifyCsrfToken } from "@/lib/api/csrf";
import { getServerEnv, type ServerEnv } from "@/lib/config/server-env";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Server-side authorization for protected routes (ACCESS-002/003, security-spec §4).
// Role comes only from app_metadata (service-role controlled); user_metadata is ignored.
export type Actor = { userId: string; role: "student" | "admin" };

export type RouteContext = {
  env: ServerEnv;
  admin: SupabaseClient;
  actor: Actor;
};

export async function requireActor(): Promise<{ actor: Actor; supabase: Awaited<ReturnType<typeof createServerClient>> }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser(); // validated by Auth server, not just decoded
  const role = data.user?.app_metadata?.role;
  if (error || !data.user || (role !== "student" && role !== "admin")) {
    throw new ApiError(401, "unauthenticated", "Bạn cần đăng nhập.");
  }
  return { actor: { userId: data.user.id, role }, supabase };
}

// Non-admins get 404 so the existence of admin routes is not disclosed (security-spec §4).
export async function requireAdmin(request: Request): Promise<RouteContext> {
  const { actor } = await requireActor();
  if (actor.role !== "admin") throw new ApiError(404, "not_found", "Không tìm thấy.");
  await assertCsrf(request, actor.userId);
  const env = getServerEnv();
  return { env, admin: createServiceRoleClient(env), actor };
}

export async function assertCsrf(request: Request, subject: string) {
  const env = getServerEnv();
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!isSameOrigin(request, site ? [new URL(site).origin] : [])) throw new ApiError(403, "csrf_failed", "Yêu cầu không hợp lệ.");
  const store = await cookies();
  if (!verifyCsrfToken(env.CSRF_SIGNING_SECRET, subject, request.headers.get(CSRF_HEADER), store.get(CSRF_COOKIE)?.value)) {
    throw new ApiError(403, "csrf_failed", "Yêu cầu không hợp lệ.");
  }
}
