-- Question bank: shape rules, Draft -> Reviewed -> Published governance, immutability, grants,
-- eligibility, exposure counters and readiness (CONTENT-001..006, LA-CONTENT-003..014, LA-AC-021/029/037).
begin;
select plan(52);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000ac01', 'qa-admin@test.invalid'),
  ('00000000-0000-4000-8000-00000000ac02', 'qa-student@test.invalid');
insert into public.profiles (id, role, student_id, full_name, display_name) values
  ('00000000-0000-4000-8000-00000000ac01', 'admin', null, 'QA Admin', 'QA Admin'),
  ('00000000-0000-4000-8000-00000000ac02', 'student', 'QA0001', 'QA Student', 'QA S.');
insert into public.sources (id, title, author_or_issuer, source_type, verification_status) values
  ('00000000-0000-4000-8000-0000000005a1', 'Nguon da xac minh', 'Test', 'syllabus', 'verified'),
  ('00000000-0000-4000-8000-0000000005a2', 'Nguon cho xac minh', 'Test', 'syllabus', 'pending');

create function pg_temp.draft(p_key text, p_game text, p_pool text, p_diff text, p_type text, p_n int,
  p_chapter text default 'chapter_1', p_src uuid default '00000000-0000-4000-8000-0000000005a1', p_ai boolean default false)
returns uuid language plpgsql as $$
declare v_opts jsonb; v_id uuid;
begin
  v_opts := (select jsonb_agg(jsonb_build_object('id', x, 'label', 'Dap an ' || x)) from unnest((array['a','b','c'])[1:p_n]) x);
  select version_id into v_id from public.upsert_question_draft(
    '00000000-0000-4000-8000-00000000ac01', p_key,
    jsonb_build_object('game_type', p_game, 'pool', p_pool, 'chapter', p_chapter, 'topic', 'Chu de thu', 'question_type', p_type, 'option_count', p_n, 'difficulty', p_diff),
    jsonb_build_object('prompt', 'Cau ' || p_key, 'options', v_opts),
    jsonb_build_object('correctOptionId', 'a', 'explanation', 'Giai thich'),
    case when p_src is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('sourceId', p_src, 'locator', 'tr.1')) end,
    p_ai);
  return v_id;
end $$;

-- ---------------------------------------------------------------- shape rules on questions
select throws_ok($$insert into public.questions (game_type, pool, chapter, topic, question_type, option_count, difficulty) values ('race', 'race', 'chapter_1', 'Chu de', 'defuse_ab', 2, 'easy')$$, '23514', null, 'defuse type only in the defuse pool');
select throws_ok($$insert into public.questions (game_type, pool, chapter, topic, question_type, option_count, difficulty) values ('minefield', 'minefield_defuse', 'chapter_1', 'Chu de', 'defuse_ab', 3, 'easy')$$, '23514', null, 'defuse needs exactly two options');
select throws_ok($$insert into public.questions (game_type, pool, chapter, topic, question_type, option_count, difficulty) values ('minefield', 'minefield_defuse', 'chapter_1', 'Chu de', 'defuse_ab', 2, 'hard')$$, '23514', null, 'defuse questions are easy');
select throws_ok($$insert into public.questions (game_type, pool, chapter, topic, question_type, option_count, difficulty) values ('minefield', 'race', 'chapter_1', 'Chu de', 'single_choice', 3, 'easy')$$, '23514', null, 'pool must belong to the game');
select throws_ok($$insert into public.questions (game_type, pool, chapter, topic, question_type, option_count, difficulty) values ('race', 'race', 'chapter_1', 'Chu de', 'before_after', 3, 'easy')$$, '23514', null, 'before/after has exactly two options');

-- ---------------------------------------------------------------- content rules
select is(public.question_content_problems('single_choice', 3,
  '{"prompt":"p","options":[{"id":"a","label":"x"},{"id":"b","label":"y"},{"id":"c","label":"z"}]}',
  '{"correctOptionId":"b","explanation":"e"}'), array[]::text[], 'valid content has no problems');
