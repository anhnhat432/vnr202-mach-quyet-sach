// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { T0, assertNoPublishedBankQuestions, at, call, clearFixtures, createWorld, expectError, loadFixtures, pool, projection, start, type World } from "./arena";

// Stage E: gameplay control follows the Supabase Auth session id passed by the HTTP layer.
const worlds: World[] = [];
const track = async (options?: Parameters<typeof createWorld>[0]) => {
  const w = await createWorld(options);
  worlds.push(w);
  return w;
};
const bind = (profile: string, attempt: string, session: string, take = false) => call<number>("arena_bind_session", [profile, attempt, session, take]);
const sessionA = crypto.randomUUID();
const sessionB = crypto.randomUUID();

beforeAll(async () => {
  await assertNoPublishedBankQuestions();
  await loadFixtures("dev87");
});
afterEach(async () => {
  while (worlds.length) await worlds.pop()!.cleanup();
});
afterAll(async () => {
  await clearFixtures();
  await pool.end();
});

describe("arena_bind_session / arena_claim_active_attempt", () => {
  it("binds on first use, refuses another session unless it takes control, and bumps the version once per transfer", async () => {
    const w = await track({ students: 1 });
    const p = w.students[0];
    const s = await start(w, p, "race", T0);
    const id = s.projection.attempt.id;
    expect(await bind(p, id, sessionA)).toBe(1);
    expect(await bind(p, id, sessionA)).toBe(1);
    await expectError(bind(p, id, sessionB), "QA409", "stale_session");
    expect(await bind(p, id, sessionB, true)).toBe(2);
    expect(await bind(p, id, sessionB, true)).toBe(2); // already in control: no second bump
    await expectError(bind(p, id, sessionA), "QA409", "stale_session");
    expect(await bind(p, id, sessionA, true)).toBe(3);
    const { rows } = await pool.query("select count(*)::int as n from public.auth_events where profile_id = $1 and event = 'session_transfer'", [p]);
    expect(rows[0].n).toBe(2);
    await expectError(call("arena_bind_session", [p, id, null, false]), "QA422", "invalid_session");
  });

  it("a transfer changes control only: same attempt, clocks, score and pending question (LA-TRY-006)", async () => {
    const w = await track({ students: 1 });
    const p = w.students[0];
    const s = await start(w, p, "race", T0);
    const id = s.projection.attempt.id;
    await bind(p, id, sessionA);
    const before = await pool.query("select started_at, ends_at, score, pending_allocation_id from public.attempts where id = $1", [id]);
    const version = await bind(p, id, sessionB, true);
    const after = await pool.query("select started_at, ends_at, score, pending_allocation_id from public.attempts where id = $1", [id]);
    expect(after.rows[0]).toEqual(before.rows[0]);
    expect((await projection(p, id, version, at(100))).interaction?.allocationId).toBe(s.projection.interaction!.allocationId);
    await expectError(projection(p, id, version - 1, at(100)), "QA409", "stale_session");
  });

  it("signing in elsewhere claims the active attempt only; finished attempts and other students are untouched", async () => {
    const w = await track({ students: 2, raceMs: 10000 });
    const [p, q] = w.students;
    const a = await start(w, p, "race", T0);
    const b = await start(w, q, "race", T0);
    await bind(p, a.projection.attempt.id, sessionA);
    await bind(q, b.projection.attempt.id, sessionA);
    expect(await call("arena_claim_active_attempt", [p, sessionB])).toBe(1);
    expect(await call("arena_claim_active_attempt", [p, sessionB])).toBe(0); // idempotent
    await expectError(bind(p, a.projection.attempt.id, sessionA), "QA409", "stale_session");
    expect(await bind(q, b.projection.attempt.id, sessionA)).toBe(1); // other student unaffected
    // once the attempt has ended nothing is claimed
    await projection(p, a.projection.attempt.id, 2, at(10000 + 400 + 250 + 1000));
    expect(await call("arena_claim_active_attempt", [p, crypto.randomUUID()])).toBe(0);
  });
});
