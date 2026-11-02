// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  MINEFIELD, RACE, applyMinefield, applyRace, initialMinefield, initialRace, rankEntries,
  type Difficulty, type MinefieldAction, type MinefieldState, type Outcome, type RaceState,
} from "@/features/arena/domain/scoring";
import {
  T0, arrange, assertNoPublishedBankQuestions, at, call, cells, clearFixtures, content, correctOption, createWorld, deadlineOf, events, expectError, key,
  loadFixtures, openCell, optionFor, pool, projection, start, submit, totalDisplayed, type Projection, type World,
} from "./arena";

const worlds: World[] = [];
const track = async (options?: Parameters<typeof createWorld>[0]) => {
  const w = await createWorld(options);
  worlds.push(w);
  return w;
};
const SECRET = /correctOptionId|explanation|snapshot_private|student_id|full_name/;
const LATENCY = 400;

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

// ---- drivers -------------------------------------------------------------------------------------
class Player {
  t = 0; // ms after T0 on the fixed test clock
  sv = 1;
  seen: string[] = [];
  constructor(readonly profile: string, readonly id: string, readonly game: "minefield" | "race", public offset: number) {}
  static async begin(w: World, profile: string, game: "minefield" | "race", offset: number) {
    const s = await start(w, profile, game, T0);
    const p = new Player(profile, s.projection.attempt.id, game, offset);
    p.record(s);
    return p;
  }
  record<R>(response: R): R {
    this.seen.push(JSON.stringify(response));
    return response;
  }
  proj() {
    return projection(this.profile, this.id, this.sv, at(this.t)).then((r) => this.record(r));
  }
  // Fetch at availability and answer; "timed_out" answers 1 ms past the allowance. Returns the response.
  async resolve(p: Projection, outcome: Outcome, presentedAtMs: number) {
    const alloc = p.interaction!.allocationId;
    await content(this.profile, this.id, alloc, this.sv, at(presentedAtMs + this.offset)).then((c) => this.record(c));
    let when: number;
    let option: string;
    if (outcome === "timed_out") {
      when = (await deadlineOf(alloc)).getTime() - T0.getTime() + LATENCY + 1;
      option = await correctOption(alloc);
    } else {
      when = presentedAtMs + this.offset + 100;
      option = await optionFor(alloc, outcome);
    }
    const r = this.record(await submit(this.profile, this.id, alloc, option, this.sv, at(when)));
    this.t = when + 10;
    return r;
  }
}

type Step = { action: MinefieldAction; score: number };

