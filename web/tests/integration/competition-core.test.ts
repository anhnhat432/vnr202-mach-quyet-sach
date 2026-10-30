// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  ArenaError, T0, assertNoPublishedBankQuestions, at, call, clearFixtures, content, correctOption, createWorld, exposure, expectError, key, loadFixtures,
  openCell, pool, projection, start, submit, totalDisplayed, wrongOption, type World,
} from "./arena";

// Competition core on a real Postgres: state machine, snapshot, one attempt per student/game,
// server-controlled content release, timing boundaries, device transfer and the display counter.
const worlds: World[] = [];
const track = async (options?: Parameters<typeof createWorld>[0]) => {
  const w = await createWorld(options);
  worlds.push(w);
  return w;
};
const SECRET = /correctOptionId|explanation|snapshot_private/;

beforeAll(async () => {
  await assertNoPublishedBankQuestions();
  await loadFixtures("dev87");
});
// Only one competition can be open at a time, so every test releases its world.
afterEach(async () => {
  while (worlds.length) await worlds.pop()!.cleanup();
});
afterAll(async () => {
  await clearFixtures();
  await pool.end();
});

describe("competition state machine and snapshot (T040)", () => {
  it("blocks an official competition that only has fixtures (LA-AC-021) and schedules a rehearsal", async () => {
    const official = await track({ kind: "official", open: false });
    const blocked = await expectError(official.transition("scheduled", T0), "QA422", "readiness_blocked");
    expect(blocked.detail).toContain("insufficient_pool");

    const rehearsal = await track({ open: false });
    const out = await rehearsal.transition("scheduled", T0);
    expect(out).toMatchObject({ to: "scheduled", snapshotQuestions: 87 });
    const { rows } = await pool.query("select g.game_type, g.config_locked_at is not null as locked, (select count(*)::int from public.competition_question_snapshots s where s.competition_game_id = g.id) as n from public.competition_games g where g.competition_id = $1 order by 1", [rehearsal.competitionId]);
    expect(rows).toEqual([{ game_type: "minefield", locked: true, n: 42 }, { game_type: "race", locked: true, n: 45 }]);
  });

  it("enforces legal transitions, admin-only, and one open competition", async () => {
    const w = await track({ open: false });
    await expectError(w.transition("open", T0), "QA409", "illegal_transition");
    await expectError(call("transition_competition", [w.competitionId, w.students[0], "scheduled"], T0), "42501", "actor_not_admin");
    await w.transition("scheduled", T0);
    await expectError(w.transition("finalized", T0), "QA422", "use_finalize_competition");
    const other = await track({ open: false });
    await other.transition("scheduled", T0);
    await w.transition("open", T0);
    await expectError(other.transition("open", T0), "QA409", "another_competition_open");
    await expectError(w.transition("scheduled", T0), "QA409", "illegal_transition");
  });

  it("locks configuration and keeps the snapshot immutable after scheduling", async () => {
    const w = await track({ open: false });
    await w.transition("scheduled", T0);
    await expect(pool.query("update public.competition_games set total_duration_ms = 20000 where competition_id = $1", [w.competitionId])).rejects.toMatchObject({ code: "QA409" });
    await expect(pool.query("update public.competition_question_snapshots set snapshot_private = '{}' where competition_game_id in (select id from public.competition_games where competition_id = $1)", [w.competitionId])).rejects.toMatchObject({ code: "QA409" });
    await w.cleanup();
    worlds.splice(worlds.indexOf(w), 1);
  });

  it("rejects starts before opening, after the start deadline and after StartClosed (LA-TRY-007)", async () => {
    const w = await track({ open: false });
    await w.transition("scheduled", T0);
    await expectError(start(w, w.students[0], "race", T0), "QA409", "start_closed");
    await w.transition("open", T0);
    await expectError(start(w, w.students[0], "race", at(3_600_001)), "QA409", "start_closed");
    const ok = await start(w, w.students[1], "race", at(3_599_000));
    expect(ok.projection.attempt.state).toBe("active");
    const rec = await call<{ startClosed: boolean }>("reconcile_competition", [w.competitionId], at(3_600_001));
    expect(rec.startClosed).toBe(true);
    await expectError(start(w, w.students[2], "minefield", at(3_600_002)), "QA409", "start_closed");
    // the attempt that started in time still resumes
    expect((await start(w, w.students[1], "race", at(3_600_100))).result.resumed).toBe(true);
    await w.cleanup();
    worlds.splice(worlds.indexOf(w), 1);
  });
});

