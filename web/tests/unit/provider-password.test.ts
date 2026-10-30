// @vitest-environment node
import { describe, expect, it } from "vitest";

import { deriveProviderPassword, hashIdentifier } from "@/features/auth/domain/provider-password";

const pepper = "p".repeat(48);
const otherPepper = "q".repeat(48);
const entered = String(Math.floor(Math.random() * 10));

describe("provider password derivation (LA-ACC-005)", () => {
  it("is deterministic per MSSV, password and pepper", () => {
    expect(deriveProviderPassword(pepper, "HE1", entered)).toBe(deriveProviderPassword(pepper, "HE1", entered));
  });

  it("differs per MSSV, per entered password and per pepper", () => {
    const base = deriveProviderPassword(pepper, "HE1", entered);
    expect(deriveProviderPassword(pepper, "HE2", entered)).not.toBe(base);
    expect(deriveProviderPassword(pepper, "HE1", `${entered}x`)).not.toBe(base);
    expect(deriveProviderPassword(otherPepper, "HE1", entered)).not.toBe(base);
  });

  it("is long enough for Supabase Auth and never contains the input", () => {
    const derived = deriveProviderPassword(pepper, "HE1", entered);
    expect(derived.length).toBeGreaterThanOrEqual(40);
    expect(derived.length).toBeLessThanOrEqual(72);
    expect(derived).not.toContain("HE1");
  });

  it("rejects a short pepper", () => {
    expect(() => deriveProviderPassword("short", "HE1", entered)).toThrow();
  });

  it("hashes identifiers into 64 hex chars with domain separation", () => {
    const a = hashIdentifier(pepper, "rate:student", "HE1");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIdentifier(pepper, "rate:ip", "HE1")).not.toBe(a);
  });
});
