// @vitest-environment node
import { describe, expect, it } from "vitest";

import { clientIp } from "@/lib/api/client-info";
import { readServerEnv, trustedProxyHops } from "@/lib/config/server-env";

const req = (xff?: string, extra: Record<string, string> = {}) => new Request("https://app.example/api/v1/auth/sign-in", { headers: { ...(xff ? { "x-forwarded-for": xff } : {}), ...extra } });

describe("clientIp: only entries added by trusted proxies are believed", () => {
  it("returns null when no proxy is trusted, whatever the headers say", () => {
    expect(clientIp(req("1.2.3.4"), 0)).toBeNull();
    expect(clientIp(req("1.2.3.4", { "x-real-ip": "5.6.7.8" }), 0)).toBeNull();
  });

  it("with one trusted proxy takes the entry that proxy appended (rightmost), not the forged leftmost", () => {
    expect(clientIp(req("203.0.113.9"), 1)).toBe("203.0.113.9");
    expect(clientIp(req("6.6.6.6, 7.7.7.7, 203.0.113.9"), 1)).toBe("203.0.113.9");
  });

  it("counts hops from the right for chained proxies (CDN + platform)", () => {
    expect(clientIp(req("6.6.6.6, 198.51.100.7, 10.0.0.2"), 2)).toBe("198.51.100.7");
    expect(clientIp(req("10.0.0.2"), 2)).toBeNull(); // fewer entries than trusted hops: do not guess
  });

  it("ignores x-real-ip, missing headers and non-IP garbage", () => {
    expect(clientIp(req(undefined, { "x-real-ip": "1.1.1.1" }), 1)).toBeNull();
    expect(clientIp(req("not-an-ip"), 1)).toBeNull();
    expect(clientIp(req("1.2.3.4, <script>"), 1)).toBeNull();
  });

  it("accepts IPv6 and rejects invalid hop settings", () => {
    expect(clientIp(req("2001:db8::1"), 1)).toBe("2001:db8::1");
    expect(clientIp(req("1.2.3.4"), -1)).toBeNull();
    expect(clientIp(req("1.2.3.4"), 1.5)).toBeNull();
  });
});

describe("TRUSTED_PROXY_HOPS and blank optional env values", () => {
  const base = {
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "k".repeat(30),
    AUTH_PASSWORD_PEPPER: "p".repeat(40),
    ROSTER_DEFAULT_PASSWORD: "x",
    INTERNAL_AUTH_EMAIL_DOMAIN: "auth.invalid",
    CSRF_SIGNING_SECRET: "c".repeat(40),
  };

  it("defaults to 1 on Vercel and 0 elsewhere; an explicit value wins", () => {
    const env = readServerEnv(base);
    expect(trustedProxyHops(env, { VERCEL: "1" })).toBe(1);
    expect(trustedProxyHops(env, {})).toBe(0);
    expect(trustedProxyHops(readServerEnv({ ...base, TRUSTED_PROXY_HOPS: "2" }), { VERCEL: "1" })).toBe(2);
    expect(trustedProxyHops(readServerEnv({ ...base, TRUSTED_PROXY_HOPS: "0" }), { VERCEL: "1" })).toBe(0);
  });

  it("treats blank values copied from .env.example as unset instead of failing or becoming 0", () => {
    const env = readServerEnv({ ...base, ROSTER_MAX_ROWS: "", ROSTER_STUDENT_ID_PATTERN: "", TRUSTED_PROXY_HOPS: "" });
    expect(env.ROSTER_MAX_ROWS).toBeUndefined();
    expect(env.ROSTER_STUDENT_ID_PATTERN).toBeUndefined();
    expect(env.TRUSTED_PROXY_HOPS).toBeUndefined();
  });

  it("rejects out-of-range hops", () => {
    expect(() => readServerEnv({ ...base, TRUSTED_PROXY_HOPS: "9" })).toThrow();
    expect(() => readServerEnv({ ...base, TRUSTED_PROXY_HOPS: "-1" })).toThrow();
  });
});
