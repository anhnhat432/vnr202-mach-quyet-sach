// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/admin/competitions/[id]/transitions/route";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(async () => ({ state: "open" })) }));
vi.mock("@/features/arena/server/arena-service", () => ({ rpc: mocks.rpc }));
vi.mock("@/lib/api/guard", () => ({ requireAdmin: async () => ({ admin: {}, actor: { userId: "70000000-0000-4000-8000-000000000001" } }) }));
afterEach(() => vi.clearAllMocks());
const submit = (body: unknown) => POST(new Request("https://test.invalid/api/v1/admin/competitions/70000000-0000-4000-8000-000000000002/transitions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
it("opens a prepared competition with a window measured from the admin click", async () => {
  expect((await submit({ target: "open", startWindowMinutes: 60 })).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith({}, "open_competition_now", { p_competition_id: "70000000-0000-4000-8000-000000000002", p_actor: "70000000-0000-4000-8000-000000000001", p_start_window_minutes: 60 });
});
it.each([0, 1441, 1.5])("rejects an invalid start window %s", async (startWindowMinutes) => {
  expect((await submit({ target: "open", startWindowMinutes })).status).toBe(422);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("does not apply an on-demand window to other state transitions", async () => {
  expect((await submit({ target: "scheduled", startWindowMinutes: 60 })).status).toBe(422);
});
it("retains the fixed-window transition for existing callers", async () => {
  expect((await submit({ target: "open" })).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith({}, "transition_competition_confirmed", expect.objectContaining({ p_target: "open" }));
});
it("does not accept a caller-supplied actor", async () => {
  expect((await submit({ target: "open", startWindowMinutes: 60, actor: "someone-else" })).status).toBe(422);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
