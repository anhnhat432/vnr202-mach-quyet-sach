import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("homepage identifies the product and has no serious axe violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Mạch Quyết Sách");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
});
