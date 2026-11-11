import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("M01 live globe, camera, keyboard and rapid place selection", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/kien-thuc");
  await page.locator("#ban-do-ky-uc").scrollIntoViewIfNeeded();
  await expect(page.getByText("Địa cầu sẵn sàng", { exact: false })).toBeVisible();
  await expect(page.locator(".museum-globe canvas")).toBeVisible();
  await page.getByRole("button", { name: "Phóng to địa cầu" }).click();
  await page.getByRole("button", { name: "Thu nhỏ địa cầu" }).click();
  const globe = page.getByRole("group", { name: "Địa cầu 3D tương tác" });
  await globe.focus(); await page.keyboard.press("ArrowLeft"); await page.keyboard.press("+");
  const bounds = await globe.boundingBox();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down(); await page.mouse.move(bounds!.x + bounds!.width / 2 + 70, bounds!.y + bounds!.height / 2, { steps: 8 }); await page.mouse.up();
  const places = page.locator(".museum-place-list");
  await places.getByRole("button", { name: /^Paris/ }).click();
  await places.getByRole("button", { name: /^Tours/ }).click();
  await places.getByRole("button", { name: /^Paris/ }).click();
  await expect(page.locator(".museum-place-detail h3")).toHaveText("Paris");
  await expect(page.getByRole("button", { name: "Chọn địa điểm Paris", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Chọn địa điểm Paris", exact: true }).click();
  await page.locator(".museum-place-detail").getByRole("button", { name: /Hiệp định Paris/ }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { level: 2 })).toHaveText("Hiệp định Paris");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Góc nhìn ban đầu" }).click();
  await expect(page.locator(".museum-globe canvas")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("M02 synchronized interval/place/topic filters survive reload", async ({ page }) => {
  await page.goto("/kien-thuc");
  await page.getByLabel("Địa điểm", { exact: true }).selectOption("paris");
  await page.getByLabel("Chủ đề", { exact: true }).selectOption("ngoai-giao");
  await page.getByLabel("Từ năm", { exact: true }).selectOption("1970");
  await page.getByLabel("Đến năm", { exact: true }).selectOption("1975");
  await expect(page.locator(".history-event-card")).toHaveCount(1);
  await expect(page.locator(".museum-place-list button")).toHaveCount(1);
  await page.reload();
  await expect(page.getByLabel("Địa điểm", { exact: true })).toHaveValue("paris");
  await expect(page.getByLabel("Từ năm", { exact: true })).toHaveValue("1970");
  await page.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
  await page.getByRole("slider", { name: "Chọn năm trên thanh thời gian" }).fill("1954");
  await expect(page.locator(".history-event-card")).toHaveCount(1);
  await expect(page.locator(".museum-place-list button")).toHaveCount(1);
  await page.getByRole("searchbox").fill("khongco");
  await expect(page.locator(".museum-place-list button")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Chưa tìm thấy dấu mốc" })).toBeVisible();
});

test("M03 complete campaign phases, overview, keyboard and source", async ({ page }) => {
  await page.goto("/kien-thuc?event=1954-dien-bien");
  const map = page.getByRole("region", { name: "Bản đồ chiến dịch Điện Biên Phủ" });
  await page.getByRole("button", { name: "Xem diễn biến trên bản đồ" }).click();
  await expect(map.getByRole("img")).toBeVisible();
  await map.getByRole("button", { name: /Đợt 1 ·/ }).click();
  await expect(map.locator(".museum-phase")).toContainText("Him Lam");
  await map.getByRole("button", { name: "Đợt tiếp →" }).click();
  await expect(map.locator(".museum-phase")).toContainText("sân bay Mường Thanh");
  await map.getByRole("button", { name: "Đợt tiếp →" }).click();
  await expect(map.locator(".museum-phase")).toContainText("De Castries");
  await expect(map.getByRole("button", { name: "Đợt tiếp →" })).toBeDisabled();
  await map.getByRole("button", { name: "← Đợt trước" }).click();
  await map.getByRole("button", { name: "Toàn cảnh chiến dịch" }).focus(); await page.keyboard.press("Enter");
  await expect(map.locator(".museum-phase h4")).toHaveText("Ba đợt tiến công");
  await expect(map.getByRole("link", { name: "CC BY-SA 3.0" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Sự kiện tiếp theo" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Xem trên địa cầu" }).click();
  await expect(page.locator(".museum-place-list").getByRole("button", { name: /^Bến Tre/ })).toHaveAttribute("aria-pressed", "true");
});

test("M04 theater types, opt-in film and fallback", async ({ page }) => {
  await page.goto("/kien-thuc");
  const theater = page.locator("#rap-ky-uc");
  await theater.scrollIntoViewIfNeeded();
  await expect(theater.locator(".history-photo")).toHaveCount(2);
  await theater.getByRole("button", { name: "Phim tái hiện", exact: true }).click();
  await expect(theater.getByText(/chưa xác minh đủ URL/)).toBeVisible();
  await theater.getByRole("button", { name: "Phóng sự & phim tài liệu" }).click();
  await theater.getByRole("button", { name: "Chọn xem phóng sự" }).click();
  await expect(theater.locator("iframe")).toHaveCount(0);
  await theater.getByRole("button", { name: "Tải video tư liệu" }).click();
  await expect(theater.locator("iframe")).toHaveAttribute("src", /youtube-nocookie.com\/embed\//);
  await theater.getByRole("button", { name: "Video không phát? Dùng nguồn gốc" }).click();
  await expect(theater.getByText("Video không phát được trong trang.")).toBeVisible();
  await expect(theater.getByRole("link", { name: /Mở nguồn gốc/ })).toBeVisible();
});

test("M05 comparison keyboard/reset, same-place disclosure, image failure", async ({ page, isMobile }) => {
  await page.goto("/kien-thuc");
  const comparison = page.locator(".museum-comparison");
  const slider = comparison.getByRole("slider");
  await slider.scrollIntoViewIfNeeded();
  await slider.focus(); await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveValue("51");
  const box = await slider.boundingBox();
  if (isMobile) await page.touchscreen.tap(box!.x + box!.width * .25, box!.y + box!.height / 2);
  else await page.mouse.click(box!.x + box!.width * .25, box!.y + box!.height / 2);
  await expect.poll(async () => Number(await slider.inputValue())).toBeLessThan(50);
  await slider.fill("15");
  await expect(comparison.locator(".museum-compare-before")).toHaveCSS("clip-path", "inset(0px 85% 0px 0px)");
  await comparison.getByRole("button", { name: "Đặt lại 50%" }).click();
  await expect(slider).toHaveValue("50");
  await expect(comparison.getByText(/khác góc máy/)).toBeVisible();
  const failedPage = await page.context().newPage();
  await failedPage.route("**/history/ba-dinh-2008.jpg", route => route.abort());
  await failedPage.goto("/kien-thuc");
  const failedComparison = failedPage.locator(".museum-comparison");
  await failedComparison.scrollIntoViewIfNeeded();
  await expect(failedComparison.getByRole("status")).toContainText("Ảnh so sánh tạm thời không tải được");
  await expect(failedComparison.getByRole("link", { name: /CC BY 4.0/ })).toBeVisible();
  await failedPage.close();
});

test("M06 challenge reuses quiz and returns to exact filtered event", async ({ page }) => {
  await page.goto("/kien-thuc?period=1986-2021&event=1986-doi-moi&from=1986&to=1990");
  await page.getByRole("dialog").getByRole("link", { name: "Thử thách kiến thức ↗" }).click();
  await expect(page).toHaveURL(/\/kien-thuc\/thu-thach\?/);
  await page.getByRole("button", { name: "Đại hội VI", exact: true }).click();
  await expect(page.locator(".history-quiz").getByRole("status")).toContainText("Chính xác");
  await page.getByRole("link", { name: "← Quay lại đúng sự kiện vừa học" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { level: 2 })).toHaveText("Đại hội VI: khởi xướng Đổi mới");
  await expect(page).toHaveURL(/from=1986&to=1990/);
  await page.goto("/kien-thuc/thu-thach?event=1986-doi-moi&return=https://example.com");
  await expect(page.getByRole("link", { name: "← Quay lại đúng sự kiện vừa học" })).toHaveAttribute("href", "/kien-thuc?event=1986-doi-moi");
});

test("M07 no WebGL and lost context keep exploration usable", async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof getContext>) {
      if (String(args[0]).startsWith("webgl")) return null;
      return getContext.apply(this, args);
    } as typeof getContext;
  });
  await page.goto("/kien-thuc");
  await page.locator("#ban-do-ky-uc").scrollIntoViewIfNeeded();
  await expect(page.getByText(/Không gian 3D không khả dụng/)).toBeVisible();
  await page.locator(".museum-place-list").getByRole("button", { name: /^Paris/ }).click();
  await page.locator(".museum-place-detail").getByRole("button", { name: /Hiệp định Paris/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("M07 context loss, reduced motion, layout and axe", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/kien-thuc");
  await page.locator("#ban-do-ky-uc").scrollIntoViewIfNeeded();
  await expect(page.locator(".museum-globe canvas")).toBeVisible();
  await page.locator(".museum-globe canvas").evaluate(canvas => canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })));
  await expect(page.getByText(/Không gian 3D không khả dụng/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter(v => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  await page.getByRole("button", { name: "Thử tải địa cầu 3D" }).click();
  await expect(page.locator(".museum-globe canvas")).toBeVisible();
});

test("M07 slow/missing terrain never blocks timeline or location exploration", async ({ page }) => {
  let release: (() => void) | undefined;
  await page.route("**/history/land-110m.json", async route => {
    await new Promise<void>(resolve => { release = resolve; });
    await route.abort();
  });
  await page.goto("/kien-thuc");
  await page.locator("#ban-do-ky-uc").scrollIntoViewIfNeeded();
  await expect(page.locator(".history-event-card")).toHaveCount(20);
  await page.locator(".museum-place-list").getByRole("button", { name: /^Tours/ }).click();
  await expect(page.locator(".museum-place-detail")).toContainText("Nguyễn Ái Quốc tại Đại hội Tours");
  await expect.poll(() => typeof release).toBe("function");
  release!();
  await expect(page.getByText(/Không gian 3D không khả dụng/)).toBeVisible();
  await page.locator(".museum-place-detail").getByRole("button").click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
