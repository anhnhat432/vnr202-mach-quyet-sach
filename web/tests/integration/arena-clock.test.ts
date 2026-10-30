// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  T0, assertNoPublishedBankQuestions, at, clearFixtures, content, correctOption, createWorld, expectError, key, loadFixtures, pool, projection, start, submit, type World,
} from "./arena";

// Owner decision 2026-10-30: the moment an expired question is handled and the next one starts must not
// include the whole lock-wait limit, yet an answer that arrived on time and is only waiting for the row
// lock must never be pre-empted. Threshold = deadline + latency + reconcile_grace (defaults 400 + 250).
const worlds: World[] = [];
const track = async (options?: Parameters<typeof createWorld>[0]) => {
  const w = await createWorld(options);
  worlds.push(w);
  return w;
};
const L = 400;
const G = 250;

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

const counts = async (attemptId: string) => {
  const { rows } = await pool.query(
    `select count(*) filter (where event_type = 'timeout')::int as timeouts, count(*) filter (where event_type = 'answer')::int as answers
       from public.attempt_events where attempt_id = $1`, [attemptId]);
  return rows[0] as { timeouts: number; answers: number };
};

describe("expired questions hand over quickly and fairly (owner decision on the clock)", () => {
  it("no answer: the next question can be fetched at its own availability, not 2.4 s later", async () => {
    const w = await track({ students: 1 });
    const p = w.students[0];
    const s = await start(w, p, "race", T0);
    const id = s.projection.attempt.id;
    await content(p, id, s.projection.interaction!.allocationId, 1, at(700));
    const deadline = 5600;
    // asking for question 2 inside the grace is refused without content and says how long to wait
    const next = (await projection(p, id, 1, at(deadline + L + 1))).interaction!.upcoming!;
    const early = await expectError(content(p, id, next.allocationId, 1, at(deadline + L + 10)), "QA425", "too_early");
    expect(JSON.parse(early.detail!).availableInMs).toBe(G - 10);
    // at deadline + 900 ms (> latency + grace = 650 ms) the question is delivered with its full time budget
    const c = await content(p, id, next.allocationId, 1, at(deadline + 900));
    expect(c.remainingMs).toBe(5000);
    expect((await counts(id))).toEqual({ timeouts: 1, answers: 0 });
  });

  it("an answer received on time but waiting for the row lock is scored on time, even though the reconcile arrives after the grace (real clock)", async () => {
    const w = await track({ students: 1, offsets: { raceFirstMs: 0 } });
    const p = w.students[0];
    const present = new Date(Date.now() + 600 - 5000); // deadline in ~600 ms
    const s = await start(w, p, "race", present);
    const id = s.projection.attempt.id;
    const alloc = s.projection.interaction!.allocationId;
    await content(p, id, alloc, 1, present);
    const correct = await correctOption(alloc);

    const holder = await pool.connect();
    await holder.query("begin");
    await holder.query("select 1 from public.attempts where id = $1 for update", [id]); // e.g. a slow request holds the row
    await new Promise((r) => setTimeout(r, 400));
    const answer = submit(p, id, alloc, correct, 1); // received ~200 ms before the deadline, now queued
    await new Promise((r) => setTimeout(r, 60));
    // wait until the grace has passed (deadline + latency + grace), THEN a reconcile also queues
    await new Promise((r) => setTimeout(r, Math.max(0, present.getTime() + 5000 + L + G + 80 - Date.now())));
    const reconcile = projection(p, id, 1);
    await new Promise((r) => setTimeout(r, 100));
    await holder.query("commit");
    holder.release();
    const [a, r] = await Promise.all([answer, reconcile]);
    expect(a.result.outcome).toBe("correct");
    expect(a.replayed).toBe(false);
    expect(r.attempt.mainCorrect).toBe(1);
    expect(await counts(id)).toEqual({ timeouts: 0, answers: 1 });
    expect(r.interaction?.sequence).toBe(2); // moved on exactly once
  });

  it("answer and reconcile racing at the boundary: never both, never lost (20 real-clock trials)", async () => {
    const w = await track({ students: 20, offsets: { raceFirstMs: 0 } });
    const trials = await Promise.all(w.students.map(async (p, i) => {
      const jitter = (i % 5) * 60 - 120; // answer arrives from 120 ms before to 120 ms after the answer window closes
      const closes = Date.now() + 700; // deadline + latency
      const present = new Date(closes - L - 5000);
      const s = await start(w, p, "race", present);
      const id = s.projection.attempt.id;
      const alloc = s.projection.interaction!.allocationId;
      await content(p, id, alloc, 1, present);
      const correct = await correctOption(alloc);
      const wait = (t: number) => new Promise((r) => setTimeout(r, Math.max(0, t - Date.now())));
      const answer = wait(closes + jitter).then(() => submit(p, id, alloc, correct, 1, undefined, key(`t${i}`)));
      const reconcile = wait(closes + G + (i % 3) * 20).then(() => projection(p, id, 1));
      await Promise.all([answer, reconcile]);
      return { id, alloc };
    }));
    for (const { id, alloc } of trials) {
      const { rows: [sub] } = await pool.query("select received_at, outcome from public.answer_submissions where allocation_id = $1", [alloc]);
      const { rows: [al] } = await pool.query("select outcome, deadline_at from public.attempt_allocations where id = $1", [alloc]);
      const ev = await counts(id);
      expect(ev.timeouts + ev.answers, "exactly one resolution per question").toBe(1);
      if (sub) {
        const onTime = sub.received_at.getTime() <= al.deadline_at.getTime() + L;
        expect(al.outcome).toBe(onTime ? "correct" : "timed_out"); // judged by receipt, never by who got the lock first
      } else {
        expect(al.outcome).toBe("timed_out");
      }
    }
  }, 30_000);

  it("all 15 Game 2 questions expire unanswered: each is timed out once, chained, never skipped or doubled", async () => {
    const w = await track({ students: 1 });
    const p = w.students[0];
    const s = await start(w, p, "race", T0);
    const id = s.projection.attempt.id;
    const far = at(140_000); // everything has expired; the attempt would still be inside its 150 s
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => projection(p, id, 1, at(140_000 + i))));
    expect(results.every((r) => r.attempt.mainAnswered === 15)).toBe(true);
    const fin = await projection(p, id, 1, far);
    expect(fin.attempt).toMatchObject({ state: "completed", score: 0, mainAnswered: 15, mainCorrect: 0 });
    expect(await counts(id)).toEqual({ timeouts: 15, answers: 0 });
    const { rows } = await pool.query("select sequence, difficulty, presented_at, available_at, deadline_at, outcome from public.attempt_allocations where attempt_id = $1 order by sequence", [id]);
    expect(rows.map((r) => r.outcome)).toEqual(Array(15).fill("timed_out"));
    const limit = { easy: 5000, medium: 7000, hard: 9000 } as const;
    let expectedPresented = T0.getTime();
    rows.forEach((r, i) => {
      expect(r.presented_at.getTime(), `presented #${i + 1}`).toBe(expectedPresented);
      const off = i === 0 ? 600 : 900;
      expect(r.deadline_at.getTime() - r.available_at.getTime()).toBe(limit[r.difficulty as keyof typeof limit]);
      expect(r.available_at.getTime() - r.presented_at.getTime()).toBe(off);
      expectedPresented = r.deadline_at.getTime();
    });
    expect(fin.attempt.completionDurationMs).toBe(rows[14].deadline_at.getTime() - T0.getTime());
  });

  it("concurrent reconciles at the first threshold move to question 2 exactly once", async () => {
    const w = await track({ students: 1 });
    const p = w.students[0];
    const s = await start(w, p, "race", T0);
    const id = s.projection.attempt.id;
    const t = at(5600 + L + G + 1);
    const out = await Promise.all(Array.from({ length: 15 }, () => projection(p, id, 1, t)));
    expect(new Set(out.map((r) => r.interaction?.sequence))).toEqual(new Set([2]));
    expect(await counts(id)).toEqual({ timeouts: 1, answers: 0 });
    const { rows } = await pool.query("select count(*)::int as n from public.attempt_allocations where attempt_id = $1 and presented_at is not null", [id]);
    expect(rows[0].n).toBe(2);
  });

  it("a late answer after the window is a timeout with the same chained timeline as a reconcile", async () => {
    const w = await track({ students: 2 });
    const [a, b] = w.students;
    const times: Date[] = [];
    for (const [p, lateAnswer] of [[a, true], [b, false]] as const) {
      const s = await start(w, p, "race", T0);
      const id = s.projection.attempt.id;
      const alloc = s.projection.interaction!.allocationId;
      await content(p, id, alloc, 1, at(700));
      if (lateAnswer) {
        const r = await submit(p, id, alloc, await correctOption(alloc), 1, at(5600 + L + 120));
        expect(r.result.outcome).toBe("timed_out");
      } else {
        await projection(p, id, 1, at(5600 + L + G + 1));
      }
      const { rows } = await pool.query("select presented_at from public.attempt_allocations where attempt_id = $1 and sequence = 2", [id]);
      times.push(rows[0].presented_at);
      expect(await counts(id)).toEqual({ timeouts: 1, answers: 0 }); // a late answer is ledgered as a timeout too
    }
    expect(times[0]).toEqual(times[1]);
  });

  it("minefield: a pending question that expires is handled once after the grace and the board stays usable", async () => {
    const w = await track({ students: 1 });
    const p = w.students[0];
    const s = await start(w, p, "minefield", T0);
    const id = s.projection.attempt.id;
    const { rows: cells } = await pool.query("select cell_index from public.minefield_cells where attempt_id = $1 and kind = 'question' limit 2", [id]);
    const { openCell } = await import("./arena");
    const o = await openCell(p, id, cells[0].cell_index, 1, at(100));
    await content(p, id, o.result.allocationId as string, 1, at(700));
    const d = (await pool.query("select deadline_at from public.attempt_allocations where id = $1", [o.result.allocationId])).rows[0].deadline_at.getTime() - T0.getTime();
    expect((await projection(p, id, 1, at(d + L + G))).attempt.mainAnswered).toBe(0);
    const after = await projection(p, id, 1, at(d + L + G + 1));
    expect(after.attempt.mainAnswered).toBe(1);
    expect(after.interaction).toBeNull();
    const next = await openCell(p, id, cells[1].cell_index, 1, at(d + L + G + 2));
    expect(next.projection.interaction?.status).toBe("pending");
  });
});
