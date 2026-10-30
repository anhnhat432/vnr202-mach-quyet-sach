-- Competition core: access matrix, clock discipline and structural guarantees (T040-T046).
-- Behaviour (timing, scoring, concurrency) is covered by web/tests/integration/{competition-core,arena-games}.test.ts.
begin;
select plan(32);

select ok(
  (select bool_and(c.relrowsecurity)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname in ('competitions','competition_games','competition_question_snapshots','attempts','attempt_allocations','minefield_cells','answer_submissions','attempt_events','leaderboard_entries','leaderboard_versions')),
  'row level security is enabled on every competition table'
);
select ok(
  (select not bool_or(has_table_privilege(r, 'public.' || t, 'SELECT, INSERT, UPDATE, DELETE'))
   from unnest(array['anon','authenticated']) r,
        unnest(array['competitions','competition_games','competition_question_snapshots','attempts','attempt_allocations','minefield_cells','answer_submissions','attempt_events','leaderboard_entries','leaderboard_versions']) t),
  'anon and authenticated have no privilege on any competition table (answers live in snapshots)'
);
select ok(
  (select bool_and(has_table_privilege('service_role', 'public.' || t, 'SELECT') and not has_table_privilege('service_role', 'public.' || t, 'INSERT, UPDATE, DELETE'))
   from unnest(array['competitions','competition_games','competition_question_snapshots','attempts','attempt_allocations','minefield_cells','answer_submissions','attempt_events','leaderboard_entries','leaderboard_versions']) t),
  'service_role can only read the competition tables; every write goes through an RPC'
);

select ok(
  (select bool_and(has_function_privilege('service_role', p.oid, 'EXECUTE') and not has_function_privilege('anon', p.oid, 'EXECUTE') and not has_function_privilege('authenticated', p.oid, 'EXECUTE'))
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('create_competition','transition_competition','start_or_resume_attempt','get_attempt_projection','get_interaction_content','open_minefield_cell','submit_answer','heartbeat_attempt','transfer_attempt_session','get_leaderboard','get_player_standing','reconcile_competition','finalize_competition','get_attempt_review','arena_lobby','competition_pool','take_competition_snapshot')),
  'every arena RPC is executable by service_role only'
);
select ok(
  (select bool_and(has_function_privilege('service_role', p.oid, 'EXECUTE') and not has_function_privilege('anon', p.oid, 'EXECUTE') and not has_function_privilege('authenticated', p.oid, 'EXECUTE'))
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('arena_bind_session', 'arena_claim_active_attempt')),
  'session binding RPCs are executable by service_role only'
);
select ok(
  (select bool_and(has_function_privilege('service_role', p.oid, 'EXECUTE') and not has_function_privilege('anon', p.oid, 'EXECUTE') and not has_function_privilege('authenticated', p.oid, 'EXECUTE'))
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('record_attempt_incident', 'arena_admin_audit', 'arena_admin_disclosed', 'arena_confirm_disclosed')),
  'incident, audit and disclosed-question RPCs are executable by service_role only'
);
select ok(
  (select c.relrowsecurity and not has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE') and not has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
   from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'attempt_incidents'),
  'attempt_incidents has RLS and no client access'
);
select ok(
  (select bool_and(not has_function_privilege('anon', p.oid, 'EXECUTE') and not has_function_privilege('authenticated', p.oid, 'EXECUTE'))
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'arena\_%'),
  'internal arena helpers are not executable by clients'
);
select ok(
  (select bool_and(coalesce((select bool_or(c like 'search_path=%') from unnest(p.proconfig) c), false))
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and (p.proname like 'arena\_%' or p.proname in ('start_or_resume_attempt','submit_answer','get_interaction_content','open_minefield_cell','get_leaderboard','finalize_competition'))),
  'every SECURITY DEFINER arena function pins search_path'
);

