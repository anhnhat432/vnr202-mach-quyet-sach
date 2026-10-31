import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Academic transitions are exercised only on synthetic questions in an isolated local stack.
// Never let an accidentally inherited hosted URL turn this test into a real-bank operation.
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const local = !!url && ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname);
test.skip(!local || !serviceKey, "requires an isolated local Supabase stack");
const admin = createClient(url ?? "http://test.invalid", serviceKey ?? "test-only", { auth: { persistSession: false } });
const run = `${Date.now().toString(36)}${crypto.randomUUID().slice(0, 8)}`;
const email = `bulk-admin-${run}@test.invalid`;
const password = `Test-only-${crypto.randomUUID()}`;
const keys = [1, 2, 3].map((index) => `bulk-${run}-${index}`);
const versionIds: string[] = [];
let adminId = "";

test.beforeAll(async () => {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: "admin" } });
  if (created.error || !created.data.user) throw new Error("Could not create isolated test administrator");
  adminId = created.data.user.id;
  const profile = await admin.from("profiles").insert({ id: adminId, role: "admin", full_name: "Bulk Test", display_name: "Bulk Test" });
  if (profile.error) throw new Error("Could not create isolated test profile");
});

test.afterAll(async () => {
  await admin.from("questions").delete().in("external_key", keys);
  if (adminId) await admin.auth.admin.deleteUser(adminId);
});

test("a human can confirm a shared-note group then separately publish it, with per-version audit", async ({ page }, testInfo) => {
  const origin = "http://127.0.0.1:3000";
  const signIn = await page.request.post("/api/v1/auth/admin-sign-in", { headers: { origin }, data: { email, password } });
  expect(signIn.status()).toBe(200);
  const csrf = (await signIn.json()).data.csrfToken as string;
  for (const key of keys) {
    const created = await page.request.post("/api/v1/admin/questions", {
      headers: { origin, "x-csrf-token": csrf },
      data: {
        key, game: "race", pool: "race", chapter: "chapter_3", topic: "Synthetic bulk test", type: "single_choice", difficulty: "easy",
        prompt: `[KIỂM THỬ] Câu ${key.slice(-1)} chọn một?`, options: [{ id: "a", label: "Một" }, { id: "b", label: "Hai" }, { id: "c", label: "Ba" }],
        correctOptionId: "a", explanation: "Nội dung giả lập, không phải kiến thức lịch sử.", aiAssisted: true,
        sources: [{ sourceId: "10000000-0000-0000-0000-000000000001", locator: "tr. 5 (kiểm thử)" }],
      },
    });
    expect(created.status()).toBe(201);
    versionIds.push((await created.json()).data.versionId as string);
  }
  await page.goto("/quan-tri/ngan-hang-cau-hoi");
  for (const key of keys) await page.getByRole("checkbox", { name: `Chọn câu ${key} phiên bản 1`, exact: true }).check();
  await page.getByRole("button", { name: "Duyệt đã chọn (3)", exact: true }).click();
  const confirm = page.getByRole("button", { name: "Xác nhận duyệt 3 câu", exact: true });
  await expect(confirm).toBeDisabled();
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  const before = await admin.from("question_versions").select("status").in("id", versionIds);
  expect(before.data?.every((version) => version.status === "draft")).toBe(true);

  await page.getByRole("button", { name: "Duyệt đã chọn (3)", exact: true }).click();
  await page.getByLabel("Ghi chú học thuật chung", { exact: true }).fill("Đã đối chiếu nhóm giả lập, tr. 5.");
  await page.getByRole("checkbox", { name: /Tôi đã đối chiếu đáp án/ }).check();
  await page.screenshot({ path: testInfo.outputPath("question-bank-bulk-confirmation.png") });
  await confirm.click();
  await expect(page.getByText("Đã xử lý: 3 thành công · 0 lỗi · 0 chưa rõ · 0 chưa gửi.", { exact: true })).toBeVisible();
  const reviewed = await admin.from("question_versions").select("status, reviewed_by, review_note, published_by").in("id", versionIds);
  expect(reviewed.data).toHaveLength(3);
  for (const version of reviewed.data ?? []) expect(version).toMatchObject({ status: "reviewed", reviewed_by: adminId, review_note: "Đã đối chiếu nhóm giả lập, tr. 5.", published_by: null });

  for (const key of keys) await page.getByRole("checkbox", { name: `Chọn câu ${key} phiên bản 1`, exact: true }).check();
  await page.getByRole("button", { name: "Xuất bản đã chọn (3)", exact: true }).click();
  await page.getByRole("button", { name: "Xác nhận xuất bản 3 câu", exact: true }).click();
  await expect(page.getByRole("button", { name: "Xuất bản đã chọn (0)", exact: true })).toBeDisabled();
  const published = await admin.from("question_versions").select("status, published_by").in("id", versionIds);
  expect(published.data).toHaveLength(3);
  for (const version of published.data ?? []) expect(version).toMatchObject({ status: "published", published_by: adminId });
  const audit = await admin.from("audit_logs").select("action, target_id").eq("actor_profile_id", adminId).in("target_id", versionIds);
  expect(audit.error).toBeNull();
  for (const id of versionIds) {
    expect(audit.data?.filter((entry) => entry.target_id === id).map((entry) => entry.action)).toEqual(expect.arrayContaining(["question.review", "question.publish"]));
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("question-bank-bulk-results.png") });
});