select ok(public.question_content_problems('single_choice', 3,
  '{"prompt":"p","options":[{"id":"a","label":"x"},{"id":"b","label":"y"},{"id":"c","label":"z"}],"correctOptionId":"b"}',
  '{"correctOptionId":"b","explanation":"e"}') @> array['public_unknown_key'], 'the public payload can never carry the answer');
select ok(public.question_content_problems('single_choice', 3,
  '{"prompt":"p","options":[{"id":"a","label":"x"},{"id":"b","label":"y"}]}', '{"correctOptionId":"b","explanation":"e"}') @> array['option_count_mismatch'], 'option count must match');
select ok(public.question_content_problems('single_choice', 3,
  '{"prompt":"p","options":[{"id":"a","label":"x"},{"id":"a","label":"y"},{"id":"c","label":"z"}]}', '{"correctOptionId":"a","explanation":"e"}') @> array['option_id_duplicate'], 'option ids are unique');
select ok(public.question_content_problems('single_choice', 3,
  '{"prompt":"p","options":[{"id":"a","label":"x"},{"id":"b","label":"y"},{"id":"c","label":"z"}]}', '{"correctOptionId":"z","explanation":"e"}') @> array['correct_option_invalid'], 'the correct option must exist');
select ok(public.question_content_problems('single_choice', 3,
  '{"prompt":"p","options":[{"id":"a","label":"x"},{"id":"b","label":"y"},{"id":"c","label":"z"}]}', '{"correctOptionId":"a"}') @> array['explanation_invalid'], 'an explanation is required');

-- ---------------------------------------------------------------- Draft creation and idempotent import
select is((select outcome from public.upsert_question_draft('00000000-0000-4000-8000-00000000ac01', 'qb-race-001',
  '{"game_type":"race","pool":"race","chapter":"chapter_1","topic":"Chu de","question_type":"single_choice","option_count":3,"difficulty":"easy"}',
  '{"prompt":"Cau 1","options":[{"id":"a","label":"A"},{"id":"b","label":"B"},{"id":"c","label":"C"}]}',
  '{"correctOptionId":"a","explanation":"e"}', '[{"sourceId":"00000000-0000-4000-8000-0000000005a1","locator":"tr.1"}]', false)), 'created', 'first import creates the Draft');
select is((select outcome from public.upsert_question_draft('00000000-0000-4000-8000-00000000ac01', 'qb-race-001',
  '{"game_type":"race","pool":"race","chapter":"chapter_1","topic":"Chu de","question_type":"single_choice","option_count":3,"difficulty":"easy"}',
  '{"prompt":"Cau 1","options":[{"id":"a","label":"A"},{"id":"b","label":"B"},{"id":"c","label":"C"}]}',
  '{"correctOptionId":"a","explanation":"e"}', '[{"sourceId":"00000000-0000-4000-8000-0000000005a1","locator":"tr.1"}]', false)), 'unchanged', 're-importing identical content is a no-op');
select is((select outcome from public.upsert_question_draft('00000000-0000-4000-8000-00000000ac01', 'qb-race-001',
  '{"game_type":"race","pool":"race","chapter":"chapter_1","topic":"Chu de","question_type":"single_choice","option_count":3,"difficulty":"easy"}',
  '{"prompt":"Cau 1 sua","options":[{"id":"a","label":"A"},{"id":"b","label":"B"},{"id":"c","label":"C"}]}',
  '{"correctOptionId":"a","explanation":"e"}', '[{"sourceId":"00000000-0000-4000-8000-0000000005a1","locator":"tr.1"}]', false)), 'updated', 'changed content updates the open Draft in place');
