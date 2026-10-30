import { expect, test, type Page } from "@playwright/test";

type State = { stage: string; selectedEvidence: string[]; selectedDecision: string };
const dossier = "20000000-0000-0000-0000-000000000002";
const blank: State = { stage: "briefing", selectedEvidence: [], selectedDecision: "" };

async function simulatedServer(page: Page, options: { failLoad?: boolean; failSave?: boolean } = {}) {
  const server = { ...options, ownerId: "c51140ff-7441-4200-9d7a-7e9ceea08377", version: 0, state: blank, posts: 0 };
  await page.route("**/api/v1/passport/progress", async (route) => {
    if (route.request().method() === "GET") {
      if (server.failLoad) return route.abort("internetdisconnected");
      return route.fulfill({ json: { data: { ownerId: server.ownerId, items: server.version ? [{ dossier_id: dossier, version: server.version, state: server.state }] : [] } } });
    }
    server.posts++;
    if (server.failSave) return route.fulfill({ status: 503, json: { error: { code: "offline", message: "Tạm mất kết nối" } } });
    const body = route.request().postDataJSON() as { state: State; ownerId: string; expectedVersion: number };
    if (body.ownerId !== server.ownerId) return route.fulfill({ status: 409, json: { error: { code: "session_changed", message: "Tài khoản đã đổi" } } });
    if (body.expectedVersion !== server.version) return route.fulfill({ status: 409, json: { error: { code: "progress_conflict", message: "Xung đột" } } });
    server.state = body.state; server.version++;
    return route.fulfill({ json: { data: { saved: true, version: server.version } } });
  });
  return server;
}

test("offline load keeps edits on this device through reload and asks before sync", async ({ page }) => {
  const server = await simulatedServer(page, { failLoad: true });
  await page.goto("/ho-so/hop-nhat-de-mo-duong");
  await page.getByRole("button", { name: "Mở phòng dữ kiện" }).click();
  await page.getByRole("checkbox", { name: /Chọn dữ kiện/ }).first().click();
  await expect.poll(() => page.evaluate((id) => JSON.parse(localStorage.getItem(`vnr202:dossier:${id}:pending:v1`) ?? "null")?.selectedEvidence.length, dossier)).toBe(1);
  await expect(page.getByText("Trang hồ sơ đã sẵn sàng để mở lại khi mất mạng.")).toBeVisible({ timeout: 30000 });
  // Next dev's HMR requires its server to hydrate; the production CI run also tests a completely offline reload.
  if (process.env.E2E_PRODUCTION) await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /Chọn dữ kiện/ }).first()).toHaveAttribute("aria-checked", "true");
  if (process.env.E2E_PRODUCTION) await page.context().setOffline(false);
  server.failLoad = false;
  await page.getByRole("button", { name: "Thử đồng bộ lại" }).click();
  await expect(page.getByText(/Thiết bị có bản chưa đồng bộ/)).toBeVisible();
  expect(server.posts).toBe(0);
  await page.getByRole("button", { name: "Dùng bản thiết bị và thay bản tài khoản" }).click();
  await expect.poll(() => server.version).toBe(1);
  expect(server.state.selectedEvidence).toHaveLength(1);
});

test("a failed save can be retried without losing the device draft", async ({ page }) => {
  const server = await simulatedServer(page, { failSave: true });
  await page.goto("/ho-so/hop-nhat-de-mo-duong");
  await page.getByRole("button", { name: "Mở phòng dữ kiện" }).click();
  await expect(page.getByText(/Không đồng bộ được tiến độ/)).toBeVisible();
  server.failSave = false;
  await page.getByRole("button", { name: "Thử đồng bộ lại" }).click();
  await expect.poll(() => server.version).toBe(1);
  expect(server.state.stage).toBe("evidence");
});

test("a concurrent device update is preserved until the learner explicitly chooses", async ({ page }) => {
  const server = await simulatedServer(page);
  server.version = 1;
  await page.goto("/ho-so/hop-nhat-de-mo-duong");
  await expect(page.getByRole("button", { name: "Mở phòng dữ kiện" })).toBeVisible();
  server.version = 2; server.state = { stage: "comparison", selectedEvidence: ["c1-e1", "c1-e2", "c1-e3"], selectedDecision: "unify" };
  await page.getByRole("button", { name: "Mở phòng dữ kiện" }).click();
  await expect(page.getByText(/tài khoản đã thay đổi ở thiết bị khác/)).toBeVisible();
  expect(server.state.stage).toBe("comparison");
  await expect(page.getByText(/Bản tài khoản: Đối chiếu/)).toBeVisible();
  server.version = 3; server.state = { ...server.state, stage: "connections" };
  await page.getByRole("button", { name: "Dùng bản thiết bị và thay bản tài khoản" }).click();
  await expect(page.getByText(/Bản tài khoản: Kết nối/)).toBeVisible();
  expect(server.version).toBe(3);
  await page.getByRole("button", { name: "Dùng bản thiết bị và thay bản tài khoản" }).click();
  await expect.poll(() => server.version).toBe(4);
  expect(server.state.stage).toBe("evidence");
  const backups = await page.evaluate((id) => Object.keys(localStorage).filter((key) => key.startsWith(`vnr202:dossier:${id}:pending:v1:backup:`)).map((key) => JSON.parse(localStorage.getItem(key)!)), dossier);
  expect(backups.some((entry) => entry.stage === "connections")).toBe(true);
  await page.getByRole("button", { name: "Xem bản dự phòng gần nhất trên thiết bị" }).click();
  await expect(page.getByText(/Bản thiết bị: Kết nối/)).toBeVisible();
  expect(server.state.stage).toBe("evidence");
});

test("a changed signed-in account cannot receive the previous account's draft automatically", async ({ page }) => {
  const server = await simulatedServer(page);
  await page.goto("/ho-so/hop-nhat-de-mo-duong");
  await expect(page.getByRole("button", { name: "Mở phòng dữ kiện" })).toBeVisible();
  server.ownerId = "d75e05f0-2ca0-4313-ac35-f63a0fb8601d";
  await page.getByRole("button", { name: "Mở phòng dữ kiện" }).click();
  await expect(page.getByText(/Tài khoản đăng nhập đã thay đổi/)).toBeVisible();
  expect(server.version).toBe(0);
  expect(server.state.stage).toBe("briefing");
});
