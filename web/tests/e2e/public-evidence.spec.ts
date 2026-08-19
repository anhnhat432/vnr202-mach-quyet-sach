import { expect, test } from "@playwright/test";

test("cause node and evidence claim trace back to source-backed dossier", async ({ page, isMobile }) => {
  await page.goto("/mach-nguyen-nhan");
  if (isMobile) {
    await page.getByLabel("Chọn lát cắt").selectOption("hop-nhat-de-mo-duong:decision");
  } else {
    await page.getByRole("button", { name: /Hợp nhất các tổ chức/ }).click();
  }
  await expect(page.getByRole("heading", { name: "Quan hệ" })).toBeVisible();
  await page.getByRole("link", { name: "Mở hồ sơ" }).click();
  await expect(page).toHaveURL(/\/ho-so\//);

  await page.goto("/ma-tran-bang-chung");
  await page.getByRole("button", { name: /Xem nguồn/ }).first().click();
  await expect(page.getByText(/Tác giả|Cơ quan/)).toBeVisible();
});
