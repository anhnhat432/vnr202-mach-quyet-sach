import { Pool } from "pg";

import { generateFixtures, type FixtureQuestion } from "../../../scripts/lib/question-bank.mjs";
import { serviceClient } from "./stack";

// Shared helpers for the Live Arena suites. Everything talks to a real Postgres through the owner
// connection; the RPCs are the same ones the server routes call (service_role only).
export const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL, max: 30 });
const admin = serviceClient();

export class ArenaError extends Error {
  constructor(readonly sqlstate: string, message: string, readonly detail?: string) {
    super(message);
  }
}

export const T0 = new Date("2031-03-01T10:00:00.000Z");
export const at = (ms: number, base: Date = T0) => new Date(base.getTime() + ms);

// One RPC in its own short transaction, optionally under the transaction-local test clock.
export async function call<T = unknown>(fn: string, args: unknown[], clock?: Date): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (clock) {
      await client.query("select set_config('arena.test_clock_enabled', 'on', true), set_config('arena.test_clock', $1, true)", [clock.toISOString()]);
    }
    const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
    const { rows } = await client.query(`select public.${fn}(${placeholders}) as r`, args as never[]);
    await client.query("commit");
    return rows[0].r as T;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    const e = error as { code?: string; message: string; detail?: string };
    throw new ArenaError(e.code ?? "XX000", e.message, e.detail);
  } finally {
    client.release();
  }
}

export async function expectError(promise: Promise<unknown>, sqlstate: string, message?: string) {
  try {
    await promise;
  } catch (error) {
    if (!(error instanceof ArenaError)) throw error;
    if (error.sqlstate !== sqlstate || (message !== undefined && error.message !== message)) {
      throw new Error(`expected ${sqlstate}${message ? ` ${message}` : ""}, got ${error.sqlstate} ${error.message}`);
    }
    return error;
  }
  throw new Error(`expected ${sqlstate}${message ? ` ${message}` : ""} but the call succeeded`);
}

export async function loadFixtures(profile: "dev87" | "official168" = "dev87"): Promise<FixtureQuestion[]> {
  await clearFixtures();
  const fixtures = generateFixtures(profile, { keyPrefix: "arena" });
  const { data, error } = await admin
    .from("questions")
    .insert(fixtures.map((q) => ({ external_key: q.key, game_type: q.game, pool: q.pool, chapter: q.chapter, topic: q.topic, question_type: q.type, option_count: q.options.length, difficulty: q.difficulty, origin: "fixture" })))
    .select("id, external_key");
  if (error) throw error;
  const ids = new Map(data!.map((r) => [r.external_key, r.id]));
  const { error: vError } = await admin.from("question_versions").insert(
    fixtures.map((q) => ({ question_id: ids.get(q.key), version: 1, status: "published", content_public: { prompt: q.prompt, options: q.options }, content_private: { correctOptionId: q.correctOptionId, explanation: q.explanation } })),
  );
  if (vError) throw vError;
  return fixtures;
}

export async function clearFixtures() {
  const { error } = await admin.from("questions").delete().eq("origin", "fixture");
  if (error) throw new Error(`could not remove fixtures (a competition still references them?): ${error.message}`);
}

export async function assertNoPublishedBankQuestions() {
  const { rows } = await pool.query("select count(*)::int as n from public.question_versions v join public.questions q on q.id = v.question_id where v.status = 'published' and q.origin = 'bank'");
  if (rows[0].n > 0) throw new Error("Published bank questions exist; run Live Arena suites on a test database.");
}

export type World = Awaited<ReturnType<typeof createWorld>>;

