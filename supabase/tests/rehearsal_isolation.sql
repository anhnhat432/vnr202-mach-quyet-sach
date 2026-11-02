-- Rehearsal Studio isolation & official competition protection (migration 202611010001_rehearsal_isolation.sql).
begin;
select plan(26);

-- 1. Schema & signature checks
select has_column('public', 'profiles', 'is_rehearsal', 'profiles has is_rehearsal column');
select has_function('public', 'eligible_questions', array['public.game_type', 'text', 'uuid'], 'eligible_questions keeps exact (game_type, text, uuid) signature');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'eligible_questions'),
  1,
  'eligible_questions has no unused overload'
);
select has_function('public', 'reset_rehearsal_competition', array['uuid', 'text', 'integer'], 'reset_rehearsal_competition RPC exists');
select ok(
  not has_function_privilege('anon', 'public.reset_rehearsal_competition(uuid,text,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.reset_rehearsal_competition(uuid,text,integer)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.reset_rehearsal_competition(uuid,text,integer)', 'EXECUTE'),
  'reset_rehearsal_competition is executable by service_role only'
);

-- Seed test actors, class, source, 87 fixture questions, and 1 published bank question
insert into auth.users (id, email) values
  ('72000000-0000-4000-8000-000000000001', 'reh-admin@test.invalid'),
  ('72000000-0000-4000-8000-000000000002', 'reh-student@test.invalid'),
  ('72000000-0000-4000-8000-000000000003', 'real-student@test.invalid');

insert into public.classes (id, code, name) values
  ('72000000-0000-4000-8000-0000000000c1', 'CLS-REH', 'Lớp chính thức');

insert into public.profiles (id, role, student_id, full_name, display_name, class_id, is_rehearsal) values
  ('72000000-0000-4000-8000-000000000001', 'admin', null, 'Admin Rehearsal', 'Admin R.', null, false),
  ('72000000-0000-4000-8000-000000000002', 'student', 'THU001', 'Thí Sinh Thử 01', 'An N.V.', null, true),
  ('72000000-0000-4000-8000-000000000003', 'student', 'SE180999', 'Sinh Viên Thật', 'Bình T.T.', '72000000-0000-4000-8000-0000000000c1', false);

-- 2. Profile constraints & immutability
select throws_ok(
  $$update public.profiles set class_id = '72000000-0000-4000-8000-0000000000c1' where id = '72000000-0000-4000-8000-000000000002'$$,
  '23514',
  null,
  'rehearsal account cannot belong to a class roster'
);
select throws_ok(
  $$update public.profiles set is_rehearsal = false where id = '72000000-0000-4000-8000-000000000002'$$,
  '23514',
  'rehearsal_flag_immutable',
  'rehearsal account cannot be converted into a regular student account'
);

-- 3. Question pool & snapshot isolation (fixture vs bank)
insert into public.sources (id, title, author_or_issuer, source_type, verification_status) values
  ('72000000-0000-4000-8000-000000000501', 'Nguồn kiểm thử cách ly', 'VNR202', 'syllabus', 'verified');

do $$
declare
  v_ver uuid;
  v_i int;
  v_qid uuid;
  v_slot record;
