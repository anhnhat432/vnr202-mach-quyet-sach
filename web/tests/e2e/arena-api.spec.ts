import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

import { generateFixtures } from "../../../scripts/lib/question-bank.mjs";
import { deriveProviderPassword } from "../../src/features/auth/domain/provider-password";

// Stage E over HTTP against a real stack: Auth-verified profile, CSRF, strict bodies, idempotent
// retries, control moving to the newest Auth session, no answer leaks, public Top 10.
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pepper = process.env.AUTH_PASSWORD_PEPPER;
const defaultPassword = process.env.ROSTER_DEFAULT_PASSWORD;
test.skip(!url || !serviceKey || !pepper || !defaultPassword, "needs the local stack and server secrets");
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "API contract does not depend on the viewport; one competition can be open at a time");
});
test.describe.configure({ mode: "serial" });

const svc = createClient(url ?? "http://x", serviceKey ?? "x", { auth: { persistSession: false } });
const origin = "http://127.0.0.1:3000";
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
const adminEmail = `arena-admin-${run}@test.invalid`;
const adminPassword = `Adm-${crypto.randomUUID()}`;
const students = ["a", "b"].map((s) => ({ key: s, studentId: `ZZE${run.toUpperCase()}${s.toUpperCase()}`, id: "", name: `Người chơi ${s.toUpperCase()}` }));
const SECRET = /correctOptionId|explanation|snapshot_private/;
let adminId = "";
let competitionId = "";
let publicId = "";

type Client = { ctx: APIRequestContext; csrf: string };
async function signIn(kind: "admin" | "student", who?: (typeof students)[number]): Promise<Client> {
  const context = await pwRequest.newContext({ baseURL: origin });
  const res = kind === "admin"
    ? await context.post("/api/v1/auth/admin-sign-in", { headers: { origin }, data: { email: adminEmail, password: adminPassword } })
    : await context.post("/api/v1/auth/sign-in", { headers: { origin }, data: { studentId: who!.studentId, password: defaultPassword } });
  expect(res.status(), await res.text()).toBe(200);
  return { ctx: context, csrf: (await res.json()).data.csrfToken as string };
}
let seq = 0;
const post = (c: Client, path: string, data: unknown = {}, key: string | null = `idem-${run}-${(seq += 1)}-padding`) =>
  c.ctx.post(path, { headers: { origin, "x-csrf-token": c.csrf, ...(key ? { "idempotency-key": key } : {}) }, data });
const get = (c: Client, path: string) => c.ctx.get(path);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function data(res: { json(): Promise<any> }) {
  return (await res.json()).data;
}
async function correctFor(allocationId: string) {
  const { data: al } = await svc.from("attempt_allocations").select("snapshot_id").eq("id", allocationId).single();
  const { data: snap } = await svc.from("competition_question_snapshots").select("snapshot_private").eq("id", al!.snapshot_id).single();
  return (snap!.snapshot_private as { correctOptionId: string }).correctOptionId;
}

test.beforeAll(async () => {
  const fixtures = generateFixtures("dev87", { keyPrefix: "e2e" });
  await svc.from("questions").delete().eq("origin", "fixture");
  const { data: qs, error } = await svc.from("questions").insert(fixtures.map((q) => ({ external_key: q.key, game_type: q.game, pool: q.pool, chapter: q.chapter, topic: q.topic, question_type: q.type, option_count: q.options.length, difficulty: q.difficulty, origin: "fixture" }))).select("id, external_key");
  if (error) throw error;
  const ids = new Map(qs!.map((r) => [r.external_key, r.id]));
  const { error: vError } = await svc.from("question_versions").insert(fixtures.map((q) => ({ question_id: ids.get(q.key), version: 1, status: "published", content_public: { prompt: q.prompt, options: q.options }, content_private: { correctOptionId: q.correctOptionId, explanation: q.explanation } })));
  if (vError) throw vError;

  const admin = await svc.auth.admin.createUser({ email: adminEmail, password: adminPassword, email_confirm: true, app_metadata: { role: "admin" } });
  if (admin.error || !admin.data.user) throw admin.error;
  adminId = admin.data.user.id;
  await svc.from("profiles").insert({ id: adminId, role: "admin", full_name: "Arena Admin", display_name: "Arena Admin" });
  for (const s of students) {
    const email = `${crypto.randomUUID()}@auth.invalid`;
    const user = await svc.auth.admin.createUser({ email, password: deriveProviderPassword(pepper!, s.studentId, defaultPassword!), email_confirm: true, app_metadata: { role: "student" } });
    if (user.error || !user.data.user) throw user.error;
    s.id = user.data.user.id;
    const { error: pError } = await svc.from("profiles").insert({ id: s.id, role: "student", student_id: s.studentId, full_name: `Họ Tên Đầy Đủ ${s.key}`, display_name: s.name });
    if (pError) throw pError;
    await svc.from("student_auth_identities").insert({ profile_id: s.id, internal_email: email });
  }
});

