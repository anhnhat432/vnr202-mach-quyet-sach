-- Rehearsal studio isolation & official competition protection.
-- 1. Rehearsal accounts are isolated from active class rosters (is_rehearsal = true, class_id is null)
--    and barred from official competitions (rehearsal_account_forbidden).
-- 2. Rehearsal competitions exclusively use synthetic fixture questions (origin = 'fixture') and never
--    touch or disclose official bank questions (origin = 'bank'), including in snapshots and pools.
-- 3. Official competitions cannot be deleted or reset; rehearsal rounds reset by closing the previous
--    rehearsal round through the legal state machine (preserving all ledger/audit history) and opening
--    a new rehearsal competition.

alter table public.profiles
  add column if not exists is_rehearsal boolean not null default false,
  add constraint profiles_rehearsal_check check (not is_rehearsal or (role = 'student' and class_id is null));

-- Once a profile is marked as a rehearsal account, it can never be converted into a regular student account.
create or replace function public.profiles_rehearsal_immutable_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_rehearsal and not new.is_rehearsal then
    raise exception 'rehearsal_flag_immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_rehearsal_immutable on public.profiles;
create trigger profiles_rehearsal_immutable
  before update of is_rehearsal on public.profiles
  for each row execute function public.profiles_rehearsal_immutable_guard();

