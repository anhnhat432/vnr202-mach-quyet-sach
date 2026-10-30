// @vitest-environment node
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { generateFixtures, type AuthoredQuestion, type FixtureQuestion } from "../../../scripts/lib/question-bank.mjs";
import { cleanupClass, serviceClient } from "./stack";

// Real Postgres. Allocation sees every Published question, so the suite owns the question tables:
// it removes fixtures first and refuses to run if real Published bank questions exist.
const admin = serviceClient();
const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL, max: 20 });
const adminEmail = `alloc-admin-${crypto.randomUUID()}@test.invalid`;
let adminId = "";
let sourceId = "";
const BANK_PREFIX = `bk-${Date.now().toString(36)}`;

type Row = { slot: number; role: string; difficulty: string; question_id: string; question_version_id: string; chapter: string; option_count: number };

async function loadFixtures(profile: "dev87" | "official168", prefix = "fx") {
  const fixtures = generateFixtures(profile, { keyPrefix: prefix });
  const { data, error } = await admin
    .from("questions")
    .insert(fixtures.map((q) => ({ external_key: q.key, game_type: q.game, pool: q.pool, chapter: q.chapter, topic: q.topic, question_type: q.type, option_count: q.options.length, difficulty: q.difficulty, origin: "fixture" })))
    .select("id, external_key");
  if (error) throw error;
  const ids = new Map(data!.map((r) => [r.external_key, r.id]));
  const { error: vError } = await admin.from("question_versions").insert(
    fixtures.map((q: FixtureQuestion) => ({ question_id: ids.get(q.key), version: 1, status: "published", content_public: { prompt: q.prompt, options: q.options }, content_private: { correctOptionId: q.correctOptionId, explanation: q.explanation } })),
  );
  if (vError) throw vError;
  return fixtures;
}

const clearQuestions = async () => {
  await admin.from("questions").delete().eq("origin", "fixture");
  await admin.from("questions").delete().like("external_key", `${BANK_PREFIX}-%`);
};

async function allocate(competition: string, game: "minefield" | "race", kind: "official" | "rehearsal"): Promise<Row[]> {
  const { rows } = await pool.query<Row>("select * from public.allocate_question_set($1::uuid, $2::public.game_type, $3)", [competition, game, kind]);
  return rows;
}

async function counts(competition: string) {
  const { rows } = await pool.query<{ pool: string; difficulty: string; allocated: number }>(
    `select q.pool, q.difficulty, x.allocated_count as allocated
       from public.question_exposures x join public.question_versions v on v.id = x.question_version_id join public.questions q on q.id = v.question_id
      where x.competition_id = $1`, [competition]);
  return rows;
}

const spread = (rows: Array<{ pool: string; difficulty: string; allocated: number }>) => {
  const bySlot = new Map<string, number[]>();
  for (const r of rows) bySlot.set(`${r.pool}/${r.difficulty}`, [...(bySlot.get(`${r.pool}/${r.difficulty}`) ?? []), r.allocated]);
  return Object.fromEntries([...bySlot].map(([k, v]) => [k, Math.max(...v) - Math.min(...v)]));
};

function validateSet(rows: Row[], game: "minefield" | "race") {
  expect(new Set(rows.map((r) => r.question_version_id)).size).toBe(rows.length); // no repeats (LA-ALLOC-006)
  const tally = (role: string, difficulty: string) => rows.filter((r) => r.role === role && r.difficulty === difficulty).length;
  if (game === "race") {
    expect([tally("main", "easy"), tally("main", "medium"), tally("main", "hard")]).toEqual([5, 7, 3]);
    expect(rows.filter((r) => r.option_count === 2).length).toBeLessThanOrEqual(5); // LA-ALLOC-010
  } else {
    expect([tally("main", "easy"), tally("main", "medium"), tally("main", "hard"), tally("defuse", "easy")]).toEqual([3, 4, 3, 3]);
    expect(rows.filter((r) => r.role === "defuse").every((r) => r.option_count === 2)).toBe(true);
  }
}

