// @vitest-environment node
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { signInAdmin, signInStudent } from "@/features/auth/server/sign-in";
import { ApiError } from "@/lib/api/errors";

const env = {
  AUTH_PASSWORD_PEPPER: "test-pepper-at-least-sixteen-chars",
  INTERNAL_AUTH_EMAIL_DOMAIN: "auth.invalid",
};

function makeDeps(authError: { message: string; status?: number; code?: string; name?: string } | null) {
  const consumedKeys: string[] = [];
  const admin = {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn === "consume_rate_limit") {
        consumedKeys.push(String(args.p_key_hash));
        return { data: true, error: null };
      }
      if (fn === "rate_limit_exceeded") {
        return { data: false, error: null };
      }
      return { data: null, error: null };
    }),
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "00000000-0000-4000-8000-000000000001",
                    role: "student",
                    status: "active",
                    display_name: "An N.V.",
                    student_auth_identities: { internal_email: "u1@auth.invalid" },
                  },
                  error: null,
                }),
              }),
              maybeSingle: async () => ({
                data: {
                  id: "00000000-0000-4000-8000-000000000002",
                  role: "admin",
                  status: "active",
                  display_name: "Admin",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "auth_events") {
        return { insert: vi.fn(async () => ({ error: null })) };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  } as unknown as SupabaseClient;

  const auth = {
    auth: {
      signInWithPassword: vi.fn(async () => ({
        data: { user: authError ? null : { id: "00000000-0000-4000-8000-000000000001", app_metadata: { role: "admin" } } },
        error: authError,
      })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  } as unknown as SupabaseClient;

  return { admin, auth, consumedKeys };
}

describe("signInStudent / signInAdmin upstream error handling", () => {
  it("does not count upstream 429 rate-limit responses as wrong-password failures for a student", async () => {
    const { admin, auth, consumedKeys } = makeDeps({
      message: "Request rate limit reached",
      status: 429,
      code: "over_request_rate_limit",
    });

    const result = await signInStudent(
      { admin, auth, env },
      { studentId: "HE123456", password: "1", ip: null, device: "vitest" },
    );

    expect(result).toEqual({ ok: false, reason: "rate_limited" });
    expect(consumedKeys).toEqual([]);
  });

  it("still counts 400 invalid_credentials responses against the per-student failure limit", async () => {
    const { admin, auth, consumedKeys } = makeDeps({
      message: "Invalid login credentials",
      status: 400,
      code: "invalid_credentials",
    });

    const result = await signInStudent(
      { admin, auth, env },
      { studentId: "HE123456", password: "wrong", ip: null, device: "vitest" },
    );

    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
    expect(consumedKeys).toHaveLength(1);
  });

  it("does not count upstream 5xx / retryable fetch failures against the per-student failure limit", async () => {
    const { admin, auth, consumedKeys } = makeDeps({
      message: "Auth service unavailable",
      status: 503,
      name: "AuthRetryableFetchError",
    });

    await expect(
      signInStudent(
        { admin, auth, env },
        { studentId: "HE123456", password: "1", ip: null, device: "vitest" },
      ),
    ).rejects.toMatchObject({ status: 503, code: "temporarily_unavailable" });
    expect(consumedKeys).toEqual([]);
  });

  it.each([{ status: 503 }, { status: 0, name: "AuthRetryableFetchError" }])("classifies a temporary provider failure independently of its SDK status/name", async (error) => {
    const { admin, auth, consumedKeys } = makeDeps({ message: "private provider details", ...error });
    await expect(signInAdmin({ admin, auth, env }, { email: "admin@test.invalid", password: "test-only", ip: null, device: "vitest" })).rejects.toBeInstanceOf(ApiError);
    expect(consumedKeys).toHaveLength(0);
  });

  it("does not count upstream 429 rate-limit responses against the admin failure limit", async () => {
    const { admin, auth, consumedKeys } = makeDeps({
      message: "Request rate limit reached",
      status: 429,
      code: "over_request_rate_limit",
    });

    const result = await signInAdmin(
      { admin, auth, env },
      { email: "admin@example.com", password: "secret", ip: null, device: "vitest" },
    );

    expect(result).toEqual({ ok: false, reason: "rate_limited" });
    expect(consumedKeys).toEqual([]);
  });
});
