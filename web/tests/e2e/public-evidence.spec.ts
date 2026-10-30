import { expect, test } from "@playwright/test";

// UX-AC-004/005: pick a historical case in the cause map, read the six-layer chain with its
// relations and explanations, open the dossier, then trace a claim to its source in the matrix.
// The cause map is a tab list of cases (same on desktop and mobile) since the chain rebuild.
test("cause map case opens its dossier and an evidence claim traces back to its source", async ({ page }) => {
  await page.goto("/mach-nguyen-nhan");

  const tab = page.getByRole("tab", { name: /Hợp nhất để mở đường/ });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");

  const chain = page.getByRole("list", { name: /Chuỗi nhân quả: Hợp nhất để mở đường/ });
  await expect(chain.getByRole("listitem")).toHaveCount(6); // context, contradiction, force, decision, result, lesson
  await expect(chain.getByText("Quyết sách", { exact: true })).toBeVisible();
  await expect(chain.locator(".cause-step__rel")).toHaveCount(5); // a relation leads into each later layer
  for (const explanation of await chain.locator(".cause-step__text").allTextContents()) expect(explanation.trim().length).toBeGreaterThan(10);

  await page.getByRole("link", { name: /Mở hồ sơ đầy đủ/ }).click();
  await expect(page).toHaveURL(/\/ho-so\/hop-nhat-de-mo-duong$/);

  await page.goto("/ma-tran-bang-chung");
  await page.getByRole("button", { name: /Xem nguồn/ }).first().click();
  await expect(page.getByText(/Cơ quan \/ Tác giả/)).toBeVisible();
});
