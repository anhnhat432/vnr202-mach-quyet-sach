import { expect, test, type Page } from "@playwright/test";

import { createArenaWorld, env, ready, type ArenaWorld } from "./arena-world";

// Stage F browser flows on the real stack: play both games through the UI, F5 keeps the same
// question and clock, offline banner then resync, device transfer only after explicit confirmation,
// and no answer ever reaches the browser before the competition is Finalized.
test.skip(!ready, "needs the local stack and server secrets");
test.describe.configure({ mode: "serial" });

let world: ArenaWorld;
const leaks: string[] = [];

test.beforeAll(async () => {
  world = await createArenaWorld(["Ánh Đ.T.", "Bảo N.Q.", "Cúc L.T."]);
});
test.afterAll(async () => {
  await world?.cleanup();
});
test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chromium", "stateful flows share one competition; viewport checks are in the screenshot pass");
  page.on("response", async (response) => {
    if (!response.url().includes("/api/v1/arena/")) return;
    const text = await response.text().catch(() => "");
    if (/correctOptionId|explanation|snapshot_private/.test(text)) leaks.push(response.url());
  });
});

async function signIn(page: Page, studentId: string) {
  await page.goto("/dang-nhap");
  await page.fill("input[name=studentId]", studentId);
  await page.fill("input[name=password]", env.defaultPassword!);
  await page.click("button[type=submit]");
  await page.waitForURL("**/live-arena");
}

// Fixture prompts name their answer ("... chọn đáp án C") so a scripted player can answer correctly
// without the browser ever receiving the correct option id.
async function correctIndex(page: Page) {
  const prompt = (await page.textContent(".ax-question__prompt")) ?? "";
  const letter = prompt.match(/đáp án ([A-C])/)?.[1];
  const labels = await page.$$eval(".ax-option span", (spans) => spans.map((s) => s.textContent?.trim()));
  return Math.max(0, labels.indexOf(`Đáp án ${letter}`));
}

// Every test signs in again (a new Auth session), so entering a game with an attempt already running
// elsewhere asks for confirmation first: accept it and continue.
async function enter(page: Page, path: string, ready: string) {
  await page.goto(path);
  const dialog = page.getByRole("dialog", { name: "Lượt thi đang mở ở thiết bị khác" });
  await expect(page.locator(ready).or(dialog).first()).toBeVisible({ timeout: 8000 });
  if (await dialog.count()) await page.getByRole("button", { name: "Chuyển sang thiết bị này" }).click();
  await expect(page.locator(ready)).toBeVisible({ timeout: 8000 });
}

const raceQuestion = (page: Page, n: number) => page.locator(`.ax-question:not(.is-expired) .ax-chip:has-text("Câu ${n}/15")`);
const clockMs = async (page: Page) => {
  const [m, s] = ((await page.textContent(".ax-clock span")) ?? "0:00").split(":").map(Number);
  return (m * 60 + s) * 1000;
};

test("Đường Đua: keyboard play, F5 keeps the question, score and clock", async ({ page }) => {
  await signIn(page, world.students[0].studentId);
  await page.goto("/live-arena/duong-dua");
  await page.getByRole("button", { name: "Bắt đầu lượt thi" }).click();
  for (const n of [1, 2]) {
    await expect(raceQuestion(page, n)).toBeVisible({ timeout: 8000 });
    await page.keyboard.press(["a", "b", "c"][await correctIndex(page)]);
  }
  await expect(raceQuestion(page, 3)).toBeVisible({ timeout: 8000 });
  const score = await page.textContent(".ax-score span");
  expect(score).toBe("200");
  const before = await clockMs(page);

  await page.reload();
  await expect(raceQuestion(page, 3)).toBeVisible({ timeout: 8000 }); // same question after F5, not a new attempt
  expect(await page.textContent(".ax-score span")).toBe("200");
  expect(await clockMs(page)).toBeLessThanOrEqual(before); // the clock never restarts
  await expect(page.getByText("Bắt đầu lượt thi")).toHaveCount(0);
});

test("offline: the banner shows, then the game resyncs from the server", async ({ page, context }) => {
  await signIn(page, world.students[0].studentId);
  await enter(page, "/live-arena/duong-dua", ".ax-race");
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByText("Mất kết nối – đang thử lại")).toBeVisible({ timeout: 6000 });
  await page.waitForTimeout(1500);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText("Mất kết nối – đang thử lại")).toHaveCount(0, { timeout: 8000 });
  await expect(page.locator(".ax-question, .ax-reveal").first()).toBeVisible();
});