async function playMineCell(pl: Player, cell: number, outcome: Outcome): Promise<{ action: MinefieldAction; score: number; state: string }> {
  const o = pl.record(await openCell(pl.profile, pl.id, cell, pl.sv, at(pl.t)));
  const kind = o.result.kind as string;
  const openedAt = pl.t;
  if (kind === "chest" || kind === "shield" || kind === "double") {
    pl.t += 10;
    return { action: { type: kind }, score: o.projection.attempt.score, state: o.projection.attempt.state };
  }
  const r = await pl.resolve(o.projection, outcome, openedAt);
  const action: MinefieldAction = kind === "bomb" ? { type: "defuse", outcome } : { type: "main", difficulty: o.result.difficulty as Difficulty, outcome };
  return { action, score: r.projection.attempt.score, state: r.projection.attempt.state };
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

describe("allocation wired into start (T041, LA-AC-036/037)", () => {
  it("60 near-simultaneous starts per game: composition, no repeats, spread <= 1, <= 5 two-option, nothing displayed", async () => {
    const w = await track({ students: 120 });
    const mine = w.students.slice(0, 60);
    const race = w.students.slice(60);
    const results = await Promise.all([...mine.map((p) => start(w, p, "minefield", T0)), ...race.map((p) => start(w, p, "race", T0))]);
    expect(results.every((r) => !r.result.resumed)).toBe(true);

    const { rows: spread } = await pool.query(
      `select q.game_type, q.pool, q.difficulty, max(x.allocated_count) - min(x.allocated_count) as spread, sum(x.allocated_count)::int as total
         from public.question_exposures x join public.question_versions v on v.id = x.question_version_id join public.questions q on q.id = v.question_id
        where x.competition_id = $1 group by 1, 2, 3`, [w.competitionId]);
    for (const r of spread) expect(Number(r.spread), `${r.game_type}/${r.pool}/${r.difficulty}`).toBeLessThanOrEqual(1);
    expect(spread.find((r) => r.pool === "minefield_main" && r.difficulty === "medium")!.total).toBe(60 * 4);
    expect(await totalDisplayed(w.competitionId)).toBe(0);

    const { rows: sets } = await pool.query(
      `select a.id, a.game_type, count(*)::int as n, count(distinct al.snapshot_id)::int as distinct_q,
              count(*) filter (where s.option_count = 2 and a.game_type = 'race')::int as two_option,
              count(*) filter (where al.role = 'main' and al.difficulty = 'easy')::int as easy,
              count(*) filter (where al.role = 'main' and al.difficulty = 'medium')::int as medium,
              count(*) filter (where al.role = 'main' and al.difficulty = 'hard')::int as hard,
              count(*) filter (where al.role = 'defuse')::int as defuse,
              bool_and((select count(*) from jsonb_array_elements(al.option_order)) = s.option_count) as full_order
         from public.attempts a join public.attempt_allocations al on al.attempt_id = a.id join public.competition_question_snapshots s on s.id = al.snapshot_id
        where a.competition_id = $1 group by a.id, a.game_type`, [w.competitionId]);
    expect(sets).toHaveLength(120);
    for (const s of sets) {
      expect(s.n).toBe(s.distinct_q);
      expect(s.full_order).toBe(true);
      if (s.game_type === "race") expect([s.n, s.easy, s.medium, s.hard, s.two_option <= 5]).toEqual([15, 5, 7, 3, true]);
      else expect([s.n, s.easy, s.medium, s.hard, s.defuse]).toEqual([13, 3, 4, 3, 3]);
    }
  }, 60_000);

  it("fails with a clear QB002 error when the two-option cap cannot be met (Q1)", async () => {
    const w = await track({ open: false, students: 1 });
    await pool.query("delete from public.questions where origin = 'fixture' and game_type = 'race' and option_count = 3 and difficulty in ('easy', 'medium')");
    const err = await expectError(call("allocate_question_set", [w.competitionId, "race", "rehearsal"]), "QB002", "two_option_cap_unsatisfiable");
    expect(err.detail).toContain("at most 5");
    await loadFixtures("dev87");
  });
});

describe("Bãi Mìn Tri Thức rules (T044)", () => {
  it("builds a 4x5 board of 10/3/1/2/4 with a hidden layout and 3/4/3 + 3 defuse allocations (LA-AC-006)", async () => {
    const w = await track({ students: 12 });
    for (const p of w.students) {
      const s = await start(w, p, "minefield", T0);
      const layout = await cells(s.projection.attempt.id);
      const count = (k: string) => layout.filter((c) => c.kind === k).length;
      expect([layout.length, count("question"), count("bomb"), count("double"), count("shield"), count("chest")]).toEqual([20, 10, 3, 1, 2, 4]);
      expect(layout.filter((c) => c.kind === "question").map((c) => c.difficulty).sort()).toEqual([...Array(3).fill("easy"), ...Array(3).fill("hard"), ...Array(4).fill("medium")]);
      expect(s.projection.board).toHaveLength(20);
      expect(s.projection.board!.every((c) => c.opened === false && Object.keys(c).length === 2)).toBe(true); // nothing about unopened cells
    }
  });

  it("never opens a bomb first: the cell is swapped with a safe one and the swap is logged (MINE-BOARD-003, LA-AC-007)", async () => {
    const w = await track({ students: 8 });
    for (const p of w.students) {
      const s = await start(w, p, "minefield", T0);
      const id = s.projection.attempt.id;
      const before = await cells(id);
      const bomb = before.find((c) => c.kind === "bomb")!;
      const r = await openCell(p, id, bomb.cell_index, 1, at(100));
      expect(r.result.kind).not.toBe("bomb");
      const after = await cells(id);
      expect(after.filter((c) => c.kind === "bomb")).toHaveLength(3);
      const { rows } = await pool.query("select swapped_from_index from public.minefield_cells where attempt_id = $1 and cell_index = $2", [id, bomb.cell_index]);
      expect(rows[0].swapped_from_index).not.toBeNull();
      expect((await events(id)).filter((e) => e.event_type === "board_swap")).toHaveLength(1);
    }
  });

  it("opening a cell twice replays it; a pending interaction blocks other cells (MINE-BOARD-007/008)", async () => {
    const w = await track({ students: 1 });
    const p = w.students[0];
    const s = await start(w, p, "minefield", T0);
    const id = s.projection.attempt.id;
    await arrange(id, ["chest", "easy", "medium"]);
    const first = await openCell(p, id, 0, 1, at(10), "same-key-0001");
    const again = await openCell(p, id, 0, 1, at(20), "other-key-0002");
    expect(again.replayed).toBe(true);
    expect(again.projection.attempt.score).toBe(first.projection.attempt.score);
    expect((await events(id)).filter((e) => e.event_type === "chest")).toHaveLength(1);

    const q = await openCell(p, id, 1, 1, at(30));
    expect(q.projection.interaction).toMatchObject({ status: "pending", difficulty: "easy" });
    await expectError(openCell(p, id, 2, 1, at(40)), "QA409", "interaction_pending");
    const replay = await openCell(p, id, 1, 1, at(50)); // replay of the open cell is still fine while pending
    expect(replay.replayed).toBe(true);
  });

  it("two simultaneous different-cell opens apply exactly one; same cell concurrently scores a chest once (LA-IDEM-003)", async () => {
    const w = await track({ students: 2 });
    const [a, b] = w.students;
    const sa = await start(w, a, "minefield", T0);
    await arrange(sa.projection.attempt.id, ["easy", "medium", "chest"]);
    const settled = await Promise.allSettled([openCell(a, sa.projection.attempt.id, 0, 1, at(10)), openCell(a, sa.projection.attempt.id, 1, 1, at(10))]);
    expect(settled.filter((s) => s.status === "fulfilled")).toHaveLength(1);
    expect((settled.find((s) => s.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ message: "interaction_pending" });

    const sb = await start(w, b, "minefield", T0);
    await arrange(sb.projection.attempt.id, ["chest"]);
    const same = await Promise.all(Array.from({ length: 8 }, () => openCell(b, sb.projection.attempt.id, 0, 1, at(10), key("c"))));
    expect(same.filter((r) => !r.replayed)).toHaveLength(1);
    expect((await projection(b, sb.projection.attempt.id, 1, at(20))).attempt.score).toBe(40);
  });

  it("reaches exactly 2 460 with x2 on a hard question and every other answer correct (MINE-END-003)", async () => {
    const w = await track({ students: 1 });
    const p = w.students[0];
    const pl = await Player.begin(w, p, "minefield", 500);
    await arrange(pl.id, ["double", "hard", "chest", "chest", "chest", "chest", "shield", "shield", "bomb", "bomb", "bomb"]);
    let model: MinefieldState = initialMinefield();
    let last: { score: number; state: string } = { score: 0, state: "active" };
    for (let cell = 0; cell < 20 && last.state === "active"; cell += 1) {
      const step = await playMineCell(pl, cell, "correct");
      model = applyMinefield(model, step.action);
      expect(step.score).toBe(model.score);
      last = step;
    }
    expect(last.score).toBe(MINEFIELD.maxScore);
    expect(model.score).toBe(2460);
    const fin = await pl.proj();
    expect(fin.attempt).toMatchObject({ state: "completed", mainAnswered: 10, mainCorrect: 10 });
    expect(pl.seen.join("")).not.toMatch(SECRET);
  });

  it("x2 is consumed by the next main question whatever the outcome and is untouched by defusing (MINE-ITEM-001)", async () => {
    const w = await track({ students: 1 });
    const pl = await Player.begin(w, w.students[0], "minefield", 500);
    await arrange(pl.id, ["double", "bomb", "medium", "medium"]);
    expect((await playMineCell(pl, 0, "correct")).action).toEqual({ type: "double" });
    expect((await pl.proj()).attempt.doubleArmed).toBe(true);
    await playMineCell(pl, 1, "correct"); // defuse ok
    expect((await pl.proj()).attempt.doubleArmed).toBe(true);
    const wrong = await playMineCell(pl, 2, "incorrect");
    expect(wrong.score).toBe(0);
    expect((await pl.proj()).attempt.doubleArmed).toBe(false); // consumed although wrong
    const next = await playMineCell(pl, 3, "correct");
    expect(next.score).toBe(200); // not doubled
    const evs = (await events(pl.id)).map((e) => e.event_type);
    expect(evs.filter((e) => e === "double_consumed")).toHaveLength(1);
  });

  it("bombs: a shield absorbs a failed defuse, otherwise -100 floored at 0; defuse is not a main question (MINE-BOMB-*, MINE-ITEM-002)", async () => {
    const w = await track({ students: 2 });
    const a = await Player.begin(w, w.students[0], "minefield", 500);
    await arrange(a.id, ["easy", "shield", "shield", "bomb", "bomb", "bomb"]);
    expect((await playMineCell(a, 0, "correct")).score).toBe(100);
    await playMineCell(a, 1, "correct");
    await playMineCell(a, 2, "correct");
    expect((await a.proj()).attempt.shields).toBe(2);
    expect((await playMineCell(a, 3, "incorrect")).score).toBe(100); // shield 2 -> 1
    expect((await playMineCell(a, 4, "timed_out")).score).toBe(100); // shield 1 -> 0
    expect((await a.proj()).attempt.shields).toBe(0);
    expect((await playMineCell(a, 5, "incorrect")).score).toBe(0); // no shield: -100
    expect((await a.proj()).attempt).toMatchObject({ mainAnswered: 1, mainCorrect: 1 });

    const b = await Player.begin(w, w.students[1], "minefield", 500);
    await arrange(b.id, ["chest", "bomb", "bomb"]);
    await playMineCell(b, 0, "correct");
    expect((await playMineCell(b, 1, "incorrect")).score).toBe(0); // 40 - 100 floors at 0
    expect((await playMineCell(b, 2, "incorrect")).score).toBe(0);
    expect((await events(b.id)).filter((e) => e.event_type === "bomb_penalty").map((e) => e.points_delta)).toEqual([-40, 0]);
    expect((await events(b.id)).every((e) => e.score_after >= 0)).toBe(true);
  });

  it("a bomb pending when the clock runs out is a failed defuse, then the attempt ends (LA-TIME-009, LA-AC-008)", async () => {
    const w = await track({ students: 2, minefieldMs: 10000 });
    for (const [i, p] of w.students.entries()) {
      const s = await start(w, p, "minefield", T0);
      const id = s.projection.attempt.id;
      await arrange(id, i === 0 ? ["chest", "bomb"] : ["shield", "bomb"]);
      await openCell(p, id, 0, 1, at(100));
      await openCell(p, id, 1, 1, at(9000)); // defuse available 9500, effective deadline = ends 10000
      const fin = await projection(p, id, 1, at(10000 + LATENCY + 2000 + 1));
      expect(fin.attempt).toMatchObject({ state: "timed_out", completionDurationMs: 10000, score: 0 });
      const evs = (await events(id)).map((e) => e.event_type);
      expect(evs).toContain(i === 0 ? "bomb_penalty" : "shield_consumed");
    }
  });

  it("a finished attempt rejects further actions and records the completion time (MINE-END-001/002, LA-LB-009)", async () => {
    const w = await track({ students: 1 });
    const p = w.students[0];
    const pl = await Player.begin(w, p, "minefield", 500);
    await arrange(pl.id, ["easy", "easy", "easy", "medium", "medium", "medium", "medium", "hard", "hard", "hard"]);
    let state = "active";
    for (let c = 0; c < 10; c += 1) state = (await playMineCell(pl, c, "correct")).state;
    expect(state).toBe("completed");
    const fin = await pl.proj();
    expect(fin.attempt.completionDurationMs).toBeGreaterThan(0);
    expect(fin.attempt.completionDurationMs).toBeLessThan(180_000);
    await expectError(openCell(p, pl.id, 10, 1, at(pl.t)), "QA410", "attempt_terminal");
    const untouched = (await cells(pl.id)).find((c) => c.kind === "bomb")!.allocation_id!;
    await expectError(submit(p, pl.id, untouched, "a", 1, at(pl.t)), "QA410", "attempt_terminal");
    await expectError(content(p, pl.id, untouched, 1, at(pl.t)), "QA410", "attempt_terminal");
  });
});

describe("Đường Đua Lịch Sử rules (T045)", () => {
  const driveRace = async (w: World, profile: string, plan: Outcome[]) => {
    const pl = await Player.begin(w, profile, "race", 0); // offsets applied below via presented times
    let model: RaceState = initialRace();
    let proj = (await pl.proj()) as Projection;
    let presented = 0;
    const diffs: string[] = [];
    for (const outcome of plan) {
      const it = proj.interaction!;
      expect(it.status).toBe("pending");
      const { rows } = await pool.query("select difficulty, available_at from public.attempt_allocations where id = $1", [it.allocationId]);
      diffs.push(rows[0].difficulty);
      const availMs = rows[0].available_at.getTime() - T0.getTime();
      pl.offset = availMs - presented;
      const r = await pl.resolve(proj, outcome, presented);
      model = applyRace(model, { difficulty: rows[0].difficulty, outcome });
      expect(r.projection.attempt.score).toBe(model.score);
      expect(r.projection.attempt.streak).toBe(model.streak);
      expect(r.projection.attempt.comboAwards).toBe(model.comboAwards);
      proj = r.projection;
      presented = pl.t - 10;
      if (proj.attempt.state !== "active") break;
    }
    return { pl, model, proj, diffs };
  };

  it("15 questions in the fixed 5/7/3 order, max 2 300 with 5 combo bonuses (RACE-001/005/008, LA-AC-010)", async () => {
    const w = await track({ students: 1 });
    const { model, proj, diffs, pl } = await driveRace(w, w.students[0], Array(15).fill("correct"));
    expect(diffs).toEqual([...Array(5).fill("easy"), ...Array(7).fill("medium"), ...Array(3).fill("hard")]);
    expect(proj.attempt).toMatchObject({ score: RACE.maxScore, state: "completed", mainAnswered: 15, comboAwards: 5 });
    expect(model.score).toBe(2300);
    expect(pl.seen.join("")).not.toMatch(SECRET);
  });

  it("a wrong answer or a timeout resets the combo; combos only at multiples of 3 (RACE-004/005)", async () => {
    const w = await track({ students: 1 });
    const plan: Outcome[] = ["correct", "correct", "incorrect", "correct", "correct", "correct", "correct", "timed_out", "correct", "correct", "correct", "correct", "correct", "correct", "correct"];
    const { model, proj } = await driveRace(w, w.students[0], plan);
    expect(proj.attempt.state).toBe("completed");
    expect(proj.attempt.score).toBe(model.score);
    expect(model.comboAwards).toBe(3);
  });

  it("the global clock ending mid-run closes the attempt as timed out with the full duration; the question pending at the end counts as a timeout (RACE-009, LA-TIME-009)", async () => {
    const w = await track({ students: 1, raceMs: 10000 });
    const p = w.students[0];
    const s = await start(w, p, "race", T0);
    const id = s.projection.attempt.id;
    const alloc = s.projection.interaction!.allocationId;
    await content(p, id, alloc, 1, at(700));
    const r = await submit(p, id, alloc, await correctOption(alloc), 1, at(800));
    expect(r.projection.interaction!.sequence).toBe(2);
    const fin = await projection(p, id, 1, at(10000 + LATENCY + 2000 + 1));
    expect(fin.attempt).toMatchObject({ state: "timed_out", completionDurationMs: 10000, mainAnswered: 3 });
    expect(fin.attempt.score).toBe(100);
  });
});

describe("reference model parity (T049)", () => {
  it("random scripted minefield games give identical scores step by step in SQL and TypeScript", async () => {
    const w = await track({ students: 14, minefieldMs: 900_000 });
    const random = rng(2026);
    for (const profile of w.students) {
      const pl = await Player.begin(w, profile, "minefield", 500);
      const order = [...Array(20).keys()].sort(() => random() - 0.5);
      let model = initialMinefield();
      let state = "active";
      for (const cell of order) {
        if (state !== "active") break;
        const roll = random();
        const outcome: Outcome = roll < 0.6 ? "correct" : roll < 0.85 ? "incorrect" : "timed_out";
        const step: Step & { state: string } = await playMineCell(pl, cell, outcome);
        // the first opened cell may have been swapped; the model follows what SQL actually opened
        model = applyMinefield(model, step.action);
        expect(step.score, JSON.stringify(step.action)).toBe(model.score);
        state = step.state;
      }
      const fin = await pl.proj();
      expect(fin.attempt).toMatchObject({ score: model.score, shields: model.shields, mainCorrect: model.mainCorrect });
      const evs = await events(pl.id);
      expect(evs.reduce((n, e) => n + e.points_delta, 0)).toBe(model.score); // ledger sums to the score
      expect(evs.at(-1)?.score_after ?? 0).toBe(model.score);
    }
  }, 120_000);

  it("random scripted race games match too", async () => {
    const w = await track({ students: 14 });
    const random = rng(7);
    for (const profile of w.students) {
      const plan: Outcome[] = Array.from({ length: 15 }, () => { const r = random(); return r < 0.65 ? "correct" : r < 0.85 ? "incorrect" : "timed_out"; });
      const pl = await Player.begin(w, profile, "race", 0);
      let model = initialRace();
      let proj = await pl.proj();
      let presented = 0;
      for (const outcome of plan) {
        if (proj.attempt.state !== "active") break;
        const { rows } = await pool.query("select difficulty, available_at from public.attempt_allocations where id = $1", [proj.interaction!.allocationId]);
        pl.offset = rows[0].available_at.getTime() - T0.getTime() - presented;
        const r = await pl.resolve(proj, outcome, presented);
        model = applyRace(model, { difficulty: rows[0].difficulty, outcome });
        expect(r.projection.attempt.score).toBe(model.score);
        proj = r.projection;
        presented = pl.t - 10;
      }
      expect(proj.attempt).toMatchObject({ score: model.score, mainCorrect: model.mainCorrect });
    }
  }, 120_000);
});

describe("idempotency and concurrency (LA-IDEM-*, LA-AC-015)", () => {
  const prepare = async (w: World, profile: string) => {
    const pl = await Player.begin(w, profile, "race", 0);
    const alloc = pl.proj ? (await pl.proj()).interaction!.allocationId : "";
    await content(profile, pl.id, alloc, 1, at(700));
    return { pl, alloc };
  };

  it("10 concurrent submits with one key score once; with different keys exactly one applies", async () => {
    const w = await track({ students: 2 });
    const { pl: a, alloc: aa } = await prepare(w, w.students[0]);
    const same = await Promise.all(Array.from({ length: 10 }, () => submit(a.profile, a.id, aa, "a", 1, at(1000), "dup-key-0001").catch((e) => e)));
    void same;
    const { pl: b, alloc: ba } = await prepare(w, w.students[1]);
    const correct = await correctOption(ba);
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => submit(b.profile, b.id, ba, correct, 1, at(1000), `diff-key-${i}-xx`)));
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    expect(new Set(results.map((r) => r.result.scoreAfter)).size).toBe(1);
    expect((await events(b.id)).filter((e) => e.event_type === "answer")).toHaveLength(1);
    const { rows } = await pool.query("select count(*)::int as n from public.answer_submissions where attempt_id = $1", [b.id]);
    expect(rows[0].n).toBe(1);
  });

  it("the same key retried after success returns the first result and changes nothing", async () => {
    const w = await track({ students: 1 });
    const { pl, alloc } = await prepare(w, w.students[0]);
    const first = await submit(pl.profile, pl.id, alloc, await correctOption(alloc), 1, at(1000), "retry-key-0001");
    const retry = await submit(pl.profile, pl.id, alloc, "zzz", 1, at(1100), "retry-key-0001");
    expect(retry.replayed).toBe(true);
    expect(retry.result).toEqual(first.result);
    expect((await projection(pl.profile, pl.id, 1, at(1200))).attempt.score).toBe(first.projection.attempt.score);
    // a different key for an already-resolved question also returns the recorded result
    const other = await submit(pl.profile, pl.id, alloc, await correctOption(alloc), 1, at(1300), "retry-key-0002");
    expect(other.replayed).toBe(true);
    expect(other.projection.attempt.score).toBe(first.projection.attempt.score);
  });

  it("an answer for a question that is not the pending one is refused", async () => {
    const w = await track({ students: 1 });
    const { pl } = await prepare(w, w.students[0]);
    const { rows } = await pool.query("select id from public.attempt_allocations where attempt_id = $1 and sequence = 2", [pl.id]);
    await expectError(submit(pl.profile, pl.id, rows[0].id, "a", 1, at(1000)), "QA409", "interaction_not_open");
  });
});

