import "server-only";

import { z } from "zod";

// Server-only configuration. Secrets never use the NEXT_PUBLIC_ prefix and never reach the
// client bundle (LA-ACC-003/005, security-spec §12). ROSTER_* format limits stay optional
// configuration while the real roster format is unknown (N6).
// Blank values in .env files mean "not set" (z.coerce.number() would turn "" into 0).
const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  AUTH_PASSWORD_PEPPER: z.string().min(32),
  ROSTER_DEFAULT_PASSWORD: z.string().min(1).max(72),
  INTERNAL_AUTH_EMAIL_DOMAIN: z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/),
  CSRF_SIGNING_SECRET: z.string().min(32),
  ROSTER_STUDENT_ID_PATTERN: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  ROSTER_MAX_ROWS: z.preprocess(blankToUndefined, z.coerce.number().int().positive().optional()),
  // Number of trusted reverse proxies in front of the app (see clientIp). Vercel appends one entry.
  TRUSTED_PROXY_HOPS: z.preprocess(blankToUndefined, z.coerce.number().int().min(0).max(5).optional()),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function readServerEnv(source: Record<string, string | undefined>): ServerEnv {
  return serverEnvSchema.parse(source);
}

// Explicit setting wins; otherwise Vercel (which sets VERCEL=1) counts as one trusted proxy and
// every other environment trusts none, so a forged X-Forwarded-For is never used.
export function trustedProxyHops(env: Pick<ServerEnv, "TRUSTED_PROXY_HOPS">, source: Record<string, string | undefined> = process.env): number {
  return env.TRUSTED_PROXY_HOPS ?? (source.VERCEL ? 1 : 0);
}

export function getServerEnv(): ServerEnv {
  return readServerEnv(process.env);
}

export function isAuthConfigured(): boolean {
  return serverEnvSchema.safeParse(process.env).success && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