describe("one attempt per student, game and competition (LA-TRY-*, LA-IDEM-002)", () => {
  it("F5, re-login and a different key resume the same attempt without re-timing anything", async () => {
    const w = await track();
    const first = await start(w, w.students[0], "race", T0);
    expect(first.result.resumed).toBe(false);
    const again = await start(w, w.students[0], "race", at(30_000));
    const third = await start(w, w.students[0], "race", at(60_000), key("other-device"));
    for (const r of [again, third]) {
      expect(r.result.resumed).toBe(true);
      expect(r.projection.attempt.id).toBe(first.projection.attempt.id);
      expect(r.projection.attempt.startedAt).toBe(first.projection.attempt.startedAt);
      expect(r.projection.attempt.endsAt).toBe(first.projection.attempt.endsAt);
    }
    const { rows } = await pool.query("select count(*)::int as n, (select count(*)::int from public.attempt_allocations where attempt_id = $1) as allocs from public.attempts where profile_id = $2 and competition_id = $3", [first.projection.attempt.id, w.students[0], w.competitionId]);
    expect(rows[0]).toEqual({ n: 1, allocs: 15 });
  });

  it("20 concurrent starts for one student and game create exactly one attempt", async () => {
    const w = await track();
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => start(w, w.students[0], "minefield", T0, key(`c${i}`))));
    expect(new Set(results.map((r) => r.projection.attempt.id)).size).toBe(1);
    expect(results.filter((r) => !r.result.resumed)).toHaveLength(1);
    const { rows } = await pool.query("select count(*)::int as n from public.attempts where profile_id = $1", [w.students[0]]);
    expect(rows[0].n).toBe(1);
  });

  it("two concurrent starts for different games give one winner and one another_attempt_active (LA-TRY-003)", async () => {
    const w = await track();
    const settled = await Promise.allSettled([start(w, w.students[0], "minefield", T0), start(w, w.students[0], "race", T0)]);
    expect(settled.filter((s) => s.status === "fulfilled")).toHaveLength(1);
    const rejected = settled.find((s) => s.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ sqlstate: "QA409", message: "another_attempt_active" });
    expect(JSON.parse(rejected.reason.detail)).toHaveProperty("attemptId");
  });

  it("allows the other game once the first attempt has ended, and never creates a second attempt for the same game", async () => {
    const w = await track({ raceMs: 20000 });
    const race = await start(w, w.students[0], "race", T0);
    await expectError(start(w, w.students[0], "minefield", at(5000)), "QA409", "another_attempt_active");
    const ended = at(20000 + 400 + 2000 + 5000);
    const mine = await start(w, w.students[0], "minefield", ended);
    expect(mine.projection.attempt.game).toBe("minefield");
    const raceAgain = await start(w, w.students[0], "race", ended);
    expect(raceAgain.result.resumed).toBe(true);
    expect(raceAgain.projection.attempt).toMatchObject({ id: race.projection.attempt.id, state: "timed_out", completionDurationMs: 20000 });
  });

  it("keeps the allocation fixed: rows are immutable (LA-ALLOC-004)", async () => {
    const w = await track();
    const a = await start(w, w.students[0], "race", T0);
    await expect(pool.query("update public.attempt_allocations set option_order = '[]' where attempt_id = $1", [a.projection.attempt.id])).rejects.toMatchObject({ code: "QA409" });
    await expect(pool.query("delete from public.attempt_allocations where attempt_id = $1", [a.projection.attempt.id])).rejects.toMatchObject({ code: "QA409" });
    await expect(pool.query("update public.attempt_events set points_delta = 5 where attempt_id = $1", [a.projection.attempt.id])).resolves.toBeDefined(); // no rows yet
  });
});