-- Strictly isolate question pools by competition kind (replacing exact signature and return table):
-- rehearsal -> origin = 'fixture' ONLY
-- official  -> origin = 'bank' ONLY
create or replace function public.eligible_questions(
  p_game public.game_type,
  p_kind text,
  p_competition_id uuid
)
returns table (
  question_id uuid,
  version_id uuid,
  pool public.question_pool,
  difficulty public.question_difficulty,
  chapter public.course_chapter,
  option_count smallint,
  prompt_len int,
  max_option_len int,
  disclosed boolean,
  confirmed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, v.id, q.pool, q.difficulty, q.chapter, q.option_count,
         char_length(v.content_public ->> 'prompt'),
         (select max(char_length(o ->> 'label')) from jsonb_array_elements(v.content_public -> 'options') o),
         exists (select 1 from public.question_exposures x where x.question_version_id = v.id and x.answer_disclosed_at is not null),
         exists (select 1 from public.competition_disclosed_question_confirmations c where c.question_version_id = v.id and c.competition_id = p_competition_id)
  from public.questions q
  join public.question_versions v on v.id = q.published_version_id
  where q.game_type = p_game
    and v.status = 'published'
    and v.retired_at is null
    and ((p_kind = 'rehearsal' and q.origin = 'fixture') or (p_kind = 'official' and q.origin = 'bank'))
$$;

-- Enforce origin isolation in snapshots and competition_pool as well.
create or replace function public.take_competition_snapshot(p_competition_id uuid)
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
    and ((v_kind = 'rehearsal' and q.origin = 'fixture') or (v_kind = 'official' and q.origin = 'bank'))
    and (v_kind = 'rehearsal' or not e.disclosed or e.confirmed);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.competition_pool(
  p_competition_id uuid,
  p_game public.game_type,
  p_kind text
)
returns table (
  question_id uuid,
  version_id uuid,
  pool public.question_pool,
  difficulty public.question_difficulty,
  chapter public.course_chapter,
  option_count smallint,
  prompt_len int,
  max_option_len int,
  disclosed boolean,
  confirmed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.question_id, s.question_version_id, s.pool, s.difficulty, s.chapter, s.option_count, 0, 0, false, true
  from public.competition_question_snapshots s
  join public.competition_games g on g.id = s.competition_game_id
  where g.competition_id = p_competition_id
    and g.game_type = p_game
    and ((p_kind = 'rehearsal' and s.origin = 'fixture') or (p_kind = 'official' and s.origin = 'bank'))
  union all
  select e.question_id, e.version_id, e.pool, e.difficulty, e.chapter, e.option_count, e.prompt_len, e.max_option_len, e.disclosed, e.confirmed
  from public.eligible_questions(p_game, p_kind, p_competition_id) e
  where not exists (
    select 1 from public.competition_question_snapshots s2
    join public.competition_games g2 on g2.id = s2.competition_game_id
    where g2.competition_id = p_competition_id and g2.game_type = p_game)
$$;

create or replace function public.competition_snapshots_origin_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind public.competition_kind;
begin
  select c.kind into v_kind
  from public.competition_games g
  join public.competitions c on c.id = g.competition_id
  where g.id = new.competition_game_id;

  if v_kind = 'rehearsal' and new.origin <> 'fixture' then
    raise exception 'rehearsal_requires_fixture_origin' using errcode = '23514';
  end if;
  if v_kind = 'official' and new.origin <> 'bank' then
    raise exception 'official_requires_bank_origin' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists competition_snapshots_origin_check on public.competition_question_snapshots;
create trigger competition_snapshots_origin_check
  before insert on public.competition_question_snapshots
  for each row execute function public.competition_snapshots_origin_guard();

-- Finalization marks only questions somebody actually saw (displayed_count > 0, not previously marked)
-- as disclosed (LA-CONTENT-009, LA-AC-037), and never marks official bank questions from a rehearsal competition.
create or replace function public.mark_competition_answers_disclosed(p_competition_id uuid)
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

  update public.question_exposures x
  set answer_disclosed_at = public.arena_clock()
  from public.question_versions v
  join public.questions q on q.id = v.question_id
  where x.competition_id = p_competition_id
    and x.question_version_id = v.id
    and x.displayed_count > 0
    and x.answer_disclosed_at is null
    and (v_kind is null or v_kind = 'official' or q.origin = 'fixture');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Block rehearsal accounts from ever creating or updating an attempt in an official competition.
create or replace function public.attempts_rehearsal_isolation_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_rehearsal boolean;
  v_kind public.competition_kind;
begin
  select is_rehearsal into v_is_rehearsal from public.profiles where id = new.profile_id;
  select kind into v_kind from public.competitions where id = new.competition_id;
  if coalesce(v_is_rehearsal, false) and v_kind = 'official' then
    raise exception 'rehearsal_account_forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists attempts_rehearsal_isolation on public.attempts;
create trigger attempts_rehearsal_isolation
  before insert or update of profile_id, competition_id on public.attempts
  for each row execute function public.attempts_rehearsal_isolation_guard();

-- Prevent deletion of official competitions (except synthetic test-harness cleanup worlds named 'Arena thử %' by owner).
create or replace function public.competitions_official_delete_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.kind = 'official' and not (current_user = 'postgres' and old.name like 'Arena thử %') then
    raise exception 'official_competition_protected' using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists competitions_protect_official_delete on public.competitions;
create trigger competitions_protect_official_delete
  before delete on public.competitions
  for each row execute function public.competitions_official_delete_guard();

-- Close any active/scheduled/draft rehearsal round (preserving all attempts, scores, and audit records)
-- through legal state transitions and open a fresh rehearsal round.
create or replace function public.reset_rehearsal_competition(
  p_actor uuid,
  p_name text default null,
  p_start_window_minutes integer default 180
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := public.arena_clock();
  v_old record;
  v_att record;
  v_closed_ids uuid[] := array[]::uuid[];
  v_round_num integer;
  v_title text;
  v_created jsonb;
  v_new_id uuid;
  v_opened jsonb;
begin
  perform public.arena_require_admin(p_actor);
  if p_start_window_minutes is null or p_start_window_minutes not between 5 and 1440 then
    raise exception 'invalid_start_window' using errcode = 'QA422';
  end if;

  -- Never interrupt an open official competition.
  if exists (select 1 from public.competitions where kind = 'official' and state = 'open') then
    raise exception 'official_competition_currently_open' using errcode = 'QA409';
  end if;

  -- Process open -> start_closed -> settling -> scheduled in order so that any open competition
  -- is finalized before a scheduled rehearsal competition transitions through open -> finalized.
  for v_old in
    select * from public.competitions
    where kind = 'rehearsal' and state in ('open', 'start_closed', 'settling', 'scheduled')
    order by case state
      when 'open' then 1
      when 'start_closed' then 2
      when 'settling' then 3
      when 'scheduled' then 4
      else 5
    end, created_at asc
    for update
  loop
    for v_att in
      select * from public.attempts
      where competition_id = v_old.id and state = 'active'
      for update
    loop
      update public.attempts
      set state = 'timed_out',
          pending_allocation_id = null,
          terminal_at = coalesce(terminal_at, least(v_now, ends_at)),
          completion_duration_ms = coalesce(completion_duration_ms, public.arena_ms_between(started_at, ends_at)),
          version = version + 1
      where id = v_att.id;

      perform public.arena_lb_refresh(v_att.id);
    end loop;

    if v_old.state = 'open' then
      perform public.transition_competition_unchecked(v_old.id, p_actor, 'start_closed');
      perform public.transition_competition_unchecked(v_old.id, p_actor, 'settling');
      perform public.finalize_competition(v_old.id, p_actor);
    elsif v_old.state = 'start_closed' then
      perform public.transition_competition_unchecked(v_old.id, p_actor, 'settling');
      perform public.finalize_competition(v_old.id, p_actor);
    elsif v_old.state = 'settling' then
      perform public.finalize_competition(v_old.id, p_actor);
    elsif v_old.state = 'scheduled' then
      perform public.transition_competition_unchecked(v_old.id, p_actor, 'open');
      perform public.transition_competition_unchecked(v_old.id, p_actor, 'start_closed');
      perform public.transition_competition_unchecked(v_old.id, p_actor, 'settling');
      perform public.finalize_competition(v_old.id, p_actor);
    end if;

    v_closed_ids := array_append(v_closed_ids, v_old.id);
  end loop;

  select count(*)::int + 1 into v_round_num from public.competitions where kind = 'rehearsal';
  v_title := coalesce(nullif(btrim(p_name), ''), 'Phòng thi thử #' || v_round_num::text);

  v_created := public.create_competition(
    p_actor,
    v_title,
    'rehearsal',
    v_now,
    v_now + make_interval(mins => p_start_window_minutes)
  );
  v_new_id := (v_created ->> 'id')::uuid;

  perform public.transition_competition_confirmed(v_new_id, p_actor, 'scheduled', 60, false, null);
  v_opened := public.open_competition_now(v_new_id, p_actor, p_start_window_minutes);

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before_redacted, after_redacted)
  values (
    p_actor,
    'competition.rehearsal_reset',
    'competition',
    v_new_id::text,
    jsonb_build_object('closedRehearsalIds', v_closed_ids),
    jsonb_build_object('newCompetitionId', v_new_id, 'name', v_title, 'startWindowMinutes', p_start_window_minutes)
  );

  return v_opened || jsonb_build_object(
    'id', v_new_id,
    'publicId', (v_created ->> 'publicId')::uuid,
    'name', v_title,
    'kind', 'rehearsal',
    'state', 'open',
    'closedRehearsalIds', v_closed_ids
  );
end;
$$;

-- Include completed, voided, and distinct participant counts for the Admin Control Center dashboard.
create or replace function public.arena_admin_competitions(p_actor uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.arena_require_admin(p_actor);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'publicId', c.public_id,
      'name', c.name,
      'kind', c.kind,
      'state', c.state,
      'opensAt', c.opens_at,
      'startDeadlineAt', c.start_deadline_at,
      'createdAt', c.created_at,
      'finalizedAt', c.finalized_at,
      'standing', public.arena_standing_label(c.id),
      'attempts', (select count(*) from public.attempts a where a.competition_id = c.id),
      'active', (select count(*) from public.attempts a where a.competition_id = c.id and a.state = 'active'),
      'completed', (select count(*) from public.attempts a where a.competition_id = c.id and a.state in ('completed', 'timed_out')),
      'voided', (select count(*) from public.attempts a where a.competition_id = c.id and a.state = 'voided'),
      'participants', (select count(distinct a.profile_id) from public.attempts a where a.competition_id = c.id)
    ) order by c.created_at desc)
    from public.competitions c), '[]'::jsonb);
end;
$$;

revoke all on function
  public.profiles_rehearsal_immutable_guard(),
  public.eligible_questions(public.game_type, text, uuid),
  public.take_competition_snapshot(uuid),
  public.competition_pool(uuid, public.game_type, text),
  public.competition_snapshots_origin_guard(),
  public.mark_competition_answers_disclosed(uuid),
  public.attempts_rehearsal_isolation_guard(),
  public.competitions_official_delete_guard(),
  public.reset_rehearsal_competition(uuid, text, integer),
  public.arena_admin_competitions(uuid)
from public, anon, authenticated;

grant execute on function
  public.eligible_questions(public.game_type, text, uuid),
  public.take_competition_snapshot(uuid),
  public.competition_pool(uuid, public.game_type, text),
  public.mark_competition_answers_disclosed(uuid),
  public.reset_rehearsal_competition(uuid, text, integer),
  public.arena_admin_competitions(uuid)
to service_role;
