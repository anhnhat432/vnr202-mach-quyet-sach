import { expect, test } from "@playwright/test";

test("visitor completes a published dossier and reaches historical comparison", async ({ page }) => {
  await page.goto("/ho-so");
  await page.getByRole("link", { name: /Hợp nhất để mở đường/ }).click();
  await page.getByRole("button", { name: "Mở phòng dữ kiện" }).click();
  const evidence = page.getByRole("checkbox", { name: /Chọn dữ kiện/ });
  await evidence.nth(0).click();
  await evidence.nth(1).click();
  await evidence.nth(2).click();
  await page.getByRole("button", { name: "Đi tới bàn quyết sách" }).click();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Phân tích hệ quả" }).click();
  await page.getByRole("button", { name: "Đối chiếu lịch sử" }).click();
  await expect(page.getByRole("heading", { name: "Lịch sử thực tế" })).toBeVisible();
});

test("visitor resumes saved dossier progress without a hydration mismatch", async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat|server rendered html|didn't match/i.test(message.text())) {
      hydrationErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    if (/hydrat|server rendered html|didn't match/i.test(error.message)) {
      hydrationErrors.push(error.message);
    }
  });

  await page.goto("/ho-so/hop-nhat-de-mo-duong");
  await page.getByRole("button", { name: "Mở phòng dữ kiện" }).click();
  await page.reload();

  await expect(page.getByRole("heading", { name: /Chọn 3 dữ kiện/ })).toBeVisible();
  expect(hydrationErrors).toEqual([]);
});