describe("question timeline and content release (LA-TIME-*, T042)", () => {
  // Race attempt started at T0: presented T0, available T0+600 (raceFirstMs), easy limit 5000 -> deadline T0+5600.
  const AVAIL = 600;
  const DEADLINE = 5600;

  it("sends no question content before available_at, by any channel (LA-TIME-013, LA-AC-022)", async () => {
    const w = await track();
    const s = await start(w, w.students[0], "race", T0);
    const id = s.projection.attempt.id;
    const alloc = s.projection.interaction!.allocationId;
    expect(JSON.stringify(s)).not.toMatch(/prompt|options|label/);
    const err = await expectError(content(w.students[0], id, alloc, 1, at(100)), "QA425", "too_early");
    expect(JSON.parse(err.detail!).availableInMs).toBe(500);
    const during = await projection(w.students[0], id, 1, at(100));
    expect(during.interaction).toMatchObject({ status: "pending", availableInMs: 500 });
    expect(JSON.stringify(during)).not.toMatch(/prompt|options|label/);
    expect(JSON.stringify(err)).not.toMatch(/prompt/);

    const fetched = await content(w.students[0], id, alloc, 1, at(AVAIL));
    expect(fetched.options.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(fetched)).not.toMatch(SECRET);
    expect(JSON.stringify(await projection(w.students[0], id, 1, at(AVAIL + 10)))).not.toMatch(SECRET);
  });

  it("a late fetch never extends the deadline and an expired question is not released (LA-TIME-015, LA-AC-023)", async () => {
    const w = await track();
    const s = await start(w, w.students[0], "race", T0);
    const id = s.projection.attempt.id;
    const alloc = s.projection.interaction!.allocationId;
    const late = await content(w.students[0], id, alloc, 1, at(3600));
    expect(late.remainingMs).toBe(DEADLINE - 3600);
    await expectError(content(w.students[0], id, alloc, 1, at(DEADLINE)), "QA409", "interaction_expired");
  });

  it.each([100, 300, 600, 1000])("accepts at deadline + latency (%i ms) and times out 1 ms later (LA-AC-025/026)", async (latency) => {
    const w = await track({ students: 2, latencyMs: latency });
    const [a, b] = w.students;
    const out: Record<string, string> = {};
    for (const [profile, delay] of [[a, 0], [b, 1]] as const) {
      const s = await start(w, profile, "race", T0);
      const alloc = s.projection.interaction!.allocationId;
      await content(profile, s.projection.attempt.id, alloc, 1, at(AVAIL));
      const r = await submit(profile, s.projection.attempt.id, alloc, await correctOption(alloc), 1, at(DEADLINE + latency + delay));
      out[profile] = r.result.outcome;
    }
    expect(out[a]).toBe("correct");
    expect(out[b]).toBe("timed_out");
  });

  it("answers need fetched content and a valid option; the deadline is min(deadline, attempt end) (LA-TIME-009, LA-AC-024)", async () => {
    const w = await track({ minefieldMs: 10000, students: 1 });
    const p = w.students[0];
    const s = await start(w, p, "minefield", T0);
    const id = s.projection.attempt.id;
    const { rows } = await pool.query("select cell_index from public.minefield_cells where attempt_id = $1 and kind = 'question' limit 1", [id]);
    const o = await openCell(p, id, rows[0].cell_index, 1, at(9000)); // flip 500 -> available 9500, deadline 9500+limit > ends 10000
    const alloc = o.result.allocationId as string;
    await expectError(submit(p, id, alloc, await correctOption(alloc), 1, at(9600)), "QA409", "content_not_fetched");
    const c = await content(p, id, alloc, 1, at(9600));
    expect(c.remainingMs).toBe(400);
    await expectError(submit(p, id, alloc, "zzzz", 1, at(9700)), "QA422", "invalid_option");
    const r = await submit(p, id, alloc, await correctOption(alloc), 1, at(10000 + 400));
    expect(r.result.outcome).toBe("correct");
  });

  it("never releases a question that would only become available after the attempt ends (LA-TIME-016, LA-AC-024)", async () => {
    const w = await track({ minefieldMs: 10000, students: 1 });
    const p = w.students[0];
    const s = await start(w, p, "minefield", T0);
    const id = s.projection.attempt.id;
    const { rows } = await pool.query("select cell_index from public.minefield_cells where attempt_id = $1 and kind = 'question' limit 1", [id]);
    const o = await openCell(p, id, rows[0].cell_index, 1, at(9800)); // available at 10300 >= ends_at
    const alloc = o.result.allocationId as string;
    await expectError(content(p, id, alloc, 1, at(10400)), "QA409", "content_unavailable");
    expect((await projection(p, id, 1, at(9900))).interaction?.status).toBe("pending");
    expect((await projection(p, id, 1, at(10400))).interaction?.status).toBe("unavailable");
    expect(await totalDisplayed(w.competitionId)).toBe(0);
    const done = await projection(p, id, 1, at(10000 + 400 + 2000 + 1));
    expect(done.attempt.state).toBe("timed_out");
    expect(done.attempt.score).toBe(0);
  });

  it("writes a timeout only after deadline + latency + lock-wait limit, then presents the next question (LA-TIME-022)", async () => {
    const w = await track({ students: 1 });
    const p = w.students[0];
    const s = await start(w, p, "race", T0);
    const id = s.projection.attempt.id;
    await content(p, id, s.projection.interaction!.allocationId, 1, at(AVAIL));
    // 400 + 2000 ms after the deadline: displayed as expired but nothing written yet
    let proj = await projection(p, id, 1, at(DEADLINE + 400 + 2000));
    expect(proj.interaction).toMatchObject({ sequence: 1, status: "expired" });
    expect(proj.attempt.mainAnswered).toBe(0);
    proj = await projection(p, id, 1, at(DEADLINE + 400 + 2000 + 1));
    expect(proj.attempt.mainAnswered).toBe(1);
    expect(proj.interaction).toMatchObject({ sequence: 2, status: "pending", availableInMs: 900 });
    expect(proj.lastEvent).toMatchObject({ type: "timeout", pointsDelta: 0 });
    // asking again changes nothing (reconcile is idempotent)
    const same = await projection(p, id, 1, at(DEADLINE + 400 + 2000 + 5));
    expect(same.attempt.version).toBe(proj.attempt.version);
  });

  it("an on-time answer is scored by its receipt time, not by when its transaction starts or waits for the lock (LA-TIME-019/020/021, LA-AC-033..035)", async () => {
    const w = await track({ students: 3, lockWaitMs: 300, offsets: { raceFirstMs: 0 } });
    const realNow = Date.now();
    // Present the question so that its deadline is 250 ms in the real future (latency allowance 400 ms).
    const present = new Date(realNow + 250 - 5000);
    const [a, b, c] = w.students;
    const prep = async (p: string) => {
      const s = await start(w, p, "race", present);
      const alloc = s.projection.interaction!.allocationId;
      await content(p, s.projection.attempt.id, alloc, 1, present);
      return { id: s.projection.attempt.id, alloc, correct: await correctOption(alloc) };
    };
    const A = await prep(a);
    const B = await prep(b);
    const C = await prep(c);

    // (1) Lock wait: the answer is received at ~now, waits ~200 ms for the row lock, and is still on time
    //     (deadline is ~now+250, allowance 400): it is judged by receipt, not by the commit time.
    const holder = await pool.connect();
    await holder.query("begin");
    await holder.query("select 1 from public.attempts where id = $1 for update", [A.id]);
    const pending = submit(a, A.id, A.alloc, A.correct, 1);
    await new Promise((r) => setTimeout(r, 200));
    await holder.query("commit");
    holder.release();
    const waited = await pending;
    expect(waited.result.outcome).toBe("correct");

    // (2) Stale transaction: a transaction that began before the deadline cannot make a late answer valid.
    const stale = await pool.connect();
    await stale.query("begin");
    await stale.query("select now()");
    await new Promise((r) => setTimeout(r, Math.max(0, present.getTime() + 5000 + 400 + 50 - Date.now())));
    const { rows } = await stale.query("select public.submit_answer($1, $2, $3, $4, $5, 1) as r", [b, B.id, B.alloc, B.correct, key("stale")]);
    await stale.query("commit");
    stale.release();
    expect(rows[0].r.result.outcome).toBe("timed_out");

    // (3) Lock timeout: waiting past lock_wait_limit aborts with 55P03 and writes nothing; a retry is scored on its own receipt.
    const hold2 = await pool.connect();
    await hold2.query("begin");
    await hold2.query("select 1 from public.attempts where id = $1 for update", [C.id]);
    const blocked = submit(c, C.id, C.alloc, C.correct, 1);
    await expectError(blocked, "55P03");
    await hold2.query("rollback");
    hold2.release();
    const { rows: subs } = await pool.query("select count(*)::int as n from public.answer_submissions where attempt_id = $1", [C.id]);
    expect(subs[0].n).toBe(0);
  });
});

