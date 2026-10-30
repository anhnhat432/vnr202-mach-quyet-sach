-- Stage D: competition core (sessions, two independent games, authoritative attempts, leaderboards).
-- Rules: LA-TRY-*, LA-TIME-*, LA-ALLOC-*, LA-IDEM-*, LA-LB-*, LA-FB-*, MINE-*, RACE-*, LA-CONTENT-006/009.
--
-- Everything that matters is decided here, in short transactions opened by the RPCs below:
--   * every decision time comes from arena_clock() (= clock_timestamp(), never now()); see §Clock.
--   * the client never sends score, correctness, time or item state; it sends a choice and a key.
--   * correct answers and explanations are only returned by get_attempt_review after Finalized.
--   * all RPCs are executable by service_role only; the server passes the authenticated profile id.
--
-- Error tokens (message) with SQLSTATE the API layer maps to HTTP:
--   QA404 not_found | QA409 conflict (stale_session, another_attempt_active, interaction_pending,
--   content_not_fetched, ...) | QA410 attempt terminal / time over | QA422 invalid input |
--   QA425 too_early (detail = {"availableInMs":n}) | QB001/QB002 question pool / two-option cap |
--   55P03 lock wait limit reached (retryable, nothing written).

create type public.competition_kind as enum ('official', 'rehearsal');
create type public.competition_state as enum ('draft', 'scheduled', 'open', 'start_closed', 'settling', 'finalized', 'archived');
create type public.attempt_state as enum ('active', 'completed', 'timed_out', 'voided');

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 3 and 120),
  kind public.competition_kind not null,
  state public.competition_state not null default 'draft',
  opens_at timestamptz not null,
  start_deadline_at timestamptz not null,
  latency_allowance_ms int not null default 400 check (latency_allowance_ms between 0 and 1500),
  lock_wait_limit_ms int not null default 2000 check (lock_wait_limit_ms between 100 and 10000),
  -- Safety margin before an unanswered question may be written as timed out. It only has to cover the
  -- gap between a request taking its receipt time and queueing for the row lock (microseconds to a few
  -- ms); lock waiting itself is protected by the FIFO lock queue and lock_wait_limit_ms (see arena_reconcile).
  reconcile_grace_ms int not null default 250 check (reconcile_grace_ms between 50 and 2000),
  timezone text not null default 'Asia/Ho_Chi_Minh',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  finalized_at timestamptz,
  check (start_deadline_at > opens_at)
);
-- At most one open competition (EVT rules); also keeps "the" arena unambiguous for the lobby.
create unique index competitions_single_open_idx on public.competitions ((true)) where state = 'open';

create table public.competition_games (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  game_type public.game_type not null,
  total_duration_ms int not null check (total_duration_ms between 10000 and 900000),
  rules jsonb not null,
  blueprint jsonb not null,
  config_locked_at timestamptz,
  unique (competition_id, game_type)
);

-- Frozen copy of the question pool taken when the competition is scheduled (readiness passed).
-- Later edits or retirement in the bank cannot change a running competition.
create table public.competition_question_snapshots (
  id uuid primary key default gen_random_uuid(),
  competition_game_id uuid not null references public.competition_games(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  question_version_id uuid not null references public.question_versions(id),
  pool public.question_pool not null,
  chapter public.course_chapter not null,
  question_type public.question_type not null,
  option_count smallint not null,
  difficulty public.question_difficulty not null,
  origin public.question_origin not null,
  snapshot_public jsonb not null,
  snapshot_private jsonb not null,
  unique (competition_game_id, question_version_id)
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  competition_game_id uuid not null references public.competition_games(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  game_type public.game_type not null,
  state public.attempt_state not null default 'active',
  version int not null default 1,
  session_version int not null default 1,
  started_at timestamptz not null,
  ends_at timestamptz not null,
  max_legal_end_at timestamptz not null,
  terminal_at timestamptz,
  score int not null default 0 check (score >= 0),
  main_total smallint not null,
  main_answered smallint not null default 0 check (main_answered between 0 and 15),
  main_correct smallint not null default 0,
  hard_correct smallint not null default 0,
  completion_duration_ms int,
  shields smallint not null default 0 check (shields between 0 and 2),
  double_armed boolean not null default false,
  streak smallint not null default 0,
  combo_awards smallint not null default 0 check (combo_awards between 0 and 5),
  pending_allocation_id uuid,
  last_heartbeat_at timestamptz,
  start_idempotency_key text,
  transfer_key text,
  created_at timestamptz not null default clock_timestamp(),
  unique (competition_game_id, profile_id),
  check (ends_at > started_at),
  check ((state = 'active') = (terminal_at is null))
);
-- LA-TRY-003: one active attempt per student across both games.
create unique index attempts_one_active_idx on public.attempts (competition_id, profile_id) where state = 'active';
create index attempts_competition_state_idx on public.attempts (competition_id, state);

create table public.attempt_allocations (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  sequence smallint not null,
  role text not null check (role in ('main', 'defuse')),
  snapshot_id uuid not null references public.competition_question_snapshots(id),
  difficulty public.question_difficulty not null,
  option_order jsonb not null,
  presented_at timestamptz,
  available_at timestamptz,
  deadline_at timestamptz,
  content_released_at timestamptz,
  outcome text check (outcome in ('correct', 'incorrect', 'timed_out')),
  resolved_at timestamptz,
  result jsonb,
  unique (attempt_id, sequence),
  unique (attempt_id, snapshot_id),
  check ((presented_at is null) = (available_at is null) and (presented_at is null) = (deadline_at is null)),
  check (presented_at is null or (presented_at <= available_at and available_at < deadline_at)),
  check (content_released_at is null or (available_at is not null and content_released_at >= available_at)),
  check ((outcome is null) = (resolved_at is null))
);
alter table public.attempts
  add constraint attempts_pending_allocation_fk foreign key (pending_allocation_id) references public.attempt_allocations(id) on delete set null;

create table public.minefield_cells (
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  cell_index smallint not null check (cell_index between 0 and 19),
  kind text not null check (kind in ('question', 'bomb', 'double', 'shield', 'chest')),
  allocation_id uuid references public.attempt_allocations(id) on delete cascade,
  opened_at timestamptz,
  swapped_from_index smallint,
  open_idempotency_key text,
  open_result jsonb,
  primary key (attempt_id, cell_index),
  check ((kind in ('question', 'bomb')) = (allocation_id is not null))
);

create table public.answer_submissions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  allocation_id uuid not null references public.attempt_allocations(id) on delete cascade,
  idempotency_key text not null,
  submitted_option_id text not null,
  received_at timestamptz not null,
  is_correct boolean not null,
  outcome text not null check (outcome in ('correct', 'incorrect', 'timed_out')),
  committed_at timestamptz not null default clock_timestamp(),
  unique (attempt_id, allocation_id),
  unique (attempt_id, idempotency_key)
);

-- Append-only score ledger. One event per scoring source (LA-IDEM-002).
create table public.attempt_events (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  seq int not null,
  event_type text not null check (event_type in (
    'answer', 'timeout', 'chest', 'double_armed', 'double_consumed', 'shield_gained', 'defuse_ok',
    'shield_consumed', 'bomb_penalty', 'combo_bonus', 'board_swap')),
  source_ref text not null,
  points_delta int not null,
  score_after int not null check (score_after >= 0),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  unique (attempt_id, seq),
  unique (attempt_id, event_type, source_ref)
);

create table public.leaderboard_entries (
  competition_game_id uuid not null references public.competition_games(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  public_entry_id uuid not null,
  display_name_snapshot text not null,
  display_name_suffix int,
  score int not null default 0,
  correct_count int not null default 0,
  hard_correct int not null default 0,
  completion_duration_ms int,
  progress int not null default 0,
  state text not null default 'playing' check (state in ('playing', 'completed', 'timed_out')),
  excluded boolean not null default false,
  version int not null default 1,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (competition_game_id, profile_id)
);
create index leaderboard_entries_order_idx on public.leaderboard_entries
  (competition_game_id, score desc, correct_count desc, hard_correct desc, completion_duration_ms asc nulls last) where not excluded;

create table public.leaderboard_versions (
  competition_game_id uuid primary key references public.competition_games(id) on delete cascade,
  version bigint not null,
  committed_at timestamptz not null
);

-- ---------------------------------------------------------------------------------------------
-- Clock (LA-TIME-019). Every decision time is arena_clock(). It equals clock_timestamp() unless a
-- TRANSACTION-LOCAL test override is set. Only service_role-executable RPCs read it and a client
-- cannot set GUCs; tests set it with set_config(..., true). A test also asserts that no function in
-- this schema uses now()/current_timestamp/transaction_timestamp().
-- ---------------------------------------------------------------------------------------------
create function public.arena_clock() returns timestamptz
language sql volatile set search_path = ''
as $$
  select case
    when current_setting('arena.test_clock_enabled', true) = 'on' and nullif(current_setting('arena.test_clock', true), '') is not null
      then current_setting('arena.test_clock')::timestamptz
    else clock_timestamp()
  end
$$;

create function public.arena_clock_is_fixed() returns boolean
language sql stable set search_path = ''
as $$ select current_setting('arena.test_clock_enabled', true) = 'on' and nullif(current_setting('arena.test_clock', true), '') is not null $$;

create function public.arena_ms(p_ms numeric) returns interval
language sql immutable set search_path = ''
as $$ select p_ms * interval '1 millisecond' $$;

create function public.arena_ms_between(p_from timestamptz, p_to timestamptz) returns int
language sql immutable set search_path = ''
as $$ select floor(extract(epoch from (p_to - p_from)) * 1000)::int $$;

-- Whole milliseconds a client should wait: rounded UP so it never retries a hair too early.
create function public.arena_ms_until(p_from timestamptz, p_to timestamptz) returns int
language sql immutable set search_path = ''
as $$ select greatest(0, ceil(extract(epoch from (p_to - p_from)) * 1000)::int) $$;

-- ---------------------------------------------------------------------------------------------
-- Locked constants (MINE-Q-001, RACE-003, LA-TIME-004). Offsets are trial values kept in rules.
-- ---------------------------------------------------------------------------------------------
create function public.arena_points(p_game public.game_type, p_diff public.question_difficulty) returns int
language sql immutable set search_path = ''
as $$
  select case p_game
    when 'minefield' then case p_diff when 'easy' then 100 when 'medium' then 200 else 300 end
    else case p_diff when 'easy' then 100 when 'medium' then 150 else 200 end
  end
$$;

create function public.arena_limit_ms(p_game public.game_type, p_role text, p_diff public.question_difficulty) returns int
language sql immutable set search_path = ''
as $$
  select case
    when p_role = 'defuse' then 5000
    when p_game = 'minefield' then case p_diff when 'easy' then 6000 when 'medium' then 8000 else 10000 end
    else case p_diff when 'easy' then 5000 when 'medium' then 7000 else 9000 end
  end
$$;

create function public.arena_main_total(p_game public.game_type) returns int
language sql immutable set search_path = ''
as $$ select case p_game when 'minefield' then 10 else 15 end $$;

create function public.arena_offset_ms(p_game_id uuid, p_key text) returns int
language sql stable set search_path = ''
as $$ select (rules -> 'offsets' ->> p_key)::int from public.competition_games where id = p_game_id $$;

create function public.arena_check_key(p_key text) returns void
language plpgsql immutable set search_path = ''
as $$
begin
  if p_key is null or p_key !~ '^[A-Za-z0-9_-]{8,80}$' then
    raise exception 'invalid_idempotency_key' using errcode = 'QA422';
  end if;
end;
$$;

create function public.arena_require_admin(p_actor uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = p_actor and p.role = 'admin' and p.status = 'active') then
    raise exception 'actor_not_admin' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Immutability guards.
-- ---------------------------------------------------------------------------------------------
create function public.competition_games_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.config_locked_at is not null and (
       new.total_duration_ms is distinct from old.total_duration_ms or new.rules is distinct from old.rules
       or new.blueprint is distinct from old.blueprint or new.config_locked_at is distinct from old.config_locked_at
       or new.game_type is distinct from old.game_type or new.competition_id is distinct from old.competition_id) then
    raise exception 'config_locked' using errcode = 'QA409';
  end if;
  return new;
end;
$$;
create trigger competition_games_guard before update on public.competition_games
  for each row execute function public.competition_games_guard();

create function public.competition_snapshots_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then raise exception 'snapshot_immutable' using errcode = 'QA409'; end if;
  if exists (select 1 from public.competition_games g where g.id = old.competition_game_id) then
    raise exception 'snapshot_immutable' using errcode = 'QA409';
  end if;
  return old;
end;
$$;
create trigger competition_snapshots_guard before update or delete on public.competition_question_snapshots
  for each row execute function public.competition_snapshots_guard();

create function public.attempt_allocations_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.attempts a where a.id = old.attempt_id) then
      raise exception 'allocation_immutable' using errcode = 'QA409';
    end if;
    return old;
  end if;
  if new.attempt_id is distinct from old.attempt_id or new.sequence is distinct from old.sequence or new.role is distinct from old.role
     or new.snapshot_id is distinct from old.snapshot_id or new.difficulty is distinct from old.difficulty
     or new.option_order is distinct from old.option_order then
    raise exception 'allocation_immutable' using errcode = 'QA409';
  end if;
  -- LA-TIME-003: the question timeline is written once.
  if old.presented_at is not null and (new.presented_at, new.available_at, new.deadline_at) is distinct from (old.presented_at, old.available_at, old.deadline_at) then
    raise exception 'timeline_immutable' using errcode = 'QA409';
  end if;
  if old.content_released_at is not null and new.content_released_at is distinct from old.content_released_at then
    raise exception 'timeline_immutable' using errcode = 'QA409';
  end if;
  if old.outcome is not null and (new.outcome, new.resolved_at, new.result) is distinct from (old.outcome, old.resolved_at, old.result) then
    raise exception 'outcome_immutable' using errcode = 'QA409';
  end if;
  return new;
end;
$$;
create trigger attempt_allocations_guard before update or delete on public.attempt_allocations
  for each row execute function public.attempt_allocations_guard();

create function public.append_only_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.attempts a where a.id = old.attempt_id) then
    return old;
  end if;
  raise exception 'append_only' using errcode = 'QA409';
