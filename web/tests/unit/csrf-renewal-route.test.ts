// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/auth/csrf/route";
import { verifyCsrfToken } from "@/lib/api/csrf";
import { ApiError } from "@/lib/api/errors";
const state = vi.hoisted(() => ({ authenticated: true, cookie: undefined as string | undefined }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => state.cookie ? { value: state.cookie } : undefined }) }));
vi.mock("@/lib/api/guard", () => ({ requireActor: async () => { if (!state.authenticated) throw new ApiError(401, "unauthenticated", "Bạn cần đăng nhập."); return { actor: { userId: "synthetic-owner", role: "admin" } }; } }));
vi.mock("@/lib/config/server-env", () => ({ getServerEnv: () => ({ CSRF_SIGNING_SECRET: "s".repeat(40) }) }));
afterEach(() => { state.authenticated = true; state.cookie = undefined; vi.unstubAllEnvs(); });
const submit = (origin: string | null, body: unknown = {}) => POST(new Request("https://class.test/api/v1/auth/csrf", { method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(body) }));
it("renews only for the authenticated actor and sets a secure non-cacheable cookie", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const response = await submit("https://class.test");
  expect(response.status).toBe(200);
  const token = (await response.json()).data.csrfToken;
  expect(verifyCsrfToken("s".repeat(40), "synthetic-owner", token, token)).toBe(true);
  expect(verifyCsrfToken("s".repeat(40), "other-owner", token, token)).toBe(false);
  expect(response.headers.get("set-cookie")).toContain(`vnr_csrf=${token};`);
  expect(response.headers.get("set-cookie")).toContain("Secure");
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it.each([null,"https://foreign.test"])("rejects missing or foreign Origin %s", async origin => { expect((await submit(origin)).status).toBe(403); });
it("requires an existing verified session", async () => { state.authenticated = false; expect((await submit("https://class.test")).status).toBe(401); });
it("reuses a valid token so concurrent tabs do not repeatedly invalidate one another", async () => {
  const first = await submit("https://class.test"); state.cookie = (await first.json()).data.csrfToken;
  const second = await submit("https://class.test"); expect((await second.json()).data.csrfToken).toBe(state.cookie);
});
it("does not accept a caller-supplied actor", async () => { expect((await submit("https://class.test", { userId: "other-owner" })).status).toBe(422); });
