import { afterEach, expect, it, vi } from "vitest";
import { request } from "@/features/arena/client/api";
afterEach(() => { vi.unstubAllGlobals(); document.cookie = "vnr_csrf=; max-age=0; path=/"; });
it("restores a missing form token before sending the mutation exactly once", async () => {
  document.cookie = "vnr_csrf=; max-age=0; path=/";
  const fetcher = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => ({ data: url.endsWith("/auth/csrf") ? { csrfToken: "renewed-test-token" } : { created: 1 } }) }));
  vi.stubGlobal("fetch", fetcher);
  await request("POST", "/admin/roster-imports/test/apply", { body: {}, key: "same-key" });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0][0]).toBe("/api/v1/auth/csrf");
  expect(fetcher.mock.calls[1]).toEqual(["/api/v1/admin/roster-imports/test/apply", expect.objectContaining({ headers: expect.objectContaining({ "x-csrf-token": "renewed-test-token", "idempotency-key": "same-key" }) })]);
});
it("does not send a mutation when restoring the session fails", async () => {
  document.cookie = "vnr_csrf=; max-age=0; path=/";
  const fetcher = vi.fn<(url: string) => Promise<unknown>>(async () => ({ ok: false, status: 401, json: async () => ({ error: { code: "unauthenticated", message: "Bạn cần đăng nhập." } }) }));
  vi.stubGlobal("fetch", fetcher);
  await expect(request("POST", "/admin/roster-imports/test/apply")).rejects.toMatchObject({ code: "unauthenticated" });
  expect(fetcher.mock.calls[0]?.[0]).toBe("/api/v1/auth/csrf");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("coalesces renewal while preserving each independent mutation", async () => {
  document.cookie = "vnr_csrf=; max-age=0; path=/";
  const fetcher = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => ({ data: url.endsWith("/auth/csrf") ? { csrfToken: "renewed-test-token" } : {} }) }));
  vi.stubGlobal("fetch", fetcher);
  await Promise.all([request("POST", "/test/one"), request("POST", "/test/two")]);
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/auth/csrf"))).toHaveLength(1);
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it("never retries a network failure with an unknown mutation outcome", async () => {
  document.cookie = "vnr_csrf=existing-test-token; path=/";
  const fetcher = vi.fn(async () => { throw new TypeError("network"); }); vi.stubGlobal("fetch", fetcher);
  await expect(request("POST", "/test/write")).rejects.toMatchObject({ code: "offline" }); expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([true,false])("retries only one explicit pre-write CSRF rejection; second success=%s", async success => {
  document.cookie = "vnr_csrf=old-test-token; path=/";
  let writes = 0;
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith("/auth/csrf")) return { ok: true, status: 200, json: async () => ({ data: { csrfToken: "renewed-test-token" } }) };
    writes += 1;
    return writes === 2 && success ? { ok: true, status: 200, json: async () => ({ data: {} }) } : { ok: false, status: 403, json: async () => ({ error: { code: "csrf_failed", message: "Yêu cầu không hợp lệ." } }) };
  });
  vi.stubGlobal("fetch", fetcher);
  const result = request("POST", "/test/write", { key: "unchanged-key", body: { value: 1 } });
  if (success) await result; else await expect(result).rejects.toMatchObject({ code: "csrf_failed" });
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(fetcher.mock.calls[0][0]).toBe(fetcher.mock.calls[2][0]);
  for (const call of [1,3]) expect(fetcher).toHaveBeenNthCalledWith(call, "/api/v1/test/write", expect.objectContaining({ body: JSON.stringify({ value: 1 }), headers: expect.objectContaining({ "idempotency-key": "unchanged-key" }) }));
});
it("preserves multipart data and lets the browser provide its boundary", async () => {
  document.cookie = "vnr_csrf=existing-test-token; path=/";
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ data: {} }) }));
  vi.stubGlobal("fetch", fetcher);
  const body = new FormData(); body.append("classCode", "SYNTHETIC");
  await request("POST", "/admin/roster-imports", { body });
  expect(fetcher.mock.calls[0]).toEqual(["/api/v1/admin/roster-imports", expect.objectContaining({ body, headers: { "x-csrf-token": "existing-test-token" } })]);
});
