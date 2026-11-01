// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/auth/sign-out/route";
import { ApiError } from "@/lib/api/errors";
const mocks = vi.hoisted(() => ({ signOut: vi.fn(), audit: vi.fn(), csrf: vi.fn() }));
vi.mock("@/lib/api/guard", () => ({ requireActor: async () => ({ actor: { userId: "synthetic-owner", role: "student" }, supabase: { auth: { signOut: mocks.signOut } } }), assertCsrf: mocks.csrf }));
vi.mock("@/features/auth/server/audit", () => ({ recordAuthEvent: mocks.audit }));
vi.mock("@/lib/config/server-env", () => ({ getServerEnv: () => ({ AUTH_PASSWORD_PEPPER: "p".repeat(40) }), trustedProxyHops: () => 0 }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({}) }));
afterEach(() => { vi.resetAllMocks(); });
const submit = () => POST(new Request("https://class.test/api/v1/auth/sign-out", { method: "POST" }));
it.each([false, true])("does not claim success or audit sign-out if the provider fails (throws=%s)", async throws => {
  if (throws) mocks.signOut.mockRejectedValue(new Error("private provider failure"));
  else mocks.signOut.mockResolvedValue({ error: new Error("private provider failure") });
  const response = await submit();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private provider failure");
  expect(mocks.audit).not.toHaveBeenCalled();
});
it("checks CSRF before touching the session", async () => {
  mocks.csrf.mockRejectedValue(new ApiError(403, "csrf_failed", "Yêu cầu không hợp lệ."));
  expect((await submit()).status).toBe(403);
  expect(mocks.signOut).not.toHaveBeenCalled();
});
it("logs successful local sign-out, clears the form cookie and returns non-cacheable 204", async () => {
  mocks.signOut.mockResolvedValue({ error: null });
  const response = await submit();
  expect(response.status).toBe(204);
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(mocks.audit).toHaveBeenCalledOnce();
  expect(response.headers.get("set-cookie")).toContain("vnr_csrf=");
  expect(response.headers.get("cache-control")).toContain("no-store");
});
