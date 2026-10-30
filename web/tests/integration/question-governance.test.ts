// @vitest-environment node
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { generateFixtures, toDraftArguments, validateQuestionDocument, type AuthoredQuestion } from "../../../scripts/lib/question-bank.mjs";
import { questionInputSchema } from "@/features/questions/contracts/question";
import { listQuestions, mapQuestionError, questionBankReadiness, transitionQuestionVersion, upsertQuestionDraft } from "@/features/questions/server/question-service";
import { ApiError } from "@/lib/api/errors";
import { anonClient, clientWithToken, serviceClient } from "./stack";

const admin = serviceClient();
const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL, max: 4 });
const PREFIX = `gv-${Date.now().toString(36)}`;
const adminEmail = `gov-admin-${crypto.randomUUID()}@test.invalid`;
const adminPassword = `Adm-${crypto.randomUUID()}`;
let adminId = "";
let studentId = "";
let verifiedSource = "";
let pendingSource = "";

const question = (n: number, over: Partial<AuthoredQuestion> = {}): AuthoredQuestion => ({
  key: `${PREFIX}-${String(n).padStart(3, "0")}`, pool: "race", chapter: "chapter_2", topic: "Chủ đề thử", type: "single_choice", difficulty: "easy",
  prompt: `Câu thử số ${n}`, options: [{ id: "a", label: "Một" }, { id: "b", label: "Hai" }, { id: "c", label: "Ba" }], correctOptionId: "b",
  explanation: "Giải thích thử.", sources: [{ sourceId: verifiedSource, locator: "tr. 1" }], ...over,
});
const input = (q: AuthoredQuestion) => questionInputSchema.parse({ ...q, game: "race" });
const versionId = async (key: string) => (await pool.query<{ id: string }>("select v.id from public.question_versions v join public.questions q on q.id = v.question_id where q.external_key = $1 order by v.version desc limit 1", [key])).rows[0].id;
const statusOf = async (id: string) => (await pool.query<{ status: string }>("select status from public.question_versions where id = $1", [id])).rows[0].status;

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email: adminEmail, password: adminPassword, email_confirm: true, app_metadata: { role: "admin" } });
  if (error || !data.user) throw error;
  adminId = data.user.id;
  await admin.from("profiles").insert({ id: adminId, role: "admin", full_name: "Quản trị", display_name: "Quản trị" });
  const student = await admin.auth.admin.createUser({ email: `gov-student-${crypto.randomUUID()}@test.invalid`, password: `Stu-${crypto.randomUUID()}`, email_confirm: true, app_metadata: { role: "student" } });
  studentId = student.data.user!.id;
  await admin.from("profiles").insert({ id: studentId, role: "student", student_id: `GV${Date.now().toString(36).toUpperCase()}`, full_name: "Sinh viên thử", display_name: "Thử S." });
  verifiedSource = (await pool.query<{ id: string }>("insert into public.sources (title, author_or_issuer, source_type, verification_status) values ($1, 'Test', 'syllabus', 'verified') returning id", [`Nguồn đã xác minh ${PREFIX}`])).rows[0].id;
  pendingSource = (await pool.query<{ id: string }>("insert into public.sources (title, author_or_issuer, source_type, verification_status) values ($1, 'Test', 'syllabus', 'pending') returning id", [`Nguồn chờ ${PREFIX}`])).rows[0].id;
});

afterAll(async () => {
  await admin.from("questions").delete().like("external_key", `${PREFIX}-%`);
  await pool.query("delete from public.sources where id = any($1)", [[verifiedSource, pendingSource]]);
  for (const id of [adminId, studentId]) if (id) await admin.auth.admin.deleteUser(id);
  await pool.end();
});

