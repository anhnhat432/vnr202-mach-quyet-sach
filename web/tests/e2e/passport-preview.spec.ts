import { expect, test } from "@playwright/test";

// Synthetic responses exercise the layout without connecting to hosted student data.
test("Passport renders a private profile, progress markers and official history", async ({ page }, info) => {
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    const data = url.endsWith("/me")
      ? { role: "student", fullName: "Sinh viên kiểm thử", displayName: "Thử S.V.", studentId: "TEST001", className: "Lớp kiểm thử" }
      : url.endsWith("/passport/progress")
        ? [{ dossier_id: "20000000-0000-0000-0000-000000000002", completed_at: "2026-01-01T00:00:00Z", state: { stage: "connections" } }]
        : [{ attemptId: "synthetic", game: "minefield", state: "completed", score: 1200, mainCorrect: 7, mainTotal: 10, hardCorrect: 2, completionDurationMs: 83000, rank: 4, competition: { id: "test", name: "Cuộc thi kiểm thử", kind: "official", standing: "official" }, reviewAvailable: true }];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data }) });
  });
  await page.goto("/passport");
  await expect(page.getByText("Sinh viên kiểm thử")).toBeVisible();
  await expect(page.getByText(/Hợp nhất để mở đường.*Đã hoàn thành/)).toBeVisible();
  await expect(page.getByText(/Hạng 4/)).toBeVisible();
  if (process.env.PASSPORT_SCREENSHOT && info.project.name === "desktop-chromium") await page.screenshot({ path: process.env.PASSPORT_SCREENSHOT, fullPage: true, animations: "disabled" });
});