test.afterAll(async () => {
  if (process.env.SUPABASE_DB_URL) {
    const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL, max: 1 });
    if (competitionId) {
      await pool.query("delete from public.question_exposures where competition_id = $1", [competitionId]);
      await pool.query("delete from public.audit_logs where target_id = $1", [competitionId]);
      await pool.query("delete from public.competitions where id = $1", [competitionId]);
    }
    await pool.query("delete from public.auth_events where profile_id = any($1::uuid[])", [[adminId, ...students.map((s) => s.id)]]);
    await pool.end();
  }
  await svc.from("questions").delete().eq("origin", "fixture");
  for (const s of students) if (s.id) await svc.auth.admin.deleteUser(s.id);
  if (adminId) await svc.auth.admin.deleteUser(adminId);
});

test("gameplay over HTTP: Auth-verified profile, idempotency, control follows the newest Auth session, no answer leaks", async ({ request }) => {
  // --- nobody signed in ------------------------------------------------------------------------
  expect((await request.get("/api/v1/arena/lobby")).status()).toBe(401);
  expect((await request.post(`/api/v1/arena/attempts/${crypto.randomUUID()}/heartbeat`, { headers: { origin }, data: {} })).status()).toBe(401);
  expect((await request.get(`/api/v1/arena/leaderboards/${crypto.randomUUID()}/race`)).status()).toBe(404);

  // --- administrator opens a rehearsal competition ---------------------------------------------
  const admin = await signIn("admin");
  const body = { name: `Arena e2e ${run}`, kind: "rehearsal", opensAt: new Date(Date.now() - 60_000).toISOString(), startDeadlineAt: new Date(Date.now() + 3_600_000).toISOString() };
  expect((await admin.ctx.post("/api/v1/admin/competitions", { headers: { origin }, data: body })).status()).toBe(403); // CSRF
  const created = await post(admin, "/api/v1/admin/competitions", body, null);
  expect(created.status()).toBe(201);
  ({ id: competitionId, publicId } = await data(created));
  expect((await post(admin, `/api/v1/admin/competitions/${competitionId}/transitions`, { target: "open" }, null)).status()).toBe(409); // Draft -> Open is illegal
  expect((await post(admin, `/api/v1/admin/competitions/${competitionId}/transitions`, { target: "scheduled", extra: 1 }, null)).status()).toBe(422);
  expect((await post(admin, `/api/v1/admin/competitions/${competitionId}/transitions`, { target: "scheduled" }, null)).status()).toBe(200);
  expect((await post(admin, `/api/v1/admin/competitions/${competitionId}/transitions`, { target: "open" }, null)).status()).toBe(200);
  expect((await get(admin, `/api/v1/admin/competitions/${competitionId}/readiness`)).status()).toBe(200);

  // --- student A on device 1 -------------------------------------------------------------------
  const [A, B] = students;
  const dev1 = await signIn("student", A);
  expect((await post(dev1, "/api/v1/admin/competitions", body, null)).status()).toBe(404); // students cannot see admin routes
  const lobby = await data(await get(dev1, "/api/v1/arena/lobby"));
  expect(lobby.competition.publicId).toBe(publicId);

  const startPath = `/api/v1/arena/competitions/${publicId}/games/race/attempt`;
  expect((await dev1.ctx.post(startPath, { headers: { origin }, data: {} })).status()).toBe(403); // CSRF
  expect((await post(dev1, startPath, {}, null)).status()).toBe(422); // Idempotency-Key required
  expect((await post(dev1, startPath, { profileId: B.id }, "idem-forged-profile-1")).status()).toBe(422); // strict body: profile id is never accepted
  const started = await post(dev1, startPath, {}, "idem-start-race-0001");
  expect(started.status()).toBe(201);
  const s1 = await data(started);
  const attemptId = s1.projection.attempt.id as string;
  expect(JSON.stringify(s1)).not.toMatch(/prompt|options|label/);
  const again = await data(await post(dev1, startPath, {}, "idem-start-race-0002"));
  expect(again.resumed).toBe(true);
  expect(again.projection.attempt).toMatchObject({ id: attemptId, startedAt: s1.projection.attempt.startedAt });

  // first question: long-polled until available, then answered
  const alloc1 = s1.projection.interaction.allocationId as string;
  const contentRes = await post(dev1, `/api/v1/arena/attempts/${attemptId}/interactions/${alloc1}/content`, {}, null);
  expect(contentRes.status()).toBe(200);
  const content = await data(contentRes);
  expect(content.prompt.length).toBeGreaterThan(0);
  expect(JSON.stringify(content)).not.toMatch(SECRET);
  const answers = `/api/v1/arena/attempts/${attemptId}/answers`;
  expect((await post(dev1, answers, { allocationId: alloc1, optionId: "a", score: 9999, isCorrect: true }, "idem-answer-0001")).status()).toBe(422);
  const correct = await correctFor(alloc1);
  const answered = await post(dev1, answers, { allocationId: alloc1, optionId: correct }, "idem-answer-0002");
  expect(answered.status()).toBe(200);
  const r1 = await data(answered);
  expect(r1.result).toMatchObject({ outcome: "correct", awardedPoints: 100 });
  expect(JSON.stringify(r1)).not.toMatch(SECRET);
  const replay = await data(await post(dev1, answers, { allocationId: alloc1, optionId: "zzzz" }, "idem-answer-0002"));
  expect(replay.replayed).toBe(true);
  expect(replay.result).toEqual(r1.result);

  // --- one active attempt across games; another student cannot read it -------------------------
  const blocked = await post(dev1, `/api/v1/arena/competitions/${publicId}/games/minefield/attempt`, {}, "idem-start-mine-0001");
  expect(blocked.status()).toBe(409);
  const blockedBody = await blocked.json();
  expect(blockedBody.error.code).toBe("another_attempt_active");
  expect(blockedBody.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ field: "attemptId", message: attemptId })]));
  const devB = await signIn("student", B);
  expect((await get(devB, `/api/v1/arena/attempts/${attemptId}`)).status()).toBe(404);

  // --- device 2: a new Auth session takes control, device 1 is refused -------------------------
  const dev2 = await signIn("student", A);
  const stale = await get(dev1, `/api/v1/arena/attempts/${attemptId}`);
  expect(stale.status()).toBe(409);
  expect((await stale.json()).error.code).toBe("stale_session");
  const next = (await data(await get(dev2, `/api/v1/arena/attempts/${attemptId}`)));
  expect(next.attempt).toMatchObject({ id: attemptId, startedAt: s1.projection.attempt.startedAt, score: 100, mainAnswered: 1 });
  expect(next.attempt.sessionVersion).toBe(s1.projection.attempt.sessionVersion + 1);
  const alloc2 = next.interaction.allocationId as string;
  const staleAnswer = await post(dev1, answers, { allocationId: alloc2, optionId: "a" }, "idem-answer-stale1");
  expect(staleAnswer.status()).toBe(409);
  expect((await post(dev1, `/api/v1/arena/attempts/${attemptId}/interactions/${alloc2}/content`, {}, null)).status()).toBe(409);
  const content2 = await post(dev2, `/api/v1/arena/attempts/${attemptId}/interactions/${alloc2}/content`, {}, null);
  expect(content2.status(), await content2.text()).toBe(200);
  const r2 = await data(await post(dev2, answers, { allocationId: alloc2, optionId: await correctFor(alloc2) }, "idem-answer-0003"));
  expect(r2.projection.attempt.score).toBeGreaterThan(100);
  // resuming explicitly from device 1 later takes control back without touching anything else
  const back = await post(dev1, `/api/v1/arena/attempts/${attemptId}/transfer`, {}, "idem-transfer-0001");
  expect(back.status()).toBe(200);
  expect((await data(back)).attempt.score).toBe(r2.projection.attempt.score);

  // --- public board and review -----------------------------------------------------------------
  const board = await request.get(`/api/v1/arena/leaderboards/${publicId}/race`);
  expect(board.status()).toBe(200);
  const boardText = await board.text();
  expect(boardText).toContain(A.name);
  expect(boardText).not.toContain(A.studentId);
  expect(boardText).not.toContain("Họ Tên Đầy Đủ");
  const parsed = JSON.parse(boardText).data;
  expect(parsed).toMatchObject({ game: "race", standing: "rehearsal", players: 1 });
  expect(parsed.entries.length).toBeLessThanOrEqual(10);
  expect((await get(dev1, `/api/v1/arena/attempts/${attemptId}/review`)).status()).toBe(409);
  const standing = await data(await get(dev1, `/api/v1/arena/attempts/${attemptId}/standing`));
  expect(standing).toMatchObject({ rank: 1, label: "leading_alone" });

  // --- the administrator cannot finalize while an attempt is active ----------------------------
  expect((await post(admin, `/api/v1/admin/competitions/${competitionId}/transitions`, { target: "start_closed" }, null)).status()).toBe(200);
  expect((await post(admin, `/api/v1/admin/competitions/${competitionId}/transitions`, { target: "settling" }, null)).status()).toBe(200);
  const fin = await post(admin, `/api/v1/admin/competitions/${competitionId}/finalize`, {}, null);
  expect(fin.status()).toBe(409);
  expect((await fin.json()).error.code).toBe("attempts_still_active");
});