set local role anon;
select throws_ok($$select public.start_or_resume_attempt('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'race', 'abcdefgh')$$, '42501', null, 'anon cannot start an attempt');
select throws_ok($$select public.get_leaderboard('00000000-0000-4000-8000-000000000002', 'race', 10)$$, '42501', null, 'anon cannot call the leaderboard RPC directly (the public API wraps it)');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated","app_metadata":{"role":"student"}}', true);
select throws_ok($$select public.submit_answer('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 'a', 'abcdefgh', 1)$$, '42501', null, 'a signed-in student cannot call submit_answer directly');
select throws_ok($$select count(*) from public.competition_question_snapshots$$, '42501', null, 'a signed-in student cannot read the question snapshots');
select throws_ok($$select count(*) from public.attempt_allocations$$, '42501', null, 'a signed-in student cannot read allocations');
reset role;

-- LA-TIME-019: decisions never use the transaction clock.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and (p.proname like 'arena\_%' or p.proname in ('create_competition','transition_competition','take_competition_snapshot','start_or_resume_attempt','get_attempt_projection','get_interaction_content','open_minefield_cell','submit_answer','heartbeat_attempt','transfer_attempt_session','get_leaderboard','get_player_standing','reconcile_competition','finalize_competition','get_attempt_review'))
     and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~* '(\mnow\s*\(\)|\mcurrent_timestamp\M|\mtransaction_timestamp\s*\(|\mstatement_timestamp\s*\()'),
  0, 'no arena function reads now()/current_timestamp/transaction_timestamp'
);
select is(
  (select count(*)::int from pg_attrdef d join pg_class c on c.oid = d.adrelid join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname in ('competitions','attempts','attempt_events','answer_submissions','leaderboard_entries')
     and pg_get_expr(d.adbin, d.adrelid) ~* '(now\(\)|current_timestamp|transaction_timestamp)'),
  0, 'no timestamp default on a competition table uses the transaction clock'
);

-- Test clock discipline: an override has no effect unless explicitly enabled, and is local to the transaction.
select set_config('arena.test_clock', '2001-01-01 00:00:00+00', true);
select ok(public.arena_clock() > '2020-01-01'::timestamptz, 'a clock value without the enable flag is ignored');
select set_config('arena.test_clock_enabled', 'on', true);
select is(public.arena_clock(), '2001-01-01 00:00:00+00'::timestamptz, 'the override applies only when enabled');
select set_config('arena.test_clock_enabled', 'off', true);
select ok(public.arena_clock() > '2020-01-01'::timestamptz, 'switching the flag off restores the real clock');

-- Structural guarantees behind LA-TRY-001/003, LA-IDEM-002 and the single open competition.
select ok(exists (select 1 from pg_indexes where indexname = 'attempts_one_active_idx' and indexdef ~ 'UNIQUE.*\(competition_id, profile_id\).*WHERE.*state'), 'one active attempt per student across both games is a unique index');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.attempts'::regclass and contype = 'u' and pg_get_constraintdef(oid) = 'UNIQUE (competition_game_id, profile_id)'), 'one attempt per student, game and competition is a unique constraint');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.answer_submissions'::regclass and contype = 'u' and pg_get_constraintdef(oid) = 'UNIQUE (attempt_id, allocation_id)'), 'one answer per allocated question is a unique constraint');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.attempt_events'::regclass and contype = 'u' and pg_get_constraintdef(oid) = 'UNIQUE (attempt_id, event_type, source_ref)'), 'one scoring event per source is a unique constraint');
select ok(exists (select 1 from pg_indexes where indexname = 'competitions_single_open_idx'), 'at most one open competition is a partial unique index');
select ok(exists (select 1 from pg_trigger where tgname = 'attempt_allocations_guard') and exists (select 1 from pg_trigger where tgname = 'attempt_events_append_only'), 'allocation timeline and score ledger are guarded by triggers');


-- F3 broadcast hint: topic, event and a payload without any personal or scoring data.
do $$
begin
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then
    create schema if not exists realtime;
    create table if not exists realtime.messages (topic text, extension text, payload jsonb, event text, private boolean);
    create function realtime.send(payload jsonb, event text, topic text, private boolean) returns void language sql
      as 'insert into realtime.messages (topic, extension, payload, event, private) values (topic, ''broadcast'', payload, event, private)';
  end if;
