import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("K01/K02 route, period filters, accent-insensitive search and empty state", async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on("console", message => { if (message.type() === "error" && /hydrat|didn't match/i.test(message.text())) hydrationErrors.push(message.text()); });
  await page.goto("/kien-thuc");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Dấu ấn");
  await expect(page.locator(".history-event-card")).toHaveCount(20);
  expect(hydrationErrors).toEqual([]);
  await page.getByRole("button", { name: /02 1930–1945/ }).click();
  await expect(page.locator(".history-event-card")).toHaveCount(4);
  await page.getByRole("searchbox", { name: "Tìm kiếm lịch sử" }).fill("nguyen ai quoc");
  await expect(page.locator(".history-event-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
  await page.getByRole("searchbox").fill("Điện Biên Phủ");
  await expect(page.locator(".history-event-card")).toHaveCount(1);
  await page.getByRole("searchbox").fill("dien bien phu");
  await expect(page.locator(".history-event-card")).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("searchbox")).toHaveValue("dien bien phu");
  await page.getByRole("searchbox").fill("khongtimthay123");
  await expect(page.getByRole("heading", { name: "Chưa tìm thấy dấu mốc" })).toBeVisible();
  await page.getByRole("button", { name: "Xóa bộ lọc và xem tất cả" }).click();
  await expect(page.locator(".history-event-card")).toHaveCount(20);
});

test("K03 details, keyboard focus, previous/next, recall quiz and history back", async ({ page }) => {
  await page.goto("/kien-thuc?period=1986-2021");
  const trigger = page.getByRole("button", { name: "Khám phá sự kiện: Đại hội VI: khởi xướng Đổi mới" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Đóng chi tiết sự kiện" })).toBeFocused();
  await expect(dialog.getByRole("heading", { name: "Bối cảnh / nguyên nhân" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Sự kiện trước" })).toBeDisabled();
  await page.keyboard.press("Shift+Tab");
  await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await dialog.getByRole("button", { name: "Đại hội VI", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Chính xác");
  await dialog.getByRole("button", { name: "Làm lại câu hỏi" }).click();
  await dialog.getByRole("button", { name: "Đại hội II", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Chưa đúng");
  await dialog.getByRole("button", { name: "Sự kiện tiếp theo" }).click();
  await expect(dialog.getByRole("heading", { level: 2 })).toHaveText("Việt Nam gia nhập ASEAN");
  await expect(dialog.getByRole("button", { name: /Làm lại câu hỏi/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.goBack();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: /06 1986–2021/ })).toHaveAttribute("aria-pressed", "true");
});

test("K04 deep link, image failure and invalid event recovery", async ({ page }) => {
  await page.route("**/history/ba-dinh-1945.jpg", route => route.abort());
  await page.goto("/kien-thuc?event=1945-doc-lap");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Ảnh tạm thời không tải được")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Nguồn ảnh ↗" })).toHaveAttribute("target", "_blank");
  await expect(dialog.getByText(/Chưa có video được xác minh/)).toBeVisible();
  await page.goto("/kien-thuc?event=missing-event");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText(/Sự kiện không có trong kết quả/)).toBeVisible();
  const videoResponse = await page.goto("/kien-thuc?event=1954-dien-bien");
  expect(videoResponse!.headers()["content-security-policy"]).toContain("frame-src https://www.youtube-nocookie.com");
  await expect(dialog.locator("iframe")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Tải video tư liệu" }).click();
  await expect(dialog.locator("iframe")).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/gA_s6ibM0mw");
  await dialog.getByRole("button", { name: "Video không phát? Dùng nguồn gốc" }).click();
  await expect(dialog.getByText("Video không phát được trong trang.")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Mở nguồn gốc nếu video không phát ↗" })).toBeVisible();
});

test("K05 navigation to knowledge, practice and existing games still playable", async ({ page, isMobile }) => {
  await page.goto("/live-arena");
  await page.getByRole("link", { name: "Ôn tập cùng Dấu Ấn Sử Việt →" }).click();
  await expect(page).toHaveURL(/\/kien-thuc/);
  if (isMobile) await page.getByRole("button", { name: "Điều hướng chính" }).click();
  await expect(page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Kiến thức", exact: true })).toBeVisible();
  if (isMobile) await page.getByRole("button", { name: "Điều hướng chính" }).click();
  await page.getByRole("button", { name: /Khám phá sự kiện:/ }).first().click();
  await page.getByRole("dialog").getByRole("link", { name: "Luyện tập kiến thức" }).click();
  await expect(page).toHaveURL(/dong-chay-lich-su/);
  await page.getByRole("button", { name: "Bắt đầu luyện tập" }).click();
  await expect(page.locator(".timeline-card")).toHaveCount(6);
  await page.getByRole("button", { name: "Kiểm tra thứ tự" }).click();
  await expect(page.getByRole("button", { name: "Chơi lại vòng mới" })).toBeVisible();
  await page.goto("/khoanh-khac");
  await page.getByRole("button", { name: /Chương 1/ }).click();
  await page.locator(".moment-choice").first().click();
  await expect(page.locator(".moment-verdict")).toBeVisible();
});

test("K06 responsive layout, reduced motion and basic accessibility", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/kien-thuc");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const violations = (await new AxeBuilder({ page }).analyze()).violations;
  expect(violations.filter(v => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  await page.getByRole("button", { name: /Khám phá sự kiện:/ }).first().click();
  const dialogViolations = (await new AxeBuilder({ page }).analyze()).violations;
  expect(dialogViolations.filter(v => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  await expect(page.getByRole("dialog")).toHaveCSS("animation-name", "none");
});

test("K05 crisis and projector modes still respond", async ({ page }) => {
  await page.goto("/ngan-can");
  await page.getByRole("button", { name: "Bắt đầu — Vòng 1 →" }).click();
  await expect(page.locator(".crisis-choice")).toHaveCount(3);
  await page.locator(".crisis-choice").first().click();
  await expect(page.getByRole("button", { name: "Vòng 2 →" })).toBeVisible();
  await page.goto("/gio-g");
  await page.getByRole("button", { name: /Cộng phiếu cho:/ }).first().click();
  await expect(page.locator(".giog__count")).toHaveText("1 phiếu");
  await page.getByRole("button", { name: /Lật bài/ }).click();
  await expect(page.locator(".giog__fact")).toBeVisible();
});

test("K06 tablet layout stays within viewport", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/kien-thuc?period=1930-1945");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: /Khám phá sự kiện:/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("K07 supplied textbook pages and WTO date distinction are visible", async ({ page }) => {
  for (const [eventId, pages] of [["1930-thanh-lap-dang", "61–64"], ["2007-wto", "332"], ["2021-dai-hoi-xiii", "386–387"]]) {
    await page.goto(`/kien-thuc?event=${eventId}`);
    const citation = page.getByRole("dialog").locator(".history-textbook");
    await expect(citation.getByText(`Trang in: ${pages}`, { exact: true })).toBeVisible();
    await expect(citation).toContainText("ISBN 978-604-57-6590-6");
    if (eventId === "2007-wto") {
      await expect(citation).toContainText("11/2006");
      await expect(citation).toContainText("11/01/2007");
      await expect(citation.getByRole("link", { name: "Xem hồ sơ WTO ↗" })).toHaveAttribute("rel", "noopener noreferrer");
    }
  }
});