begin
  -- Create 1 published bank question for race/easy
  select version_id into v_ver from public.upsert_question_draft(
    '72000000-0000-4000-8000-000000000001',
    'iso-bank-race-1',
    '{"game_type":"race","pool":"race","chapter":"chapter_1","topic":"Chủ đề chính thức","question_type":"single_choice","option_count":3,"difficulty":"easy"}'::jsonb,
    '{"prompt":"Câu chính thức 1","options":[{"id":"a","label":"A"},{"id":"b","label":"B"},{"id":"c","label":"C"}]}'::jsonb,
    '{"correctOptionId":"a","explanation":"Giải thích chính thức"}'::jsonb,
    '[{"sourceId":"72000000-0000-4000-8000-000000000501","locator":"tr.10"}]'::jsonb,
    false
  );
  perform public.transition_question_version(v_ver, '72000000-0000-4000-8000-000000000001', 'review', 'ok');
  perform public.transition_question_version(v_ver, '72000000-0000-4000-8000-000000000001', 'publish', 'ok');

  -- Seed 87 fixture questions across slots so rehearsal readiness passes
  for v_slot in
    select * from (values
      ('minefield'::public.game_type, 'minefield_main'::public.question_pool, 'easy'::public.question_difficulty, 'single_choice'::public.question_type, 3, 9),
      ('minefield'::public.game_type, 'minefield_main'::public.question_pool, 'medium'::public.question_difficulty, 'single_choice'::public.question_type, 3, 12),
      ('minefield'::public.game_type, 'minefield_main'::public.question_pool, 'hard'::public.question_difficulty, 'single_choice'::public.question_type, 3, 12),
      ('minefield'::public.game_type, 'minefield_defuse'::public.question_pool, 'easy'::public.question_difficulty, 'defuse_ab'::public.question_type, 2, 9),
      ('race'::public.game_type, 'race'::public.question_pool, 'easy'::public.question_difficulty, 'single_choice'::public.question_type, 3, 15),
      ('race'::public.game_type, 'race'::public.question_pool, 'medium'::public.question_difficulty, 'single_choice'::public.question_type, 3, 18),
      ('race'::public.game_type, 'race'::public.question_pool, 'hard'::public.question_difficulty, 'single_choice'::public.question_type, 3, 12)
    ) as t(game, pool, diff, qtype, opts, cnt)
  loop
    for v_i in 1 .. v_slot.cnt loop
      insert into public.questions (external_key, game_type, pool, chapter, topic, question_type, option_count, difficulty, origin)
      values (
        format('iso-fx-%s-%s-%s', v_slot.pool, v_slot.diff, v_i),
        v_slot.game,
        v_slot.pool,
        (array['chapter_1','chapter_2','chapter_3']::public.course_chapter[])[(v_i % 3) + 1],
        '[GIẢ LẬP] Kiểm thử',
        v_slot.qtype,
        v_slot.opts,
        v_slot.diff,
        'fixture'
      ) returning id into v_qid;

      insert into public.question_versions (question_id, version, status, content_public, content_private)
      values (
        v_qid,
        1,
        'published',
        case when v_slot.opts = 2
          then '{"prompt":"[GIẢ LẬP] Câu 2 đáp án","options":[{"id":"a","label":"Đáp án A"},{"id":"b","label":"Đáp án B"}]}'::jsonb
          else '{"prompt":"[GIẢ LẬP] Câu 3 đáp án","options":[{"id":"a","label":"Đáp án A"},{"id":"b","label":"Đáp án B"},{"id":"c","label":"Đáp án C"}]}'::jsonb
        end,
        '{"correctOptionId":"a","explanation":"[GIẢ LẬP] Giải thích"}'::jsonb
      );
    end loop;
  end loop;
end $$;

select is(
  (select count(*)::int from public.eligible_questions('race', 'rehearsal', null) e join public.questions q on q.id = e.question_id where q.origin = 'bank'),
  0,
  'rehearsal eligible_questions never includes published bank questions'
);
select is(
  (select count(*)::int from public.eligible_questions('race', 'official', null) e join public.questions q on q.id = e.question_id where q.origin = 'fixture'),
  0,
  'official eligible_questions never includes fixture questions'
);

-- 4. reset_rehearsal_competition lifecycle & state transitions
select throws_ok(
  $$select public.reset_rehearsal_competition('72000000-0000-4000-8000-000000000002', 'Trái phép', 60)$$,
  '42501',
  'actor_not_admin',
  'students cannot reset rehearsal competitions'
);
select throws_ok(
  $$select public.reset_rehearsal_competition('72000000-0000-4000-8000-000000000001', 'Sai cửa sổ', 2)$$,
  'QA422',
  'invalid_start_window',
  'reset_rehearsal_competition validates start window minutes'
);

-- Case A: No prior rehearsal round -> creates and opens round #1
create temp table reh_r1 as
  select public.reset_rehearsal_competition('72000000-0000-4000-8000-000000000001', 'Phòng thi thử #1', 60) as data;

select is((select data ->> 'state' from reh_r1), 'open', 'first reset creates and opens rehearsal round #1');
select is(
  (select count(*)::int from public.competition_question_snapshots s join public.competition_games g on g.id = s.competition_game_id where g.competition_id = ((select data ->> 'id' from reh_r1))::uuid and s.origin <> 'fixture'),
  0,
  'rehearsal snapshot contains strictly fixture questions (0 bank questions)'
);
select throws_ok(
  $$insert into public.competition_question_snapshots (competition_game_id, question_id, question_version_id, pool, chapter, question_type, option_count, difficulty, origin, snapshot_public, snapshot_private)
    select g.id, q.id, q.published_version_id, q.pool, q.chapter, q.question_type, q.option_count, q.difficulty, 'bank', '{"prompt":"x","options":[]}'::jsonb, '{}'::jsonb
    from public.competition_games g, public.questions q
    where g.competition_id = ((select data ->> 'id' from reh_r1))::uuid and g.game_type = 'race' and q.external_key = 'iso-bank-race-1'$$,
  '23514',
  'rehearsal_requires_fixture_origin',
  'snapshot trigger blocks inserting a bank question into a rehearsal competition'
);

-- Rehearsal student starts an attempt in Round #1
create temp table reh_att1 as
  select public.start_or_resume_attempt('72000000-0000-4000-8000-000000000002', ((select data ->> 'publicId' from reh_r1))::uuid, 'race', 'idem-reh-r1') as data;

select is((select data -> 'projection' -> 'attempt' ->> 'state' from reh_att1), 'active', 'rehearsal account starts an attempt in rehearsal round #1');

