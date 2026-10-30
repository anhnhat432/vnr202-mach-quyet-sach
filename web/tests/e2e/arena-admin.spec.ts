import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

import { generateFixtures } from "../../../scripts/lib/question-bank.mjs";
import { deriveProviderPassword } from "../../src/features/auth/domain/provider-password";
import { env, ready } from "./arena-world";

// Stage F5 acceptance: an administrator creates and runs a rehearsal from the admin screen, watches the
// player, cannot finalize while an attempt is running, finalizes once it ends; the student then sees
// the answers of the questions they saw (and only then).
test.skip(!ready, "needs the local stack and server secrets");
test.describe.configure({ mode: "serial" });

const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`.toUpperCase();
const adminEmail = `adm-ui-${run.toLowerCase()}@test.invalid`;
const adminPassword = `Adm-${crypto.randomUUID()}`;
const studentId = `ZZA${run}`;
const name = `Diễn tập UI ${run}`;
let adminId = "";
let studentUserId = "";

test.beforeAll(async () => {
  const svc = createClient(env.url!, env.serviceKey!, { auth: { persistSession: false } });
  const pool = new Pool({ connectionString: env.dbUrl!, max: 1 });
  await pool.query("update public.competitions set state = 'start_closed' where state = 'open'");
  const { rows } = await pool.query("select count(*)::int as n from public.questions where origin = 'fixture'");
  if (!rows[0].n) {
    const fixtures = generateFixtures("dev87", { keyPrefix: `adm${run.toLowerCase()}` });
    const { data: qs } = await svc.from("questions").insert(fixtures.map((q) => ({ external_key: q.key, game_type: q.game, pool: q.pool, chapter: q.chapter, topic: q.topic, question_type: q.type, option_count: q.options.length, difficulty: q.difficulty, origin: "fixture" }))).select("id, external_key");
    const ids = new Map(qs!.map((r) => [r.external_key, r.id]));
    await svc.from("question_versions").insert(fixtures.map((q) => ({ question_id: ids.get(q.key), version: 1, status: "published", content_public: { prompt: q.prompt, options: q.options }, content_private: { correctOptionId: q.correctOptionId, explanation: q.explanation } })));
  }
  await pool.end();
  const a = await svc.auth.admin.createUser({ email: adminEmail, password: adminPassword, email_confirm: true, app_metadata: { role: "admin" } });
  adminId = a.data.user!.id;
  await svc.from("profiles").insert({ id: adminId, role: "admin", full_name: "Admin UI", display_name: "Admin UI" });
  const email = `${crypto.randomUUID()}@auth.invalid`;
  const s = await svc.auth.admin.createUser({ email, password: deriveProviderPassword(env.pepper!, studentId, env.defaultPassword!), email_confirm: true, app_metadata: { role: "student" } });
  studentUserId = s.data.user!.id;
  await svc.from("profiles").insert({ id: studentUserId, role: "student", student_id: studentId, full_name: "Họ Tên Admin Test", display_name: "Quân T.M." });
  await svc.from("student_auth_identities").insert({ profile_id: studentUserId, internal_email: email });
});

test.afterAll(async () => {
  const svc = createClient(env.url!, env.serviceKey!, { auth: { persistSession: false } });
  const pool = new Pool({ connectionString: env.dbUrl!, max: 1 });
  const { rows } = await pool.query("select id from public.competitions where name = $1", [name]);
  for (const r of rows) {
    await pool.query("delete from public.audit_logs where target_type = 'attempt' and target_id in (select id::text from public.attempts where competition_id = $1)", [r.id]);
    await pool.query("delete from public.question_exposures where competition_id = $1", [r.id]);
    await pool.query("delete from public.audit_logs where target_id = $1", [r.id]);
    await pool.query("delete from public.competitions where id = $1", [r.id]);
  }
  await pool.query("delete from public.auth_events where profile_id = any($1::uuid[])", [[adminId, studentUserId].filter(Boolean)]);
  await pool.end();
  if (studentUserId) await svc.auth.admin.deleteUser(studentUserId);
  if (adminId) await svc.auth.admin.deleteUser(adminId);
});

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "one competition can be open at a time");
});

async function correctIndex(page: Page) {
  const prompt = (await page.textContent(".ax-question__prompt")) ?? "";
  const letter = prompt.match(/đáp án ([A-C])/)?.[1];
  const labels = await page.$$eval(".ax-option span", (spans) => spans.map((s) => s.textContent?.trim()));
  return Math.max(0, labels.indexOf(`Đáp án ${letter}`));
}

test("admin runs a rehearsal end to end; the student reviews answers only after Finalized", async ({ page, browser }) => {
  test.setTimeout(120_000);
  // --- admin creates, schedules and opens --------------------------------------------------------
  await page.goto("/quan-tri/cuoc-thi");
  await page.waitForURL("**/quan-tri/dang-nhap");
  await page.fill("input[name=email]", adminEmail);
  await page.fill("input[name=password]", adminPassword);
  await page.click("button[type=submit]");
  await page.waitForURL("**/quan-tri/cuoc-thi");
  await page.getByLabel("Tên").fill(name);
  await page.getByRole("button", { name: "Tạo (Nháp)" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.getByRole("button", { name: /lên lịch/ }).click();
  await page.getByRole("button", { name: "Mở cuộc thi" }).click();
  await expect(page.getByText(/Đang mở · nhãn bảng: Diễn tập/)).toBeVisible();

  // --- the student plays the whole race ------------------------------------------------------------
  const student = await (await browser.newContext()).newPage();
  await student.goto("/dang-nhap");
  await student.fill("input[name=studentId]", studentId);
  await student.fill("input[name=password]", env.defaultPassword!);
  await student.click("button[type=submit]");
  await student.waitForURL("**/live-arena");
  await student.goto("/live-arena/duong-dua");
  await student.getByRole("button", { name: "Bắt đầu lượt thi" }).click();

  // the admin sees the player live, with MSSV (admin only), and cannot finalize a running attempt
  const row = page.locator(".adm__monitor tbody tr", { hasText: studentId });
  await expect(row).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Đóng nhận lượt mới" }).click();
  await page.getByRole("button", { name: "Chuyển sang chốt kết quả" }).click();
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: /Kết thúc & công bố/ }).click();
  await expect(page.getByText(/attempts_still_active/)).toBeVisible();

  // The race clock runs while the admin acts above (a slow first compile can expire a 5 s question):
  // answer every question still open and let the server time out the others.
  const done = student.getByText(/Hoàn thành!|Hết giờ!/);
  const open = student.locator(".ax-question:not(.is-expired)");
  let answered = "";
  for (let step = 0; step < 60 && !(await done.count()); step += 1) {
    await expect(open.or(done).first()).toBeVisible({ timeout: 15000 });
    if (await done.count()) break;
    const chip = (await open.locator(".ax-chip").textContent().catch(() => null)) ?? "";
    if (!chip || chip === answered) { await student.waitForTimeout(150); continue; }
    answered = chip;
    await student.locator(".ax-option").nth(await correctIndex(student)).click().catch(() => undefined);
  }
  await expect(student.getByText("Hoàn thành!")).toBeVisible({ timeout: 10000 });
  await student.goto("/live-arena/xem-lai");
  await expect(student.getByText("Đáp án mở sau khi cuộc thi kết thúc")).toBeVisible();

  // incident handling (LA-ADMIN-003), after the run so the race clock is not held up: a reason is required,
  // voiding needs an explicit confirmation, everything lands in the audit log; no score or clock editing
  await row.getByRole("button", { name: "Xử lý" }).click();
  const panel = page.getByRole("form", { name: /Xử lý sự cố/ });
  await panel.getByLabel("Vô hiệu lượt thi").check();
  await panel.getByLabel("Lý do (bắt buộc)").fill("Thử xác nhận");
  await expect(panel.getByRole("button", { name: "Vô hiệu lượt thi" })).toBeDisabled();
  await expect(panel.getByText(/không thể hoàn tác và không tạo lượt thay thế/)).toBeVisible();
  await panel.getByLabel("Ghi chú sự cố").check();
  await panel.getByLabel("Lý do (bắt buộc)").fill("Máy 12 mất mạng 30 giây");
  await panel.getByRole("button", { name: "Ghi chú sự cố" }).click();
  await expect(row.getByText(/1 ghi nhận/)).toBeVisible({ timeout: 10000 });
  await page.getByText(/Nhật ký thao tác/).click();
  await expect(page.locator(".adm__audit li", { hasText: "attempt.note" })).toContainText("Máy 12 mất mạng 30 giây");
  // lock then unlock reuse the stage B account actions (sessions are revoked on lock)
  await row.getByRole("button", { name: "Xử lý" }).click();
  await panel.getByLabel("Khóa tài khoản").check();
  await panel.getByLabel("Lý do (bắt buộc)").fill("Nghi lộ mật khẩu");
  await panel.getByRole("checkbox").check();
  await panel.getByRole("button", { name: "Khóa tài khoản" }).click();
  await expect(row.getByText("TK bị khóa")).toBeVisible({ timeout: 10000 });
  await student.reload();
  await expect(student.getByText("để xem lượt thi của bạn")).toBeVisible({ timeout: 10000 }); // signed out everywhere
  await row.getByRole("button", { name: "Xử lý" }).click();
  await panel.getByLabel("Mở khóa tài khoản").check();
  await panel.getByLabel("Lý do (bắt buộc)").fill("Đã đổi mật khẩu");
  await panel.getByRole("button", { name: "Mở khóa tài khoản" }).click();
  await expect(row.getByText("TK bị khóa")).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator(".adm__audit li", { hasText: "attempt.lock_account" })).toBeVisible();
  await expect(page.locator(".adm__audit li", { hasText: "account.set_status" }).first()).toBeVisible();

  // --- finalize, then the review opens -------------------------------------------------------------
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: /Kết thúc & công bố/ }).click();
  await expect(page.getByText(/Đã kết thúc · nhãn bảng: Diễn tập/)).toBeVisible({ timeout: 10000 });
  await student.goto("/dang-nhap");
  await student.fill("input[name=studentId]", studentId);
  await student.fill("input[name=password]", env.defaultPassword!);
  await student.click("button[type=submit]");
  await student.waitForURL("**/live-arena");
  await student.goto("/live-arena/xem-lai");
  await student.getByRole("button", { name: "Xem lại đáp án" }).click();
  await expect(student.locator(".rev__q")).toHaveCount(15);
  await expect(student.getByText("✓ đáp án đúng").first()).toBeVisible();

  // --- question bank screen is admin-only and lists fixtures as such --------------------------------
  await page.goto("/quan-tri/ngan-hang-cau-hoi");
  await page.getByLabel("Nguồn").selectOption("fixture");
  await expect(page.locator(".adm__questions > li").first()).toBeVisible();
  await expect(page.locator(".adm__ai", { hasText: "GIẢ LẬP" }).first()).toBeVisible();
  await student.goto("/quan-tri/ngan-hang-cau-hoi");
  await student.waitForURL("**/quan-tri/dang-nhap");
});