select is((select count(*) from public.question_versions v join public.questions q on q.id = v.question_id where q.external_key = 'qb-race-001'), 1::bigint, 'still a single version');
select throws_ok($$select * from public.upsert_question_draft('00000000-0000-4000-8000-00000000ac02', 'qb-x', '{}', '{}', '{}', '[]', false)$$, '42501', 'actor_not_admin', 'a student cannot create questions');
select throws_ok($$select * from public.upsert_question_draft('00000000-0000-4000-8000-00000000ac01', 'qb-bad',
  '{"game_type":"race","pool":"race","chapter":"chapter_1","topic":"Chu de","question_type":"single_choice","option_count":3,"difficulty":"easy"}',
  '{"prompt":"Cau","options":[{"id":"a","label":"A"}]}', '{"correctOptionId":"a","explanation":"e"}', '[]', false)$$, '23514', null, 'invalid content is rejected by the database');

-- ---------------------------------------------------------------- governance
select is((select status from public.question_versions v join public.questions q on q.id = v.question_id where q.external_key = 'qb-race-001'), 'draft'::public.question_status, 'new questions start as Draft');
select throws_ok($$update public.question_versions set status = 'published' where question_id = (select id from public.questions where external_key = 'qb-race-001')$$, '23514', null, 'a bank Draft cannot jump to Published');
select throws_ok($$update public.question_versions set status = 'reviewed' where question_id = (select id from public.questions where external_key = 'qb-race-001')$$, '23514', 'human_reviewer_required', 'review without a human administrator is refused (AI cannot review)');

select pg_temp.draft('qb-nosrc', 'race', 'race', 'easy', 'single_choice', 3, 'chapter_1', null);
select throws_ok($$select public.transition_question_version((select v.id from public.question_versions v join public.questions q on q.id = v.question_id where q.external_key = 'qb-nosrc'), '00000000-0000-4000-8000-00000000ac01', 'review', 'ok')$$, '23514', 'verified_sources_required', 'review needs at least one source');
select pg_temp.draft('qb-pending', 'race', 'race', 'easy', 'single_choice', 3, 'chapter_1', '00000000-0000-4000-8000-0000000005a2');
select throws_ok($$select public.transition_question_version((select v.id from public.question_versions v join public.questions q on q.id = v.question_id where q.external_key = 'qb-pending'), '00000000-0000-4000-8000-00000000ac01', 'review', 'ok')$$, '23514', 'verified_sources_required', 'a pending source does not count');
select throws_ok($$select public.transition_question_version((select v.id from public.question_versions v join public.questions q on q.id = v.question_id where q.external_key = 'qb-race-001'), '00000000-0000-4000-8000-00000000ac02', 'review', 'ok')$$, '42501', 'actor_not_admin', 'a student cannot review');

select pg_temp.draft('qb-ai', 'race', 'race', 'easy', 'single_choice', 3, 'chapter_1', '00000000-0000-4000-8000-0000000005a1', true);
select throws_ok($$select public.transition_question_version((select v.id from public.question_versions v join public.questions q on q.id = v.question_id where q.external_key = 'qb-ai'), '00000000-0000-4000-8000-00000000ac01', 'review', null)$$, '23514', 'ai_review_note_required', 'AI-assisted content needs the reviewer to write what they checked');
select is(public.transition_question_version((select v.id from public.question_versions v join public.questions q on q.id = v.question_id where q.external_key = 'qb-ai'), '00000000-0000-4000-8000-00000000ac01', 'review', 'Da doi chieu giao trinh'), 'reviewed'::public.question_status, 'AI-assisted content can be reviewed with a note');

select is(public.transition_question_version((select v.id from public.question_versions v join public.questions q on q.id = v.question_id where q.external_key = 'qb-race-001'), '00000000-0000-4000-8000-00000000ac01', 'review', null), 'reviewed'::public.question_status, 'human administrator reviews a verified-source Draft');
select throws_ok($$update public.question_versions set content_public = '{"prompt":"x","options":[{"id":"a","label":"A"},{"id":"b","label":"B"},{"id":"c","label":"C"}]}' where question_id = (select id from public.questions where external_key = 'qb-race-001')$$, '23514', 'content_locked_after_draft', 'content is locked once reviewed');
select is(public.transition_question_version((select v.id from public.question_versions v join public.questions q on q.id = v.question_id where q.external_key = 'qb-race-001'), '00000000-0000-4000-8000-00000000ac01', 'publish', null), 'published'::public.question_status, 'a reviewed version can be published');
select is((select published_version_id is not null from public.questions where external_key = 'qb-race-001'), true, 'the question points at its published version');

