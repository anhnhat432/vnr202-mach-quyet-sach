// @vitest-environment node
import { describe, expect, it } from "vitest";

import { isSameOrigin, issueCsrfToken, verifyCsrfToken } from "@/lib/api/csrf";

const secret = "s".repeat(40);

describe("CSRF protection", () => {
  it("accepts a matching header and cookie for the same subject", () => {
    const token = issueCsrfToken(secret, "user-a");
    expect(verifyCsrfToken(secret, "user-a", token, token)).toBe(true);
  });

  it("rejects missing, mismatched, foreign-subject or forged tokens", () => {
    const token = issueCsrfToken(secret, "user-a");
    expect(verifyCsrfToken(secret, "user-a", null, token)).toBe(false);
    expect(verifyCsrfToken(secret, "user-a", token, undefined)).toBe(false);
    expect(verifyCsrfToken(secret, "user-a", token, issueCsrfToken(secret, "user-a"))).toBe(false);
    expect(verifyCsrfToken(secret, "user-b", token, token)).toBe(false);
    const forged = `${token.split(".")[0]}.AAAA`;
    expect(verifyCsrfToken(secret, "user-a", forged, forged)).toBe(false);
  });

  it("checks the Origin header", () => {
    const own = new Request("https://app.example/api/v1/x", { headers: { origin: "https://app.example" } });
    const foreign = new Request("https://app.example/api/v1/x", { headers: { origin: "https://evil.example" } });
    const none = new Request("https://app.example/api/v1/x");
    expect(isSameOrigin(own, [])).toBe(true);
    expect(isSameOrigin(foreign, [])).toBe(false);
    expect(isSameOrigin(foreign, ["https://evil.example"])).toBe(true);
    expect(isSameOrigin(none, [])).toBe(false);
  });
});
