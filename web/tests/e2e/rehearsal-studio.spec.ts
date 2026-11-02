import fs from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

import { deriveProviderPassword } from "../../src/features/auth/domain/provider-password";
import { env, ready } from "./arena-world";

// End-to-end verification of the Admin Control Center & Closed-Loop Rehearsal Studio on the isolated
// Supabase stack:
// 1. RBAC (401 unauthenticated, 404 non-disclosure for student), CSRF (403 csrf_failed), invalid-state reset/close.
// 2. Network error handling & "Thử lại" retry recovery + Sandbox DB isolation badge.
// 3. Provision rehearsal accounts (THU prefix) -> verify is_rehearsal=true & excluded from class roster.
// 4. Open rehearsal round -> verify question snapshots strictly use origin='fixture' (never 'bank').
// 5. Sign in as THU account -> play both Đường Đua and Bãi Mìn -> verify both leaderboards & results.
// 6. Capture live Desktop & Mobile screenshots directly from the real stack.
// 7. Click "Chơi thử lại (Vòng diễn tập mới)" -> verify new round opens with empty leaderboards,
//    fresh attempt for THU account, and 100% preserved history/audit of the previous round.
test.skip(!ready, "needs the local stack and server secrets");
test.describe.configure({ mode: "serial" });

const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`.toUpperCase();
const origin = "http://127.0.0.1:3000";
const adminEmail = `reh-admin-${run.toLowerCase()}@test.invalid`;
const adminPassword = `Adm-${crypto.randomUUID()}`;
const classStudentId = `SV${run}`.slice(0, 12);
const syntheticBankKey = `reh-e2e-bank-${run.toLowerCase()}`;
const SEEDED_VERIFIED_SOURCE = "10000000-0000-0000-0000-000000000001";

async function correctIndex(page: Page) {
  const prompt = (await page.textContent(".ax-question__prompt")) ?? "";
  const letter = prompt.match(/đáp án ([A-C])/)?.[1];
  const labels = await page.$$eval(".ax-option span", (spans) => spans.map((s) => s.textContent?.trim()));
  return Math.max(0, labels.indexOf(`Đáp án ${letter}`));
}

test("Rehearsal Studio full closed-loop E2E: RBAC, CSRF, network retry, THU accounts, play 2 games, leaderboards, reset round, and live screenshots", async ({
  page,
  browser,
  request,
}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "one competition can be open at a time");
  test.setTimeout(360_000);

  const svc = createClient(env.url!, env.serviceKey!, { auth: { persistSession: false } });
  const pool = new Pool({ connectionString: env.dbUrl!, max: 2 });
  const screenshotDir = path.resolve(process.cwd(), "test-results", "rehearsal-studio-screenshots");
  await fs.mkdir(screenshotDir, { recursive: true });

  let adminId = "";
  let classStudentUserId = "";
  let classId = "";
  let createdOwnClass = false;
  const createdCompetitionIds: string[] = [];

  try {
    // =========================================================================
    // 0. Setup Isolated Test World
    // =========================================================================
    await pool.query("update public.competitions set state = 'start_closed' where state = 'open'");

    const a = await svc.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      app_metadata: { role: "admin" },
    });
    if (a.error || !a.data.user) throw a.error ?? new Error("Failed to create admin user");
    adminId = a.data.user.id;
    await svc.from("profiles").insert({
      id: adminId,
      role: "admin",
      full_name: "Admin Rehearsal E2E",
      display_name: "Admin E2E",
    });

    // Create a published 'bank' question to verify it never enters rehearsal snapshots
    const { data: bq } = await svc
      .from("questions")
      .insert({
        external_key: syntheticBankKey,
        game_type: "race",
        pool: "race",
        chapter: "chapter_3",
        topic: "Cách ly ngân hàng chính thức",
        question_type: "single_choice",
        option_count: 3,
        difficulty: "easy",
        origin: "bank",
        created_by: adminId,
      })
      .select("id")
      .single();
    if (bq?.id) {
      const { data: bv } = await svc
        .from("question_versions")
        .insert({
          question_id: bq.id,
          version: 1,
          status: "draft",
          content_public: {
            prompt: "Câu hỏi chính thức kiểm tra cách ly phòng thi thử?",
            options: [
              { id: "a", label: "Đáp án A" },
              { id: "b", label: "Đáp án B" },
              { id: "c", label: "Đáp án C" },
            ],
          },
          content_private: {
            correctOptionId: "a",
            explanation: "Giải thích kiểm thử.",
          },
          created_by: adminId,
        })
        .select("id")
        .single();
      if (bv?.id) {
        await svc.from("question_source_links").insert({
          question_version_id: bv.id,
          source_id: SEEDED_VERIFIED_SOURCE,
          locator: "tr. 12",
        });
        await pool.query(
          "update public.question_versions set status = 'reviewed', reviewed_by = $1, reviewed_at = now(), review_note = 'Duyệt e2e' where id = $2",
          [adminId, bv.id],
        );
        await pool.query(
          "update public.question_versions set status = 'published', published_by = $1, published_at = now() where id = $2",
          [adminId, bv.id],
        );
        await pool.query("update public.questions set current_version_id = $1, published_version_id = $1 where id = $2", [
          bv.id,
          bq.id,
        ]);
      }
    }

    // Reuse existing active class or create one (public.classes has classes_single_active_idx and no created_by column)
    const existingClass = await svc.from("classes").select("id").eq("is_active", true).maybeSingle();
    if (existingClass.data?.id) {
      classId = existingClass.data.id;
      createdOwnClass = false;
    } else {
      const { data: cls, error: clsError } = await svc
        .from("classes")
        .insert({ code: `CLS-${run}`, name: `Lớp chính thức ${run}`, is_active: true })
        .select("id")
        .single();
      if (clsError || !cls) throw clsError ?? new Error("Failed to create active class");
      classId = cls.id;
      createdOwnClass = true;
    }

    const sEmail = `${crypto.randomUUID()}@auth.invalid`;
    const sUser = await svc.auth.admin.createUser({
      email: sEmail,
      password: deriveProviderPassword(env.pepper!, classStudentId, env.defaultPassword!),
      email_confirm: true,
      app_metadata: { role: "student" },
    });
    if (sUser.error || !sUser.data.user) throw sUser.error ?? new Error("Failed to create class student");
    classStudentUserId = sUser.data.user.id;
    await svc.from("profiles").insert({
      id: classStudentUserId,
      role: "student",
      student_id: classStudentId,
      full_name: "Nguyễn Văn Chính Thức",
      display_name: "Thức N.V.",
      class_id: classId,
      is_rehearsal: false,
    });
    await svc.from("student_auth_identities").insert({ profile_id: classStudentUserId, internal_email: sEmail });

    // =========================================================================
    // 1. RBAC, CSRF & Invalid-State API Verification
    // =========================================================================
    // Unauthenticated requests are rejected with 401
    expect((await request.get("/api/v1/admin/rehearsal")).status()).toBe(401);

    // Student requests to rehearsal admin routes are rejected with 404 (security-spec §4 non-disclosure)
    const studentApiCtx = await browser.newContext({ baseURL: origin });
    const studentLogin = await studentApiCtx.request.post("/api/v1/auth/sign-in", {
      headers: { origin },
      data: { studentId: classStudentId, password: env.defaultPassword },
    });
    expect(studentLogin.status()).toBe(200);
    const studentCsrf = (await studentLogin.json()).data.csrfToken as string;
    expect((await studentApiCtx.request.get("/api/v1/admin/rehearsal")).status()).toBe(404);
    expect(
      (
        await studentApiCtx.request.post("/api/v1/admin/rehearsal/accounts", {
          headers: { origin, "x-csrf-token": studentCsrf },
          data: { count: 2 },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await studentApiCtx.request.post("/api/v1/admin/rehearsal/rounds", {
          headers: { origin, "x-csrf-token": studentCsrf },
          data: { action: "open_or_reset", startWindowMinutes: 60 },
        })
      ).status(),
    ).toBe(404);
    await studentApiCtx.close();

    // Admin CSRF & invalid-state checks
    const adminApiCtx = await browser.newContext({ baseURL: origin });
    const adminLogin = await adminApiCtx.request.post("/api/v1/auth/admin-sign-in", {
      headers: { origin },
      data: { email: adminEmail, password: adminPassword },
    });
    expect(adminLogin.status()).toBe(200);
    const adminCsrf = (await adminLogin.json()).data.csrfToken as string;

    // Missing CSRF token -> 403 csrf_failed
    const noCsrfAccounts = await adminApiCtx.request.post("/api/v1/admin/rehearsal/accounts", {
      headers: { origin },
      data: { count: 2 },
    });
    expect(noCsrfAccounts.status()).toBe(403);
    expect((await noCsrfAccounts.json()).error.code).toBe("csrf_failed");

    const noCsrfRounds = await adminApiCtx.request.post("/api/v1/admin/rehearsal/rounds", {
      headers: { origin },
      data: { action: "open_or_reset", startWindowMinutes: 60 },
    });
    expect(noCsrfRounds.status()).toBe(403);
    expect((await noCsrfRounds.json()).error.code).toBe("csrf_failed");

    // Invalid state: closing when no rehearsal is open or start_closed -> 404 not_found
    await pool.query(
      "update public.competitions set state = 'finalized' where kind = 'rehearsal' and state in ('open', 'start_closed')",
    );
    const closeWhenNone = await adminApiCtx.request.post("/api/v1/admin/rehearsal/rounds", {
      headers: { origin, "x-csrf-token": adminCsrf },
      data: { action: "close" },
    });
    expect(closeWhenNone.status()).toBe(404);
    expect((await closeWhenNone.json()).error.code).toBe("not_found");

    // Invalid payload: startWindowMinutes out of range -> 422 validation_error
    const invalidWindow = await adminApiCtx.request.post("/api/v1/admin/rehearsal/rounds", {
      headers: { origin, "x-csrf-token": adminCsrf },
      data: { action: "open_or_reset", startWindowMinutes: 1 },
    });
    expect(invalidWindow.status()).toBe(422);
    await adminApiCtx.close();

    // =========================================================================
    // 2. Admin UI Sign-In, Network Error & Retry ("Thử lại") + DB Sandbox Badge
    // =========================================================================
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto("/quan-tri/cuoc-thi");
    await page.waitForURL("**/quan-tri/dang-nhap");
    await page.fill("input[name=email]", adminEmail);
    await page.fill("input[name=password]", adminPassword);
    await page.click("button[type=submit]");
    await page.waitForURL("**/quan-tri/cuoc-thi");

    // Simulate a transient network failure on the first load of /api/v1/admin/rehearsal
    let rehearsalFetchCount = 0;
    await page.route("**/api/v1/admin/rehearsal", async (route) => {
      rehearsalFetchCount += 1;
      if (rehearsalFetchCount === 1 && route.request().method() === "GET") {
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    await page.getByRole("tab", { name: /Phòng thi thử khép kín/ }).click();
    await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible({ timeout: 10000 });
    await page.unroute("**/api/v1/admin/rehearsal");
    await page.getByRole("button", { name: "Thử lại" }).click();

    // Verify DB Sandbox isolation badge is displayed
    await expect(page.getByText(/DB: local-sandbox · Sandbox Cô lập/)).toBeVisible({ timeout: 10000 });

    // =========================================================================
    // 3. Provision Rehearsal Accounts (THU001, THU002) & Verify Class Isolation
    // =========================================================================
    const { rows: beforeOfficialCount } = await pool.query(
      "select count(*)::int as n from public.profiles where role = 'student' and is_rehearsal = false",
    );

    await page.getByLabel(/Số lượng tài khoản thử/).fill("2");
    await page.getByRole("button", { name: /Tạo \/ Làm mới .* tài khoản thử/ }).click();

    await expect(page.getByText(/Đã chuẩn bị 2 tài khoản thử/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("cell", { name: "THU001" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "THU002" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sao chép thông tin đăng nhập" })).toBeVisible();

    // Verify in DB that THU001 & THU002 have is_rehearsal=true, class_id=null, and official count did not change
    const { rows: thuRows } = await pool.query(
      "select student_id, is_rehearsal, class_id from public.profiles where student_id in ('THU001', 'THU002') order by student_id",
    );
    expect(thuRows).toEqual([
      { student_id: "THU001", is_rehearsal: true, class_id: null },
      { student_id: "THU002", is_rehearsal: true, class_id: null },
    ]);
    const { rows: afterOfficialCount } = await pool.query(
      "select count(*)::int as n from public.profiles where role = 'student' and is_rehearsal = false",
    );
    expect(afterOfficialCount[0].n).toBe(beforeOfficialCount[0].n);

    // =========================================================================
    // 4. Open Rehearsal Round #1 & Verify Snapshot Question Origin Isolation
    // =========================================================================
    await page.getByRole("button", { name: "Mở buổi thi thử ngay" }).click();
    await expect(page.getByText(/Đã mở buổi thi thử/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Đang mở nhận lượt")).toBeVisible();

    const { rows: openRehRows } = await pool.query<{ id: string; public_id: string; name: string }>(
      "select id, public_id, name from public.competitions where kind = 'rehearsal' and state = 'open' limit 1",
    );
    expect(openRehRows).toHaveLength(1);
    const round1Id = openRehRows[0]!.id;
    const round1Name = openRehRows[0]!.name;
    createdCompetitionIds.push(round1Id);

    // Verify snapshot strictly contains origin='fixture' and 0 origin='bank'
    const { rows: snapOrigins } = await pool.query<{ origin: string; n: number }>(
      `select s.origin::text as origin, count(*)::int as n
       from public.competition_question_snapshots s
       join public.competition_games g on g.id = s.competition_game_id
       where g.competition_id = $1
       group by s.origin`,
      [round1Id],
    );
    expect(snapOrigins).toHaveLength(1);
    expect(snapOrigins[0]!.origin).toBe("fixture");
    expect(snapOrigins[0]!.n).toBeGreaterThanOrEqual(87);

    // =========================================================================
    // 5. Student THU001 Signs In & Plays Both Đường Đua and Bãi Mìn
    // =========================================================================
    const studentCtx = await browser.newContext();
    const student = await studentCtx.newPage();
    await student.goto("/dang-nhap");
    await student.fill("input[name=studentId]", "THU001");
    await student.fill("input[name=password]", env.defaultPassword!);
    await student.click("button[type=submit]");
    await student.waitForURL("**/live-arena");

    // Play Game 2 (Đường Đua Lịch Sử) to completion first
    await student.goto("/live-arena/duong-dua");
    await student.getByRole("button", { name: "Bắt đầu lượt thi" }).click();
    const doneRace = student.getByText(/Hoàn thành!|Hết giờ!/);
    const openQuestion = student.locator(".ax-question:not(.is-expired)");
    let lastAnsweredChip = "";
    for (let step = 0; step < 65 && !(await doneRace.count()); step += 1) {
      await expect(openQuestion.or(doneRace).first()).toBeVisible({ timeout: 15000 });
      if (await doneRace.count()) break;
      const chip = (await openQuestion.locator(".ax-chip").textContent().catch(() => null)) ?? "";
      if (!chip || chip === lastAnsweredChip) {
        await student.waitForTimeout(150);
        continue;
      }
      lastAnsweredChip = chip;
      await student
        .locator(".ax-option")
        .nth(await correctIndex(student))
        .click()
        .catch(() => undefined);
    }
    await expect(student.getByText(/Hoàn thành!|Hết giờ!/)).toBeVisible({ timeout: 15000 });

    // Play Game 1 (Bãi Mìn Tri Thức) and answer a question
    await student.goto("/live-arena/bai-min");
    await student.getByRole("button", { name: "Bắt đầu lượt thi" }).click();
    await expect(student.locator(".ax-board")).toBeVisible({ timeout: 10000 });
    for (let i = 0; i < 20 && !(await student.locator(".ax-question").count()); i += 1) {
      const opened = await student.locator(".ax-cell.is-open").count();
      await student.locator(".ax-cell:not(.is-open)").first().click({ force: true });
      await expect(student.locator(".ax-cell.is-open")).toHaveCount(opened + 1);
      await student.waitForTimeout(700);
    }
    await expect(student.locator(".ax-question")).toBeVisible({ timeout: 8000 });
    await student.locator(".ax-option").nth(await correctIndex(student)).click();
    await expect(student.locator(".ax-overlay")).toHaveCount(0, { timeout: 8000 });
    await expect(student.locator(".ax-mark--ok, .ax-mark--bad").first()).toBeVisible();

    // =========================================================================
    // 6. Verify Both Leaderboards & Capture Live Desktop/Mobile Screenshots
    // =========================================================================
    await student.goto("/live-arena/bang-xep-hang");
    await expect(student.locator(".ax-lb--minefield").getByText("An N.V.")).toBeVisible({ timeout: 10000 });
    await expect(student.locator(".ax-lb--race").getByText("An N.V.")).toBeVisible({ timeout: 10000 });

    // Refresh leaderboards in Admin Rehearsal Studio & verify An N.V. appears in both Top 10 panels
    await page.getByRole("button", { name: "Làm mới bảng điểm" }).click();
    await expect(
      page.locator(".acc-panel-alt", { hasText: "Game 1 · Bãi Mìn Quyết Sách" }).getByText("An N.V."),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator(".acc-panel-alt", { hasText: "Game 2 · Đường Đua Mốc Quá Độ" }).getByText("An N.V."),
    ).toBeVisible({ timeout: 10000 });

    // Capture live Rehearsal Studio screenshots (Desktop 1440x960 & Mobile 390x844)
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
    await page.screenshot({ path: path.join(screenshotDir, "admin-rehearsal-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: path.join(screenshotDir, "admin-rehearsal-mobile.png"), fullPage: true });

    // Capture live Operations Overview screenshots (Desktop 1440x960 & Mobile 390x844)
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.getByRole("tab", { name: /Điều hành & Giám sát trực tiếp/ }).click();
    await page.getByRole("button", { name: "Làm mới ngay" }).click();
    await page.getByRole("button", { name: new RegExp(round1Name) }).click();
    await expect(page.locator(".adm__monitor tbody tr", { hasText: "THU001" }).first()).toBeVisible({ timeout: 10000 });
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
    await page.screenshot({ path: path.join(screenshotDir, "admin-overview-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: path.join(screenshotDir, "admin-overview-mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 960 });

    // =========================================================================
    // 7. Click "Chơi thử lại" -> Verify Empty Leaderboards, New Attempt & Preserved History
    // =========================================================================
    await page.getByRole("tab", { name: /Phòng thi thử khép kín/ }).click();
    await page.getByRole("button", { name: /Chơi thử lại \(Vòng diễn tập mới\)/ }).click();
    const resetDialog = page.getByRole("dialog", { name: /Bắt đầu vòng .* mới/ });
    await expect(resetDialog).toBeVisible();
    await resetDialog.getByRole("button", { name: "Xác nhận mở vòng diễn tập mới" }).click();

    await expect(page.getByText(/Đã đóng vòng thử cũ .* và mở vòng mới/)).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText("Bảng xếp hạng đang trống — chưa có lượt chơi nào trong vòng thi thử này."),
    ).toHaveCount(2);

    // Verify in DB: Round 1 is finalized with all attempts, scores, and audit logs intact; Round 2 is open
    const { rows: round1State } = await pool.query<{ state: string; attempts: number }>(
      `select c.state::text as state,
              (select count(*)::int from public.attempts a where a.competition_id = c.id) as attempts
       from public.competitions c where c.id = $1`,
      [round1Id],
    );
    expect(round1State[0]).toEqual({ state: "finalized", attempts: 2 });

    const { rows: round1Audit } = await pool.query<{ n: number }>(
      "select count(*)::int as n from public.audit_logs where target_id = $1::text",
      [round1Id],
    );
    expect(round1Audit[0]!.n).toBeGreaterThan(0);

    const { rows: openRehRows2 } = await pool.query<{ id: string }>(
      "select id from public.competitions where kind = 'rehearsal' and state = 'open' limit 1",
    );
    expect(openRehRows2).toHaveLength(1);
    const round2Id = openRehRows2[0]!.id;
    expect(round2Id).not.toBe(round1Id);
    createdCompetitionIds.push(round2Id);

    // Verify public leaderboard for the new active round is empty
    await student.goto("/live-arena/bang-xep-hang");
    await expect(student.locator(".ax-lb__row")).toHaveCount(0);

    // Verify THU001 can start a brand-new attempt in Round 2
    await student.goto("/live-arena/duong-dua");
    await expect(student.getByRole("button", { name: "Bắt đầu lượt thi" })).toBeVisible({ timeout: 10000 });
    await student.getByRole("button", { name: "Bắt đầu lượt thi" }).click();
    await expect(student.locator(".ax-question")).toBeVisible({ timeout: 10000 });
    await studentCtx.close();

    // =========================================================================
    // 8. Capture Official Confirmation Modal, Roster (no THU accounts), & Question Bank Screenshots
    // =========================================================================
    await page.goto("/quan-tri/lop");
    await expect(page.getByRole("heading", { name: /Danh sách lớp & Tài khoản/ })).toBeVisible();
    // Official class student is listed, rehearsal THU001 is excluded from the student directory table
    await expect(page.locator(".acc-table tbody").getByText(classStudentId)).toBeVisible();
    await expect(page.locator(".acc-table tbody").getByText("THU001")).toHaveCount(0);
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
    await page.screenshot({ path: path.join(screenshotDir, "admin-roster-desktop.png"), fullPage: true });

    await page.goto("/quan-tri/ngan-hang-cau-hoi");
    await expect(page.getByRole("heading", { name: "Ngân hàng câu hỏi" })).toBeVisible();
    await page.getByLabel("Nguồn").selectOption("fixture");
    await expect(page.locator(".adm__questions > li").first()).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
    await page.screenshot({ path: path.join(screenshotDir, "admin-bank-desktop.png"), fullPage: true });

    // Create a Scheduled Official Competition in DB to capture the Official Open Confirmation Modal screenshot
    const { rows: offComp } = await pool.query<{ id: string }>(
      `insert into public.competitions (name, kind, state, opens_at, start_deadline_at, created_by)
       values ($1, 'official', 'scheduled', now() - interval '1 minute', now() + interval '60 minutes', $2)
       returning id`,
      [`Cuộc thi chính thức E2E ${run}`, adminId],
    );
    const offCompId = offComp[0]!.id;
    createdCompetitionIds.push(offCompId);
    await page.goto("/quan-tri/cuoc-thi");
    await page.getByRole("button", { name: new RegExp(`Cuộc thi chính thức E2E ${run}`) }).click();
    await page.getByRole("button", { name: /Mở cuộc thi/ }).click();
    await expect(page.getByRole("dialog", { name: /Xác nhận mở cuộc thi chính thức/ })).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
    await page.screenshot({ path: path.join(screenshotDir, "admin-official-modal-desktop.png"), fullPage: true });
    await page.getByRole("button", { name: "Hủy" }).click();
    // Clean up synthetic official competition as postgres using the Arena thử prefix
    await pool.query("update public.competitions set name = $1 where id = $2", [`Arena thử ${run}`, offCompId]);
    await pool.query("delete from public.competitions where id = $1", [offCompId]);
  } finally {
    try {
      const { rows: comps } = await pool.query(
        "select id from public.competitions where id = any($1::uuid[]) or name like 'Phòng thi thử #%' or name like 'Cuộc thi chính thức E2E%'",
        [createdCompetitionIds],
      );
      for (const r of comps) {
        await pool.query(
          "delete from public.audit_logs where target_type = 'attempt' and target_id in (select id::text from public.attempts where competition_id = $1)",
          [r.id],
        );
        await pool.query("delete from public.question_exposures where competition_id = $1", [r.id]);
        await pool.query("delete from public.audit_logs where target_id = $1", [r.id]);
        await pool.query("delete from public.competitions where id = $1 and kind = 'rehearsal'", [r.id]);
      }

      const { rows: rehProfiles } = await pool.query(
        "select id from public.profiles where is_rehearsal = true and student_id in ('THU001', 'THU002')",
      );
      for (const p of rehProfiles) {
        await pool.query("delete from public.auth_events where profile_id = $1", [p.id]);
        await svc.auth.admin.deleteUser(p.id);
      }

      await pool.query("delete from public.questions where external_key = $1", [syntheticBankKey]);
      await pool.query("delete from public.auth_events where profile_id = any($1::uuid[])", [
        [adminId, classStudentUserId].filter(Boolean),
      ]);
      if (classStudentUserId) await svc.auth.admin.deleteUser(classStudentUserId);
      if (createdOwnClass && classId) await pool.query("delete from public.classes where id = $1", [classId]);
      if (adminId) await svc.auth.admin.deleteUser(adminId);
    } finally {
      await pool.end();
    }
  }
});
