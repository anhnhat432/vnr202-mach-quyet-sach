// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { requireActor, requireStudent } from "@/lib/api/guard";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getSession: vi.fn(), service: vi.fn(), cookies: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => ({ auth: { getUser: mocks.getUser, getSession: mocks.getSession } }) }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: mocks.service }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
afterEach(() => { vi.restoreAllMocks(); vi.resetAllMocks(); });

it.each([
  { status: 429, code: "over_request_rate_limit" },
  { status: 503, code: "unexpected_failure" },
  { status: 0, name: "AuthRetryableFetchError" },
])("does not misreport an upstream Auth outage as a lost login: %j", async upstream => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: { ...upstream, message: "private provider detail" } });
  await expect(requireStudent(new Request("https://class.test/api/v1/arena/lobby"), { mutating: false })).rejects.toMatchObject({ status: 503, code: "temporarily_unavailable" });
  expect(mocks.service).not.toHaveBeenCalled();
  expect(mocks.cookies).not.toHaveBeenCalled();
  expect(JSON.stringify(warning.mock.calls)).not.toContain("private provider detail");
});

it("handles a thrown retryable provider error without admitting a caller", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mocks.getUser.mockRejectedValue(Object.assign(new Error("private network detail"), { name: "AuthRetryableFetchError", status: 0 }));
  await expect(requireActor()).rejects.toMatchObject({ status: 503, code: "temporarily_unavailable" });
  expect(mocks.service).not.toHaveBeenCalled();
});

it("also distinguishes a failed control-session read from an expired login", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mocks.getUser.mockResolvedValue({ data: { user: { id: "fixture-user", app_metadata: { role: "student" } } }, error: null });
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: { status: 503, message: "private detail" } });
  await expect(requireStudent(new Request("https://class.test/api/v1/arena/lobby"), { mutating: false })).rejects.toMatchObject({ status: 503, code: "temporarily_unavailable" });
  expect(mocks.service).not.toHaveBeenCalled();
});

it.each([
  { user: null, error: { status: 401, code: "session_not_found" } },
  { user: null, error: { name: "AuthSessionMissingError", status: 400 } },
  { user: { id: "fixture-user", app_metadata: { role: "visitor" } }, error: null },
])("retains 401 for missing/revoked sessions or an invalid role: %j", async ({user,error}) => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mocks.getUser.mockResolvedValue({ data: { user }, error });
  await expect(requireActor()).rejects.toMatchObject({ status: 401, code: "unauthenticated" });
});
