// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { T0, assertNoPublishedBankQuestions, at, call, clearFixtures, createWorld, expectError, loadFixtures, pool, start, type World } from "./arena";

// Stage F5 read models: admin-only monitor/list, and a student's own history.
const worlds: World[] = [];
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

describe("admin views and student history", () => {
  it("only an active admin can list competitions and monitor attempts; the monitor shows progress and incidents", async () => {
    const w = await createWorld({ students: 2 });
    worlds.push(w);
    const [a, b] = w.students;
    await start(w, a, "race", T0);
    await start(w, b, "minefield", T0);
    await expectError(call("arena_admin_monitor", [a, w.competitionId]), "42501", "actor_not_admin");
    await expectError(call("arena_admin_competitions", [b]), "42501", "actor_not_admin");
    const list = await call<Array<{ id: string; attempts: number; active: number }>>("arena_admin_competitions", [w.adminId]);
    expect(list.find((c) => c.id === w.competitionId)).toMatchObject({ attempts: 2, active: 2 });
    await call("arena_bind_session", [a, (await pool.query("select id from public.attempts where profile_id = $1", [a])).rows[0].id, crypto.randomUUID(), false]);
    const m = await call<{ attempts: Array<{ game: string; studentId: string; deviceTransfers: number; mainTotal: number }> }>("arena_admin_monitor", [w.adminId, w.competitionId], at(1000));
    expect(m.attempts.map((x) => [x.game, x.mainTotal]).sort()).toEqual([["minefield", 10], ["race", 15]]);
    expect(m.attempts.every((x) => /^ZZ/.test(x.studentId))).toBe(true); // MSSV appears for the admin only
  });

  it("a student's history lists only their own attempts and opens review only after Finalized", async () => {
    const w = await createWorld({ students: 2, raceMs: 10000 });
    worlds.push(w);
    const [a, b] = w.students;
    await start(w, a, "race", T0);
    await start(w, b, "race", T0);
    const mine = await call<Array<{ attemptId: string; reviewAvailable: boolean; competition: { standing: string } }>>("arena_my_attempts", [a]);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ reviewAvailable: false, competition: { standing: "rehearsal" } });
    await w.transition("start_closed", at(1000));
    await w.transition("settling", at(1000));
    await call("finalize_competition", [w.competitionId, w.adminId], at(10000 + 400 + 250 + 100));
    expect((await call<Array<{ reviewAvailable: boolean }>>("arena_my_attempts", [a]))[0].reviewAvailable).toBe(true);
  });
});
