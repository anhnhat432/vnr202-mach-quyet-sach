import { expect, test, type Browser, type Page } from "@playwright/test";
import { createArenaWorld, env, ready, type ArenaWorld } from "./arena-world";

test.skip(!ready, "needs an isolated Supabase stack and test secrets");
let world: ArenaWorld;
test.beforeAll(async () => { world = await createArenaWorld(["An N.V.", "Bình T.T."]); });
test.afterAll(async () => { await world?.cleanup(); });

async function signIn(browser: Browser, student: number): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/dang-nhap");
  await page.fill("input[name=studentId]", world.students[student].studentId);
  await page.fill("input[name=password]", env.defaultPassword!);
  await page.click("button[type=submit]");
  await page.waitForURL("**/live-arena");
  return page;
}

test("progress follows the student to a second device and stays private", async ({ browser }) => {
  const first = await signIn(browser, 0);
  const guestKey = "vnr202:dossier:20000000-0000-0000-0000-000000000002:v1";
  const guestProgress = JSON.stringify({ stage: "connections", selectedEvidence: ["c1-e1", "c1-e2", "c1-e3"], selectedDecision: "unify" });
  await first.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: guestKey, value: guestProgress });
  await first.goto("/ho-so/hop-nhat-de-mo-duong");
  await expect(first.getByRole("heading", { name: "Nhận diện tình thế" })).toBeVisible();
  expect(await first.evaluate((key) => localStorage.getItem(key), guestKey)).toBe(guestProgress);
  await first.getByRole("button", { name: "Mở phòng dữ kiện" }).click();
  const evidence = first.getByRole("checkbox", { name: /Chọn dữ kiện/ });
  for (let i = 0; i < 3; i++) await evidence.nth(i).click();
  await first.getByRole("button", { name: "Đi tới bàn quyết sách" }).click();
  await first.getByRole("radio").first().check();
  await first.getByRole("button", { name: "Phân tích hệ quả" }).click();
  await first.getByRole("button", { name: "Đối chiếu lịch sử" }).click();
  const saved = first.waitForResponse((r) => r.url().endsWith("/api/v1/passport/progress") && r.request().method() === "POST" && r.ok());
  await first.getByRole("button", { name: "Kết nối vào mạch" }).click();
  await saved;
  await expect.poll(async () => first.evaluate(async () => {
    const result = await fetch("/api/v1/passport/progress");
    const body = await result.json();
    return body.data?.items.some((r: { completed_at: string | null }) => r.completed_at !== null);
  })).toBe(true);
  const second = await signIn(browser, 0);
  await second.goto("/passport");
  await expect(second.getByText(/Hợp nhất để mở đường.*Đã hoàn thành/)).toBeVisible();
  await second.goto("/ho-so/hop-nhat-de-mo-duong");
  await expect(second.getByRole("heading", { name: "Hồ sơ đã nhập vào bản đồ tư duy lịch sử" })).toBeVisible();
  const other = await signIn(browser, 1);
  await other.goto("/passport");
  await expect(other.getByText(/Hợp nhất để mở đường.*Chưa bắt đầu/)).toBeVisible();
  await first.context().close();
  await second.context().close();
  await other.context().close();
});
