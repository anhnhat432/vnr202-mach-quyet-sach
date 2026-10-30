import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import { Pool } from "pg";

import { createArenaWorld, env, ready, type ArenaWorld } from "./arena-world";

// Stage G5/G6: a whole Bãi Mìn attempt played with the keyboard only under reduced motion, WCAG 2 A/AA
// scans (axe) of the game, leaderboard and projector screens, and readability on a phone, a laptop and
// a 1920×1080 projector (no horizontal scroll, touch-sized answers, ten rows that fit the projector).
test.skip(!ready, "needs the local stack and server secrets");
test.describe.configure({ mode: "serial" });

let world: ArenaWorld;
const SHOTS = process.env.G_SHOTS_DIR;

test.beforeAll(async () => {
  const names = Array.from({ length: 22 }, (_, i) => `${["Lan", "Minh", "Nga", "Oanh", "Phúc", "Quế", "Sơn", "Tâm", "Uyên", "Vinh", "Xuân"][i % 11]} ${String.fromCharCode(65 + i)}.${i > 10 ? "T." : ""}`);
  world = await createArenaWorld(names);
  // twenty other players (ten per game) so both Top 10 boards are full
  const pool = new Pool({ connectionString: env.dbUrl!, max: 1 });
  for (const [i, s] of world.students.slice(2).entries()) {
    await pool.query("select public.start_or_resume_attempt($1, $2, $3, $4)", [s.id, world.publicId, i % 2 ? "race" : "minefield", `quality-${crypto.randomUUID()}`]);
  }
  await pool.end();
});
test.afterAll(async () => {
  await world?.cleanup();
});
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "viewports are set per check inside the spec");
});

async function signedIn(browser: Browser, studentIndex: number, options: BrowserContextOptions) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto("/dang-nhap");
  await page.fill("input[name=studentId]", world.students[studentIndex].studentId);
  await page.fill("input[name=password]", env.defaultPassword!);
  await page.click("button[type=submit]");
  await page.waitForURL("**/live-arena");
  return page;
}

async function correctIndex(page: Page) {
  const prompt = (await page.textContent(".ax-question__prompt")) ?? "";
  const letter = prompt.match(/đáp án ([A-C])/)?.[1];
  const labels = await page.$$eval(".ax-option span", (spans) => spans.map((s) => s.textContent?.trim()));
  return Math.max(0, labels.indexOf(`Đáp án ${letter}`));
}

async function axe(page: Page, label: string) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${label}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
}

async function noHorizontalScroll(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll, "no horizontal scrolling").toBeLessThanOrEqual(width + 1);
}

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

test("Bãi Mìn: a whole attempt with the keyboard only, reduced motion, no serious axe violations", async ({ browser }) => {
  test.setTimeout(240_000);
  const page = await signedIn(browser, 0, { reducedMotion: "reduce", viewport: { width: 1366, height: 768 } });
  await page.goto("/live-arena/bai-min");
  await expect(page.getByRole("button", { name: "Bắt đầu lượt thi" })).toBeVisible();
  await axe(page, "minefield intro");
  await page.getByRole("button", { name: "Bắt đầu lượt thi" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".ax-board")).toBeVisible({ timeout: 10000 });

  // reduced motion: no transition or animation inside the game frame
  const motion = await page.locator(".ax-cell").first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { transition: s.transitionDuration, animation: s.animationName };
  });
  expect(motion.transition.split(",").every((d) => d.trim() === "0s")).toBe(true);
  expect(motion.animation).toBe("none");
  await axe(page, "minefield board");

  let scannedQuestion = false;
  for (let step = 0; step < 60; step += 1) {
    if (await page.getByText(/Hoàn thành!|Hết giờ!/).count()) break;
    const question = page.locator(".ax-question:not(.is-expired)");
    if (await question.count()) {
      if (!scannedQuestion) {
        await axe(page, "minefield question");
        await shot(page, "laptop-minefield-question");
        scannedQuestion = true;
      }
      await page.keyboard.press("abc"[await correctIndex(page)]);
      await expect(question).toHaveCount(0, { timeout: 12000 });
      continue;
    }
    const cells = await page.$$eval(".ax-cell", (els) => els.map((e) => ({ open: e.classList.contains("is-open"), disabled: (e as HTMLButtonElement).disabled, tab: e.getAttribute("tabindex") })));
    const target = cells.findIndex((c) => !c.open);
    if (target < 0 || cells.every((c) => c.open || c.disabled)) {
      await page.waitForTimeout(300);
      continue;
    }
    // move the roving focus with the arrow keys, then open with Enter
    await page.locator('.ax-cell[tabindex="0"]').focus();
    let at = cells.findIndex((c) => c.tab === "0");
    while (at !== target) {
      await page.keyboard.press(target > at ? "ArrowRight" : "ArrowLeft");
      at += target > at ? 1 : -1;
    }
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await page.locator(".ax-cell.is-open").count()) > cells.filter((c) => c.open).length || (await page.locator(".ax-question").count()) > 0, { timeout: 8000 }).toBe(true);
  }
  await expect(page.getByText(/Hoàn thành!|Hết giờ!/)).toBeVisible({ timeout: 15000 });
  await axe(page, "minefield finished");
  await page.context().close();
});

