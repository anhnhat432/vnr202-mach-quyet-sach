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

  it("returns competition identity, correct counts and authoritative personal rank for each owned attempt", async () => {
    const w = await createWorld({ students: 2 });
    worlds.push(w);
    const [a, b] = w.students;
    await start(w, a, "race", T0);
    await start(w, b, "race", T0);
    const mine = await call<Array<{ competition: { id: string }; mainCorrect: number; hardCorrect: number; rank: number | null }>>("arena_my_attempts", [a]);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ competition: { id: w.competitionId }, mainCorrect: 0, hardCorrect: 0, rank: 1 });
  });

  it("stores dossier progress per student, retains completion, and denies direct client access", async () => {
    const w = await createWorld({ students: 2 });
    worlds.push(w);
    const [a, b] = w.students;
    const dossier = "20000000-0000-0000-0000-000000000002";
    const state = { stage: "connections", selectedEvidence: ["c1-e1", "c1-e2", "c1-e3"], selectedDecision: "unify" };
    await call("save_dossier_progress", [a, dossier, JSON.stringify(state)]);
    await call("save_dossier_progress", [a, dossier, JSON.stringify({ ...state, stage: "comparison" })]);
    const rows = (await pool.query("select profile_id, state, completed_at from public.student_dossier_progress where profile_id = any($1::uuid[])", [[a, b]])).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ profile_id: a, state: { stage: "comparison" } });
    expect(rows[0].completed_at).not.toBeNull();
    const privileges = (await pool.query("select has_table_privilege('authenticated','public.student_dossier_progress','select') as can_read, has_function_privilege('authenticated','public.save_dossier_progress(uuid,uuid,jsonb)','execute') as can_write")).rows[0];
    expect(privileges).toMatchObject({ can_read: false, can_write: false });
  });

  it("rejects stale progress writes from another device without losing the newer state", async () => {
    const w = await createWorld({ students: 1 });
    worlds.push(w);
    const privilege = (await pool.query("select has_function_privilege('service_role', 'public.save_dossier_progress(uuid,uuid,jsonb)', 'execute') as can_overwrite")).rows[0];
    expect(privilege.can_overwrite).toBe(false);
    const dossier = "20000000-0000-0000-0000-000000000002";
    const a = JSON.stringify({ stage: "evidence", selectedEvidence: [], selectedDecision: "" });
    const b = JSON.stringify({ stage: "decision", selectedEvidence: ["c1-e1", "c1-e2", "c1-e3"], selectedDecision: "" });
    expect(await call("save_dossier_progress_versioned", [w.students[0], dossier, a, 0])).toBe(1);
    expect(await call("save_dossier_progress_versioned", [w.students[0], dossier, b, 1])).toBe(2);
    await expectError(call("save_dossier_progress_versioned", [w.students[0], dossier, a, 1]), "QA409", "progress_conflict");
    const { rows } = await pool.query("select state, version from public.student_dossier_progress where profile_id = $1 and dossier_id = $2", [w.students[0], dossier]);
    expect(rows[0]).toMatchObject({ state: { stage: "decision" }, version: 2 });
  });

  it("incidents: admin-only, reason required, void keeps score and history but leaves the boards, every action audited", async () => {
    const w = await createWorld({ students: 2 });
    worlds.push(w);
    const [a, b] = w.students;
    const started = await start(w, a, "race", T0);
    await start(w, b, "race", T0);
    const attemptId = started.projection.attempt.id;
    try {
      await expectError(call("record_attempt_incident", [b, attemptId, "void_attempt", "gian lận"]), "42501", "actor_not_admin");
      await expectError(call("record_attempt_incident", [w.adminId, attemptId, "void_attempt", " "]), "QA422", "reason_required");
      await expectError(call("record_attempt_incident", [w.adminId, attemptId, "edit_score", "sửa điểm"]), "QA422", "invalid_action");
      await call("record_attempt_incident", [w.adminId, attemptId, "note", "Mất điện phòng máy 2 phút"], at(500));
      const before = (await pool.query("select score, version from public.attempts where id = $1", [attemptId])).rows[0];
      const ledger = (await pool.query("select count(*)::int n from public.attempt_events where attempt_id = $1", [attemptId])).rows[0].n;
      const voided = await call<{ state: string }>("record_attempt_incident", [w.adminId, attemptId, "void_attempt", "Dùng tài liệu khi thi"], at(1000));
      expect(voided.state).toBe("voided");
      await expectError(call("record_attempt_incident", [w.adminId, attemptId, "void_attempt", "lặp lại"]), "QA409", "already_voided");
      const after = (await pool.query("select score, pending_allocation_id from public.attempts where id = $1", [attemptId])).rows[0];
      expect(after.score).toBe(before.score); // score untouched; ledger untouched
      expect(after.pending_allocation_id).toBeNull();
      expect((await pool.query("select count(*)::int n from public.attempt_events where attempt_id = $1", [attemptId])).rows[0].n).toBe(ledger);
      const board = await call<{ players: number; entries: Array<{ displayName: string }> }>("get_leaderboard", [w.publicId, "race"], at(1000));
      expect(board.players).toBe(1);
      expect(board.entries.map((e) => e.displayName).join()).not.toContain("SV1 ");
      // History cannot be rewritten to hide the incident.
      await expect(pool.query("update public.attempt_incidents set reason = 'x' where attempt_id = $1", [attemptId])).rejects.toThrow("append_only");
      await expect(pool.query("delete from public.attempt_incidents where attempt_id = $1", [attemptId])).rejects.toThrow("append_only");
      const m = await call<{ attempts: Array<{ attemptId: string; state: string; incidents: Array<{ action: string }> }> }>("arena_admin_monitor", [w.adminId, w.competitionId], at(1000));
      expect(m.attempts.find((x) => x.attemptId === attemptId)).toMatchObject({ state: "voided", incidents: [{ action: "note" }, { action: "void_attempt" }] });
      const audit = await call<Array<{ action: string; actor: string }>>("arena_admin_audit", [w.adminId, w.competitionId]);
      expect(audit.map((x) => x.action)).toEqual(expect.arrayContaining(["attempt.note", "attempt.void_attempt"]));
      await expectError(call("arena_admin_audit", [a, w.competitionId]), "42501", "actor_not_admin");
      // After results are published, voiding is refused; a note is still possible.
      await w.transition("start_closed", at(1000));
      await w.transition("settling", at(1000));
      await call("finalize_competition", [w.competitionId, w.adminId], at(150000 + 400 + 250 + 100));
      const other = (await pool.query("select id from public.attempts where profile_id = $1", [b])).rows[0].id;
      await expectError(call("record_attempt_incident", [w.adminId, other, "void_attempt", "phát hiện muộn"]), "QA409", "competition_finalized");
      await call("record_attempt_incident", [w.adminId, other, "note", "phát hiện muộn, đã báo giảng viên"]);
    } finally {
      await pool.query("delete from public.audit_logs where target_type = 'attempt' and target_id in (select id::text from public.attempts where competition_id = $1)", [w.competitionId]);
    }
  });

  it("disclosed questions are reused only by explicit confirmation in a Draft official competition", async () => {
    const rehearsal = await createWorld({ students: 1, open: false });
    worlds.push(rehearsal);
    const official = await createWorld({ students: 1, kind: "official", open: false });
    worlds.push(official);
    const [v1, v2] = (await pool.query("select id from public.question_versions order by id limit 2")).rows.map((r) => r.id as string);
    const donor = crypto.randomUUID();
    await pool.query("insert into public.question_exposures (question_version_id, competition_id, allocated_count, displayed_count, answer_disclosed_at) values ($1, $2, 1, 1, now())", [v1, donor]);
    try {
      const listed = await call<{ kind: string; questions: unknown[] }>("arena_admin_disclosed", [official.adminId, official.competitionId]);
      expect(listed.kind).toBe("official"); // fixtures are never eligible for official, so nothing is listed here
      await expectError(call("arena_confirm_disclosed", [official.students[0], official.competitionId, [v1], "đủ lý do"]), "42501", "actor_not_admin");
      await expectError(call("arena_confirm_disclosed", [rehearsal.adminId, rehearsal.competitionId, [v1], "đủ lý do"]), "QA422", "not_needed_for_rehearsal");
      await expectError(call("arena_confirm_disclosed", [official.adminId, official.competitionId, [v1], "  "]), "QA422", "reason_required");
      await expectError(call("arena_confirm_disclosed", [official.adminId, official.competitionId, [v1, v2], "đủ lý do"]), "QA422", "not_disclosed");
      expect(await call("arena_confirm_disclosed", [official.adminId, official.competitionId, [v1], "Câu nền tảng, đã thay phương án"])).toBe(1);
      const audit = await call<Array<{ action: string; after: { reason: string } }>>("arena_admin_audit", [official.adminId, official.competitionId]);
      expect(audit[0]).toMatchObject({ action: "question.confirm_disclosed_reuse", after: { reason: "Câu nền tảng, đã thay phương án" } });
    } finally {
      await pool.query("delete from public.question_exposures where competition_id = $1", [donor]);
    }
  });

  it("rehearsal isolation: blocks THU rehearsal accounts from official competitions, keeps bank questions out of rehearsal snapshots, and resets rehearsal across all states", async () => {
    const w = await createWorld({ students: 1 });
    worlds.push(w);
    const [testStudent] = w.students;
    await pool.query("update public.profiles set student_id = 'THU099', is_rehearsal = true, class_id = null where id = $1", [testStudent]);

    // 1. Create a published official bank question and verify it never enters rehearsal eligible_questions or snapshots
    const srcId = crypto.randomUUID();
    await pool.query(
      "insert into public.sources (id, title, author_or_issuer, source_type, verification_status) values ($1, 'Nguồn chính thức', 'VNR202', 'syllabus', 'verified')",
      [srcId],
    );
    const bankKey = `adm-iso-bank-${w.tag.toLowerCase()}`;
    const drafted = (
      await pool.query(
        `select version_id from public.upsert_question_draft(
          $1::uuid, $2,
          '{"game_type":"race","pool":"race","chapter":"chapter_1","topic":"Chính thức","question_type":"single_choice","option_count":3,"difficulty":"easy"}'::jsonb,
          '{"prompt":"Câu chính thức không vào rehearsal","options":[{"id":"a","label":"A"},{"id":"b","label":"B"},{"id":"c","label":"C"}]}'::jsonb,
          '{"correctOptionId":"a","explanation":"Giải thích"}'::jsonb,
          jsonb_build_array(jsonb_build_object('sourceId', $3::text, 'locator', 'tr.1')),
          false
        )`,
        [w.adminId, bankKey, srcId],
      )
    ).rows[0].version_id as string;
    await call("transition_question_version", [drafted, w.adminId, "review", "ok"]);
    await call("transition_question_version", [drafted, w.adminId, "publish", "ok"]);

    const createdCompIds: string[] = [];
    try {
      const bankInRehearsalEligible = (
        await pool.query(
          "select count(*)::int as n from public.eligible_questions('race', 'rehearsal', $1) e join public.questions q on q.id = e.question_id where q.origin = 'bank'",
          [w.competitionId],
        )
      ).rows[0].n;
      expect(bankInRehearsalEligible).toBe(0);

      // Test student can play in the open rehearsal competition
      const round1Attempt = await start(w, testStudent, "race", T0);
      expect(round1Attempt.projection.attempt.state).toBe("active");

      // Also create a rehearsal competition in 'scheduled' state to verify reset_rehearsal_competition handles 'scheduled' cleanly
      const schedCreated = await call<{ id: string }>("create_competition", [
        w.adminId,
        `Rehearsal Scheduled ${w.tag}`,
        "rehearsal",
        at(-60_000),
        at(3_600_000),
      ]);
      createdCompIds.push(schedCreated.id);
      await call("transition_competition_confirmed", [schedCreated.id, w.adminId, "scheduled", 60, false, null], T0);

      // 2. Admin resets rehearsal ("Chơi thử lại") -> closes both Round 1 (open) and Scheduled round without illegal_transition
      const resetResult = await call<{ id: string; publicId: string; closedRehearsalIds: string[] }>(
        "reset_rehearsal_competition",
        [w.adminId, "Phòng thi thử #2", 120],
        at(2000),
      );
      createdCompIds.push(resetResult.id);
      expect(resetResult.closedRehearsalIds).toEqual(expect.arrayContaining([w.competitionId, schedCreated.id]));

      // Verify snapshot of the new rehearsal round contains strictly fixture questions (0 bank questions)
      const nonFixtureSnapshots = (
        await pool.query(
          "select count(*)::int as n from public.competition_question_snapshots s join public.competition_games g on g.id = s.competition_game_id where g.competition_id = $1 and s.origin <> 'fixture'",
          [resetResult.id],
        )
      ).rows[0].n;
      expect(nonFixtureSnapshots).toBe(0);

      // Old attempt is preserved as timed_out; old round is finalized; new rehearsal round has an empty leaderboard and allows a fresh attempt
      const oldAttState = (await pool.query("select state from public.attempts where id = $1", [round1Attempt.projection.attempt.id])).rows[0].state;
      expect(oldAttState).toBe("timed_out");
      const schedState = (await pool.query("select state from public.competitions where id = $1", [schedCreated.id])).rows[0].state;
      expect(schedState).toBe("finalized");

      const newAttempt = await call<{ projection: { attempt: { id: string; state: string } } }>(
        "start_or_resume_attempt",
        [testStudent, resetResult.publicId, "race", "idem-round-2"],
        at(3000),
      );
      expect(newAttempt.projection.attempt.state).toBe("active");
      expect(newAttempt.projection.attempt.id).not.toBe(round1Attempt.projection.attempt.id);

      // 3. Repeated reset back-to-back opens Round #3 with an empty leaderboard
      const resetResult2 = await call<{ id: string; publicId: string; closedRehearsalIds: string[] }>(
        "reset_rehearsal_competition",
        [w.adminId, "Phòng thi thử #3", 120],
        at(4000),
      );
      createdCompIds.push(resetResult2.id);
      expect(resetResult2.closedRehearsalIds).toContain(resetResult.id);
      const lb3 = await call<{ players: number }>("get_leaderboard", [resetResult2.publicId, "race", 10], at(4000));
      expect(lb3.players).toBe(0);

      // 4. Official competition blocks rehearsal account (rehearsal_account_forbidden) and blocks reset when official is open
      const official = await createWorld({ students: 1, kind: "official", open: false });
      worlds.push(official);
      await pool.query("update public.competitions set state = 'start_closed' where id = $1", [resetResult2.id]);
      await pool.query("update public.competitions set state = 'open' where id = $1", [official.competitionId]);

      await expectError(
        call("start_or_resume_attempt", [testStudent, official.publicId, "race", "idem-off-blocked"], at(5000)),
        "42501",
        "rehearsal_account_forbidden",
      );
      await expectError(
        call("reset_rehearsal_competition", [w.adminId, "Phòng thi thử bị chặn", 60], at(5000)),
        "QA409",
        "official_competition_currently_open",
      );
    } finally {
      for (const cid of createdCompIds) {
        await pool.query("delete from public.audit_logs where target_type = 'competition' and target_id = $1", [cid]);
        await pool.query("delete from public.question_exposures where competition_id = $1", [cid]);
        await pool.query("delete from public.competitions where id = $1", [cid]);
      }
      await pool.query("delete from public.audit_logs where target_type = 'question_version' and target_id = $1", [drafted]);
      await pool.query("delete from public.questions where external_key = $1", [bankKey]);
      await pool.query("delete from public.sources where id = $1", [srcId]);
    }
  });
});