select throws_ok($$update public.question_versions set content_private = '{"correctOptionId":"b","explanation":"e"}' where question_id = (select id from public.questions where external_key = 'qb-race-001')$$, '23514', 'published_version_immutable', 'a Published version cannot be edited');
select throws_ok($$update public.question_versions set status = 'draft' where question_id = (select id from public.questions where external_key = 'qb-race-001')$$, '23514', 'published_version_immutable', 'a Published version cannot go back to Draft');

select is((select outcome from public.upsert_question_draft('00000000-0000-4000-8000-00000000ac01', 'qb-race-001',
  '{"game_type":"race","pool":"race","chapter":"chapter_1","topic":"Chu de","question_type":"single_choice","option_count":3,"difficulty":"easy"}',
  '{"prompt":"Cau 1 ban hai","options":[{"id":"a","label":"A"},{"id":"b","label":"B"},{"id":"c","label":"C"}]}',
  '{"correctOptionId":"a","explanation":"e"}', '[{"sourceId":"00000000-0000-4000-8000-0000000005a1","locator":"tr.1"}]', false)), 'new_version', 'editing published content makes version 2');
select is((select v.version from public.questions q join public.question_versions v on v.id = q.published_version_id where q.external_key = 'qb-race-001'), 1, 'version 1 stays the allocatable one until version 2 is published');

select throws_ok($$select public.transition_question_version((select v.id from public.question_versions v join public.questions q on q.id = v.question_id where q.external_key = 'qb-ai'), '00000000-0000-4000-8000-00000000ac01', 'retire', 'x')$$, '23514', null, 'only a Published version can be retired (and a reason is required)');
select lives_ok($$select public.transition_question_version((select published_version_id from public.questions where external_key = 'qb-race-001'), '00000000-0000-4000-8000-00000000ac01', 'retire', 'sai sot da bi phat hien')$$, 'a Published version can be retired with a reason');
select is((select published_version_id from public.questions where external_key = 'qb-race-001'), null, 'a retired question leaves rotation');
select is((select count(*) from public.audit_logs where action in ('question.review', 'question.publish', 'question.retire') and actor_profile_id = '00000000-0000-4000-8000-00000000ac01'), 4::bigint, 'every successful transition is audited');

-- ---------------------------------------------------------------- fixtures are separate from the bank
select throws_ok($$insert into public.question_versions (question_id, version, status, content_public, content_private)
  select id, 9, 'published', '{"prompt":"p","options":[{"id":"a","label":"A"},{"id":"b","label":"B"},{"id":"c","label":"C"}]}', '{"correctOptionId":"a","explanation":"e"}' from public.questions where external_key = 'qb-ai'$$, '23514', 'new_version_must_be_draft', 'a bank question cannot be inserted already Published');
insert into public.questions (id, external_key, game_type, pool, chapter, topic, question_type, option_count, difficulty, origin)
values ('00000000-0000-4000-8000-0000000000f1', 'fx-qb-1', 'race', 'race', 'chapter_2', '[GIA LAP] x', 'single_choice', 3, 'easy', 'fixture');
select lives_ok($$insert into public.question_versions (question_id, version, status, content_public, content_private)
  values ('00000000-0000-4000-8000-0000000000f1', 1, 'published', '{"prompt":"[GIA LAP]","options":[{"id":"a","label":"A"},{"id":"b","label":"B"},{"id":"c","label":"C"}]}', '{"correctOptionId":"a","explanation":"e"}')$$, 'a fixture can be Published without a reviewer');
