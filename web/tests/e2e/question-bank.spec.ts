import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { deriveProviderPassword } from "../../src/features/auth/domain/provider-password";

// HTTP-level checks of the question bank admin routes against a real stack: CSRF, 404 for
// non-admins, validation, and the Draft -> Reviewed -> Published walk performed by a human admin.
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
test.skip(!url || !serviceKey || !process.env.AUTH_PASSWORD_PEPPER || !process.env.ROSTER_DEFAULT_PASSWORD, "needs the local stack and server secrets");

const admin = createClient(url ?? "http://x", serviceKey ?? "x", { auth: { persistSession: false } });
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
const origin = "http://127.0.0.1:3000";
const adminEmail = `qb-admin-${run}@test.invalid`;
const adminPassword = `Adm-${crypto.randomUUID()}`;
const SEEDED_VERIFIED_SOURCE = "10000000-0000-0000-0000-000000000001"; // from supabase/seed.sql
const key = `e2e-qb-${run}`;
let adminId = "";

const body = (over: Record<string, unknown> = {}) => ({
  key, game: "race", pool: "race", chapter: "chapter_3", topic: "Chủ đề e2e", type: "single_choice", difficulty: "medium",
  prompt: "Câu hỏi e2e?", options: [{ id: "a", label: "Một" }, { id: "b", label: "Hai" }, { id: "c", label: "Ba" }], correctOptionId: "c",
  explanation: "Giải thích e2e.", sources: [{ sourceId: SEEDED_VERIFIED_SOURCE, locator: "tr. 5" }], ...over,
});

test.beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email: adminEmail, password: adminPassword, email_confirm: true, app_metadata: { role: "admin" } });
  if (error || !data.user) throw error;
  adminId = data.user.id;
  await admin.from("profiles").insert({ id: adminId, role: "admin", full_name: "QB Admin", display_name: "QB Admin" });
});

test.afterAll(async () => {
  await admin.from("questions").delete().eq("external_key", key);
  if (adminId) await admin.auth.admin.deleteUser(adminId);
});

test("an administrator walks a question to Published over HTTP; others cannot", async ({ browser, request }) => {
  const ctx = await browser.newContext({ baseURL: origin });
  const signIn = await ctx.request.post("/api/v1/auth/admin-sign-in", { headers: { origin }, data: { email: adminEmail, password: adminPassword } });
  expect(signIn.status()).toBe(200);
  const csrf = (await signIn.json()).data.csrfToken as string;
  const headers = { origin, "x-csrf-token": csrf };

  // No session, or no CSRF token: refused before any work.
  expect((await request.get("/api/v1/admin/questions")).status()).toBe(401);
  expect((await ctx.request.post("/api/v1/admin/questions", { headers: { origin }, data: body() })).status()).toBe(403);

  // Input that tries to smuggle in a status or origin is rejected.
  const smuggled = await ctx.request.post("/api/v1/admin/questions", { headers, data: body({ status: "published" }) });
  expect(smuggled.status()).toBe(422);
  expect((await ctx.request.post("/api/v1/admin/questions", { headers, data: body({ origin: "fixture" }) })).status()).toBe(422);
  expect((await ctx.request.post("/api/v1/admin/questions", { headers, data: body({ correctOptionId: "z" }) })).status()).toBe(422);

  const created = await ctx.request.post("/api/v1/admin/questions", { headers, data: body() });
  expect(created.status()).toBe(201);
  const { versionId } = (await created.json()).data as { versionId: string };
  expect((await ctx.request.post("/api/v1/admin/questions", { headers, data: body() })).status()).toBe(200); // idempotent

  // The state machine is enforced: no jumping to Published.
  const skip = await ctx.request.post(`/api/v1/admin/question-versions/${versionId}/transitions`, { headers, data: { action: "publish" } });
  expect(skip.status()).toBe(409);
  expect((await skip.json()).error.code).toBe("invalid_content_transition");
  expect((await ctx.request.post(`/api/v1/admin/question-versions/${versionId}/transitions`, { headers, data: { action: "review", reviewer: "ai-agent" } })).status()).toBe(422); // unknown key: nobody else can be named
  const reviewed = await ctx.request.post(`/api/v1/admin/question-versions/${versionId}/transitions`, { headers, data: { action: "review", note: "đã đối chiếu" } });
  expect((await reviewed.json()).data.status).toBe("reviewed");
  const published = await ctx.request.post(`/api/v1/admin/question-versions/${versionId}/transitions`, { headers, data: { action: "publish" } });
  expect((await published.json()).data.status).toBe("published");

  const list = await ctx.request.get(`/api/v1/admin/questions?game=race&status=published`);
  expect(list.status()).toBe(200);
  const listed = (await list.json()).data as Array<{ external_key: string }>;
  expect(listed.some((q) => q.external_key === key)).toBe(true);

  const readiness = await ctx.request.get("/api/v1/admin/question-bank/readiness?kind=official");
  expect(readiness.status()).toBe(200);
  expect((await readiness.json()).data.ready).toBe(false);
  expect((await ctx.request.get("/api/v1/admin/question-bank/readiness?kind=bogus")).status()).toBe(422);
  expect((await ctx.request.get("/api/v1/admin/question-versions/not-a-uuid/transitions")).status()).toBeGreaterThanOrEqual(400);

  // A signed-in student gets 404 on every admin route and the response never contains an answer.
  const studentId = `QB${run.toUpperCase()}`.slice(0, 20);
  const email = `${crypto.randomUUID()}@auth.invalid`;
  const password = deriveProviderPassword(process.env.AUTH_PASSWORD_PEPPER!, studentId, process.env.ROSTER_DEFAULT_PASSWORD!);
  const student = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: "student" } });
  await admin.from("profiles").insert({ id: student.data.user!.id, role: "student", student_id: studentId, full_name: "QB Student", display_name: "QB S." });
  await admin.from("student_auth_identities").insert({ profile_id: student.data.user!.id, internal_email: email });
  try {
    const sctx = await browser.newContext({ baseURL: origin });
    const login = await sctx.request.post("/api/v1/auth/sign-in", { headers: { origin }, data: { studentId, password: process.env.ROSTER_DEFAULT_PASSWORD } });
    expect(login.status()).toBe(200);
    const sCsrf = (await login.json()).data.csrfToken as string;
    const sHeaders = { origin, "x-csrf-token": sCsrf };
    for (const response of [
      await sctx.request.get("/api/v1/admin/questions"),
      await sctx.request.get("/api/v1/admin/question-bank/readiness?kind=official"),
      await sctx.request.post("/api/v1/admin/questions", { headers: sHeaders, data: body({ key: `${key}-s` }) }),
      await sctx.request.post(`/api/v1/admin/question-versions/${versionId}/transitions`, { headers: sHeaders, data: { action: "retire", note: "thử" } }),
    ]) {
      expect(response.status()).toBe(404);
      expect(await response.text()).not.toContain("correctOptionId");
    }
    const { data: still } = await admin.from("question_versions").select("status, retired_at").eq("id", versionId).single();
    expect(still).toMatchObject({ status: "published", retired_at: null }); // the student could not retire it
    await sctx.close();
  } finally {
    await admin.auth.admin.deleteUser(student.data.user!.id);
  }
  await ctx.close();
});