test("phone: questions and answers fit 360×640 without scrolling, touch-sized targets, no horizontal scroll", async ({ browser }) => {
  for (const viewport of [{ width: 360, height: 640 }, { width: 412, height: 915 }]) {
    const page = await signedIn(browser, 1, { viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto("/live-arena");
    await noHorizontalScroll(page);
    await page.goto("/live-arena/duong-dua");
    const startButton = page.getByRole("button", { name: "Bắt đầu lượt thi" });
    const dialog = page.getByRole("button", { name: "Chuyển sang thiết bị này" });
    await expect(startButton.or(dialog).or(page.locator(".ax-race")).first()).toBeVisible({ timeout: 10000 });
    if (await startButton.count()) await startButton.tap();
    if (await dialog.count()) await dialog.tap();
    await expect(page.locator(".ax-question:not(.is-expired)")).toBeVisible({ timeout: 12000 });
    await noHorizontalScroll(page);
    for (const box of await Promise.all((await page.locator(".ax-option").all()).map((o) => o.boundingBox()))) {
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(box!.y + box!.height, "every answer is on screen without scrolling while the clock runs").toBeLessThanOrEqual(viewport.height);
    }
    await shot(page, `phone-${viewport.width}-race-question`);
    if (viewport.width === 412) await axe(page, "race question (phone)");
    await page.goto("/live-arena/bang-xep-hang");
    await expect(page.locator(".ax-lb__row").first()).toBeVisible({ timeout: 10000 });
    await noHorizontalScroll(page);
    await shot(page, `phone-${viewport.width}-leaderboards`);
    await page.context().close();
  }
  // Bãi Mìn on the smallest phone: the board comes first and its cells are touch-sized
  const viewport = { width: 360, height: 640 };
  const page = await signedIn(browser, 2, { viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto("/live-arena/bai-min");
  const take = page.getByRole("button", { name: "Chuyển sang thiết bị này" });
  await expect(take.or(page.locator(".ax-board")).first()).toBeVisible({ timeout: 10000 });
  if (await take.count()) await take.tap();
  await expect(page.locator(".ax-board")).toBeVisible({ timeout: 10000 });
  await noHorizontalScroll(page);
  const cells = await Promise.all((await page.locator(".ax-cell").all()).map((c) => c.boundingBox()));
  expect(cells).toHaveLength(20);
  for (const box of cells) {
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  }
  await page.locator(".ax-cell").first().tap();
  await expect(page.locator(".ax-question:not(.is-expired)").or(page.locator(".ax-cell.is-open")).first()).toBeVisible({ timeout: 8000 });
  if (await page.locator(".ax-question:not(.is-expired)").count()) {
    for (const box of await Promise.all((await page.locator(".ax-option").all()).map((o) => o.boundingBox()))) expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  }
  await shot(page, "phone-360-minefield");
  await page.context().close();
});

test("laptop and projector: both Top 10 boards readable; ten rows fit 1920×1080", async ({ browser }) => {
  const laptop = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  await laptop.goto("/live-arena/bang-xep-hang");
  await expect(laptop.locator(".ax-lb--race .ax-lb__row")).toHaveCount(10, { timeout: 10000 });
  await noHorizontalScroll(laptop);
  await axe(laptop, "leaderboards");
  await shot(laptop, "laptop-leaderboards");
  await laptop.context().close();

  const projector = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  await projector.goto("/trinh-chieu");
  await expect(projector.locator(".ax-lb--projector")).toHaveCount(2, { timeout: 10000 });
  await expect(projector.locator(".ax-lb--minefield .ax-lb__row")).toHaveCount(10, { timeout: 10000 });
  await noHorizontalScroll(projector);
  const rows = await projector.locator(".ax-lb__row").evaluateAll((els) => els.map((e) => {
    const r = e.getBoundingClientRect();
    const name = e.querySelector(".ax-lb__name") as HTMLElement;
    return { bottom: r.bottom, nameSize: parseFloat(getComputedStyle(name).fontSize) };
  }));
  expect(rows.length).toBe(20);
  for (const r of rows) {
    expect(r.bottom).toBeLessThanOrEqual(1080); // no scrolling on the projector
    expect(r.nameSize).toBeGreaterThanOrEqual(24); // readable from the back of a classroom
  }
  await axe(projector, "projector");
  await shot(projector, "projector-1920");
  await projector.context().close();
});
