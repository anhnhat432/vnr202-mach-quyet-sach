import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(path.join(root, "web/package.json"));
const { chromium } = require("@playwright/test");
const base = process.argv[2] ?? "http://127.0.0.1:3000";
const output = path.join(root, "docs/sdd/evidence/history");
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const evidence = [];
try {
  for (const [name, width, height] of [["desktop", 1440, 1000], ["tablet", 768, 1024], ["mobile", 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    const response = await page.goto(`${base}/kien-thuc?period=1930-1945`);
    await page.evaluate(() => document.fonts.ready);
    // Wait for an actual hydrated interaction before screenshot() temporarily
    // hides input carets, so React never sees screenshot-only inline styles.
    await page.getByRole("button", { name: /Khám phá sự kiện:/ }).first().click();
    await page.keyboard.press("Escape");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: path.join(output, `${name}.png`) });
    await page.locator("#history-timeline-title").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `${name}-timeline.png`) });
    await page.getByRole("button", { name: /Khám phá sự kiện:/ }).first().click();
    await page.screenshot({ path: path.join(output, `${name}-detail.png`) });
    evidence.push({ viewport: name, width, height, status: response.status(), overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), errors });
    await page.close();
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(output, "visual-check.json"), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence));
