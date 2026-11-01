-- Rehearsal studio isolation & official competition protection.
-- 1. Rehearsal accounts are isolated from active class rosters and barred from official competitions.
-- 2. Rehearsal competitions exclusively use synthetic fixture questions (origin = 'fixture') and never
--    touch or disclose official bank questions (origin = 'bank').
-- 3. Official competitions cannot be deleted or reset; rehearsal rounds reset by closing the previous
--    rehearsal round (preserving all ledger/audit history) and opening a new rehearsal competition.

alter table public.profiles
  add column if not exists is_rehearsal boolean not null default false,
  add constraint profiles_rehearsal_check check (not is_rehearsal or (role = 'student' and class_id is null));

-- Strictly isolate question pools by competition kind:
-- rehearsal -> origin = 'fixture' ONLY
-- official  -> origin = 'bank' ONLY
create or replace function public.eligible_questions(
  p_game public.game_type,
  p_kind public.competition_kind,
  p_competition_id uuid default null
)
returns table (
  question_id uuid,
  version_id uuid,
  pool public.question_pool,
  difficulty public.question_difficulty,
  chapter public.question_chapter,
  question_type public.question_type,
  option_count smallint,
  origin public.question_origin,
  prior_exposures bigint,
  disclosed boolean,
  confirmed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with exposure_summary as (
    select
      e.question_version_id,
      count(*) filter (where e.competition_id is distinct from p_competition_id) as prior_exposures,
      bool_or(e.answer_disclosed_at is not null) as disclosed
    from public.question_exposures e
    group by e.question_version_id
  ),
  confirmations as (
    select c.question_version_id
    from public.competition_disclosed_question_confirmations c
    where c.competition_id = p_competition_id
  )
  select
    q.id as question_id,
    v.id as version_id,
    q.pool,
    q.difficulty,
    q.chapter,
    q.question_type,
    q.option_count,
    q.origin,
    coalesce(es.prior_exposures, 0) as prior_exposures,
    coalesce(es.disclosed, false) as disclosed,
    (cf.question_version_id is not null) as confirmed
  from public.questions q
  join public.question_versions v on v.id = q.published_version_id
  left join exposure_summary es on es.question_version_id = v.id
  left join confirmations cf on cf.question_version_id = v.id
  where q.game_type = p_game
    and v.status = 'published'
    and v.retired_at is null
    and ((p_kind = 'rehearsal' and q.origin = 'fixture') or (p_kind = 'official' and q.origin = 'bank'))
    and (
      p_kind = 'rehearsal'
      or not coalesce(es.disclosed, false)
      or cf.question_version_id is not null
    );
$$;

-- Defense in depth: only official competitions mark questions as answer-disclosed upon finalization.
create or replace function public.mark_competition_answers_disclosed(p_competition_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not exists (select 1 from public.competitions where id = p_competition_id and kind = 'official') then
    return 0;
  end if;

  update public.question_exposures
  set answer_disclosed_at = coalesce(answer_disclosed_at, public.arena_clock())
  where competition_id = p_competition_id;

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
  before insert or update on public.attempts
  for each row execute function public.attempts_rehearsal_isolation_guard();

-- Prevent deletion of official competitions at the database level.
create or replace function public.competitions_official_delete_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.kind = 'official' then
    raise exception 'official_competition_protected' using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists competitions_protect_official_delete on public.competitions;
create trigger competitions_protect_official_delete
  before delete on public.competitions
  for each row execute function public.competitions_official_delete_guard();

-- Close any active rehearsal round (preserving all attempts, scores, and audit records) and open a fresh rehearsal round.
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

  -- Settle and close any currently open or scheduled rehearsal competition without deleting history.
  for v_old in
    select * from public.competitions
    where kind = 'rehearsal' and state in ('open', 'scheduled', 'start_closed')
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
          terminal_at = coalesce(terminal_at, v_now),
          completion_duration_ms = coalesce(completion_duration_ms, greatest(0, public.arena_ms_between(started_at, least(v_now, ends_at)))),
          version = version + 1
      where id = v_att.id;

      perform public.arena_lb_refresh(v_att.id);
    end loop;

    if v_old.state = 'open' then
      perform public.transition_competition_unchecked(v_old.id, p_actor, 'start_closed');
      perform public.transition_competition_unchecked(v_old.id, p_actor, 'settling');
    elsif v_old.state = 'start_closed' then
      perform public.transition_competition_unchecked(v_old.id, p_actor, 'settling');
    elsif v_old.state = 'scheduled' then
      perform public.transition_competition_unchecked(v_old.id, p_actor, 'archived');
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
    'name', v_title,
    'kind', 'rehearsal',
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
      'standing', c.standing,
      'opensAt', c.opens_at,
      'startDeadlineAt', c.start_deadline_at,
      'finalizedAt', c.finalized_at,
      'attempts', (select count(*) from public.attempts a where a.competition_id = c.id),
      'active', (select count(*) from public.attempts a where a.competition_id = c.id and a.state = 'active'),
      'completed', (select count(*) from public.attempts a where a.competition_id = c.id and a.state in ('completed', 'timed_out')),
      'voided', (select count(*) from public.attempts a where a.competition_id = c.id and a.state = 'voided'),
      'participants', (select count(distinct a.profile_id) from public.attempts a where a.competition_id = c.id)
    ) order by c.created_at desc)
    from public.competitions c), '[]'::jsonb);
end;
$$;

revoke all on function public.reset_rehearsal_competition(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.reset_rehearsal_competition(uuid, text, integer) to service_role;
