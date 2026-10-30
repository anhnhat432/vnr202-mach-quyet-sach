import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("homepage identifies the product and has no serious axe violations", async ({ page }) => {
  // Scan the settled page. The cold-open fades text in over a near-identical background for a moment,
  // and axe reads that frame as a 1.02:1 contrast failure. The product honours reduced motion
  // (UX-AC-011), which renders the final state immediately and makes the scan deterministic.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  // The landing opens on the "Ngàn cân treo sợi tóc" cold-open, so the product identity lives in the
  // document title and the header brand, while the page still has exactly one non-empty h1.
  await expect(page).toHaveTitle(/Mạch Quyết Sách/);
  await expect(page.getByRole("link", { name: "VNR202 Mạch Quyết Sách - Trang chủ" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).not.toBeEmpty();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
});

test("homepage sends the public-preview browser security policy", async ({ page }) => {
  const response = await page.goto("/");
  expect(response).not.toBeNull();

  const headers = response!.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
});
