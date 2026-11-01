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

function authServiceFailure(error: unknown): ApiError | null {
  if (!error || typeof error !== "object") return null;
  const upstream = error as { status?: number; code?: string; name?: string };
  if (upstream.status !== 429 && !(typeof upstream.status === "number" && upstream.status >= 500) && upstream.name !== "AuthRetryableFetchError") return null;
  console.warn("auth service unavailable", {
    at: new Date().toISOString(),
    status: typeof upstream.status === "number" ? upstream.status : null,
    code: typeof upstream.code === "string" && /^[a-z_]{1,64}$/.test(upstream.code) ? upstream.code : null,
  });
  return new ApiError(503, "temporarily_unavailable", "Dịch vụ xác thực tạm thời gián đoạn. Hãy thử lại sau ít phút.");
}

async function checkedAuthResult<T extends { error: unknown }>(operation: Promise<T>): Promise<T> {
  let result: T;
  try {
    result = await operation;
  } catch (error) {
    throw authServiceFailure(error) ?? error;
  }
  const failure = authServiceFailure(result.error);
  if (failure) throw failure;
  return result;
}

export async function requireActor(): Promise<{ actor: Actor; supabase: Awaited<ReturnType<typeof createServerClient>> }> {
  const supabase = await createServerClient();
  const { data, error } = await checkedAuthResult(supabase.auth.getUser()); // validated by Auth server, not just decoded
  const role = data.user?.app_metadata?.role;
  if (error || !data.user || (role !== "student" && role !== "admin")) {
    // Operational diagnosis only: never log provider messages, tokens or user identity.
    console.warn("auth verification rejected", {
      at: new Date().toISOString(),
      status: typeof error?.status === "number" ? error.status : null,
      code: error?.code && /^[a-z_]{1,64}$/.test(error.code) ? error.code : null,
      name: error?.name && /^[A-Za-z]{1,64}$/.test(error.name) ? error.name : null,
      kind: error ? "provider_error" : data.user ? "invalid_role" : "missing_user",
    });
    throw new ApiError(401, "unauthenticated", "Bạn cần đăng nhập.");
  }
  return { actor: { userId: data.user.id, role }, supabase };
}

// The Auth session id travels in the access token's `session_id` claim. The token was just validated
// by the Auth server (getUser), so reading the claim from the same token is safe.
function sessionIdFromAccessToken(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { session_id?: unknown };
    return typeof payload.session_id === "string" && /^[0-9a-f-]{36}$/i.test(payload.session_id) ? payload.session_id : null;
  } catch {
    return null;
  }
}

export type StudentContext = RouteContext & { authSessionId: string };

// Gameplay routes: a verified student session. The profile id used for every RPC is the Auth user id,
// the request cannot name another one. `mutating` routes also require the CSRF token.
export async function requireStudent(request: Request, options: { mutating: boolean }): Promise<StudentContext> {
  const { actor, supabase } = await requireActor();
  if (actor.role !== "student") throw new ApiError(403, "forbidden", "Chỉ sinh viên mới chơi được.");
  if (options.mutating) await assertCsrf(request, actor.userId);
  const { data } = await checkedAuthResult(supabase.auth.getSession());
  const authSessionId = sessionIdFromAccessToken(data.session?.access_token);
  if (!authSessionId) throw new ApiError(401, "unauthenticated", "Bạn cần đăng nhập.");
  const env = getServerEnv();
  return { env, admin: createServiceRoleClient(env), actor, authSessionId };
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