beforeAll(async () => {
  await clearQuestions();
  const { count } = await admin.from("question_versions").select("id", { count: "exact", head: true }).eq("status", "published");
  if ((count ?? 0) > 0) throw new Error("Published questions exist outside this suite; run it on a test database (npm run db:up, then a reset).");
  const { data, error } = await admin.auth.admin.createUser({ email: adminEmail, password: `Adm-${crypto.randomUUID()}`, email_confirm: true, app_metadata: { role: "admin" } });
  if (error || !data.user) throw error;
  adminId = data.user.id;
  await admin.from("profiles").insert({ id: adminId, role: "admin", full_name: "Quản trị", display_name: "Quản trị" });
  // The server role has no write access to the public source registry (by design), so use the owner connection.
  const { rows: src } = await pool.query<{ id: string }>("insert into public.sources (title, author_or_issuer, source_type, verification_status) values ($1, 'Test', 'syllabus', 'verified') returning id", [`Nguồn thử ${BANK_PREFIX}`]);
  sourceId = src[0].id;
  await loadFixtures("dev87");
});

afterAll(async () => {
  await clearQuestions();
  if (sourceId) await pool.query("delete from public.sources where id = $1", [sourceId]);
  if (adminId) await admin.auth.admin.deleteUser(adminId);
  await pool.end();
  void cleanupClass;
});

