import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { deriveProviderPassword, hashIdentifier } from "@/features/auth/domain/provider-password";
import { normalizeStudentId } from "@/features/auth/domain/student-id";
import { recordAuthEvent } from "@/features/auth/server/audit";
import type { ServerEnv } from "@/lib/config/server-env";

// LA-ACC-003..009, LA-ACC-015: MSSV + shared default password, no password-change step.
export const SIGN_IN_LIMITS = {
  studentFailures: { limit: 5, windowSeconds: 600 }, // LA-ACC-008 [THỬ NGHIỆM]
  ipRequests: { limit: 300, windowSeconds: 600 }, // whole class behind one NAT
} as const;

export type SignInLimits = { studentFailures: { limit: number; windowSeconds: number }; ipRequests: { limit: number; windowSeconds: number } };

export type SignInDeps = {
  limits?: SignInLimits; // test seam; defaults to SIGN_IN_LIMITS
  admin: SupabaseClient; // service role
  auth: SupabaseClient; // client whose session storage writes the response cookies
  env: Pick<ServerEnv, "AUTH_PASSWORD_PEPPER" | "INTERNAL_AUTH_EMAIL_DOMAIN">;
};

export type SignInResult =
  | { ok: true; userId: string; role: "student" | "admin"; displayName: string }
  | { ok: false; reason: "invalid_credentials" | "rate_limited" | "account_disabled" };

async function rateLimited(admin: SupabaseClient, key: string, rule: { limit: number; windowSeconds: number }, consume: boolean) {
  const { data, error } = consume
    ? await admin.rpc("consume_rate_limit", { p_key_hash: key, p_limit: rule.limit, p_window_seconds: rule.windowSeconds })
    : await admin.rpc("rate_limit_exceeded", { p_key_hash: key, p_limit: rule.limit, p_window_seconds: rule.windowSeconds });
  if (error) throw new Error(`rate limit check failed: ${error.message}`);
  return consume ? data === false : data === true;
}

export async function signInStudent(
  deps: SignInDeps,
  input: { studentId: string; password: string; ip: string | null; device: string },
): Promise<SignInResult> {
  const { admin, auth, env } = deps;
  const studentId = normalizeStudentId(input.studentId);
  const studentKey = hashIdentifier(env.AUTH_PASSWORD_PEPPER, "rate:sign-in:student", studentId);
  const limits = deps.limits ?? SIGN_IN_LIMITS;

  // Per-IP limit only when a trusted client IP exists (null = no trusted proxy, see clientIp).
  if (input.ip && (await rateLimited(admin, hashIdentifier(env.AUTH_PASSWORD_PEPPER, "rate:sign-in:ip", input.ip), limits.ipRequests, true))) return { ok: false, reason: "rate_limited" };
  if (await rateLimited(admin, studentKey, limits.studentFailures, false)) return { ok: false, reason: "rate_limited" };

  const { data: profile } = await admin
    .from("profiles")
    .select("id, status, display_name, student_auth_identities(internal_email)")
    .eq("role", "student")
    .eq("student_id", studentId)
    .maybeSingle();
  const identity = profile?.student_auth_identities as { internal_email: string } | { internal_email: string }[] | null | undefined;
  const internalEmail = Array.isArray(identity) ? identity[0]?.internal_email : identity?.internal_email;

  // Same work whether or not the MSSV exists: derive the password and call Auth with a decoy
  // address, so response time does not reveal which MSSV exist (LA-ACC-015).
  const providerPassword = deriveProviderPassword(env.AUTH_PASSWORD_PEPPER, studentId, input.password);
  const email = internalEmail ?? `${randomUUID()}@${env.INTERNAL_AUTH_EMAIL_DOMAIN}`;
  const { data, error } = await auth.auth.signInWithPassword({ email, password: providerPassword });

  if (error || !data.user || !profile || !internalEmail) {
    await rateLimited(admin, studentKey, limits.studentFailures, true);
    await recordAuthEvent(admin, env.AUTH_PASSWORD_PEPPER, "sign_in_failure", { profileId: profile?.id, studentId, ip: input.ip ?? undefined, device: input.device });
    return { ok: false, reason: "invalid_credentials" };
  }
  if (profile.status !== "active") {
    await auth.auth.signOut({ scope: "local" });
    await recordAuthEvent(admin, env.AUTH_PASSWORD_PEPPER, "sign_in_failure", { profileId: profile.id, studentId, ip: input.ip ?? undefined, device: input.device });
    return { ok: false, reason: "account_disabled" };
  }
  await recordAuthEvent(admin, env.AUTH_PASSWORD_PEPPER, "sign_in_success", { profileId: profile.id, studentId, ip: input.ip ?? undefined, device: input.device });
  return { ok: true, userId: data.user.id, role: "student", displayName: profile.display_name };
}

// Administrators sign in with an email and their own password; the admin role must be in
// app_metadata (server-controlled) and match an active admin profile.
export async function signInAdmin(
  deps: SignInDeps,
  input: { email: string; password: string; ip: string | null; device: string },
): Promise<SignInResult> {
  const { admin, auth, env } = deps;
  const email = input.email.trim().toLowerCase();
  const accountKey = hashIdentifier(env.AUTH_PASSWORD_PEPPER, "rate:sign-in:admin", email);
  const limits = deps.limits ?? SIGN_IN_LIMITS;
  if (input.ip && (await rateLimited(admin, hashIdentifier(env.AUTH_PASSWORD_PEPPER, "rate:sign-in:ip", input.ip), limits.ipRequests, true))) return { ok: false, reason: "rate_limited" };
  if (await rateLimited(admin, accountKey, limits.studentFailures, false)) return { ok: false, reason: "rate_limited" };

  const { data, error } = await auth.auth.signInWithPassword({ email, password: input.password });
  const user = data?.user;
  const { data: profile } = user
    ? await admin.from("profiles").select("id, role, status, display_name").eq("id", user.id).maybeSingle()
    : { data: null };
  const isAdmin = user?.app_metadata?.role === "admin" && profile?.role === "admin" && profile.status === "active";
  if (error || !user || !isAdmin || !profile) {
    if (user) await auth.auth.signOut({ scope: "local" });
    await rateLimited(admin, accountKey, limits.studentFailures, true);
    await recordAuthEvent(admin, env.AUTH_PASSWORD_PEPPER, "sign_in_failure", { profileId: profile?.id, ip: input.ip ?? undefined, device: input.device });
    return { ok: false, reason: "invalid_credentials" };
  }
  await recordAuthEvent(admin, env.AUTH_PASSWORD_PEPPER, "sign_in_success", { profileId: profile.id, ip: input.ip ?? undefined, device: input.device });
  return { ok: true, userId: user.id, role: "admin", displayName: profile.display_name };
}