describe("leaderboards (T046, LA-LB-*)", () => {
  const setEntry = (w: World, game: "minefield" | "race", profile: string, v: { score: number; correct: number; hard: number; duration: number | null; state?: string }) =>
    pool.query(
      `update public.leaderboard_entries e set score = $3, correct_count = $4, hard_correct = $5, completion_duration_ms = $6, state = $7
         from public.competition_games g where g.id = e.competition_game_id and g.competition_id = $1 and g.game_type = $8 and e.profile_id = $2`,
      [w.competitionId, profile, v.score, v.correct, v.hard, v.duration, v.state ?? (v.duration === null ? "playing" : "completed"), game],
    );

  it("ranks by score, correct, hard-correct, time (unfinished last) with shared ranks 1,2,2,4 and matches the reference model", async () => {
    const w = await track({ students: 8 });
    const rows = [
      { score: 900, correct: 6, hard: 1, duration: 100000 },  // 1
      { score: 700, correct: 5, hard: 1, duration: 90000 },   // 2
      { score: 700, correct: 5, hard: 1, duration: 90000 },   // 2 (all criteria equal)
      { score: 600, correct: 5, hard: 2, duration: 80000 },   // 4 (more hard-correct)
      { score: 600, correct: 5, hard: 1, duration: 70000 },   // 5
      { score: 600, correct: 5, hard: 1, duration: 95000 },   // 6 (slower)
      { score: 600, correct: 5, hard: 1, duration: null },    // 7 (still playing)
      { score: 100, correct: 1, hard: 0, duration: 120000 },  // 8
    ];
    for (const [i, p] of w.students.entries()) {
      await start(w, p, "minefield", T0);
      await setEntry(w, "minefield", p, rows[i]);
    }
    const board = await call<{ entries: Array<{ rank: number; score: number }>; standing: string; players: number; completed: number }>("get_leaderboard", [w.publicId, "minefield", 10]);
    const expected = rankEntries(rows.map((r) => ({ score: r.score, correct: r.correct, hardCorrect: r.hard, durationMs: r.duration }))).map((e) => e.rank);
    expect(board.entries.map((e) => e.rank)).toEqual(expected);
    expect(expected).toEqual([1, 2, 2, 4, 5, 6, 7, 8]);
    expect(board).toMatchObject({ standing: "rehearsal", players: 8, completed: 7 });
    // independent boards: nobody started the race
    expect((await call<{ entries: unknown[]; players: number }>("get_leaderboard", [w.publicId, "race", 10])).players).toBe(0);
  });

  it("shows display names only, caps at Top 10, hides voided entries and never leaks identifiers (LA-LB-011/012, LA-AC-032/038)", async () => {
    const w = await track({ students: 12 });
    for (const [i, p] of w.students.entries()) {
      await start(w, p, "race", T0);
      await setEntry(w, "race", p, { score: 1000 - i * 10, correct: 5, hard: 0, duration: 50000 + i });
    }
    await pool.query("update public.leaderboard_entries e set excluded = true from public.competition_games g where g.id = e.competition_game_id and g.competition_id = $1 and e.profile_id = $2", [w.competitionId, w.students[0]]);
    await pool.query("update public.leaderboard_entries e set display_name_suffix = 2 from public.competition_games g where g.id = e.competition_game_id and g.competition_id = $1 and e.profile_id = $2", [w.competitionId, w.students[1]]);
    const board = await call<{ entries: Array<{ displayName: string; rank: number }> }>("get_leaderboard", [w.publicId, "race", 500]);
    expect(board.entries).toHaveLength(10);
    expect(board.entries[0].rank).toBe(1);
    expect(board.entries[0].displayName).toMatch(/\(2\)$/); // student 0 is voided, student 1 comes first and carries a suffix
    const text = JSON.stringify(board);
    expect(text).not.toMatch(/ZZ[0-9A-F]{8}|Sinh Viên|student_id|full_name/);
    expect(Object.keys((board.entries[0]) as object).sort()).toEqual(["completionDurationMs", "correctCount", "displayName", "entryId", "hardCorrect", "progress", "rank", "score", "state"]);
  });

  it("personal standing: gap to the player above, to 10th place, sole leader, shared first (LA-LB-005, LA-AC-031)", async () => {
    const w = await track({ students: 12 });
    const ids: string[] = [];
    for (const [i, p] of w.students.entries()) {
      const s = await start(w, p, "race", T0);
      ids.push(s.projection.attempt.id);
      await setEntry(w, "race", p, { score: 1200 - i * 100, correct: 5, hard: 0, duration: 50000 + i });
    }
    const standing = (i: number) => call<Record<string, unknown>>("get_player_standing", [w.students[i], ids[i]]);
    expect(await standing(0)).toMatchObject({ rank: 1, label: "leading", leadOverSecond: 100 });
    expect(await standing(3)).toMatchObject({ rank: 4, label: "chasing", gapToAbove: 100, gapToTenth: null });
    expect(await standing(11)).toMatchObject({ rank: 12, gapToAbove: 100, gapToTenth: 200 });
    await setEntry(w, "race", w.students[1], { score: 1200, correct: 5, hard: 0, duration: 50000 });
    await setEntry(w, "race", w.students[0], { score: 1200, correct: 5, hard: 0, duration: 50000 });
    expect(await standing(0)).toMatchObject({ rank: 1, label: "tied_first" });
  });

  it("sole leader has no gap; labels follow the competition kind and state (LA-LB-007, LA-CONTENT-006)", async () => {
    const w = await track({ students: 1 });
    const s = await start(w, w.students[0], "race", T0);
    expect(await call("get_player_standing", [w.students[0], s.projection.attempt.id])).toMatchObject({ rank: 1, label: "leading_alone", leadOverSecond: null, standing: "rehearsal" });
    expect(await call("arena_standing_label", [w.competitionId])).toBe("rehearsal");
    await pool.query("update public.competitions set kind = 'official', state = 'open' where id = $1", [w.competitionId]);
    expect(await call("arena_standing_label", [w.competitionId])).toBe("provisional");
    await pool.query("update public.competitions set state = 'finalized' where id = $1", [w.competitionId]);
    expect(await call("arena_standing_label", [w.competitionId])).toBe("official");
    await pool.query("update public.competitions set kind = 'rehearsal', state = 'open' where id = $1", [w.competitionId]);
  });

  it("every scoring event bumps the board version inside the same transaction (LA-IDEM-004, LA-LB-002)", async () => {
    const w = await track({ students: 1 });
    const pl = await Player.begin(w, w.students[0], "minefield", 500);
    await arrange(pl.id, ["chest", "easy"]);
    const version = async () => (await call<{ version: number; entries: Array<{ score: number }> }>("get_leaderboard", [w.publicId, "minefield", 10]));
    const v0 = await version();
    await playMineCell(pl, 0, "correct");
    const v1 = await version();
    expect(v1.version).toBeGreaterThan(v0.version);
    expect(v1.entries[0].score).toBe(40);
    await playMineCell(pl, 1, "correct");
    const v2 = await version();
    expect(v2.version).toBeGreaterThan(v1.version);
    expect(v2.entries[0].score).toBe(140);
  });
});