export async function createWorld(options: {
  students?: number;
  kind?: "official" | "rehearsal";
  minefieldMs?: number;
  raceMs?: number;
  latencyMs?: number;
  lockWaitMs?: number;
  offsets?: Record<string, number>;
  open?: boolean;
  startDeadlineMs?: number;
} = {}) {
  const n = options.students ?? 3;
  const tag = crypto.randomUUID().slice(0, 8).toUpperCase();
  const authIds: string[] = [];
  const newUser = async (role: "admin" | "student", i: number) => {
    const id = crypto.randomUUID();
    await pool.query("insert into auth.users (id, email) values ($1, $2)", [id, `arena-${tag}-${role}-${i}@test.invalid`]);
    if (role === "admin") {
      await pool.query("insert into public.profiles (id, role, full_name, display_name) values ($1, 'admin', 'Quản trị thử', 'Quản trị thử')", [id]);
    } else {
      await pool.query(
        "insert into public.profiles (id, role, student_id, full_name, display_name, display_name_suffix) values ($1, 'student', $2, $3, $4, null)",
        [id, `ZZ${tag}${i}`, `Sinh Viên ${tag} ${i}`, `SV${i} ${tag}`],
      );
    }
    authIds.push(id);
    return id;
  };
  const adminId = await newUser("admin", 0);
  const students: string[] = [];
  for (let i = 1; i <= n; i += 1) students.push(await newUser("student", i));

  const created = await call<{ id: string; publicId: string }>("create_competition", [
    adminId, `Arena thử ${tag}`, options.kind ?? "rehearsal", at(-3_600_000), at(options.startDeadlineMs ?? 3_600_000),
    options.latencyMs ?? 400, options.lockWaitMs ?? 2000, options.minefieldMs ?? 180000, options.raceMs ?? 150000,
    options.offsets ? JSON.stringify(options.offsets) : null,
  ]);
  const world = {
    tag, adminId, students, competitionId: created.id, publicId: created.publicId,
    transition: (target: string, clock?: Date) => call("transition_competition", [created.id, adminId, target], clock),
    async cleanup() {
      await pool.query("delete from public.question_exposures where competition_id = $1", [created.id]);
      await pool.query("delete from public.competition_disclosed_question_confirmations where competition_id = $1", [created.id]);
      await pool.query("delete from public.audit_logs where target_id = $1", [created.id]);
      await pool.query("delete from public.competitions where id = $1", [created.id]);
      await pool.query("delete from public.auth_events where profile_id = any($1::uuid[])", [authIds]);
      await pool.query("delete from public.profiles where id = any($1::uuid[])", [authIds]);
      await pool.query("delete from auth.users where id = any($1::uuid[])", [authIds]);
    },
  };
  if (options.open !== false) {
    try {
      await call("transition_competition", [created.id, adminId, "scheduled"], T0);
      await call("transition_competition", [created.id, adminId, "open"], T0);
    } catch (error) {
      await world.cleanup();
      throw error;
    }
  }
  return world;
}

// ---- Player-side helpers -------------------------------------------------------------------------
export type Projection = {
  attempt: { id: string; game: string; state: string; score: number; sessionVersion: number; version: number; remainingMs: number; mainAnswered: number; mainCorrect: number; shields?: number; doubleArmed?: boolean; streak?: number; comboAwards?: number; completionDurationMs: number | null; endsAt: string; startedAt: string };
  competition: { publicId: string; kind: string; state: string; standing: string };
  board: Array<{ index: number; opened: boolean; kind?: string; allocationId?: string; difficulty?: string; outcome?: string | null }> | null;
  interaction: { allocationId: string; sequence: number; role: string; status: string; contentFetched: boolean; difficulty?: string; availableInMs?: number; remainingMs?: number } | null;
  lastEvent: { type: string; pointsDelta: number; scoreAfter: number } | null;
};
export type Resolved = { result: { allocationId: string; outcome: string; awardedPoints: number; comboBonus: number; doubleApplied: boolean; effect: string; scoreAfter: number }; replayed: boolean; projection: Projection };

let keyCounter = 0;
export const key = (label = "k") => `${label}-${Date.now().toString(36)}-${(keyCounter += 1)}-${Math.random().toString(36).slice(2, 8)}`;

export const start = (world: World, profile: string, game: "minefield" | "race", clock?: Date, k = key("start")) =>
  call<{ result: { resumed: boolean }; projection: Projection }>("start_or_resume_attempt", [profile, world.publicId, game, k], clock);
export const projection = (profile: string, attemptId: string, sessionVersion: number | null, clock?: Date) =>
  call<Projection>("get_attempt_projection", [profile, attemptId, sessionVersion], clock);
export const content = (profile: string, attemptId: string, allocationId: string, sessionVersion: number, clock?: Date) =>
  call<{ allocationId: string; prompt: string; options: Array<{ id: string; label: string }>; remainingMs: number; difficulty?: string; role: string }>("get_interaction_content", [profile, attemptId, allocationId, sessionVersion], clock);
export const openCell = (profile: string, attemptId: string, cell: number, sessionVersion: number, clock?: Date, k = key("cell")) =>
  call<{ result: Record<string, unknown>; replayed: boolean; projection: Projection }>("open_minefield_cell", [profile, attemptId, cell, k, sessionVersion], clock);
export const submit = (profile: string, attemptId: string, allocationId: string, optionId: string, sessionVersion: number, clock?: Date, k = key("ans")) =>
  call<Resolved>("submit_answer", [profile, attemptId, allocationId, optionId, k, sessionVersion], clock);

export async function correctOption(allocationId: string): Promise<string> {
  const { rows } = await pool.query("select s.snapshot_private ->> 'correctOptionId' as c from public.attempt_allocations al join public.competition_question_snapshots s on s.id = al.snapshot_id where al.id = $1", [allocationId]);
  return rows[0].c;
}
export async function wrongOption(allocationId: string): Promise<string> {
  const { rows } = await pool.query(
    "select o ->> 'id' as id from public.attempt_allocations al join public.competition_question_snapshots s on s.id = al.snapshot_id, jsonb_array_elements(s.snapshot_public -> 'options') o where al.id = $1 and o ->> 'id' <> s.snapshot_private ->> 'correctOptionId' limit 1",
    [allocationId],
  );
  return rows[0].id;
}
export async function optionFor(allocationId: string, outcome: "correct" | "incorrect" | "timed_out") {
  return outcome === "correct" ? correctOption(allocationId) : wrongOption(allocationId);
}