describe("display counter moves exactly once per released question (LA-ALLOC-012, mandatory)", () => {
  it("F5, repeated and concurrent content calls do not increase it; nor do answered, unopened or unreleased questions", async () => {
    const w = await track({ students: 2 });
    const [p, q] = w.students;
    const s = await start(w, p, "race", T0);
    const id = s.projection.attempt.id;
    const alloc = s.projection.interaction!.allocationId;
    expect(await totalDisplayed(w.competitionId)).toBe(0);
    expect(await exposure(w.competitionId, alloc)).toMatchObject({ allocated_count: 1, displayed_count: 0 });

    await expectError(content(p, id, alloc, 1, at(100)), "QA425"); // too early: not released, not counted
    expect((await exposure(w.competitionId, alloc)).displayed_count).toBe(0);

    await content(p, id, alloc, 1, at(700));
    await content(p, id, alloc, 1, at(800)); // repeated API call
    await projection(p, id, 1, at(900)); // F5
    await start(w, p, "race", at(950)); // resume
    await Promise.all(Array.from({ length: 12 }, () => content(p, id, alloc, 1, at(1000)))); // concurrent
    expect(await exposure(w.competitionId, alloc)).toMatchObject({ allocated_count: 1, displayed_count: 1 });

    await submit(p, id, alloc, await correctOption(alloc), 1, at(1500));
    await expectError(content(p, id, alloc, 1, at(1600)), "QA409", "interaction_not_open"); // answered: no re-release
    expect(await totalDisplayed(w.competitionId)).toBe(1);

    // a second player holding the same question counts once more, once
    const s2 = await start(w, q, "minefield", T0);
    expect(await totalDisplayed(w.competitionId)).toBe(1); // 13 allocated, none opened or displayed
    const cell = (await pool.query("select cell_index from public.minefield_cells where attempt_id = $1 and kind = 'question' limit 1", [s2.projection.attempt.id])).rows[0].cell_index;
    const o = await openCell(q, s2.projection.attempt.id, cell, 1, at(2000));
    expect(await totalDisplayed(w.competitionId)).toBe(1); // opened but content not fetched yet
    const alloc2 = o.result.allocationId as string;
    await Promise.all([content(q, s2.projection.attempt.id, alloc2, 1, at(2600)), content(q, s2.projection.attempt.id, alloc2, 1, at(2600))]);
    expect(await totalDisplayed(w.competitionId)).toBe(2);
  });

  it("holds under real-clock concurrency: 12 simultaneous fetches release once", async () => {
    const w = await track({ students: 1, offsets: { raceFirstMs: 0 } });
    const p = w.students[0];
    const s = await start(w, p, "race");
    const alloc = s.projection.interaction!.allocationId;
    const id = s.projection.attempt.id;
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => content(p, id, alloc, 1)));
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(await exposure(w.competitionId, alloc)).toMatchObject({ displayed_count: 1 });
    const { rows } = await pool.query("select count(*)::int as n from public.attempt_allocations where attempt_id = $1 and content_released_at is not null", [id]);
    expect(rows[0].n).toBe(1);
  });

  it("long-poll: a request that arrives just before available_at is held and answered at available_at, never earlier", async () => {
    const w = await track({ students: 1, offsets: { raceFirstMs: 700 } });
    const p = w.students[0];
    const s = await start(w, p, "race");
    const id = s.projection.attempt.id;
    const alloc = s.projection.interaction!.allocationId;
    const began = Date.now();
    const c = await content(p, id, alloc, 1);
    expect(Date.now() - began).toBeGreaterThanOrEqual(600);
    const { rows } = await pool.query("select content_released_at >= available_at as ok from public.attempt_allocations where id = $1", [alloc]);
    expect(rows[0].ok).toBe(true);
    expect(c.prompt.length).toBeGreaterThan(0);
  });
});