describe("finalization and review (LA-FB-*, LA-CONTENT-009)", () => {
  it("refuses review before Finalized, finalizes only after reconcile, then reveals only questions the player saw", async () => {
    const w = await track({ students: 2, raceMs: 20000, minefieldMs: 20000 });
    const [a, b] = w.students;
    const pa = await Player.begin(w, a, "race", 0);
    const proj = await pa.proj();
    const sa = proj.interaction!;
    await content(a, pa.id, sa.allocationId, 1, at(700));
    await submit(a, pa.id, sa.allocationId, await correctOption(sa.allocationId), 1, at(800));
    const pb = await Player.begin(w, b, "minefield", 500);

    await expectError(call("get_attempt_review", [a, pa.id]), "QA409", "review_not_available");
    await w.transition("start_closed", at(1000));
    await w.transition("settling", at(1000));
    await expectError(call("finalize_competition", [w.competitionId, w.adminId], at(2000)), "QA409", "attempts_still_active");
    const fin = await call<{ disclosedQuestions: number }>("finalize_competition", [w.competitionId, w.adminId], at(20000 + LATENCY + 2000 + 100));
    expect(fin.disclosedQuestions).toBe(1);

    const review = await call<{ questions: Array<{ sequence: number; correctOptionId: string; explanation: string; outcome: string; submittedOptionId: string | null }> }>("get_attempt_review", [a, pa.id]);
    expect(review.questions.map((q) => q.sequence)).toEqual([1]); // only the one that was displayed
    expect(review.questions[0]).toMatchObject({ outcome: "correct" });
    expect(review.questions[0].explanation.length).toBeGreaterThan(0);
    expect(await call("get_attempt_review", [b, pb.id])).toMatchObject({ questions: [] });
    const { rows } = await pool.query("select count(*) filter (where answer_disclosed_at is not null)::int as disclosed, count(*)::int as allocated from public.question_exposures where competition_id = $1", [w.competitionId]);
    expect(rows[0].disclosed).toBe(1);
    expect(rows[0].allocated).toBeGreaterThan(20);
    const lb = await call<{ standing: string }>("get_leaderboard", [w.publicId, "race", 10]);
    expect(lb.standing).toBe("rehearsal");
    await expectError(call("finalize_competition", [w.competitionId, w.adminId], at(30000)), "QA409", "illegal_transition");
  });
});

