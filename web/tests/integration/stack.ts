import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { ServerEnv } from "@/lib/config/server-env";

// Shared setup: real GoTrue/PostgREST/Postgres. Fails loudly when the stack is missing so the
// suite can never pass vacuously.
function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Start the stack (npm run db:up) or run in CI with a Supabase stack.`);
  return value;
}

export const stack = {
  url: need("SUPABASE_URL"),
  anonKey: need("SUPABASE_ANON_KEY"),
  serviceKey: need("SUPABASE_SERVICE_ROLE_KEY"),
};

// Test-only values generated per run; none is a real secret or the production default password.
export const testSecrets = {
  AUTH_PASSWORD_PEPPER: `pepper-${crypto.randomUUID()}-${crypto.randomUUID()}`,
  ROSTER_DEFAULT_PASSWORD: "1",
  INTERNAL_AUTH_EMAIL_DOMAIN: "auth.invalid",
};

export const env: Pick<ServerEnv, "AUTH_PASSWORD_PEPPER" | "ROSTER_DEFAULT_PASSWORD" | "INTERNAL_AUTH_EMAIL_DOMAIN" | "ROSTER_STUDENT_ID_PATTERN" | "ROSTER_MAX_ROWS"> = {
  ...testSecrets,
  ROSTER_STUDENT_ID_PATTERN: undefined,
  ROSTER_MAX_ROWS: undefined,
};

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
export const serviceClient = (): SupabaseClient => createClient(stack.url, stack.serviceKey, options);
export const anonClient = (): SupabaseClient => createClient(stack.url, stack.anonKey, options);
export const clientWithToken = (accessToken: string): SupabaseClient =>
  createClient(stack.url, stack.anonKey, { ...options, global: { headers: { Authorization: `Bearer ${accessToken}` } } });

export const utf8 = (text: string) => new TextEncoder().encode(text);

export async function cleanupClass(admin: SupabaseClient, classCode: string) {
  const { data: cls } = await admin.from("classes").select("id").eq("code", classCode).maybeSingle();
  if (!cls) return;
  const { data: profiles } = await admin.from("profiles").select("id").eq("class_id", cls.id);
  for (const p of profiles ?? []) await admin.auth.admin.deleteUser(p.id);
  await admin.from("roster_imports").delete().eq("class_id", cls.id);
  await admin.from("classes").delete().eq("id", cls.id);
}
