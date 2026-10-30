import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// HTTP-level checks of the stage B routes against a real stack (CSRF, 404 for non-admins,
// cookies, multipart upload, generic errors). Needs the server env from scripts/db/stack.env
// plus the server-only secrets; skipped explicitly (not silently green) when they are absent.
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
test.skip(!url || !serviceKey || !process.env.AUTH_PASSWORD_PEPPER || !process.env.ROSTER_DEFAULT_PASSWORD, "stage B e2e needs the local stack and server secrets");

const admin = createClient(url ?? "http://x", serviceKey ?? "x", { auth: { persistSession: false } });
const run = Date.now().toString(36);
const CLASS = `E2E-${run}`;
const adminEmail = `e2e-admin-${run}@test.invalid`;
const adminPassword = `Adm-${crypto.randomUUID()}`;
const origin = "http://127.0.0.1:3000";
let adminId = "";

test.beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email: adminEmail, password: adminPassword, email_confirm: true, app_metadata: { role: "admin" } });
  if (error || !data.user) throw error;
  adminId = data.user.id;
  await admin.from("profiles").insert({ id: adminId, role: "admin", full_name: "E2E Admin", display_name: "E2E Admin" });
});

test.afterAll(async () => {
  const { data: cls } = await admin.from("classes").select("id").eq("code", CLASS).maybeSingle();
  if (cls) {
    const { data: profiles } = await admin.from("profiles").select("id").eq("class_id", cls.id);
    for (const p of profiles ?? []) await admin.auth.admin.deleteUser(p.id);
    await admin.from("roster_imports").delete().eq("class_id", cls.id);
    await admin.from("classes").delete().eq("id", cls.id);
  }
  if (adminId) await admin.auth.admin.deleteUser(adminId);
});

test("admin imports a roster over HTTP, a student signs in, and protections hold", async ({ browser, request }) => {
  // Admin sign-in rejects a cross-origin request and wrong credentials generically.
  const foreign = await request.post("/api/v1/auth/admin-sign-in", { headers: { origin: "https://evil.example" }, data: { email: adminEmail, password: adminPassword } });
  expect(foreign.status()).toBe(403);
  const wrong = await request.post("/api/v1/auth/admin-sign-in", { headers: { origin }, data: { email: adminEmail, password: "sai" } });
  expect(wrong.status()).toBe(401);
  expect((await wrong.json()).error.code).toBe("invalid_credentials");

  const adminCtx = await browser.newContext({ baseURL: origin });
  const signedIn = await adminCtx.request.post("/api/v1/auth/admin-sign-in", { headers: { origin }, data: { email: adminEmail, password: adminPassword } });
  expect(signedIn.status()).toBe(200);
  const csrf = (await signedIn.json()).data.csrfToken as string;

  // CSRF: missing or wrong token is refused before any work happens.
  const file = { name: "lop.csv", mimeType: "text/csv", buffer: Buffer.from("MSSV,Họ và tên\n00777,Nguyễn Văn Ê\nHE000778,Trần Thị Mai\nHE000778,Trùng Lặp\n") };
  const noCsrf = await adminCtx.request.post("/api/v1/admin/roster-imports", { headers: { origin }, multipart: { classCode: CLASS, file } });
  expect(noCsrf.status()).toBe(403);
  const badFile = await adminCtx.request.post("/api/v1/admin/roster-imports", { headers: { origin, "x-csrf-token": csrf }, multipart: { classCode: CLASS, file: { name: "x.pdf", mimeType: "application/pdf", buffer: Buffer.from("x") } } });
  expect(badFile.status()).toBe(422);

  const preview = await adminCtx.request.post("/api/v1/admin/roster-imports", { headers: { origin, "x-csrf-token": csrf }, multipart: { classCode: CLASS, file } });
  expect(preview.status()).toBe(201);
  const previewBody = (await preview.json()).data;
  expect(previewBody.validCount).toBe(1);
  expect(previewBody.errorCount).toBe(2);
  expect(previewBody.rows[0].studentId).toBe("00777");

  const applied = await adminCtx.request.post(`/api/v1/admin/roster-imports/${previewBody.importId}/apply`, { headers: { origin, "x-csrf-token": csrf }, data: { confirmedWarningRows: [], displayNameOverrides: {} } });
  expect(applied.status()).toBe(200);
  expect((await applied.json()).data.created).toBe(1);

  // Student signs in through the real UI form: MSSV with leading zeros + default password, no extra step.
  const page = await browser.newPage({ baseURL: origin });
  await page.goto("/dang-nhap");
  await page.getByLabel("Mã số sinh viên").fill(" 00777 ");
  await page.getByLabel("Mật khẩu").fill(process.env.ROSTER_DEFAULT_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/live-arena");
  const me = await page.request.get("/api/v1/me");
  expect((await me.json()).data).toMatchObject({ role: "student", displayName: "Ê N.V.", studentId: "00777" });

  // The student is not an admin: admin routes answer 404 and never reveal the roster.
  const roster = await page.request.get("/api/v1/admin/students");
  expect(roster.status()).toBe(404);
  const studentImport = await page.request.post("/api/v1/admin/roster-imports", { headers: { origin }, multipart: { classCode: CLASS, file } });
  expect(studentImport.status()).toBe(404);
  const admins = await page.goto("/quan-tri/lop");
  expect(new URL(page.url()).pathname).toBe("/");
  expect(admins?.status()).toBe(200);

  // Wrong password: generic message in the UI, and the same envelope over HTTP.
  const anon = await request.post("/api/v1/auth/sign-in", { headers: { origin }, data: { studentId: "00777", password: "sai" } });
  expect(anon.status()).toBe(401);
  const unknown = await request.post("/api/v1/auth/sign-in", { headers: { origin }, data: { studentId: "KHONGCO", password: "sai" } });
  expect(unknown.status()).toBe(401);
  expect((await unknown.json()).error).toEqual((await anon.json()).error);

  // Unauthenticated and malformed requests.
  expect((await request.get("/api/v1/me")).status()).toBe(401);
  expect((await request.post("/api/v1/auth/sign-in", { headers: { origin }, data: { studentId: "", password: "" } })).status()).toBe(422);
  expect((await request.post("/api/v1/auth/sign-in", { headers: { origin, "content-type": "application/json" }, data: Buffer.from("{not json") })).status()).toBe(400);

  // Sign-out clears the session.
  const csrfStudent = (await page.context().cookies()).find((c) => c.name === "vnr_csrf")!.value;
  expect((await page.request.post("/api/v1/auth/sign-out", { headers: { origin, "x-csrf-token": csrfStudent } })).status()).toBe(204);
  expect((await page.request.get("/api/v1/me")).status()).toBe(401);

  // Public content stays reachable without any login.
  expect((await request.get("/api/v1/dossiers")).status()).toBe(200);
  await adminCtx.close();
  await page.close();
});
