import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const local = !!url && ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname);
test.skip(!local || !key || !process.env.ROSTER_DEFAULT_PASSWORD, "isolated local stack only");
const admin = createClient(url ?? "http://test.invalid", key ?? "test-only", { auth: { persistSession: false } });
const run = `${Date.now().toString(36)}${crypto.randomUUID().slice(0, 4)}`;
const studentId = `NM${run.toUpperCase()}`;
const email = `name-admin-${run}@test.invalid`;
const password = `Admin-test-${crypto.randomUUID()}`;
const origin = "http://127.0.0.1:3000";
let actorId = "", studentProfile = "", importId = "", createdClass = "";

test.beforeAll(async () => {
  const user = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: "admin" } });
  if (user.error || !user.data.user) throw new Error("Could not create synthetic administrator");
  actorId = user.data.user.id;
  const profile = await admin.from("profiles").insert({ id: actorId, role: "admin", full_name: "Name test", display_name: "Name test" });
  if (profile.error) throw profile.error;
});
test.afterAll(async () => {
  if (studentProfile) await admin.auth.admin.deleteUser(studentProfile);
  if (importId) await admin.from("roster_imports").delete().eq("id", importId);
  if (createdClass) await admin.from("classes").delete().eq("id", createdClass);
  if (actorId) await admin.auth.admin.deleteUser(actorId);
});

test("IDs-only import leads to an authenticated, write-once, privacy-safe first-login name", async ({ page, browser }, info) => {
  const signIn = await page.request.post("/api/v1/auth/admin-sign-in", { headers: { origin }, data: { email, password } });
  expect(signIn.status()).toBe(200);
  const csrf = (await signIn.json()).data.csrfToken as string;
  const existing = await admin.from("classes").select("id, code, name").eq("is_active", true).maybeSingle();
  const classCode = existing.data?.code ?? `NAME-${run}`;
  const preview = await page.request.post("/api/v1/admin/roster-imports", { headers: { origin, "x-csrf-token": csrf }, multipart: {
    classCode, className: existing.data?.name ?? "Synthetic first-login test", collectNamesOnSignIn: "on",
    file: { name: "synthetic-ids.csv", mimeType: "text/csv", buffer: Buffer.from(`MSSV\n${studentId}\n`) },
  } });
  expect(preview.status()).toBe(201);
  const draft = (await preview.json()).data;
  importId = draft.importId;
  expect(draft.rows[0]).toMatchObject({ requiresDisplayName: true, status: "valid" });
  if (!existing.data) createdClass = (await admin.from("classes").select("id").eq("code", classCode).single()).data!.id;
  const applied = await page.request.post(`/api/v1/admin/roster-imports/${importId}/apply`, { headers: { origin, "x-csrf-token": csrf }, data: { confirmedWarningRows: [], displayNameOverrides: {} } });
  expect(applied.status()).toBe(200);
  const profile = await admin.from("profiles").select("id, requires_display_name").eq("student_id", studentId).single();
  studentProfile = profile.data!.id;
  expect(profile.data?.requires_display_name).toBe(true);

  const context = await browser.newContext({ baseURL: origin, viewport: info.project.use.viewport, deviceScaleFactor: info.project.use.deviceScaleFactor, isMobile: info.project.use.isMobile, hasTouch: info.project.use.hasTouch, userAgent: info.project.use.userAgent });
  try {
    const student = await context.newPage();
    await student.goto("/dang-nhap");
    await student.getByLabel("Mã số sinh viên", { exact: true }).fill(studentId);
    await student.getByLabel("Mật khẩu", { exact: true }).fill(process.env.ROSTER_DEFAULT_PASSWORD!);
    await student.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(student).toHaveURL(/\/thiet-lap-ten$/);
    await expect(student.getByRole("button", { name: "Lưu tên và vào sảnh" })).toBeDisabled();
    await student.goto("/live-arena/bai-min");
    await expect(student).toHaveURL(/\/thiet-lap-ten$/);
    const studentCsrf = (await context.cookies()).find((cookie) => cookie.name === "vnr_csrf")!.value;
    expect((await student.request.post("/api/v1/me/display-name", { headers: { origin }, data: { name: "An" } })).status()).toBe(403);
    const headers = { origin, "x-csrf-token": studentCsrf };
    expect((await student.request.post("/api/v1/me/display-name", { headers, data: { name: "An", profileId: actorId } })).status()).toBe(422);
    expect((await student.request.post("/api/v1/me/display-name", { headers, data: { name: studentId } })).status()).toBe(422);
    await student.getByLabel("Tên gọi hoặc họ tên", { exact: true }).fill("Nguyễn Văn An");
    await expect(student.getByText("An N.V.", { exact: true })).toBeVisible();
    await student.screenshot({ path: info.outputPath("student-name-confirmation.png") });
    await student.getByRole("button", { name: "Lưu tên và vào sảnh" }).click();
    await expect(student).toHaveURL(/\/live-arena$/);
    const saved = await admin.from("profiles").select("requires_display_name, full_name, display_name").eq("id", studentProfile).single();
    expect(saved.data).toMatchObject({ requires_display_name: false, full_name: "Nguyễn Văn An", display_name: "An N.V." });
    expect((await student.request.post("/api/v1/me/display-name", { headers, data: { name: "Other name" } })).status()).toBe(409);
    const audit = await admin.from("audit_logs").select("after_redacted").eq("action", "profile.student_name_set").eq("actor_profile_id", studentProfile);
    expect(audit.data).toHaveLength(1);
    expect(JSON.stringify(audit.data)).not.toContain(studentId);
    expect(JSON.stringify(audit.data)).not.toContain("Nguyễn Văn An");
  } finally { await context.close(); }
});