describe("service layer against the real database", () => {
  it("creates a Draft, is idempotent, and walks Draft → Reviewed → Published as a human administrator", async () => {
    const q = question(1);
    expect(await upsertQuestionDraft(admin, adminId, input(q))).toMatchObject({ outcome: "created", version: 1 });
    expect(await upsertQuestionDraft(admin, adminId, input(q))).toMatchObject({ outcome: "unchanged", version: 1 });
    const id = await versionId(q.key);
    expect(await statusOf(id)).toBe("draft");
    await expect(transitionQuestionVersion(admin, adminId, id, "publish")).rejects.toMatchObject({ status: 409, code: "invalid_content_transition" });
    expect(await transitionQuestionVersion(admin, adminId, id, "review")).toMatchObject({ status: "reviewed" });
    expect(await transitionQuestionVersion(admin, adminId, id, "publish")).toMatchObject({ status: "published" });
    const { rows } = await pool.query("select published_version_id from public.questions where external_key = $1", [q.key]);
    expect(rows[0].published_version_id).toBe(id);
  });

  it("a student profile cannot review or publish, and an unknown actor is refused", async () => {
    const q = question(2);
    await upsertQuestionDraft(admin, adminId, input(q));
    const id = await versionId(q.key);
    await expect(transitionQuestionVersion(admin, studentId, id, "review")).rejects.toMatchObject({ status: 403, code: "forbidden" });
    await expect(transitionQuestionVersion(admin, crypto.randomUUID(), id, "review")).rejects.toMatchObject({ status: 403 });
    await expect(upsertQuestionDraft(admin, studentId, input(question(3)))).rejects.toMatchObject({ status: 403 });
    expect(await statusOf(id)).toBe("draft");
  });

  it("direct table writes cannot skip the rules either (AI or any script holding the service key)", async () => {
    const q = question(4);
    await upsertQuestionDraft(admin, adminId, input(q));
    const id = await versionId(q.key);
    const { error } = await admin.from("question_versions").update({ status: "reviewed" }).eq("id", id);
    expect(error?.message).toContain("human_reviewer_required");
    const { error: e2 } = await admin.from("question_versions").update({ status: "reviewed", reviewed_by: studentId, reviewed_at: new Date().toISOString() }).eq("id", id);
    expect(e2?.message).toContain("human_reviewer_required"); // a student profile is not a reviewer
    expect(await statusOf(id)).toBe("draft");
  });

  it("refuses review without a verified source, with the stable publication_requirements_failed code", async () => {
    const q = question(5, { sources: [{ sourceId: pendingSource, locator: "tr. 2" }] });
    await upsertQuestionDraft(admin, adminId, input(q));
    await expect(transitionQuestionVersion(admin, adminId, await versionId(q.key), "review", "đã xem")).rejects.toMatchObject({ status: 422, code: "publication_requirements_failed" });
  });

  it("AI-assisted drafts need a reviewer's note; the flag survives into the version", async () => {
    const q = question(6, { aiAssisted: true });
    await upsertQuestionDraft(admin, adminId, input(q));
    const id = await versionId(q.key);
    await expect(transitionQuestionVersion(admin, adminId, id, "review")).rejects.toMatchObject({ code: "publication_requirements_failed" });
    expect(await transitionQuestionVersion(admin, adminId, id, "review", "Đã đối chiếu với giáo trình")).toMatchObject({ status: "reviewed" });
    expect((await pool.query("select ai_assisted from public.question_versions where id = $1", [id])).rows[0].ai_assisted).toBe(true);
  });

  it("returns the database's content rules as a 422 with codes, never raw SQL text", async () => {
    const bad = { ...input(question(7)), correctOptionId: "a" };
    await upsertQuestionDraft(admin, adminId, bad); // valid so far
    const err = mapQuestionError({ code: "23514", message: "invalid_question_content: correct_option_invalid,prompt_invalid" });
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 422, code: "validation_error" });
    expect(err.details?.map((d) => d.code)).toEqual(["correct_option_invalid", "prompt_invalid"]);
    expect(mapQuestionError({ code: "XX000", message: "relation \"x\" does not exist at character 14" })).toMatchObject({ status: 500, message: "Đã xảy ra lỗi." });
  });

  it("editing a Published question creates version 2 and the old version stays allocatable until version 2 is published", async () => {
    const q = question(8);
    await upsertQuestionDraft(admin, adminId, input(q));
    const v1 = await versionId(q.key);
    await transitionQuestionVersion(admin, adminId, v1, "review");
    await transitionQuestionVersion(admin, adminId, v1, "publish");
    expect(await upsertQuestionDraft(admin, adminId, input({ ...q, prompt: "Câu thử số 8, bản sửa" }))).toMatchObject({ outcome: "new_version", version: 2 });
    const { rows } = await pool.query("select published_version_id from public.questions where external_key = $1", [q.key]);
    expect(rows[0].published_version_id).toBe(v1);
    await expect(admin.from("question_versions").update({ content_public: { prompt: "x", options: [] } }).eq("id", v1)).resolves.toMatchObject({ error: expect.objectContaining({ message: expect.stringContaining("published_version_immutable") }) });
  });

  it("lists questions for administrators with answers, filtered by game and status", async () => {
    const all = await listQuestions(admin, { limit: 200, game: "race" });
    const mine = all.filter((x) => (x.external_key as string).startsWith(PREFIX));
    expect(mine.length).toBeGreaterThanOrEqual(6);
    const published = await listQuestions(admin, { limit: 200, status: "published" });
    expect(published.every((x) => (x.question_versions as Array<{ status: string }>).some((v) => v.status === "published"))).toBe(true);
    expect(JSON.stringify(mine[0])).toContain("correctOptionId");
  });

  it("reports readiness through the service", async () => {
    const report = (await questionBankReadiness(admin, { kind: "official", expectedAttempts: 60 })) as { ready: boolean; blockers: string[] };
    expect(report.ready).toBe(false);
    expect(report.blockers.some((b) => b.startsWith("insufficient_pool:"))).toBe(true);
  });
});