describe("load: 60 players answering at once on the real clock (LA-AC-015, P7)", () => {
  it("every answer is accepted, ledgers equal scores and the board agrees", async () => {
    const w = await track({ students: 60, offsets: { raceFirstMs: 0 } });
    const latencies: number[] = [];
    await Promise.all(w.students.map(async (profile) => {
      const s = await start(w, profile, "race");
      const id = s.projection.attempt.id;
      let proj = s.projection;
      for (let i = 0; i < 3; i += 1) {
        const alloc = proj.interaction!.allocationId;
        await content(profile, id, alloc, 1);
        const began = performance.now();
        const r = await submit(profile, id, alloc, await correctOption(alloc), 1);
        latencies.push(performance.now() - began);
        expect(r.result.outcome).toBe("correct");
        proj = r.projection;
      }
    }));
    const { rows } = await pool.query(
      "select a.score, coalesce((select sum(points_delta) from public.attempt_events e where e.attempt_id = a.id), 0)::int as ledger from public.attempts a where a.competition_id = $1", [w.competitionId]);
    expect(rows).toHaveLength(60);
    for (const r of rows) expect([r.score, r.ledger]).toEqual([330, 330]); // 3 x 100 + one combo bonus
    const board = await call<{ players: number; entries: Array<{ rank: number }> }>("get_leaderboard", [w.publicId, "race", 10]);
    expect(board.players).toBe(60);
    expect(board.entries.every((e) => e.rank === 1)).toBe(true); // all tied on every criterion except time: shared or ordered by time
    latencies.sort((a, b) => a - b);
    console.log(`submit latency over 60 concurrent players: p50 ${latencies[30].toFixed(0)} ms, max ${latencies.at(-1)!.toFixed(0)} ms`);
    expect(latencies.at(-1)!).toBeLessThan(2000);
  }, 60_000);
});
