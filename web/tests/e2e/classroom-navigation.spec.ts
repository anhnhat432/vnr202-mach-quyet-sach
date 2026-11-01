import { expect, test } from "@playwright/test";

const publicId = "00000000-0000-4000-8000-000000000099";
const competition = { publicId, name: "[GIẢ LẬP] Kiểm tra trạng thái chờ", kind: "rehearsal", state: "open", standing: "rehearsal", startDeadlineAt: "2030-01-01T00:00:00Z" };

test("administrator sign-in is reachable from the visible account links", async ({ page }, info) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Tài khoản", exact: true }).getByRole("link", { name: "Đăng nhập quản trị", exact: true }).click();
  await expect(page).toHaveURL(/\/quan-tri\/dang-nhap$/);
  await expect(page.getByLabel("Email quản trị", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(info.project.use.viewport!.width);
  await page.screenshot({ path: info.outputPath("classroom-entry.png") });
});

test("waiting lobby discovers opening, game allows manual refresh, and no attempt starts", async ({ page }) => {
  let opened = false, starts = 0;
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { role: "student", displayName: "Người thử" } } }));
  await page.route("**/api/v1/arena/lobby", route => route.fulfill({ json: { data: { competition: opened ? competition : null, games: [] } } }));
  await page.route("**/api/v1/arena/competitions/**/attempt", route => { starts += 1; return route.abort(); });
  await page.goto("/live-arena");
  await expect(page.getByText(/Đang chờ giảng viên mở cuộc thi/)).toBeVisible();
  opened = true;
  await expect(page.getByText(competition.name, { exact: true })).toBeVisible({ timeout: 15000 });
  opened = false;
  await page.goto("/live-arena/duong-dua");
  await expect(page.getByRole("heading", { name: "Chưa có cuộc thi đang mở", exact: true })).toBeVisible();
  opened = true;
  await page.getByRole("button", { name: "Kiểm tra lại", exact: true }).click();
  await expect(page.getByRole("button", { name: /Bắt đầu/ })).toBeEnabled();
  expect(starts).toBe(0);
});

test("projector shows an explicit waiting state and picks up opening", async ({ page }, info) => {
  let opened = false;
  await page.route("**/api/v1/arena/competitions/current", route => route.fulfill({ json: { data: opened ? competition : null } }));
  await page.route("**/api/v1/arena/leaderboards/**", route => route.fulfill({ json: { data: { version: 0, players: 0, completed: 0, standing: "rehearsal", entries: [] } } }));
  await page.goto("/trinh-chieu?game=minefield");
  await expect(page.getByText("Đang chờ giảng viên mở cuộc thi.", { exact: true })).toBeVisible();
  opened = true;
  await expect(page.getByText(competition.name, { exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Hai bảng", exact: true }).click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(info.project.use.viewport!.width);
  await page.screenshot({ path: info.outputPath("classroom-projector.png") });
});