describe("clients can never read the bank (correct answers stay on the server)", () => {
  it("anonymous and signed-in student requests through PostgREST see nothing and cannot write", async () => {
    const anon = anonClient();
    for (const table of ["questions", "question_versions", "question_source_links", "question_exposures"]) {
      expect((await anon.from(table).select("*").limit(1)).error, table).not.toBeNull();
    }
    const asAuthenticated = clientWithToken((await anonClient().auth.signInWithPassword({ email: adminEmail, password: adminPassword })).data.session!.access_token);
    for (const table of ["questions", "question_versions"]) {
      expect((await asAuthenticated.from(table).select("*").limit(1)).error, `${table} as signed-in admin JWT`).not.toBeNull();
    }
    expect((await asAuthenticated.rpc("transition_question_version", { p_version_id: crypto.randomUUID(), p_actor: adminId, p_action: "review" })).error).not.toBeNull();
  });
});

describe("the JavaScript validator and the database agree on content rules", () => {
  const cases: Array<[string, Partial<AuthoredQuestion>]> = [
    ["valid", {}],
    ["empty prompt", { prompt: " " }],
    ["prompt over the hard limit", { prompt: "x".repeat(301) }],
    ["missing explanation", { explanation: "" }],
    ["one option", { options: [{ id: "a", label: "x" }] }],
    ["duplicate option ids", { options: [{ id: "a", label: "x" }, { id: "a", label: "y" }, { id: "c", label: "z" }] }],
    ["unknown correct option", { correctOptionId: "q" }],
    ["option label over the hard limit", { options: [{ id: "a", label: "y".repeat(201) }, { id: "b", label: "B" }, { id: "c", label: "C" }] }],
    ["before/after with three options", { type: "before_after" }],
  ];
  it.each(cases)("%s", async (_name, over) => {
    const q = question(100 + cases.findIndex((c) => c[0] === _name), over);
    const js = validateQuestionDocument({ schemaVersion: 1, game: "race", questions: [q] }, { sources: new Map([[verifiedSource, "verified"]]) });
    const args = toDraftArguments("race", q);
    const { error } = await admin.rpc("upsert_question_draft", { p_actor: adminId, ...args });
    expect(error === null, `database accepted=${error === null} js errors=${js.errors.join("|")}`).toBe(js.errors.length === 0);
  });
});