describe("allocation of one set (rehearsal, fixtures)", () => {
  it("race: 5/7/3 by difficulty, no repeats, at most 5 two-option, chapters spread", async () => {
    const competition = crypto.randomUUID();
    const rows = await allocate(competition, "race", "rehearsal");
    expect(rows).toHaveLength(15);
    validateSet(rows, "race");
    const perChapter = ["chapter_1", "chapter_2", "chapter_3"].map((c) => rows.filter((r) => r.chapter === c).length);
    expect(Math.max(...perChapter) - Math.min(...perChapter)).toBeLessThanOrEqual(2); // LA-ALLOC-007
    expect(rows.map((r) => r.slot)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it("minefield: 3/4/3 main plus 3 two-option defuse", async () => {
    const rows = await allocate(crypto.randomUUID(), "minefield", "rehearsal");
    expect(rows).toHaveLength(13);
    validateSet(rows, "minefield");
  });

  it("official competitions never see fixtures: the pool is reported insufficient (LA-AC-021)", async () => {
    await expect(allocate(crypto.randomUUID(), "race", "official")).rejects.toMatchObject({ code: "QB001" });
  });

  it("counts every pick as allocated but not displayed", async () => {
    const competition = crypto.randomUUID();
    await allocate(competition, "race", "rehearsal");
    const { rows } = await pool.query<{ allocated: number; displayed: number; disclosed: number }>(
      "select sum(allocated_count)::int allocated, sum(displayed_count)::int displayed, count(answer_disclosed_at)::int disclosed from public.question_exposures where competition_id = $1", [competition]);
    expect(rows[0]).toEqual({ allocated: 15, displayed: 0, disclosed: 0 });
  });
});

describe("60 starts at the same moment (LA-AC-036)", () => {
  for (const game of ["race", "minefield"] as const) {
    it(`${game}: every set valid, counters add up, and spread within a slot stays ≤ 1`, async () => {
      const competition = crypto.randomUUID();
      const started = Date.now();
      const sets = await Promise.all(Array.from({ length: 60 }, () => allocate(competition, game, "rehearsal")));
      const elapsed = Date.now() - started;
      sets.forEach((rows) => validateSet(rows, game));
      const rows = await counts(competition);
      expect(rows.reduce((s, r) => s + r.allocated, 0)).toBe(60 * (game === "race" ? 15 : 13));
      const diffs = spread(rows);
      for (const [slot, diff] of Object.entries(diffs)) expect(diff, `${game} ${slot}`).toBeLessThanOrEqual(1);
      expect(elapsed).toBeLessThan(15000);
    });
  }

  it("two competitions allocate independently and concurrently", async () => {
    const [a, b] = [crypto.randomUUID(), crypto.randomUUID()];
    await Promise.all([...Array.from({ length: 20 }, () => allocate(a, "race", "rehearsal")), ...Array.from({ length: 20 }, () => allocate(b, "race", "rehearsal"))]);
    for (const c of [a, b]) {
      const rows = await counts(c);
      expect(rows.reduce((s, r) => s + r.allocated, 0)).toBe(20 * 15);
    }
  });
});

describe("the 5 two-option cap stays satisfiable when three-option supply is short", () => {
  it("reserves capacity so later slots can still be filled", async () => {
    await clearQuestions();
    // easy and medium are mostly two-option; hard has only 1 three-option question for 3 slots.
    const make = (pool: string, difficulty: string, i: number, options: 2 | 3): FixtureQuestion => ({
      key: `fx-cap-${difficulty}-${options}-${i}`, game: "race", pool: pool as FixtureQuestion["pool"], chapter: (["chapter_1", "chapter_2", "chapter_3"] as const)[i % 3], topic: `[GIẢ LẬP] cap ${difficulty} ${i}`,
      type: options === 2 ? "before_after" : "single_choice", difficulty: difficulty as FixtureQuestion["difficulty"], prompt: `[GIẢ LẬP] cap ${difficulty} ${options} ${i}`,
      options: (["a", "b", "c"] as const).slice(0, options).map((id) => ({ id, label: id })), correctOptionId: "a", explanation: "[GIẢ LẬP]", sources: [],
    });
    const spec: Array<[string, 2 | 3, number]> = [["easy", 2, 8], ["easy", 3, 8], ["medium", 2, 10], ["medium", 3, 10], ["hard", 2, 8], ["hard", 3, 1]];
    const questions = spec.flatMap(([d, o, n]) => Array.from({ length: n }, (_, i) => make("race", d, i, o)));
    const { data } = await admin.from("questions").insert(questions.map((q) => ({ external_key: q.key, game_type: "race", pool: "race", chapter: q.chapter, topic: q.topic, question_type: q.type, option_count: q.options.length, difficulty: q.difficulty, origin: "fixture" }))).select("id, external_key");
    const ids = new Map(data!.map((r) => [r.external_key, r.id]));
    await admin.from("question_versions").insert(questions.map((q) => ({ question_id: ids.get(q.key), version: 1, status: "published", content_public: { prompt: q.prompt, options: q.options }, content_private: { correctOptionId: "a", explanation: "[GIẢ LẬP]" } })));

    const competition = crypto.randomUUID();
    const sets = await Promise.all(Array.from({ length: 30 }, () => allocate(competition, "race", "rehearsal")));
    sets.forEach((rows) => validateSet(rows, "race")); // ≤ 5 two-option, even though hard forces 2 of them
    // hard has 1 three-option + 8 two-option and needs 3 per set: at least 2 two-option every time.
    expect(sets.every((rows) => rows.filter((r) => r.difficulty === "hard" && r.option_count === 2).length >= 2)).toBe(true);
    const { rows } = await pool.query("select public.question_bank_readiness('rehearsal', $1, 60) as r", [competition]);
    expect(rows[0].r.games.race.slots.find((s: { difficulty: string }) => s.difficulty === "hard").availableThreeOption).toBe(1);

    await clearQuestions();
    await loadFixtures("dev87");
  });

  it("is reported as a blocker when it cannot be satisfied, and allocation refuses instead of breaking the cap", async () => {
    await clearQuestions();
    const rowsFor = (difficulty: string, options: 2 | 3, n: number) => Array.from({ length: n }, (_, i) => ({ external_key: `fx-bad-${difficulty}-${options}-${i}`, game_type: "race", pool: "race", chapter: "chapter_1", topic: "[GIẢ LẬP] x", question_type: options === 2 ? "before_after" : "single_choice", option_count: options, difficulty, origin: "fixture" }));
    const all = [...rowsFor("easy", 2, 8), ...rowsFor("medium", 2, 9), ...rowsFor("hard", 2, 5)]; // no three-option at all: 15 forced > 5
    const { data } = await admin.from("questions").insert(all).select("id, external_key, option_count");
    await admin.from("question_versions").insert(data!.map((q) => ({
      question_id: q.id, version: 1, status: "published",
      content_public: { prompt: `[GIẢ LẬP] ${q.external_key}`, options: q.option_count === 2 ? [{ id: "a", label: "a" }, { id: "b", label: "b" }] : [{ id: "a", label: "a" }, { id: "b", label: "b" }, { id: "c", label: "c" }] },
      content_private: { correctOptionId: "a", explanation: "[GIẢ LẬP]" },
    })));
    const competition = crypto.randomUUID();
    const { rows } = await pool.query("select public.question_bank_readiness('rehearsal', $1, 60) as r", [competition]);
    expect(rows[0].r.blockers).toContain("two_option_cap_unsatisfiable:race");
    await expect(allocate(competition, "race", "rehearsal")).rejects.toMatchObject({ code: "QB001" });
    await clearQuestions();
    await loadFixtures("dev87");
  });
});

describe("official competitions with a reviewed bank (disclosure and reuse, LA-AC-029)", () => {
  // A bank exactly the size of one set (5 easy, 7 medium, 3 hard), so every question is used by the first competition.
  const bankQuestions = (): AuthoredQuestion[] => {
    const need: Record<string, number> = { easy: 5, medium: 7, hard: 3 };
    const taken: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
    return generateFixtures("dev87", { keyPrefix: BANK_PREFIX })
      .filter((q) => q.game === "race" && taken[q.difficulty]++ < need[q.difficulty])
      .map((q) => ({ ...q, sources: [{ sourceId, locator: "tr.1" }] }));
  };

  async function publishBank() {
    for (const q of bankQuestions()) {
      const { data, error } = await admin.rpc("upsert_question_draft", {
        p_actor: adminId, p_external_key: q.key,
        p_question: { game_type: "race", pool: q.pool, chapter: q.chapter, topic: "Chủ đề thử", question_type: q.type, option_count: q.options.length, difficulty: q.difficulty },
        p_public: { prompt: q.prompt, options: q.options }, p_private: { correctOptionId: q.correctOptionId, explanation: "Giải thích thử" },
        p_sources: q.sources, p_ai_assisted: false,
      });
      if (error) throw error;
      const versionId = (data as Array<{ version_id: string }>)[0].version_id;
      for (const action of ["review", "publish"]) {
        const { error: tError } = await admin.rpc("transition_question_version", { p_version_id: versionId, p_actor: adminId, p_action: action, p_note: "đã đối chiếu" });
        if (tError) throw tError;
      }
    }
  }

  it("allocates from the reviewed bank only, then excludes disclosed questions until an administrator confirms reuse", async () => {
    await clearQuestions();
    await publishBank();
    const first = crypto.randomUUID();
    const set1 = await allocate(first, "race", "official");
    validateSet(set1, "race");

    // The competition runs: players saw these questions, then it is finalized.
    await pool.query("update public.question_exposures set displayed_count = allocated_count where competition_id = $1", [first]);
    const { rows: marked } = await pool.query<{ n: number }>("select public.mark_competition_answers_disclosed($1) as n", [first]);
    expect(marked[0].n).toBeGreaterThan(0);

    // Next competition: the bank is only as large as one set, so excluding disclosed questions leaves too few.
    const second = crypto.randomUUID();
    await expect(allocate(second, "race", "official")).rejects.toMatchObject({ code: "QB001" });
    const { rows: ready } = await pool.query("select public.question_bank_readiness('official', $1, 60) as r", [second]);
    expect(ready[0].r.ready).toBe(false);
    expect(ready[0].r.games.race.disclosedExcluded).toBeGreaterThan(0);

    // No silent reuse: an administrator confirms the exact versions, with a reason, and it is audited.
    const versionIds = [...new Set(set1.map((r) => r.question_version_id))];
    const { data: confirmed, error } = await admin.rpc("confirm_disclosed_questions", { p_competition_id: second, p_actor: adminId, p_version_ids: versionIds, p_reason: "ngân hàng chưa đủ, đã báo lớp" });
    expect(error).toBeNull();
    expect(confirmed).toBe(versionIds.length);
    const set2 = await allocate(second, "race", "official");
    validateSet(set2, "race");
    const { data: audit } = await admin.from("audit_logs").select("action").eq("target_id", second).eq("action", "question.confirm_disclosed_reuse");
    expect(audit).toHaveLength(1);
  });

  it("a retired question leaves the rotation immediately", async () => {
    const { data } = await admin.from("questions").select("id, published_version_id").like("external_key", `${BANK_PREFIX}-%`).limit(1);
    const versionId = data![0].published_version_id as string;
    const { error } = await admin.rpc("transition_question_version", { p_version_id: versionId, p_actor: adminId, p_action: "retire", p_note: "sai sót phát hiện sau khi xuất bản" });
    expect(error).toBeNull();
    const { rows } = await pool.query("select count(*)::int n from public.eligible_questions('race', 'official', null) where version_id = $1", [versionId]);
    expect(rows[0].n).toBe(0);
  });
});