end $$;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000f3', 'f3@test.invalid');
insert into public.profiles (id, role, full_name, display_name) values ('00000000-0000-4000-8000-0000000000f3', 'admin', 'F3 Admin', 'F3 Admin');
select public.create_competition('00000000-0000-4000-8000-0000000000f3', 'F3 broadcast', 'rehearsal', '2030-01-01T00:00:00Z', '2030-01-01T02:00:00Z');
insert into public.leaderboard_versions (competition_game_id, version, committed_at)
  select g.id, 7, clock_timestamp() from public.competition_games g join public.competitions c on c.id = g.competition_id where c.name = 'F3 broadcast' and g.game_type = 'race';
select is(
  (select m.topic from realtime.messages m where m.payload -> 'aggregate' ->> 'version' = '7' and m.topic = (select format('leaderboard:%s:race', c.public_id) from public.competitions c where c.name = 'F3 broadcast') order by 1 limit 1),
  (select format('leaderboard:%s:race', c.public_id) from public.competitions c where c.name = 'F3 broadcast'),
  'a version bump broadcasts on leaderboard:{publicId}:{game}'
);
select is(
  (select m.event from realtime.messages m where m.payload -> 'aggregate' ->> 'version' = '7' and m.topic = (select format('leaderboard:%s:race', c.public_id) from public.competitions c where c.name = 'F3 broadcast') limit 1),
  'leaderboard.changed', 'the event is leaderboard.changed while the competition is not finalized'
);
select is(
  (select array_agg(k order by k) from realtime.messages m, jsonb_object_keys(m.payload - 'id') k where m.payload -> 'aggregate' ->> 'version' = '7' and m.topic = (select format('leaderboard:%s:race', c.public_id) from public.competitions c where c.name = 'F3 broadcast')),
  array['aggregate', 'data', 'eventId', 'eventType', 'occurredAt'],
  'the payload carries only the envelope (no names, scores, answers or ids of people); Realtime adds its own message id'
);
-- G pacing: at most one leaderboard.changed per game per second; finalization is never paced.
update public.leaderboard_versions v set version = 8 from public.competition_games g join public.competitions c on c.id = g.competition_id
  where v.competition_game_id = g.id and c.name = 'F3 broadcast' and g.game_type = 'race';
select is((select count(*)::int from realtime.messages m where m.payload -> 'aggregate' ->> 'version' = '8' and m.topic = (select format('leaderboard:%s:race', c.public_id) from public.competitions c where c.name = 'F3 broadcast')), 0,
  'a second change within the same second is paced (no extra fan-out)');
insert into public.leaderboard_versions (competition_game_id, version, committed_at)
  select g.id, 1, clock_timestamp() from public.competition_games g join public.competitions c on c.id = g.competition_id where c.name = 'F3 broadcast' and g.game_type = 'race'
  on conflict (competition_game_id) do update set version = 81, committed_at = excluded.committed_at;
select is((select count(*)::int from realtime.messages m where m.payload -> 'aggregate' ->> 'version' in ('1', '81') and m.topic = (select format('leaderboard:%s:race', c.public_id) from public.competitions c where c.name = 'F3 broadcast')), 0,
  'the scoring upsert path (insert .. on conflict do update) is paced too');
update public.leaderboard_versions v set version = 9, hinted_at = clock_timestamp() - interval '2 seconds' from public.competition_games g join public.competitions c on c.id = g.competition_id
  where v.competition_game_id = g.id and c.name = 'F3 broadcast' and g.game_type = 'race';
select is((select count(*)::int from realtime.messages m where m.payload -> 'aggregate' ->> 'version' = '9' and m.topic = (select format('leaderboard:%s:race', c.public_id) from public.competitions c where c.name = 'F3 broadcast')), 1,
  'once the second has passed the next change is hinted again');
update public.competitions set state = 'finalized' where name = 'F3 broadcast';
update public.leaderboard_versions v set version = 10 from public.competition_games g join public.competitions c on c.id = g.competition_id
  where v.competition_game_id = g.id and c.name = 'F3 broadcast' and g.game_type = 'race';
select is((select m.event from realtime.messages m where m.payload -> 'aggregate' ->> 'version' = '10' and m.topic = (select format('leaderboard:%s:race', c.public_id) from public.competitions c where c.name = 'F3 broadcast') limit 1),
  'leaderboard.finalized', 'finalization is always hinted, even inside the paced second');

select * from finish();
rollback;