describe("device transfer and stale sessions (LA-TRY-006, T043)", () => {
  it("invalidates the old session for every action and the new one resumes the same interaction (LA-AC-005)", async () => {
    const w = await track({ students: 1 });
    const p = w.students[0];
    const s = await start(w, p, "race", T0);
    const id = s.projection.attempt.id;
    const alloc = s.projection.interaction!.allocationId;
    await content(p, id, alloc, 1, at(700));

    const t = await call<{ replayed: boolean; projection: { attempt: { sessionVersion: number } } }>("transfer_attempt_session", [p, id, 1, "transfer-key-0001"], at(2000));
    expect(t.projection.attempt.sessionVersion).toBe(2);
    const replay = await call<{ replayed: boolean; projection: { attempt: { sessionVersion: number } } }>("transfer_attempt_session", [p, id, 1, "transfer-key-0001"], at(2001));
    expect(replay).toMatchObject({ replayed: true, projection: { attempt: { sessionVersion: 2 } } });
    await expectError(call("transfer_attempt_session", [p, id, 1, "transfer-key-0002"], at(2002)), "QA409", "stale_session");

    await expectError(submit(p, id, alloc, await correctOption(alloc), 1, at(2100)), "QA409", "stale_session");
    await expectError(content(p, id, alloc, 1, at(2100)), "QA409", "stale_session");
    await expectError(projection(p, id, 1, at(2100)), "QA409", "stale_session");
    await expectError(call("heartbeat_attempt", [p, id, 1], at(2100)), "QA409", "stale_session");

    // The new device sees the same pending question with the original deadline and answers it.
    const proj = await projection(p, id, 2, at(2100));
    expect(proj.interaction).toMatchObject({ allocationId: alloc, status: "released", remainingMs: 5600 - 2100 });
    await content(p, id, alloc, 2, at(2200));
    expect(await exposure(w.competitionId, alloc)).toMatchObject({ displayed_count: 1 });
    const r = await submit(p, id, alloc, await correctOption(alloc), 2, at(2500));
    expect(r.result.outcome).toBe("correct");
  });

  it("an old-device cell open is rejected and a heartbeat never moves a clock (LA-TIME-012)", async () => {
    const w = await track({ students: 1 });
    const p = w.students[0];
    const s = await start(w, p, "minefield", T0);
    const id = s.projection.attempt.id;
    await call("transfer_attempt_session", [p, id, 1, "transfer-key-0003"], at(1000));
    await expectError(openCell(p, id, 0, 1, at(1100)), "QA409", "stale_session");
    const before = await pool.query("select started_at, ends_at from public.attempts where id = $1", [id]);
    await call("heartbeat_attempt", [p, id, 2], at(5000));
    const after = await pool.query("select started_at, ends_at, last_heartbeat_at from public.attempts where id = $1", [id]);
    expect(after.rows[0].started_at).toEqual(before.rows[0].started_at);
    expect(after.rows[0].ends_at).toEqual(before.rows[0].ends_at);
    expect(after.rows[0].last_heartbeat_at).toEqual(at(5000));
  });

  it("another student cannot touch an attempt they do not own", async () => {
    const w = await track({ students: 2 });
    const s = await start(w, w.students[0], "race", T0);
    await expectError(projection(w.students[1], s.projection.attempt.id, null, at(10)), "QA404", "attempt_not_found");
    await expectError(content(w.students[1], s.projection.attempt.id, s.projection.interaction!.allocationId, 1, at(700)), "QA404", "attempt_not_found");
    void ArenaError;
    void wrongOption;
  });
});
