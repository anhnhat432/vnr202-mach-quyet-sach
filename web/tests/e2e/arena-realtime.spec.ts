import { expect, test, type Page } from "@playwright/test";

import { createArenaWorld, env, ready, type ArenaWorld } from "./arena-world";

// Stage G1: Supabase Realtime Broadcast actually reaches the browser (not only realtime.send in the
// database). A viewer and the projector join the public channels ("Trực tiếp"); a player scores; the
// viewer receives the `leaderboard.changed` WebSocket frame and its Top 10 follows within the debounce,
// far below the 15 s safety sync. Needs a stack with the Realtime service (CI, local harness); set
// E2E_REALTIME=1 to make it mandatory.
test.skip(!ready || process.env.E2E_REALTIME !== "1", "needs the stack with Supabase Realtime (E2E_REALTIME=1)");
test.describe.configure({ mode: "serial" });

let world: ArenaWorld;
test.beforeAll(async () => {
  world = await createArenaWorld(["Hạnh P.T.", "Khoa V.Đ."]);
});
test.afterAll(async () => {
  await world?.cleanup();
});
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "one shared competition");
});

async function correctIndex(page: Page) {
  const prompt = (await page.textContent(".ax-question__prompt")) ?? "";
  const letter = prompt.match(/đáp án ([A-C])/)?.[1];
  const labels = await page.$$eval(".ax-option span", (spans) => spans.map((s) => s.textContent?.trim()));
  return Math.max(0, labels.indexOf(`Đáp án ${letter}`));
}

test("Broadcast hint reaches viewer and projector browsers; boards follow within a second", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const viewerCtx = await browser.newContext();
  const viewer = await viewerCtx.newPage();
  const frames: Array<{ at: number; text: string }> = [];
  viewer.on("websocket", (ws) => ws.on("framereceived", (f) => frames.push({ at: Date.now(), text: String(f.payload) })));
  const boardGets: number[] = [];
  viewer.on("request", (r) => { if (r.url().includes(`/api/v1/arena/leaderboards/${world.publicId}/race`)) boardGets.push(Date.now()); });
  await viewer.goto("/live-arena/bang-xep-hang");
  const race = viewer.locator(".ax-lb--race");
  await expect(race.locator(".ax-live.is-live")).toBeVisible({ timeout: 15000 }); // subscribed to the public channel

  const projector = await viewerCtx.newPage();
  await projector.setViewportSize({ width: 1920, height: 1080 });
  await projector.goto("/trinh-chieu");
  await expect(projector.locator(".ax-live.is-live")).toHaveCount(2, { timeout: 15000 });

  // the player starts and answers through the real UI
  const s = world.students[0];
  await page.goto("/dang-nhap");
  await page.fill("input[name=studentId]", s.studentId);
  await page.fill("input[name=password]", env.defaultPassword!);
  await page.click("button[type=submit]");
  await page.waitForURL("**/live-arena");
  await page.goto("/live-arena/duong-dua");
  const startSettled = viewer.waitForResponse((r) => r.url().includes(`/api/v1/arena/leaderboards/${world.publicId}/race`) && r.url().includes("settle=1"));
  await page.getByRole("button", { name: "Bắt đầu lượt thi" }).click();
  await expect(viewer.locator(".ax-lb__row", { hasText: s.name })).toBeVisible({ timeout: 5000 }); // the start itself is a board change
  await expect(page.locator(".ax-question:not(.is-expired)")).toBeVisible({ timeout: 10000 });
  await startSettled; // let the start hint's 1 s server pacing window and 1.2 s client settle read finish

  const framesBefore = frames.length;
  const answered = page.waitForResponse((r) => r.url().includes("/answers") && r.request().method() === "POST");
  await page.locator(".ax-option").nth(await correctIndex(page)).click();
  const t0 = Date.now();
  await answered;
  await expect.poll(() => frames.slice(framesBefore).some((f) => f.text.includes("leaderboard.changed")), { timeout: 5000 }).toBe(true);
  const frame = frames.slice(framesBefore).find((f) => f.text.includes("leaderboard.changed"))!;
  // the hint is an envelope only: no names, scores, answers or ids of people
  expect(frame.text).not.toMatch(/displayName|score|studentId|correctOptionId|profileId|attemptId/);
  expect(frame.text).not.toContain(s.name);
  await expect.poll(async () => Number((await viewer.locator(".ax-lb--race .ax-lb__row", { hasText: s.name }).locator(".ax-lb__score").textContent())?.replace(/\./g, "")), { timeout: 3000 }).toBeGreaterThan(0);
  const tBoard = Date.now();
  const refetch = boardGets.find((t) => t >= frame.at);
  expect(refetch, "the hint triggered an authoritative re-read").toBeDefined();
  expect(refetch! - frame.at).toBeLessThan(1000); // debounce 200 ms, not the 15 s safety sync
  test.info().annotations.push({ type: "latency", description: `answer→hint frame ${frame.at - t0} ms, answer→board updated ${tBoard - t0} ms` });
  console.log(`[G1] answer→hint frame ${frame.at - t0} ms; hint→API re-read ${refetch! - frame.at} ms; answer→board visible ${tBoard - t0} ms`);
  await viewerCtx.close();
});