export async function exposure(competitionId: string, allocationId: string) {
  const { rows } = await pool.query(
    "select x.allocated_count, x.displayed_count from public.attempt_allocations al join public.competition_question_snapshots s on s.id = al.snapshot_id join public.question_exposures x on x.question_version_id = s.question_version_id and x.competition_id = $1 where al.id = $2",
    [competitionId, allocationId],
  );
  return rows[0] as { allocated_count: number; displayed_count: number };
}

export async function totalDisplayed(competitionId: string): Promise<number> {
  const { rows } = await pool.query("select coalesce(sum(displayed_count), 0)::int as n from public.question_exposures where competition_id = $1", [competitionId]);
  return rows[0].n;
}

export async function events(attemptId: string) {
  const { rows } = await pool.query("select seq, event_type, source_ref, points_delta, score_after from public.attempt_events where attempt_id = $1 order by seq", [attemptId]);
  return rows as Array<{ seq: number; event_type: string; source_ref: string; points_delta: number; score_after: number }>;
}

export async function cells(attemptId: string) {
  const { rows } = await pool.query(
    "select m.cell_index, m.kind, m.allocation_id, a.difficulty, a.role, a.sequence from public.minefield_cells m left join public.attempt_allocations a on a.id = m.allocation_id where m.attempt_id = $1 order by m.cell_index",
    [attemptId],
  );
  return rows as Array<{ cell_index: number; kind: string; allocation_id: string | null; difficulty: string | null; role: string | null; sequence: number | null }>;
}

// Presents, fetches and answers the pending interaction at deterministic times. `clock` is the time
// the pending question was presented; the helper moves to just after availability.
export async function answerPending(
  profile: string, proj: Projection, outcome: "correct" | "incorrect" | "timed_out", presentedAt: Date, offsetMs: number, answerAfterMs = 1000,
): Promise<Resolved> {
  const it = proj.interaction!;
  const sv = proj.attempt.sessionVersion;
  const availableAt = at(offsetMs, presentedAt);
  await content(profile, proj.attempt.id, it.allocationId, sv, availableAt);
  if (outcome === "timed_out") {
    // Late answer: fixed far beyond any deadline so it is scored as timed out (LA-ANTI-004).
    return submit(profile, proj.attempt.id, it.allocationId, await correctOption(it.allocationId), sv, at(offsetMs + 60_000, presentedAt));
  }
  return submit(profile, proj.attempt.id, it.allocationId, await optionFor(it.allocationId, outcome), sv, at(offsetMs + answerAfterMs, presentedAt));
}

// ---- Scripted-play helpers ------------------------------------------------------------------------
export type Piece = "chest" | "shield" | "double" | "bomb" | "easy" | "medium" | "hard";

// Test-only: lays the (unopened) board out in a chosen order so item rules can be driven exactly.
// Pieces not listed keep filling the remaining cells; the board composition stays 10/3/1/2/4.
export async function arrange(attemptId: string, first: Piece[]) {
  const { rows: al } = await pool.query("select id, role, difficulty from public.attempt_allocations where attempt_id = $1 order by sequence", [attemptId]);
  const mains: Record<string, string[]> = { easy: [], medium: [], hard: [] };
  const defuse: string[] = [];
  for (const a of al) (a.role === "main" ? mains[a.difficulty] : defuse).push(a.id);
  const inventory: Piece[] = [...Array(3).fill("easy"), ...Array(4).fill("medium"), ...Array(3).fill("hard"), ...Array(3).fill("bomb"), "double", ...Array(2).fill("shield"), ...Array(4).fill("chest")];
  for (const p of first) {
    const i = inventory.indexOf(p);
    if (i < 0) throw new Error(`piece ${p} exhausted`);
    inventory.splice(i, 1);
  }
  const layout = [...first, ...inventory];
  const kinds: string[] = [];
  const allocs: Array<string | null> = [];
  for (const p of layout) {
    if (p === "bomb") { kinds.push("bomb"); allocs.push(defuse.shift()!); }
    else if (p === "easy" || p === "medium" || p === "hard") { kinds.push("question"); allocs.push(mains[p].shift()!); }
    else { kinds.push(p); allocs.push(null); }
  }
  await pool.query(
    "update public.minefield_cells m set kind = v.kind, allocation_id = v.alloc from (select i - 1 as idx, k as kind, a as alloc from unnest($2::text[], $3::uuid[]) with ordinality as t(k, a, i)) v where m.attempt_id = $1 and m.cell_index = v.idx",
    [attemptId, kinds, allocs],
  );
  return layout;
}

export async function deadlineOf(allocationId: string): Promise<Date> {
  const { rows } = await pool.query("select deadline_at from public.attempt_allocations where id = $1", [allocationId]);
  return rows[0].deadline_at;
}
