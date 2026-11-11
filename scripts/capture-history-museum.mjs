import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";
const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(path.join(root, "web/package.json"));
const { chromium } = require("@playwright/test");
const base = process.argv[2] ?? "http://127.0.0.1:3002";
const output = path.join(root, "docs/sdd/evidence/history/museum");
fs.mkdirSync(output, { recursive: true });
const chunksDir = path.join(root, "web/.next/static/chunks");
const threeChunks = fs.readdirSync(chunksDir).filter(file => file.endsWith(".js") && fs.readFileSync(path.join(chunksDir, file), "utf8").includes("THREE.WebGLRenderer"));
const chunkSizes = threeChunks.map(file => {
  const data = fs.readFileSync(path.join(chunksDir, file));
  return { file, bytes: data.length, gzipBytes: zlib.gzipSync(data).length };
});
const browser = await chromium.launch();
const report = { mode: "local production, unthrottled single samples; not field Core Web Vitals", threeChunks: chunkSizes, viewports: [] };
try {
  for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      window.museumMetrics = { lcp: null, cls: 0, maxEventDuration: null };
      for (const type of ["largest-contentful-paint", "layout-shift", "event"]) {
        try { new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (type === "largest-contentful-paint") window.museumMetrics.lcp = entry.startTime;
            if (type === "layout-shift" && !entry.hadRecentInput) window.museumMetrics.cls += entry.value;
            if (type === "event") window.museumMetrics.maxEventDuration = Math.max(window.museumMetrics.maxEventDuration ?? 0, entry.duration);
          }
        }).observe({ type, buffered: true, ...(type === "event" ? { durationThreshold: 16 } : {}) }); } catch { /* Browser may not support a metric. */ }
      }
    });
    await page.goto(`${base}/live-arena/dong-chay-lich-su`);
    await page.getByRole("button", { name: "Bắt đầu luyện tập" }).click();
    const gameResources = await page.evaluate(() => performance.getEntriesByType("resource").map(r => r.name));
    const gameLoadedThree = threeChunks.some(file => gameResources.some(url => url.includes(file)));
    if (gameLoadedThree) throw new Error("Game route loaded the globe renderer");
    const response = await page.goto(`${base}/kien-thuc`);
    await page.evaluate(() => document.fonts.ready);
    await page.locator("#ban-do-ky-uc").scrollIntoViewIfNeeded();
    await page.getByText("Địa cầu sẵn sàng", { exact: false }).waitFor();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: path.join(output, `${name}-entry.png`) });
    await page.locator("#ban-do-ky-uc").scrollIntoViewIfNeeded();
    await page.locator(".museum-place-list").getByRole("button", { name: /^Paris/ }).click();
    await page.getByRole("button", { name: "Chọn địa điểm Paris", exact: true }).waitFor({ state: "visible" });
    await page.screenshot({ path: path.join(output, `${name}-globe.png`) });
    const globeLoaded = await page.evaluate(() => performance.getEntriesByType("resource").map(r => r.name));
    const metrics = await page.evaluate(() => window.museumMetrics);
    await page.locator("#rap-ky-uc").scrollIntoViewIfNeeded();
    await page.locator("#rap-ky-uc img").evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
    await page.screenshot({ path: path.join(output, `${name}-theater.png`) });
    await page.locator(".museum-comparison").scrollIntoViewIfNeeded();
    await page.locator(".museum-compare-stage img").evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
    await page.screenshot({ path: path.join(output, `${name}-comparison.png`) });
    await page.goto(`${base}/kien-thuc?event=1954-dien-bien`);
    await page.getByRole("button", { name: "Xem diễn biến trên bản đồ" }).click();
    await page.locator(".museum-campaign").getByRole("button", { name: /Đợt 1 ·/ }).click();
    await page.screenshot({ path: path.join(output, `${name}-campaign.png`) });
    report.viewports.push({ name, width, height, status: response.status(), overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), gameLoadedThree, museumLoadedThree: threeChunks.some(file => globeLoaded.some(url => url.includes(file))), metrics, errors });
    await page.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(output, "production-check.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