select is((select count(*) from public.eligible_questions('race', 'official', null) where question_id = '00000000-0000-4000-8000-0000000000f1'), 0::bigint, 'official competitions never see fixtures (LA-AC-021)');
select is((select count(*) from public.eligible_questions('race', 'rehearsal', null) where question_id = '00000000-0000-4000-8000-0000000000f1'), 1::bigint, 'rehearsal competitions can use fixtures');
select is((select count(*) from public.eligible_questions('race', 'official', null) where question_id in (select id from public.questions where external_key in ('qb-ai', 'qb-nosrc', 'qb-pending'))), 0::bigint, 'Drafts, Reviewed and retired questions are not eligible');

-- ---------------------------------------------------------------- exposure counters and disclosure
select pg_temp.draft('qb-exp', 'race', 'race', 'easy', 'single_choice', 3);
select public.transition_question_version((select v.id from public.question_versions v join public.questions q on q.id = v.question_id where q.external_key = 'qb-exp'), '00000000-0000-4000-8000-00000000ac01', 'review', null);
select public.transition_question_version((select v.id from public.question_versions v join public.questions q on q.id = v.question_id where q.external_key = 'qb-exp'), '00000000-0000-4000-8000-00000000ac01', 'publish', null);
insert into public.question_exposures (question_version_id, competition_id, allocated_count)
select published_version_id, '00000000-0000-4000-8000-0000000c0001', 2 from public.questions where external_key = 'qb-exp';
select public.record_question_displayed('00000000-0000-4000-8000-0000000c0001', (select published_version_id from public.questions where external_key = 'qb-exp'));
select is((select displayed_count from public.question_exposures where competition_id = '00000000-0000-4000-8000-0000000c0001'), 1, 'displaying increments the display counter only');
select is(public.mark_competition_answers_disclosed('00000000-0000-4000-8000-0000000c0001'), 1, 'finalization marks the question that was displayed as disclosed');
select is((select count(*) from public.eligible_questions('race', 'official', '00000000-0000-4000-8000-0000000c0002') where disclosed and not confirmed), 1::bigint, 'a disclosed question is flagged for the next competition');
select throws_ok($$select public.confirm_disclosed_questions('00000000-0000-4000-8000-0000000c0002', '00000000-0000-4000-8000-00000000ac02', array[(select published_version_id from public.questions where external_key = 'qb-exp')], 'dung lai')$$, '42501', 'actor_not_admin', 'only an administrator can confirm reuse of a disclosed question');

-- ---------------------------------------------------------------- readiness report
select is((public.question_bank_readiness('official', null, 60, 80, 40) ->> 'ready')::boolean, false, 'an almost empty bank is not ready');
select ok((public.question_bank_readiness('official') -> 'blockers') @> '"insufficient_pool:race/race/medium"', 'readiness names the missing slot');
select is((public.question_bank_readiness('official') -> 'target' ->> 'meetsTarget')::boolean, false, 'the 168-question target is reported separately');

-- ---------------------------------------------------------------- access
select is((select bool_or(has_table_privilege(r, 'public.' || t, 'SELECT')) from unnest(array['anon', 'authenticated']) r, unnest(array['questions', 'question_versions', 'question_source_links', 'question_exposures', 'competition_disclosed_question_confirmations']) t), false, 'clients cannot read any question table (correct answers stay server-side)');
select is((select bool_and(has_function_privilege('authenticated', f, 'EXECUTE')) from unnest(array['public.allocate_question_set(uuid, public.game_type, text)', 'public.transition_question_version(uuid, uuid, text, text)', 'public.upsert_question_draft(uuid, text, jsonb, jsonb, jsonb, jsonb, boolean)']) f), false, 'clients cannot call the allocation or governance functions');
select is((select bool_and(has_table_privilege('service_role', 'public.' || t, 'SELECT, INSERT, UPDATE, DELETE')) from unnest(array['questions', 'question_versions', 'question_source_links', 'question_exposures', 'competition_disclosed_question_confirmations']) t), true, 'the server role has the privileges it needs');

select * from finish();
rollback;