end;
$$;
create trigger attempt_events_append_only before update or delete on public.attempt_events
  for each row execute function public.append_only_guard();
create trigger answer_submissions_append_only before update or delete on public.answer_submissions
  for each row execute function public.append_only_guard();

-- ---------------------------------------------------------------------------------------------
-- Question pool for a competition: the frozen snapshot once it exists, otherwise the live pool.
-- Same column shape as eligible_questions so allocate_question_set can use it unchanged.
-- ---------------------------------------------------------------------------------------------
create function public.competition_pool(p_competition_id uuid, p_game public.game_type, p_kind text)
returns table (
  question_id uuid, version_id uuid, pool public.question_pool, difficulty public.question_difficulty,
  chapter public.course_chapter, option_count smallint, prompt_len int, max_option_len int,
  disclosed boolean, confirmed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.question_id, s.question_version_id, s.pool, s.difficulty, s.chapter, s.option_count, 0, 0, false, true
  from public.competition_question_snapshots s
  join public.competition_games g on g.id = s.competition_game_id
  where g.competition_id = p_competition_id and g.game_type = p_game
  union all
  select e.question_id, e.version_id, e.pool, e.difficulty, e.chapter, e.option_count, e.prompt_len, e.max_option_len, e.disclosed, e.confirmed
  from public.eligible_questions(p_game, p_kind, p_competition_id) e
  where not exists (
    select 1 from public.competition_question_snapshots s2
    join public.competition_games g2 on g2.id = s2.competition_game_id
    where g2.competition_id = p_competition_id and g2.game_type = p_game)
$$;

-- ---------------------------------------------------------------------------------------------
-- Competition admin: create, readiness, transitions, snapshot.
-- ---------------------------------------------------------------------------------------------
create function public.create_competition(
  p_actor uuid, p_name text, p_kind text, p_opens_at timestamptz, p_start_deadline_at timestamptz,
  p_latency_allowance_ms int default 400, p_lock_wait_limit_ms int default 2000,
  p_minefield_duration_ms int default 180000, p_race_duration_ms int default 150000, p_offsets jsonb default null,
  p_reconcile_grace_ms int default 250
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_public uuid;
  v_offsets jsonb := jsonb_build_object('cellFlipMs', 500, 'raceFirstMs', 600, 'raceNextMs', 900) || coalesce(p_offsets, '{}'::jsonb);
begin
  perform public.arena_require_admin(p_actor);
  if p_kind not in ('official', 'rehearsal') then raise exception 'invalid_kind' using errcode = 'QA422'; end if;
  if (v_offsets ->> 'cellFlipMs')::int not between 0 and 600
     or (v_offsets ->> 'raceFirstMs')::int not between 0 and 1000
     or (v_offsets ->> 'raceNextMs')::int not between 800 and 1000 then
    raise exception 'invalid_offsets' using errcode = 'QA422';
  end if;
  insert into public.competitions (name, kind, opens_at, start_deadline_at, latency_allowance_ms, lock_wait_limit_ms, reconcile_grace_ms, created_by)
  values (p_name, p_kind::public.competition_kind, p_opens_at, p_start_deadline_at, p_latency_allowance_ms, p_lock_wait_limit_ms, p_reconcile_grace_ms, p_actor)
  returning id, public_id into v_id, v_public;
  insert into public.competition_games (competition_id, game_type, total_duration_ms, rules, blueprint) values
    (v_id, 'minefield', p_minefield_duration_ms, jsonb_build_object('schemaVersion', 1, 'offsets', v_offsets),
     '[{"role":"main","difficulty":"easy","n":3},{"role":"main","difficulty":"medium","n":4},{"role":"main","difficulty":"hard","n":3},{"role":"defuse","difficulty":"easy","n":3}]'::jsonb),
    (v_id, 'race', p_race_duration_ms, jsonb_build_object('schemaVersion', 1, 'offsets', v_offsets),
     '[{"role":"main","difficulty":"easy","n":5},{"role":"main","difficulty":"medium","n":7},{"role":"main","difficulty":"hard","n":3}]'::jsonb);
  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, after_redacted)
  values (p_actor, 'competition.create', 'competition', v_id::text, jsonb_build_object('kind', p_kind, 'name', p_name));
  return jsonb_build_object('id', v_id, 'publicId', v_public, 'state', 'draft', 'kind', p_kind);
end;
$$;

create function public.competition_readiness(p_competition_id uuid, p_expected_attempts int default 60)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_kind public.competition_kind;
begin
  select kind into v_kind from public.competitions where id = p_competition_id;
  if not found then raise exception 'competition_not_found' using errcode = 'QA404'; end if;
  return public.question_bank_readiness(v_kind::text, p_competition_id, p_expected_attempts);
end;
$$;

-- Freeze the pool: official snapshots hold bank questions that are Published, not retired and not
-- disclosed (unless confirmed for this competition); rehearsal may also hold fixtures.
create function public.take_competition_snapshot(p_competition_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind public.competition_kind;
  v_count int;
begin
  select kind into v_kind from public.competitions where id = p_competition_id;
  insert into public.competition_question_snapshots
    (competition_game_id, question_id, question_version_id, pool, chapter, question_type, option_count, difficulty, origin, snapshot_public, snapshot_private)
  select g.id, q.id, v.id, q.pool, q.chapter, q.question_type, q.option_count, q.difficulty, q.origin, v.content_public, v.content_private
  from public.competition_games g
  cross join lateral public.eligible_questions(g.game_type, v_kind::text, p_competition_id) e
  join public.question_versions v on v.id = e.version_id
  join public.questions q on q.id = e.question_id
  where g.competition_id = p_competition_id
    and (v_kind = 'rehearsal' or not e.disclosed or e.confirmed);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.transition_competition(p_competition_id uuid, p_actor uuid, p_target public.competition_state)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.competitions;
  v_ready jsonb;
  v_snap int := null;
  v_now timestamptz := public.arena_clock();
begin
  perform public.arena_require_admin(p_actor);
  select * into c from public.competitions where id = p_competition_id for update;
  if not found then raise exception 'competition_not_found' using errcode = 'QA404'; end if;
  if p_target = 'finalized' then
    raise exception 'use_finalize_competition' using errcode = 'QA422';
  end if;
  if not ((c.state, p_target) in (('draft', 'scheduled'), ('scheduled', 'open'), ('open', 'start_closed'),
                                  ('start_closed', 'settling'), ('finalized', 'archived'))) then
    raise exception 'illegal_transition' using errcode = 'QA409', detail = format('%s -> %s', c.state, p_target);
  end if;
  if p_target = 'scheduled' then
    v_ready := public.question_bank_readiness(c.kind::text, c.id, 60);
    if not (v_ready ->> 'ready')::boolean then
      raise exception 'readiness_blocked' using errcode = 'QA422', detail = (v_ready -> 'blockers')::text;
    end if;
    v_snap := public.take_competition_snapshot(c.id);
    update public.competition_games set config_locked_at = v_now where competition_id = c.id;
  end if;
  begin
    update public.competitions set state = p_target, updated_at = v_now where id = c.id;
  exception when unique_violation then
    raise exception 'another_competition_open' using errcode = 'QA409';
  end;
  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before_redacted, after_redacted)
  values (p_actor, 'competition.transition', 'competition', c.id::text, jsonb_build_object('state', c.state),
          jsonb_build_object('state', p_target, 'snapshotQuestions', v_snap));
  return jsonb_build_object('id', c.id, 'from', c.state, 'to', p_target, 'snapshotQuestions', v_snap);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Attempt internals. Callers hold the attempt row lock.
-- ---------------------------------------------------------------------------------------------
create function public.arena_lock_attempt(p_attempt_id uuid, p_profile_id uuid) returns public.attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lw int;
  a public.attempts;
begin
  select c.lock_wait_limit_ms into v_lw
  from public.attempts x join public.competitions c on c.id = x.competition_id
  where x.id = p_attempt_id and x.profile_id = p_profile_id;
  if not found then raise exception 'attempt_not_found' using errcode = 'QA404'; end if;
  -- LA-TIME-021: bounded lock wait; on timeout Postgres raises 55P03 and nothing is written.
  perform set_config('lock_timeout', v_lw || 'ms', true);
  select * into a from public.attempts where id = p_attempt_id for update;
  return a;
end;
$$;

create function public.arena_check_session(a public.attempts, p_session_version int) returns void
language plpgsql immutable set search_path = ''
as $$
begin
  if p_session_version is distinct from a.session_version then
    raise exception 'stale_session' using errcode = 'QA409';
  end if;
end;
$$;

create function public.arena_ledger(p_attempt_id uuid, p_type text, p_source text, p_delta int, p_detail jsonb default '{}'::jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seq int;
  v_score int;
begin
  select coalesce(max(seq), 0) + 1 into v_seq from public.attempt_events where attempt_id = p_attempt_id;
  update public.attempts set score = score + p_delta where id = p_attempt_id returning score into v_score;
  insert into public.attempt_events (attempt_id, seq, event_type, source_ref, points_delta, score_after, detail)
  values (p_attempt_id, v_seq, p_type, p_source, p_delta, v_score, p_detail);
  return v_score;
end;
$$;

create function public.arena_lb_refresh(p_attempt_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare a public.attempts;
begin
  select * into a from public.attempts where id = p_attempt_id;
  update public.leaderboard_entries e set
    score = a.score, correct_count = a.main_correct, hard_correct = a.hard_correct,
    completion_duration_ms = a.completion_duration_ms, progress = a.main_answered,
    state = case a.state when 'active' then 'playing' when 'completed' then 'completed' when 'timed_out' then 'timed_out' else e.state end,
    excluded = (a.state = 'voided'), version = e.version + 1, updated_at = public.arena_clock()
  where e.competition_game_id = a.competition_game_id and e.profile_id = a.profile_id;
  insert into public.leaderboard_versions (competition_game_id, version, committed_at)
  values (a.competition_game_id, 1, public.arena_clock())
  on conflict (competition_game_id) do update set version = public.leaderboard_versions.version + 1, committed_at = excluded.committed_at;
end;
$$;

-- Ends the attempt. Completion time = min(time the last question was processed, ends_at) (§5.4.1);
-- a timed-out attempt always reports the full duration (LA-LB-009).
create function public.arena_finish(p_attempt_id uuid, p_processed_at timestamptz) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.attempts;
  v_term timestamptz;
  v_state public.attempt_state;
begin
  select * into a from public.attempts where id = p_attempt_id;
  if a.state <> 'active' then return; end if;
  v_term := least(p_processed_at, a.ends_at);
  v_state := case when a.main_answered >= a.main_total and v_term < a.ends_at then 'completed' else 'timed_out' end;
  update public.attempts set
    state = v_state, terminal_at = v_term, pending_allocation_id = null, version = version + 1,
    completion_duration_ms = case when v_state = 'timed_out' then public.arena_ms_between(a.started_at, a.ends_at)
                                  else public.arena_ms_between(a.started_at, v_term) end
  where id = a.id;
  perform public.arena_lb_refresh(a.id);
end;
$$;

-- Writes the question timeline once (LA-TIME-003, LA-TIME-010).
create function public.arena_present(p_attempt_id uuid, p_alloc_id uuid, p_at timestamptz, p_offset_ms int) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.attempts;
  al public.attempt_allocations;
begin
  select * into a from public.attempts where id = p_attempt_id;
  select * into al from public.attempt_allocations where id = p_alloc_id;
  update public.attempt_allocations set
    presented_at = p_at,
    available_at = p_at + public.arena_ms(p_offset_ms),
    deadline_at = p_at + public.arena_ms(p_offset_ms) + public.arena_ms(public.arena_limit_ms(a.game_type, al.role, al.difficulty))
  where id = p_alloc_id and presented_at is null;
  if not found then raise exception 'already_presented' using errcode = 'QA409'; end if;
  update public.attempts set pending_allocation_id = p_alloc_id where id = a.id;
end;
$$;

-- Applies one resolved question (answer, late answer or timeout) to the attempt, atomically.
-- p_processed_at is when the question counts as processed (receipt for an answer, the effective
-- deadline for a timeout); p_now is the decision clock used to present the next question.
create function public.arena_resolve(p_attempt_id uuid, p_alloc_id uuid, p_outcome text, p_processed_at timestamptz, p_now timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.attempts;
  al public.attempt_allocations;
  v_base int;
  v_points int := 0;
  v_combo int := 0;
  v_double boolean := false;
  v_streak int;
  v_effect text := 'none';
  v_penalty int;
  v_result jsonb;
  v_next uuid;
  v_next_at timestamptz;
begin
  select * into a from public.attempts where id = p_attempt_id;
  select * into al from public.attempt_allocations where id = p_alloc_id;
  v_base := public.arena_points(a.game_type, al.difficulty);

  if al.role = 'main' then
    if p_outcome = 'correct' then
      v_double := a.game_type = 'minefield' and a.double_armed;
      v_points := v_base * case when v_double then 2 else 1 end;
      perform public.arena_ledger(a.id, 'answer', al.id::text, v_points,
        jsonb_build_object('outcome', 'correct', 'difficulty', al.difficulty, 'doubled', v_double));
      if a.game_type = 'race' then
        v_streak := a.streak + 1;
        if v_streak % 3 = 0 and a.combo_awards < 5 then
          v_combo := 30;
          perform public.arena_ledger(a.id, 'combo_bonus', al.id::text, 30, jsonb_build_object('streak', v_streak));
        end if;
      end if;
    else
      perform public.arena_ledger(a.id, case when p_outcome = 'timed_out' then 'timeout' else 'answer' end, al.id::text, 0,
        jsonb_build_object('outcome', p_outcome, 'difficulty', al.difficulty));
      v_streak := 0;
      v_double := a.game_type = 'minefield' and a.double_armed;
    end if;
    -- MINE-ITEM-001: x2 is consumed by the next main question whatever its outcome.
    if a.game_type = 'minefield' and a.double_armed then
      perform public.arena_ledger(a.id, 'double_consumed', al.id::text, 0, jsonb_build_object('outcome', p_outcome));
    end if;
    update public.attempts set
      main_answered = main_answered + 1,
      main_correct = main_correct + (p_outcome = 'correct')::int,
      hard_correct = hard_correct + (p_outcome = 'correct' and al.difficulty = 'hard')::int,
      double_armed = case when a.game_type = 'minefield' then false else double_armed end,
      streak = coalesce(v_streak, streak),
      combo_awards = combo_awards + (v_combo > 0)::int
    where id = a.id;
  else
    -- Defuse (MINE-BOMB-001..005): never scores, never uses x2, not counted in the 10 main questions.
    if p_outcome = 'correct' then
      perform public.arena_ledger(a.id, 'defuse_ok', al.id::text, 0);
    elsif a.shields > 0 then
      perform public.arena_ledger(a.id, 'shield_consumed', al.id::text, 0, jsonb_build_object('outcome', p_outcome));
      update public.attempts set shields = shields - 1 where id = a.id;
      v_effect := 'shield_consumed';
    else
      v_penalty := least(a.score, 100);
      perform public.arena_ledger(a.id, 'bomb_penalty', al.id::text, -v_penalty, jsonb_build_object('outcome', p_outcome));
      v_points := -v_penalty;
      v_effect := 'penalty';
    end if;
  end if;

  select jsonb_build_object('allocationId', al.id, 'role', al.role, 'outcome', p_outcome,
    'awardedPoints', v_points + v_combo, 'comboBonus', v_combo, 'doubleApplied', v_double and p_outcome = 'correct',
    'effect', v_effect, 'scoreAfter', t.score)
    into v_result from public.attempts t where t.id = a.id;

  update public.attempt_allocations set outcome = p_outcome, resolved_at = p_now, result = v_result where id = al.id;
  update public.attempts set pending_allocation_id = null, version = version + 1 where id = a.id;

  select * into a from public.attempts where id = a.id;
  -- Game 2: the next question is presented when the previous one was processed. For an answer that is
  -- the commit time; for an expired question it is that question's effective deadline, so the timeline
  -- is the same whether the timeout is written now or later.
  v_next_at := case when p_outcome = 'timed_out' then p_processed_at else p_now end;
  if a.main_answered >= a.main_total then
    perform public.arena_finish(a.id, p_processed_at);
  elsif a.game_type = 'race' and v_next_at >= a.ends_at then
    perform public.arena_finish(a.id, a.ends_at);
  elsif a.game_type = 'minefield' and p_now >= a.ends_at then
    perform public.arena_finish(a.id, a.ends_at);
  elsif a.game_type = 'race' then
    select x.id into v_next from public.attempt_allocations x
      where x.attempt_id = a.id and x.role = 'main' and x.presented_at is null order by x.sequence limit 1;
    perform public.arena_present(a.id, v_next, v_next_at, public.arena_offset_ms(a.competition_game_id, 'raceNextMs'));
  end if;
  perform public.arena_lb_refresh(a.id);
  return v_result;
end;
$$;

-- LA-TIME-022 (amended 2026-10-30, owner decision): a timeout is written once the answer window plus
-- reconcile_grace_ms has passed, NOT plus the lock-wait limit. Why this still protects an on-time
-- answer that is waiting for the row lock: every writer takes its clock BEFORE it queues for the lock
-- and the lock queue is FIFO. An answer received at r <= deadline+latency queues at r+e (e = the few
-- statements between taking r and `for update`); a reconcile only writes if its own pre-lock clock t0
-- is > deadline+latency+grace, so it queues after t0 > r+e whenever grace >= e. The answer therefore
-- runs first and the reconcile then finds the question already resolved. lock_wait_limit_ms bounds
-- how long any request waits (lock_timeout, nothing written on expiry) and no longer delays a
-- question change. The next question's timeline is chained to the expired question's effective
-- deadline, so the moment the write happens never changes anybody's clock.
create function public.arena_needs_reconcile(p_attempt_id uuid, p_now timestamptz) returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.attempts;
  c public.competitions;
  al public.attempt_allocations;
  v_buf interval;
begin
  select * into a from public.attempts where id = p_attempt_id;
  if a.state <> 'active' then return false; end if;
  select * into c from public.competitions where id = a.competition_id;
  v_buf := public.arena_ms(c.latency_allowance_ms + c.reconcile_grace_ms);
  if a.pending_allocation_id is not null then
    select * into al from public.attempt_allocations where id = a.pending_allocation_id;
    return p_now > least(al.deadline_at, a.ends_at) + v_buf;
  end if;
  return p_now > a.ends_at + v_buf;
end;
$$;

create function public.arena_reconcile(p_attempt_id uuid, p_now timestamptz) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.attempts;
  c public.competitions;
  al public.attempt_allocations;
  v_buf interval;
  v_eff timestamptz;
  v_guard int := 0;
begin
  select * into a from public.attempts where id = p_attempt_id;
  select * into c from public.competitions where id = a.competition_id;
  v_buf := public.arena_ms(c.latency_allowance_ms + c.reconcile_grace_ms);
  loop
    v_guard := v_guard + 1;
    exit when v_guard > 40;
    select * into a from public.attempts where id = p_attempt_id;
    exit when a.state <> 'active';
    if a.pending_allocation_id is not null then
      select * into al from public.attempt_allocations where id = a.pending_allocation_id;
      v_eff := least(al.deadline_at, a.ends_at);
      exit when p_now <= v_eff + v_buf;
      -- LA-TIME-008/009/016: expired (or never released) means timed out; a defuse becomes a failed defuse.
      perform public.arena_resolve(a.id, al.id, 'timed_out', v_eff, p_now);
    else
      exit when p_now <= a.ends_at + v_buf;
      perform public.arena_finish(a.id, a.ends_at);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Projection: what a player may see. Never question content, never answers, never unopened cells.
-- ---------------------------------------------------------------------------------------------
create function public.arena_standing_label(p_competition_id uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select case when c.kind = 'rehearsal' then 'rehearsal'
              when c.state in ('finalized', 'archived') then 'official' else 'provisional' end
  from public.competitions c where c.id = p_competition_id
$$;

create function public.arena_projection(p_attempt_id uuid, p_now timestamptz) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.attempts;
  c public.competitions;
  al public.attempt_allocations;
  v_board jsonb := null;
  v_inter jsonb := null;
  v_last jsonb;
  v_eff timestamptz;
  v_status text;
  v_up_id uuid;
  v_up_seq smallint;
begin
  select * into a from public.attempts where id = p_attempt_id;
  select * into c from public.competitions where id = a.competition_id;

  if a.game_type = 'minefield' then
    select jsonb_agg(
      case when m.opened_at is null then jsonb_build_object('index', m.cell_index, 'opened', false)
           else jsonb_build_object('index', m.cell_index, 'opened', true, 'kind', m.kind)
                || case when m.allocation_id is not null
                        then jsonb_build_object('allocationId', m.allocation_id, 'difficulty', x.difficulty, 'outcome', x.outcome)
                        else '{}'::jsonb end
      end order by m.cell_index)
    into v_board
    from public.minefield_cells m left join public.attempt_allocations x on x.id = m.allocation_id
    where m.attempt_id = a.id;
  end if;

  if a.pending_allocation_id is not null then
    select * into al from public.attempt_allocations where id = a.pending_allocation_id;
    v_eff := least(al.deadline_at, a.ends_at);
    v_status := case
      when p_now < al.available_at then 'pending'
      when al.available_at >= a.ends_at then 'unavailable'
      when p_now > v_eff + public.arena_ms(c.latency_allowance_ms) then 'expired'
      else 'released' end;
    v_inter := jsonb_build_object('allocationId', al.id, 'sequence', al.sequence, 'role', al.role, 'status', v_status,
      'contentFetched', al.content_released_at is not null);
    if a.game_type = 'minefield' then v_inter := v_inter || jsonb_build_object('difficulty', al.difficulty); end if;
    if v_status = 'pending' then
      v_inter := v_inter || jsonb_build_object('availableInMs', public.arena_ms_until(p_now, al.available_at));
    elsif v_status = 'released' then
      v_inter := v_inter || jsonb_build_object('remainingMs', greatest(0, public.arena_ms_between(p_now, v_eff)));
    elsif v_status = 'expired' and a.game_type = 'race' and a.state = 'active' then
      -- The answer window is closed but the timeout is not written yet (grace). The next question's
      -- timeline is already fixed (chained to this deadline), so the client can start waiting for it.
      select x.id, x.sequence into v_up_id, v_up_seq from public.attempt_allocations x
        where x.attempt_id = a.id and x.role = 'main' and x.presented_at is null order by x.sequence limit 1;
      if v_up_id is not null and v_eff + public.arena_ms(public.arena_offset_ms(a.competition_game_id, 'raceNextMs')) < a.ends_at then
        v_inter := v_inter || jsonb_build_object('upcoming', jsonb_build_object('allocationId', v_up_id, 'sequence', v_up_seq,
          'availableInMs', public.arena_ms_until(p_now, v_eff + public.arena_ms(public.arena_offset_ms(a.competition_game_id, 'raceNextMs')))));
      end if;
    end if;
  end if;

  select jsonb_build_object('type', e.event_type, 'pointsDelta', e.points_delta, 'scoreAfter', e.score_after, 'sourceRef', e.source_ref)
    into v_last from public.attempt_events e where e.attempt_id = a.id and e.event_type <> 'board_swap' order by e.seq desc limit 1;

  return jsonb_build_object(
    'attempt', jsonb_build_object('id', a.id, 'game', a.game_type, 'state', a.state, 'version', a.version, 'sessionVersion', a.session_version,
      'score', a.score, 'startedAt', a.started_at, 'endsAt', a.ends_at,
      'remainingMs', case when a.state = 'active' then greatest(0, public.arena_ms_between(p_now, a.ends_at)) else 0 end,
      'mainTotal', a.main_total, 'mainAnswered', a.main_answered, 'mainCorrect', a.main_correct,
      'completionDurationMs', a.completion_duration_ms)
      || case when a.game_type = 'minefield' then jsonb_build_object('shields', a.shields, 'doubleArmed', a.double_armed)
              else jsonb_build_object('streak', a.streak, 'comboAwards', a.combo_awards) end,
    'competition', jsonb_build_object('publicId', c.public_id, 'kind', c.kind, 'state', c.state, 'standing', public.arena_standing_label(c.id)),
    'board', v_board,
    'interaction', v_inter,
    'lastEvent', v_last);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Player RPCs (service_role only; the server passes the authenticated profile id).
-- ---------------------------------------------------------------------------------------------
create function public.start_or_resume_attempt(p_profile_id uuid, p_competition_public_id uuid, p_game public.game_type, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_received timestamptz := public.arena_clock();
  c public.competitions;
  g public.competition_games;
  prof public.profiles;
  a public.attempts;
  oa public.attempts;
  r record;
  sn public.competition_question_snapshots;
  v_start timestamptz;
begin
  perform public.arena_check_key(p_idempotency_key);
  select * into c from public.competitions where public_id = p_competition_public_id;
  if not found then raise exception 'competition_not_found' using errcode = 'QA404'; end if;
  select * into prof from public.profiles where id = p_profile_id and role = 'student' and status = 'active';
  if not found then raise exception 'profile_not_eligible' using errcode = '42501'; end if;
  select * into g from public.competition_games where competition_id = c.id and game_type = p_game;

  perform set_config('lock_timeout', c.lock_wait_limit_ms || 'ms', true);
  -- Serializes starts of one student across both games (LA-TRY-003) so the checks below are race-free.
  perform pg_advisory_xact_lock(hashtextextended('start:' || c.id::text || ':' || prof.id::text, 0));

  select * into a from public.attempts where competition_game_id = g.id and profile_id = prof.id for update;
  if found then
    -- LA-TRY-004: F5, re-login or another device reuses the attempt; nothing is re-created or re-timed.
    perform public.arena_reconcile(a.id, v_received);
    return jsonb_build_object('result', jsonb_build_object('resumed', true), 'projection', public.arena_projection(a.id, public.arena_clock()));
  end if;

  if c.state <> 'open' or v_received >= c.start_deadline_at then
    raise exception 'start_closed' using errcode = 'QA409';
  end if;

  select * into oa from public.attempts where competition_id = c.id and profile_id = prof.id and state = 'active' for update;
  if found then
    perform public.arena_reconcile(oa.id, v_received);
    select * into oa from public.attempts where id = oa.id;
    if oa.state = 'active' then
      raise exception 'another_attempt_active' using errcode = 'QA409',
        detail = jsonb_build_object('attemptId', oa.id, 'game', oa.game_type)::text;
    end if;
  end if;

  v_start := public.arena_clock();
  insert into public.attempts (competition_id, competition_game_id, profile_id, game_type, started_at, ends_at, max_legal_end_at,
                               main_total, start_idempotency_key)
  values (c.id, g.id, prof.id, p_game, v_start, v_start + public.arena_ms(g.total_duration_ms),
          c.start_deadline_at + public.arena_ms(g.total_duration_ms + c.latency_allowance_ms),
          public.arena_main_total(p_game), p_idempotency_key)
  returning * into a;

  -- LA-ALLOC-004: the whole set is allocated once, with a per-attempt random option order (LA-ALLOC-003).
  for r in select * from public.allocate_question_set(c.id, p_game, c.kind::text) loop
    select * into sn from public.competition_question_snapshots s where s.competition_game_id = g.id and s.question_version_id = r.question_version_id;
    insert into public.attempt_allocations (attempt_id, sequence, role, snapshot_id, difficulty, option_order)
    values (a.id, r.slot, r.role, sn.id, r.difficulty,
            (select jsonb_agg(opt ->> 'id' order by gen_random_uuid()) from jsonb_array_elements(sn.snapshot_public -> 'options') opt));
  end loop;

  if p_game = 'minefield' then
    -- MINE-BOARD-001/002/004: 10 question, 3 bomb, 1 x2, 2 shield, 4 chest cells; secure shuffle; random difficulty per cell.
    with k as materialized (
      select kind, (row_number() over (order by gen_random_uuid()) - 1)::smallint as cell_index
      from (select 'question'::text as kind from generate_series(1, 10)
            union all select 'bomb' from generate_series(1, 3)
            union all select 'double'
            union all select 'shield' from generate_series(1, 2)
            union all select 'chest' from generate_series(1, 4)) t
    ), qc as materialized (
      select cell_index, row_number() over (order by gen_random_uuid()) as rn from k where kind = 'question'
    ), bc as materialized (
      select cell_index, row_number() over (order by gen_random_uuid()) as rn from k where kind = 'bomb'
    ), ma as materialized (
      select id, row_number() over (order by sequence) as rn from public.attempt_allocations where attempt_id = a.id and role = 'main'
    ), da as materialized (
      select id, row_number() over (order by sequence) as rn from public.attempt_allocations where attempt_id = a.id and role = 'defuse'
    )
    insert into public.minefield_cells (attempt_id, cell_index, kind, allocation_id)
    select a.id, k.cell_index, k.kind,
           case k.kind
             when 'question' then (select ma.id from qc join ma on ma.rn = qc.rn where qc.cell_index = k.cell_index)
             when 'bomb' then (select da.id from bc join da on da.rn = bc.rn where bc.cell_index = k.cell_index)
           end
    from k;
  else
    select x.id into r from public.attempt_allocations x where x.attempt_id = a.id and x.sequence = 1;
    perform public.arena_present(a.id, r.id, v_start, public.arena_offset_ms(g.id, 'raceFirstMs'));
  end if;

  insert into public.leaderboard_entries (competition_game_id, profile_id, public_entry_id, display_name_snapshot, display_name_suffix)
  values (g.id, prof.id, prof.public_entry_id, prof.display_name, prof.display_name_suffix);
  perform public.arena_lb_refresh(a.id);
  return jsonb_build_object('result', jsonb_build_object('resumed', false), 'projection', public.arena_projection(a.id, public.arena_clock()));
end;
$$;

create function public.get_attempt_projection(p_profile_id uuid, p_attempt_id uuid, p_session_version int default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := public.arena_clock();
  a public.attempts;
begin
  select * into a from public.attempts where id = p_attempt_id and profile_id = p_profile_id;
  if not found then raise exception 'attempt_not_found' using errcode = 'QA404'; end if;
  if p_session_version is not null then perform public.arena_check_session(a, p_session_version); end if;
  if public.arena_needs_reconcile(a.id, v_now) then
    a := public.arena_lock_attempt(a.id, p_profile_id);
    perform public.arena_reconcile(a.id, v_now);
  end if;
  return public.arena_projection(a.id, v_now);
end;
$$;

-- Content release (LA-TIME-013..017). The ONLY place a question's text leaves the database.
-- The display counter moves exactly once per allocation: on the NULL -> value transition of
-- content_released_at, which the attempt row lock serializes (LA-ALLOC-012).
create function public.get_interaction_content(p_profile_id uuid, p_attempt_id uuid, p_allocation_id uuid, p_session_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_received timestamptz := public.arena_clock();
  a public.attempts;
  al public.attempt_allocations;
  sn public.competition_question_snapshots;
  v_now timestamptz;
  v_eff timestamptz;
  v_wait numeric;
  v_first int;
  pend public.attempt_allocations;
  c public.competitions;
  v_ready timestamptz;
  v_wait0 numeric;
begin
  -- Race: the player may ask for the next question while the previous one is expired but its timeout is
  -- not writable yet. The wait happens BEFORE queueing for the row lock: a reconcile must queue after
  -- deadline + latency + grace, otherwise it could overtake an on-time answer (see arena_reconcile).
  select * into a from public.attempts where id = p_attempt_id and profile_id = p_profile_id;
  if found and a.state = 'active' and a.game_type = 'race' and a.pending_allocation_id is not null
     and a.pending_allocation_id is distinct from p_allocation_id then
    select * into al from public.attempt_allocations where id = p_allocation_id and attempt_id = a.id;
    select * into pend from public.attempt_allocations where id = a.pending_allocation_id;
    select * into c from public.competitions where id = a.competition_id;
    if al.id is not null and al.outcome is null and al.presented_at is null
       and v_received > least(pend.deadline_at, a.ends_at) + public.arena_ms(c.latency_allowance_ms) then
      v_ready := least(pend.deadline_at, a.ends_at) + public.arena_ms(c.latency_allowance_ms + c.reconcile_grace_ms);
      if v_received <= v_ready then
        v_wait0 := extract(epoch from (v_ready - v_received)) * 1000;
        if v_wait0 <= 1000 and not public.arena_clock_is_fixed() then
          perform pg_sleep(v_wait0 / 1000.0 + 0.002);
          v_received := public.arena_clock();
        else
          raise exception 'too_early' using errcode = 'QA425',
            detail = jsonb_build_object('availableInMs', public.arena_ms_until(v_received, v_ready))::text;
        end if;
      end if;
    end if;
  end if;

  a := public.arena_lock_attempt(p_attempt_id, p_profile_id);
  perform public.arena_check_session(a, p_session_version);
  perform public.arena_reconcile(a.id, v_received);
  select * into a from public.attempts where id = a.id;
  if a.state <> 'active' then raise exception 'attempt_terminal' using errcode = 'QA410'; end if;
  select * into al from public.attempt_allocations where id = p_allocation_id and attempt_id = a.id;
  if not found then raise exception 'allocation_not_found' using errcode = 'QA404'; end if;
  if al.outcome is not null or a.pending_allocation_id is distinct from al.id then
    raise exception 'interaction_not_open' using errcode = 'QA409';
  end if;
  -- LA-TIME-016: a question that would only become available after the attempt ends is never released.
  if al.available_at >= a.ends_at then raise exception 'content_unavailable' using errcode = 'QA409'; end if;

  v_now := public.arena_clock();
  if v_now < al.available_at then
    v_wait := extract(epoch from (al.available_at - v_now)) * 1000;
    -- Long-poll: hold up to the largest offset (<= 1 s), then answer; otherwise 425 without content.
    if v_wait <= 1000 and not public.arena_clock_is_fixed() then
      perform pg_sleep(v_wait / 1000.0 + 0.002);
      v_now := public.arena_clock();
    end if;
    if v_now < al.available_at then
      raise exception 'too_early' using errcode = 'QA425',
        detail = jsonb_build_object('availableInMs', public.arena_ms_until(v_now, al.available_at))::text;
    end if;
  end if;
  v_eff := least(al.deadline_at, a.ends_at);
  if v_now >= v_eff then raise exception 'interaction_expired' using errcode = 'QA409'; end if;

  select * into sn from public.competition_question_snapshots where id = al.snapshot_id;
  update public.attempt_allocations set content_released_at = v_now where id = al.id and content_released_at is null;
  get diagnostics v_first = row_count;
  if v_first = 1 then
    perform public.record_question_displayed(a.competition_id, sn.question_version_id);
  end if;

  return jsonb_build_object(
    'allocationId', al.id, 'sequence', al.sequence, 'role', al.role, 'questionType', sn.question_type,
    'prompt', sn.snapshot_public ->> 'prompt',
    'options', (select jsonb_agg(jsonb_build_object('id', o ->> 'id', 'label', o ->> 'label') order by ord.idx)
                from jsonb_array_elements_text(al.option_order) with ordinality as ord(id, idx)
                join jsonb_array_elements(sn.snapshot_public -> 'options') o on o ->> 'id' = ord.id),
    'remainingMs', greatest(0, public.arena_ms_between(v_now, v_eff))
  ) || case when a.game_type = 'minefield' then jsonb_build_object('difficulty', al.difficulty) else '{}'::jsonb end;
end;
$$;

create function public.open_minefield_cell(p_profile_id uuid, p_attempt_id uuid, p_cell_index int, p_idempotency_key text, p_session_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_received timestamptz := public.arena_clock();
  a public.attempts;
  m public.minefield_cells;
  m2 public.minefield_cells;
  al public.attempt_allocations;
  v_now timestamptz;
  v_opened int;
  v_result jsonb;
  v_off int;
begin
  perform public.arena_check_key(p_idempotency_key);
  if p_cell_index is null or p_cell_index not between 0 and 19 then raise exception 'invalid_cell' using errcode = 'QA422'; end if;
  a := public.arena_lock_attempt(p_attempt_id, p_profile_id);
  perform public.arena_check_session(a, p_session_version);
  if a.game_type <> 'minefield' then raise exception 'wrong_game' using errcode = 'QA422'; end if;

  select * into m from public.minefield_cells where attempt_id = a.id and cell_index = p_cell_index;
  if m.opened_at is not null then
    -- MINE-BOARD-007 / LA-IDEM-001: opening again returns the recorded result and changes nothing.
    return jsonb_build_object('result', m.open_result, 'replayed', true, 'projection', public.arena_projection(a.id, public.arena_clock()));
  end if;

  perform public.arena_reconcile(a.id, v_received);
  select * into a from public.attempts where id = a.id;
  if a.state <> 'active' then raise exception 'attempt_terminal' using errcode = 'QA410'; end if;
  if a.pending_allocation_id is not null then raise exception 'interaction_pending' using errcode = 'QA409'; end if;
  v_now := public.arena_clock();
  if v_now >= a.ends_at then raise exception 'attempt_time_over' using errcode = 'QA410'; end if;

  select count(*) into v_opened from public.minefield_cells where attempt_id = a.id and opened_at is not null;
  if v_opened = 0 and m.kind = 'bomb' then
    -- MINE-BOARD-003: the first opened cell is never a bomb; swap with a random unopened non-bomb cell.
    select * into m2 from public.minefield_cells where attempt_id = a.id and kind <> 'bomb' and opened_at is null order by gen_random_uuid() limit 1;
    update public.minefield_cells x set
      kind = case x.cell_index when m.cell_index then m2.kind else m.kind end,
      allocation_id = case x.cell_index when m.cell_index then m2.allocation_id else m.allocation_id end,
      swapped_from_index = case x.cell_index when m.cell_index then m2.cell_index else x.swapped_from_index end
    where x.attempt_id = a.id and x.cell_index in (m.cell_index, m2.cell_index);
    perform public.arena_ledger(a.id, 'board_swap', 'cell:' || m.cell_index, 0, jsonb_build_object('from', m.cell_index, 'to', m2.cell_index));
    select * into m from public.minefield_cells where attempt_id = a.id and cell_index = p_cell_index;
  end if;

  v_result := jsonb_build_object('cell', m.cell_index, 'kind', m.kind);
  if m.kind in ('question', 'bomb') then
    select * into al from public.attempt_allocations where id = m.allocation_id;
    v_off := public.arena_offset_ms(a.competition_game_id, 'cellFlipMs');
    perform public.arena_present(a.id, al.id, v_now, v_off);
    v_result := v_result || jsonb_build_object('allocationId', al.id, 'role', al.role, 'difficulty', al.difficulty, 'availableInMs', v_off);
  elsif m.kind = 'chest' then
    perform public.arena_ledger(a.id, 'chest', 'cell:' || m.cell_index, 40);
    v_result := v_result || jsonb_build_object('awardedPoints', 40);
  elsif m.kind = 'double' then
    perform public.arena_ledger(a.id, 'double_armed', 'cell:' || m.cell_index, 0);
    update public.attempts set double_armed = true where id = a.id;
  else
    perform public.arena_ledger(a.id, 'shield_gained', 'cell:' || m.cell_index, 0, jsonb_build_object('capped', a.shields >= 2));
    update public.attempts set shields = least(2, shields + 1) where id = a.id;
  end if;

  update public.minefield_cells set opened_at = v_now, open_idempotency_key = p_idempotency_key, open_result = v_result
  where attempt_id = a.id and cell_index = m.cell_index;
  update public.attempts set version = version + 1 where id = a.id;
  if m.kind = 'chest' then perform public.arena_lb_refresh(a.id); end if;
  return jsonb_build_object('result', v_result, 'replayed', false, 'projection', public.arena_projection(a.id, public.arena_clock()));
end;
$$;

create function public.submit_answer(p_profile_id uuid, p_attempt_id uuid, p_allocation_id uuid, p_option_id text, p_idempotency_key text, p_session_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- LA-TIME-020: received_at is the first thing taken, before any lock wait.
  v_received timestamptz := public.arena_clock();
  a public.attempts;
  c public.competitions;
  al public.attempt_allocations;
  sn public.competition_question_snapshots;
  v_prior public.answer_submissions;
  v_eff timestamptz;
  v_in_time boolean;
  v_correct boolean;
  v_outcome text;
  v_result jsonb;
begin
  perform public.arena_check_key(p_idempotency_key);
  if p_option_id is null or p_option_id !~ '^[a-z0-9]{1,8}$' then raise exception 'invalid_option' using errcode = 'QA422'; end if;
  a := public.arena_lock_attempt(p_attempt_id, p_profile_id);
  perform public.arena_check_session(a, p_session_version);

  select * into v_prior from public.answer_submissions where attempt_id = a.id and idempotency_key = p_idempotency_key;
  if found then
    select result into v_result from public.attempt_allocations where id = v_prior.allocation_id;
    return jsonb_build_object('result', v_result, 'replayed', true, 'projection', public.arena_projection(a.id, public.arena_clock()));
  end if;

  -- Reconcile with the receipt time: only timeouts that were already beyond the window when this
  -- answer arrived can be written, so an on-time answer is never pre-empted (LA-TIME-022).
  perform public.arena_reconcile(a.id, v_received);
  select * into a from public.attempts where id = a.id;
  select * into al from public.attempt_allocations where id = p_allocation_id and attempt_id = a.id;
  if not found then raise exception 'allocation_not_found' using errcode = 'QA404'; end if;
  if al.outcome is not null then
    return jsonb_build_object('result', al.result, 'replayed', true, 'projection', public.arena_projection(a.id, public.arena_clock()));
  end if;
  if a.state <> 'active' then raise exception 'attempt_terminal' using errcode = 'QA410'; end if;
  if a.pending_allocation_id is distinct from al.id then raise exception 'interaction_not_open' using errcode = 'QA409'; end if;
  if al.content_released_at is null then raise exception 'content_not_fetched' using errcode = 'QA409'; end if;
  if v_received < al.available_at then
    raise exception 'too_early' using errcode = 'QA425', detail = jsonb_build_object('availableInMs', public.arena_ms_until(v_received, al.available_at))::text;
  end if;

  select * into sn from public.competition_question_snapshots where id = al.snapshot_id;
  if not exists (select 1 from jsonb_array_elements(sn.snapshot_public -> 'options') o where o ->> 'id' = p_option_id) then
    raise exception 'invalid_option' using errcode = 'QA422';
  end if;
  select * into c from public.competitions where id = a.competition_id;

  v_eff := least(al.deadline_at, a.ends_at);                                  -- LA-TIME-009
  v_in_time := v_received <= v_eff + public.arena_ms(c.latency_allowance_ms);  -- LA-TIME-005
  v_correct := v_in_time and (sn.snapshot_private ->> 'correctOptionId') = p_option_id;
  v_outcome := case when not v_in_time then 'timed_out' when v_correct then 'correct' else 'incorrect' end;

  insert into public.answer_submissions (attempt_id, allocation_id, idempotency_key, submitted_option_id, received_at, is_correct, outcome)
  values (a.id, al.id, p_idempotency_key, p_option_id, v_received, v_correct, v_outcome);
  v_result := public.arena_resolve(a.id, al.id, v_outcome, case when v_outcome = 'timed_out' then v_eff else v_received end, public.arena_clock());
  return jsonb_build_object('result', v_result, 'replayed', false, 'projection', public.arena_projection(a.id, public.arena_clock()));
end;
$$;

create function public.heartbeat_attempt(p_profile_id uuid, p_attempt_id uuid, p_session_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := public.arena_clock();
  a public.attempts;
begin
  a := public.arena_lock_attempt(p_attempt_id, p_profile_id);
  perform public.arena_check_session(a, p_session_version);
  -- LA-TIME-012: monitoring only. It never touches a clock, a deadline or a score.
  update public.attempts set last_heartbeat_at = v_now where id = a.id;
  return jsonb_build_object('state', a.state, 'remainingMs', case when a.state = 'active' then greatest(0, public.arena_ms_between(v_now, a.ends_at)) else 0 end);
end;
$$;

-- Device transfer (LA-TRY-006): the caller becomes the controlling session, every other session of
-- the attempt is rejected on its next call. Same key -> same result.
create function public.transfer_attempt_session(p_profile_id uuid, p_attempt_id uuid, p_expected_session_version int, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.attempts;
begin
  perform public.arena_check_key(p_idempotency_key);
  a := public.arena_lock_attempt(p_attempt_id, p_profile_id);
  if a.transfer_key is not distinct from p_idempotency_key then
    return jsonb_build_object('replayed', true, 'projection', public.arena_projection(a.id, public.arena_clock()));
  end if;
  perform public.arena_check_session(a, p_expected_session_version);
  if a.state <> 'active' then raise exception 'attempt_terminal' using errcode = 'QA410'; end if;
  update public.attempts set session_version = session_version + 1, transfer_key = p_idempotency_key, version = version + 1 where id = a.id;
  insert into public.auth_events (profile_id, event) values (p_profile_id, 'session_transfer');
  return jsonb_build_object('replayed', false, 'projection', public.arena_projection(a.id, public.arena_clock()));
end;
$$;

create function public.arena_lobby(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare c public.competitions;
begin
  select * into c from public.competitions where state in ('open', 'start_closed') order by (state = 'open') desc, opens_at desc limit 1;
  if not found then return jsonb_build_object('competition', null, 'games', '[]'::jsonb); end if;
  return jsonb_build_object(
    'competition', jsonb_build_object('publicId', c.public_id, 'name', c.name, 'kind', c.kind, 'state', c.state,
                                      'startDeadlineAt', c.start_deadline_at),
    'games', (select jsonb_agg(jsonb_build_object('game', g.game_type, 'durationMs', g.total_duration_ms,
                'attemptId', t.id, 'state', t.state, 'score', t.score) order by g.game_type)
              from public.competition_games g
              left join public.attempts t on t.competition_game_id = g.id and t.profile_id = p_profile_id
              where g.competition_id = c.id));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Leaderboards (LA-LB-*). Ranks are computed on read: score, correct, hard correct, then
-- completion time (unfinished last); equal on every criterion = same rank (1, 2, 2, 4).
-- ---------------------------------------------------------------------------------------------
create function public.get_leaderboard(p_competition_public_id uuid, p_game public.game_type, p_limit int default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.competitions;
  g public.competition_games;
  v_limit int := least(greatest(coalesce(p_limit, 10), 1), 10);   -- public boards never exceed Top 10
begin
  select * into c from public.competitions where public_id = p_competition_public_id;
  if not found then raise exception 'competition_not_found' using errcode = 'QA404'; end if;
  select * into g from public.competition_games where competition_id = c.id and game_type = p_game;
  return jsonb_build_object(
    'game', p_game, 'standing', public.arena_standing_label(c.id), 'kind', c.kind,
    'version', coalesce((select v.version from public.leaderboard_versions v where v.competition_game_id = g.id), 0),
    'players', (select count(*) from public.leaderboard_entries e where e.competition_game_id = g.id and not e.excluded),
    'completed', (select count(*) from public.leaderboard_entries e where e.competition_game_id = g.id and not e.excluded and e.state <> 'playing'),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rank', r.rnk, 'entryId', r.public_entry_id,
        'displayName', r.display_name_snapshot || case when r.display_name_suffix is not null then ' (' || r.display_name_suffix || ')' else '' end,
        'score', r.score, 'correctCount', r.correct_count, 'hardCorrect', r.hard_correct, 'progress', r.progress,
        'state', r.state, 'completionDurationMs', r.completion_duration_ms) order by r.rnk, r.public_entry_id)
      from (
        select e.*, rank() over (order by e.score desc, e.correct_count desc, e.hard_correct desc, e.completion_duration_ms asc nulls last) as rnk
        from public.leaderboard_entries e where e.competition_game_id = g.id and not e.excluded
        order by rnk, e.public_entry_id limit v_limit
      ) r), '[]'::jsonb));
end;
$$;

-- Personal standing (LA-LB-005): rank, gap to the player directly above, gap to 10th place, and the
-- special cases for sole leader / shared first place.
create function public.get_player_standing(p_profile_id uuid, p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.attempts;
  v_rnk bigint; v_pos bigint; v_score int; v_total bigint; v_tied bigint;
  v_second int; v_above int; v_tenth int;
  v_label text;
begin
  select * into a from public.attempts where id = p_attempt_id and profile_id = p_profile_id;
  if not found then raise exception 'attempt_not_found' using errcode = 'QA404'; end if;
  with r as materialized (
    select e.profile_id, e.score,
           rank() over (order by e.score desc, e.correct_count desc, e.hard_correct desc, e.completion_duration_ms asc nulls last) as rnk,
           row_number() over (order by e.score desc, e.correct_count desc, e.hard_correct desc, e.completion_duration_ms asc nulls last, e.public_entry_id) as pos
    from public.leaderboard_entries e where e.competition_game_id = a.competition_game_id and not e.excluded
  )
  select me.rnk, me.pos, me.score, (select count(*) from r), (select count(*) from r where r.rnk = 1),
         (select max(r.score) from r where r.rnk > 1), (select r.score from r where r.pos = me.pos - 1), (select r.score from r where r.pos = 10)
    into v_rnk, v_pos, v_score, v_total, v_tied, v_second, v_above, v_tenth
  from r me where me.profile_id = p_profile_id;
  if not found then
    return jsonb_build_object('rank', null, 'standing', public.arena_standing_label(a.competition_id));
  end if;
  v_label := case when v_rnk = 1 and v_tied > 1 then 'tied_first'
                  when v_rnk = 1 and v_total = 1 then 'leading_alone'
                  when v_rnk = 1 then 'leading' else 'chasing' end;
  return jsonb_build_object('rank', v_rnk, 'position', v_pos, 'players', v_total, 'score', v_score, 'label', v_label,
    'gapToAbove', case when v_rnk > 1 then v_above - v_score end,
    'gapToTenth', case when v_pos > 10 then v_tenth - v_score end,
    'leadOverSecond', case when v_label = 'leading' then v_score - v_second end,
    'standing', public.arena_standing_label(a.competition_id));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Reconcile, finalize, review.
-- ---------------------------------------------------------------------------------------------
create function public.reconcile_competition(p_competition_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.competitions;
  v_now timestamptz := public.arena_clock();
  r record;
  v_done int := 0;
  v_closed boolean := false;
begin
  select * into c from public.competitions where id = p_competition_id for update;
  if not found then raise exception 'competition_not_found' using errcode = 'QA404'; end if;
  perform set_config('lock_timeout', c.lock_wait_limit_ms || 'ms', true);
  if c.state = 'open' and v_now >= c.start_deadline_at then
    update public.competitions set state = 'start_closed', updated_at = v_now where id = c.id;
    insert into public.audit_logs (action, target_type, target_id, before_redacted, after_redacted)
    values ('competition.auto_close_start', 'competition', c.id::text, jsonb_build_object('state', 'open'), jsonb_build_object('state', 'start_closed'));
    v_closed := true;
  end if;
  for r in select id from public.attempts where competition_id = c.id and state = 'active' order by id loop
    perform 1 from public.attempts where id = r.id for update;
    if public.arena_needs_reconcile(r.id, v_now) then
      perform public.arena_reconcile(r.id, v_now);
      v_done := v_done + 1;
    end if;
  end loop;
  return jsonb_build_object('startClosed', v_closed, 'reconciled', v_done,
    'activeAttempts', (select count(*) from public.attempts where competition_id = c.id and state = 'active'));
end;
$$;

create function public.finalize_competition(p_competition_id uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.competitions;
  v_rec jsonb;
  v_disclosed int;
  v_now timestamptz := public.arena_clock();
begin
  perform public.arena_require_admin(p_actor);
  select * into c from public.competitions where id = p_competition_id;
  if not found then raise exception 'competition_not_found' using errcode = 'QA404'; end if;
  if c.state <> 'settling' then raise exception 'illegal_transition' using errcode = 'QA409', detail = format('%s -> finalized', c.state); end if;
  v_rec := public.reconcile_competition(c.id);
  if (v_rec ->> 'activeAttempts')::int > 0 then
    raise exception 'attempts_still_active' using errcode = 'QA409', detail = v_rec::text;
  end if;
  -- LA-CONTENT-009: only questions somebody actually saw are marked as disclosed.
  v_disclosed := public.mark_competition_answers_disclosed(c.id);
  update public.competitions set state = 'finalized', finalized_at = v_now, updated_at = v_now where id = c.id;
  update public.leaderboard_versions v set version = v.version + 1, committed_at = v_now
    from public.competition_games g where g.id = v.competition_game_id and g.competition_id = c.id;
  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before_redacted, after_redacted)
  values (p_actor, 'competition.finalize', 'competition', c.id::text, jsonb_build_object('state', 'settling'),
          jsonb_build_object('state', 'finalized', 'disclosedQuestions', v_disclosed));
  return jsonb_build_object('id', c.id, 'state', 'finalized', 'disclosedQuestions', v_disclosed);
end;
$$;

-- Review is the only path that returns correct answers and explanations (LA-FB-003/004). It only
-- covers questions the player actually saw, so it reveals nothing that was not already displayed.
create function public.get_attempt_review(p_profile_id uuid, p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.attempts;
  c public.competitions;
begin
  select * into a from public.attempts where id = p_attempt_id and profile_id = p_profile_id;
  if not found then raise exception 'attempt_not_found' using errcode = 'QA404'; end if;
  select * into c from public.competitions where id = a.competition_id;
  if c.state not in ('finalized', 'archived') then raise exception 'review_not_available' using errcode = 'QA409'; end if;
  return jsonb_build_object('attemptId', a.id, 'score', a.score, 'questions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'sequence', al.sequence, 'role', al.role, 'difficulty', al.difficulty, 'outcome', al.outcome,
      'prompt', s.snapshot_public ->> 'prompt', 'options', s.snapshot_public -> 'options',
      'submittedOptionId', (select x.submitted_option_id from public.answer_submissions x where x.allocation_id = al.id),
      'correctOptionId', s.snapshot_private ->> 'correctOptionId', 'explanation', s.snapshot_private ->> 'explanation',
      'sources', coalesce((select jsonb_agg(jsonb_build_object('title', so.title, 'locator', l.locator, 'url', so.url))
                           from public.question_source_links l join public.sources so on so.id = l.source_id
                           where l.question_version_id = s.question_version_id), '[]'::jsonb)) order by al.sequence)
    from public.attempt_allocations al join public.competition_question_snapshots s on s.id = al.snapshot_id
    where al.attempt_id = a.id and al.content_released_at is not null), '[]'::jsonb));
end;
$$;

-- Balanced allocation, now reading the competition's frozen pool (competition_pool) and failing with
-- QB002 when the two-option cap cannot be met (Q1). Body otherwise identical to the Stage C function.
create or replace function public.allocate_question_set(p_competition_id uuid, p_game public.game_type, p_kind text)
returns table (slot int, role text, difficulty public.question_difficulty, question_id uuid, question_version_id uuid, chapter public.course_chapter, option_count smallint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_blueprint jsonb;
  v_n int;
  v_i int;
  v_k int;
  v_slot jsonb;
  v_cap int := case when p_game = 'race' then 5 else null end;
  v_supply3 int[] := '{}';
  v_forced int[] := '{}';
  v_used_two int := 0;
  v_chosen uuid[] := '{}';
  v_chapters jsonb := '{}'::jsonb;
  v_picked_in_slot int;
  v_picked3_in_slot int;
  v_forced_after int;
  v_need int;
  v_pick record;
  v_slot_no int := 0;
  v_pool public.question_pool;
  v_diff public.question_difficulty;
begin
  if p_kind not in ('official', 'rehearsal') then raise exception 'invalid_kind' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('alloc:' || p_competition_id::text || ':' || p_game::text, 0));

  v_blueprint := case p_game
    when 'minefield' then '[
      {"role":"main","pool":"minefield_main","difficulty":"easy","n":3},
      {"role":"main","pool":"minefield_main","difficulty":"medium","n":4},
      {"role":"main","pool":"minefield_main","difficulty":"hard","n":3},
      {"role":"defuse","pool":"minefield_defuse","difficulty":"easy","n":3}]'::jsonb
    else '[
      {"role":"main","pool":"race","difficulty":"easy","n":5},
      {"role":"main","pool":"race","difficulty":"medium","n":7},
      {"role":"main","pool":"race","difficulty":"hard","n":3}]'::jsonb
  end;
  v_n := jsonb_array_length(v_blueprint);

  -- Per slot: how many questions are forced to be two-option because three-option supply is short.
  for v_i in 0 .. v_n - 1 loop
    v_slot := v_blueprint -> v_i;
    v_pool := (v_slot ->> 'pool')::public.question_pool;
    v_diff := (v_slot ->> 'difficulty')::public.question_difficulty;
    v_supply3 := v_supply3 || (
      select count(*)::int from public.competition_pool(p_competition_id, p_game, p_kind) e
      where e.pool = v_pool and e.difficulty = v_diff and e.option_count = 3 and (p_kind <> 'official' or not e.disclosed or e.confirmed));
    v_forced := v_forced || greatest(0, (v_slot ->> 'n')::int - v_supply3[v_i + 1]);
  end loop;

  -- Q1 (2026-10-30): the cap of 5 two-option questions is a hard limit; when the supply cannot meet it,
  -- fail with a clear error instead of silently changing the rule. Spread across questions is the soft priority.
  if v_cap is not null and (select coalesce(sum(f), 0) from unnest(v_forced) f) > v_cap
     and not exists (   -- an outright pool shortage is reported as such (QB001) first
       select 1 from jsonb_array_elements(v_blueprint) b
       where (select count(*) from public.competition_pool(p_competition_id, p_game, p_kind) e
              where e.pool = (b ->> 'pool')::public.question_pool and e.difficulty = (b ->> 'difficulty')::public.question_difficulty
                and (p_kind <> 'official' or not e.disclosed or e.confirmed)) < (b ->> 'n')::int) then
    raise exception 'two_option_cap_unsatisfiable' using errcode = 'QB002',
      detail = format('%s needs %s two-option questions but at most %s are allowed', p_game, (select sum(f) from unnest(v_forced) f), v_cap);
  end if;

  for v_i in 0 .. v_n - 1 loop
    v_slot := v_blueprint -> v_i;
    v_pool := (v_slot ->> 'pool')::public.question_pool;
    v_diff := (v_slot ->> 'difficulty')::public.question_difficulty;
    v_need := (v_slot ->> 'n')::int;
    v_picked_in_slot := 0;
    v_picked3_in_slot := 0;

    for v_k in 1 .. v_need loop
      v_forced_after := coalesce((select sum(f) from unnest(v_forced[v_i + 2 : v_n]) f), 0)
                        + greatest(0, (v_need - v_picked_in_slot - 1) - (v_supply3[v_i + 1] - v_picked3_in_slot));
      select e.question_id, e.version_id, e.chapter, e.option_count
        into v_pick
      from public.competition_pool(p_competition_id, p_game, p_kind) e
      left join public.question_exposures x on x.question_version_id = e.version_id and x.competition_id = p_competition_id
      where e.pool = v_pool and e.difficulty = v_diff
        and not (e.version_id = any (v_chosen))
        and (p_kind <> 'official' or not e.disclosed or e.confirmed)
        and (v_cap is null or e.option_count = 3 or v_used_two + 1 + v_forced_after <= v_cap)
      order by coalesce(x.allocated_count, 0),
               coalesce((v_chapters ->> e.chapter::text)::int, 0),
               (select coalesce(sum(x2.displayed_count), 0) from public.question_exposures x2 where x2.question_version_id = e.version_id),
               random()
      limit 1;
      if v_pick.version_id is null then
        raise exception 'question_pool_insufficient' using errcode = 'QB001', detail = format('%s/%s/%s needs %s', p_game, v_pool, v_diff, v_need);
      end if;

      insert into public.question_exposures (question_version_id, competition_id, allocated_count)
      values (v_pick.version_id, p_competition_id, 1)
      on conflict on constraint question_exposures_pkey do update set allocated_count = public.question_exposures.allocated_count + 1;

      v_chosen := v_chosen || v_pick.version_id;
      v_chapters := jsonb_set(v_chapters, array[v_pick.chapter::text], to_jsonb(coalesce((v_chapters ->> v_pick.chapter::text)::int, 0) + 1));
      v_picked_in_slot := v_picked_in_slot + 1;
      if v_pick.option_count = 3 then v_picked3_in_slot := v_picked3_in_slot + 1; else v_used_two := v_used_two + 1; end if;

      v_slot_no := v_slot_no + 1;
      slot := v_slot_no; role := v_slot ->> 'role'; difficulty := v_diff; question_id := v_pick.question_id;
      question_version_id := v_pick.version_id; chapter := v_pick.chapter; option_count := v_pick.option_count;
      return next;
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Access: server only. RLS enabled with no policies, no client privileges, execute for service_role.
-- ---------------------------------------------------------------------------------------------
alter table public.competitions enable row level security;
alter table public.competition_games enable row level security;
alter table public.competition_question_snapshots enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_allocations enable row level security;
alter table public.minefield_cells enable row level security;
alter table public.answer_submissions enable row level security;
alter table public.attempt_events enable row level security;
alter table public.leaderboard_entries enable row level security;
alter table public.leaderboard_versions enable row level security;

revoke all on public.competitions, public.competition_games, public.competition_question_snapshots, public.attempts,
  public.attempt_allocations, public.minefield_cells, public.answer_submissions, public.attempt_events,
  public.leaderboard_entries, public.leaderboard_versions from anon, authenticated;
grant select on public.competitions, public.competition_games, public.competition_question_snapshots, public.attempts,
  public.attempt_allocations, public.minefield_cells, public.answer_submissions, public.attempt_events,
  public.leaderboard_entries, public.leaderboard_versions to service_role;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'arena\_%' or p.proname in (
      'competition_pool', 'create_competition', 'competition_readiness', 'take_competition_snapshot', 'transition_competition',
      'start_or_resume_attempt', 'get_attempt_projection', 'get_interaction_content', 'open_minefield_cell', 'submit_answer',
      'heartbeat_attempt', 'transfer_attempt_session', 'get_leaderboard', 'get_player_standing', 'reconcile_competition',
      'finalize_competition', 'get_attempt_review', 'competition_games_guard', 'competition_snapshots_guard',
      'attempt_allocations_guard', 'append_only_guard'))
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