test("device transfer needs an explicit confirmation and locks the old device", async ({ page, browser }) => {
  await signIn(page, world.students[0].studentId);
  await enter(page, "/live-arena/duong-dua", ".ax-race");

  const second = await browser.newContext();
  const page2 = await second.newPage();
  await signIn(page2, world.students[0].studentId);
  await page2.goto("/live-arena/duong-dua");
  await expect(page2.getByRole("dialog", { name: "Lượt thi đang mở ở thiết bị khác" })).toBeVisible({ timeout: 8000 });
  // nothing moved yet: the first device still plays
  await page.reload();
  await expect(page.locator(".ax-race")).toBeVisible({ timeout: 8000 });

  await page2.getByRole("button", { name: "Chuyển sang thiết bị này" }).click();
  await expect(page2.locator(".ax-race")).toBeVisible({ timeout: 8000 });
  await expect(page2.locator(".ax-score span")).toHaveText("200");

  // the old device is refused on its next action and is asked to confirm instead
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Lượt thi đang mở ở thiết bị khác" })).toBeVisible({ timeout: 8000 });
  await second.close();
});

test("Bãi Mìn: open, answer, F5 during a question keeps its countdown", async ({ page }) => {
  await signIn(page, world.students[1].studentId);
  await page.goto("/live-arena/bai-min");
  await page.getByRole("button", { name: "Bắt đầu lượt thi" }).click();
  await expect(page.locator(".ax-board")).toBeVisible();
  for (let i = 0; i < 20 && !(await page.locator(".ax-question").count()); i += 1) {
    const opened = await page.locator(".ax-cell.is-open").count();
    await page.locator(".ax-cell:not(.is-open)").first().click({ force: true });
    await expect(page.locator(".ax-cell.is-open")).toHaveCount(opened + 1);
    await page.waitForTimeout(700);
  }
  await expect(page.locator(".ax-question")).toBeVisible({ timeout: 5000 });
  const prompt = await page.textContent(".ax-question__prompt");
  const shown = Number((await page.textContent(".ax-question__time"))?.replace(",", "."));
  await page.reload();
  await expect(page.locator(".ax-question__prompt")).toHaveText(prompt ?? "", { timeout: 8000 });
  const after = Number((await page.textContent(".ax-question__time"))?.replace(",", "."));
  expect(after).toBeLessThanOrEqual(shown); // the deadline did not move
  await page.locator(".ax-option").nth(await correctIndex(page)).click();
  await expect(page.locator(".ax-overlay")).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator(".ax-mark--ok, .ax-mark--bad").first()).toBeVisible();
  expect(Number(await page.textContent(".ax-score span"))).toBeGreaterThanOrEqual(0);
});

test("leaderboards resync from the API without reload, survive going offline, and show display names only", async ({ page, browser, context }) => {
  // viewer (no sign-in needed)
  const viewer = await browser.newContext();
  const board = await viewer.newPage();
  await board.goto("/live-arena/bang-xep-hang");
  const raceBoard = board.locator(".ax-lb--race");
  await expect(raceBoard.getByText(world.students[0].name)).toBeVisible({ timeout: 10000 });
  const before = Number((await raceBoard.locator(".ax-lb__row", { hasText: world.students[0].name }).locator(".ax-lb__score").textContent())?.replace(/\./g, ""));

  // the player answers; the viewer's board follows by itself (Broadcast hint or periodic sync)
  await signIn(page, world.students[0].studentId);
  await enter(page, "/live-arena/duong-dua", ".ax-race");
  await expect(page.locator(".ax-question:not(.is-expired)")).toBeVisible({ timeout: 10000 });
  await page.locator(".ax-option").nth(await correctIndex(page)).click();
  await expect.poll(async () => Number((await raceBoard.locator(".ax-lb__row", { hasText: world.students[0].name }).locator(".ax-lb__score").textContent())?.replace(/\./g, "")), { timeout: 12000 }).toBeGreaterThan(before);

  // offline then back: the board shows the state and resyncs
  await viewer.setOffline(true);
  await board.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(board.getByText("Mất kết nối").first()).toBeVisible({ timeout: 8000 });
  await viewer.setOffline(false);
  await board.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(board.getByText("Mất kết nối")).toHaveCount(0, { timeout: 8000 });

  const text = (await board.locator(".ax-lb-grid").textContent()) ?? "";
  expect(text).toContain("Diễn tập");
  for (const s of world.students) expect(text).not.toContain(s.studentId);
  expect(text).not.toContain("Họ Tên Thử");

  // projector: both boards at 1920x1080, then one game enlarged
  const proj = await viewer.newPage();
  await proj.setViewportSize({ width: 1920, height: 1080 });
  await proj.goto("/trinh-chieu");
  await expect(proj.locator(".ax-lb--projector")).toHaveCount(2, { timeout: 10000 });
  await expect(proj.locator(".ax-lb__row").first()).toBeVisible({ timeout: 10000 }); // hydrated and synced
  await proj.keyboard.press("2");
  await expect(proj.locator(".ax-lb--projector")).toHaveCount(1);
  await expect(proj.locator(".ax-lb--race")).toBeVisible();
  await viewer.close();
  void context;
});

test("hub shows both games and the player's state; no answer ever reached the browser", async ({ page }) => {
  await signIn(page, world.students[0].studentId);
  await expect(page.getByRole("heading", { name: "Bãi Mìn Tri Thức" })).toBeVisible();
  await expect(page.getByText("Tiếp tục lượt đang chơi")).toBeVisible();
  expect(leaks).toEqual([]);
});