-- Case B: Also create a 'scheduled' rehearsal competition to verify reset handles 'scheduled' without illegal_transition
create temp table reh_sched as
  select (public.create_competition('72000000-0000-4000-8000-000000000001', 'Diễn tập đang Scheduled', 'rehearsal', clock_timestamp(), clock_timestamp() + interval '1 hour') ->> 'id')::uuid as id;
select public.transition_competition_confirmed((select id from reh_sched), '72000000-0000-4000-8000-000000000001', 'scheduled', 60, false, null);

-- Reset while Round #1 is 'open' (with active attempt) AND another rehearsal is 'scheduled'
create temp table reh_r2 as
  select public.reset_rehearsal_competition('72000000-0000-4000-8000-000000000001', 'Phòng thi thử #2', 90) as data;

select is((select state::text from public.competitions where id = ((select data ->> 'id' from reh_r1))::uuid), 'finalized', 'previous open rehearsal round is finalized cleanly');
select is((select state::text from public.competitions where id = (select id from reh_sched)), 'finalized', 'previous scheduled rehearsal round is finalized cleanly without illegal transition');
select is((select state::text from public.attempts where id = ((select data -> 'projection' -> 'attempt' ->> 'id' from reh_att1))::uuid), 'timed_out', 'active attempt in round #1 is settled as timed_out and preserved');
select is((select (public.get_leaderboard(((select data ->> 'publicId' from reh_r2))::uuid, 'race', 10) ->> 'players')::int), 0, 'new rehearsal round #2 starts with an empty leaderboard');

-- Repeated reset back-to-back (when Round #2 has 0 attempts and Round #1 is already finalized)
create temp table reh_r3 as
  select public.reset_rehearsal_competition('72000000-0000-4000-8000-000000000001', 'Phòng thi thử #3', 90) as data;
select is((select data ->> 'state' from reh_r3), 'open', 'repeated reset back-to-back opens round #3 cleanly');

-- 5. Official competition protection & rehearsal account blocking
create temp table off_comp as
  select (public.create_competition('72000000-0000-4000-8000-000000000001', 'Cuộc thi Chính thức Bảo vệ', 'official', clock_timestamp(), clock_timestamp() + interval '1 hour') ->> 'id')::uuid as id;

select throws_ok(
  $$delete from public.competitions where id = (select id from off_comp)$$,
  '42501',
  'official_competition_protected',
  'official competition cannot be deleted'
);

select throws_ok(
  $$insert into public.attempts (competition_id, competition_game_id, profile_id, game_type, started_at, ends_at, max_legal_end_at, main_total)
    select c.id, g.id, '72000000-0000-4000-8000-000000000002', 'race', clock_timestamp(), clock_timestamp() + interval '2 minutes', clock_timestamp() + interval '3 minutes', 15
    from public.competitions c join public.competition_games g on g.competition_id = c.id
    where c.id = (select id from off_comp) and g.game_type = 'race'$$,
  '42501',
  'rehearsal_account_forbidden',
  'rehearsal account is blocked by trigger from creating an attempt in an official competition'
);

-- 6. mark_competition_answers_disclosed only marks displayed_count > 0 in official competitions
insert into public.question_exposures (question_version_id, competition_id, allocated_count, displayed_count)
select published_version_id, ((select data ->> 'id' from reh_r1))::uuid, 2, 2
from public.questions where external_key = 'iso-bank-race-1';

select is(
  public.mark_competition_answers_disclosed(((select data ->> 'id' from reh_r1))::uuid),
  0,
  'rehearsal competition never marks questions as disclosed even if displayed_count > 0'
);

insert into public.question_exposures (question_version_id, competition_id, allocated_count, displayed_count)
select published_version_id, (select id from off_comp), 1, 0
from public.questions where external_key = 'iso-bank-race-1';

select is(
  public.mark_competition_answers_disclosed((select id from off_comp)),
  0,
  'official competition does not mark allocated but undisplayed questions (displayed_count = 0) as disclosed'
);

update public.question_exposures set displayed_count = 1
where competition_id = (select id from off_comp);

select is(
  public.mark_competition_answers_disclosed((select id from off_comp)),
  1,
  'official competition marks displayed bank questions (displayed_count > 0) as disclosed once'
);

-- Close rehearsal #3 and mark official competition as open -> reset_rehearsal_competition must refuse with QA409
update public.competitions set state = 'start_closed' where id = ((select data ->> 'id' from reh_r3))::uuid;
update public.competitions set state = 'open' where id = (select id from off_comp);

select throws_ok(
  $$select public.reset_rehearsal_competition('72000000-0000-4000-8000-000000000001', 'Không được mở khi đang thi thật', 60)$$,
  'QA409',
  'official_competition_currently_open',
  'reset_rehearsal_competition refuses when an official competition is currently open'
);

select * from finish();
rollback;
