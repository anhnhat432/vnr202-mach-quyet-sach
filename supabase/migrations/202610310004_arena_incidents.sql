-- Stage F5 completion: attempt incidents, audit view, explicit reuse of disclosed questions.
-- LA-ADMIN-001..004: every action needs an active admin and a reason, is audited, and can never create
-- an attempt, change a score, a clock or a rank, or delete score history. Voiding keeps the attempt and
-- its ledger; it only removes the entry from the official board and cannot be undone silently.

create table public.attempt_incidents (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  action text not null check (action in ('note', 'void_attempt', 'revoke_sessions', 'lock_account', 'unlock_account')),
  reason text not null check (char_length(btrim(reason)) between 3 and 300),
  actor_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default clock_timestamp()
);
create index attempt_incidents_attempt_idx on public.attempt_incidents (attempt_id, created_at desc);
create trigger attempt_incidents_append_only before update or delete on public.attempt_incidents
  for each row execute function public.append_only_guard();
alter table public.attempt_incidents enable row level security;
revoke all on public.attempt_incidents from anon, authenticated;
grant select on public.attempt_incidents to service_role;

-- note / void_attempt change data here; revoke_sessions / lock_account / unlock_account are performed by the
-- existing account actions (stage B) and only logged here against the attempt they concern.
create function public.record_attempt_incident(p_actor uuid, p_attempt_id uuid, p_action text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.attempts;
  v_before jsonb;
begin
  perform public.arena_require_admin(p_actor);
  if p_action not in ('note', 'void_attempt', 'revoke_sessions', 'lock_account', 'unlock_account') then
    raise exception 'invalid_action' using errcode = 'QA422';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then raise exception 'reason_required' using errcode = 'QA422'; end if;
  perform set_config('lock_timeout', '2000ms', true);
  select * into a from public.attempts where id = p_attempt_id for update;
  if not found then raise exception 'attempt_not_found' using errcode = 'QA404'; end if;
  v_before := jsonb_build_object('state', a.state, 'score', a.score);

  if p_action = 'void_attempt' then
    if a.state = 'voided' then raise exception 'already_voided' using errcode = 'QA409'; end if;
    -- Published results are final: an incident found later is recorded as a note, never by rewriting the board.
    if exists (select 1 from public.competitions c where c.id = a.competition_id and c.state in ('finalized', 'archived')) then
      raise exception 'competition_finalized' using errcode = 'QA409';
    end if;
    update public.attempts set
      state = 'voided', pending_allocation_id = null, version = version + 1,
      terminal_at = coalesce(terminal_at, public.arena_clock())
    where id = a.id;
    perform public.arena_lb_refresh(a.id); -- excluded from the boards; score and ledger untouched
  end if;

  insert into public.attempt_incidents (attempt_id, action, reason, actor_profile_id) values (a.id, p_action, btrim(p_reason), p_actor);
  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before_redacted, after_redacted)
  values (p_actor, 'attempt.' || p_action, 'attempt', a.id::text, v_before,
          jsonb_build_object('state', (select state from public.attempts where id = a.id), 'reason', btrim(p_reason)));
  return jsonb_build_object('attemptId', a.id, 'action', p_action, 'state', (select state from public.attempts where id = a.id));
end;
$$;

-- Audit trail of one competition: the competition itself, its attempts and the accounts that played it.
create function public.arena_admin_audit(p_actor uuid, p_competition_id uuid, p_limit int default 200)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.arena_require_admin(p_actor);
  return coalesce((
    select jsonb_agg(jsonb_build_object('at', l.created_at, 'action', l.action, 'targetType', l.target_type, 'targetId', l.target_id,
      'actor', coalesce(p.display_name, 'hệ thống'), 'before', l.before_redacted, 'after', l.after_redacted) order by l.created_at desc, l.id desc)
    from (
      select * from public.audit_logs l
      where (l.target_type = 'competition' and l.target_id = p_competition_id::text)
         or (l.target_type = 'attempt' and l.target_id in (select id::text from public.attempts where competition_id = p_competition_id))
         or (l.target_type = 'profile' and l.target_id in (select profile_id::text from public.attempts where competition_id = p_competition_id))
      order by l.created_at desc, l.id desc
      limit least(greatest(coalesce(p_limit, 200), 1), 500)
    ) l left join public.profiles p on p.id = l.actor_profile_id), '[]'::jsonb);
end;
$$;

-- Disclosed questions that an official competition would exclude unless explicitly confirmed (LA-CONTENT-009).
create function public.arena_admin_disclosed(p_actor uuid, p_competition_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare c public.competitions;
begin
  perform public.arena_require_admin(p_actor);
  select * into c from public.competitions where id = p_competition_id;
  if not found then raise exception 'competition_not_found' using errcode = 'QA404'; end if;
  return jsonb_build_object('competitionState', c.state, 'kind', c.kind, 'questions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'versionId', e.version_id, 'game', g.game_type, 'pool', e.pool, 'difficulty', e.difficulty, 'chapter', e.chapter,
      'prompt', v.content_public ->> 'prompt', 'confirmed', e.confirmed,
      'disclosedBy', (select jsonb_agg(jsonb_build_object('competition', dc.name, 'at', x.answer_disclosed_at))
                      from public.question_exposures x join public.competitions dc on dc.id = x.competition_id
                      where x.question_version_id = e.version_id and x.answer_disclosed_at is not null)
    ) order by g.game_type, e.pool, e.difficulty)
    from unnest(array['minefield', 'race']::public.game_type[]) g(game_type)
    cross join lateral public.eligible_questions(g.game_type, 'official', p_competition_id) e
    join public.question_versions v on v.id = e.version_id
    where e.disclosed), '[]'::jsonb));
end;
$$;

-- Confirmation is only possible before the question snapshot is taken (Draft), for an official competition.
create function public.arena_confirm_disclosed(p_actor uuid, p_competition_id uuid, p_version_ids uuid[], p_reason text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare c public.competitions;
begin
  perform public.arena_require_admin(p_actor);
  select * into c from public.competitions where id = p_competition_id;
  if not found then raise exception 'competition_not_found' using errcode = 'QA404'; end if;
  if c.state <> 'draft' then raise exception 'confirmation_closed' using errcode = 'QA409'; end if;
  if c.kind <> 'official' then raise exception 'not_needed_for_rehearsal' using errcode = 'QA422'; end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then raise exception 'reason_required' using errcode = 'QA422'; end if;
  if coalesce(array_length(p_version_ids, 1), 0) = 0 then raise exception 'nothing_selected' using errcode = 'QA422'; end if;
  if exists (select 1 from unnest(p_version_ids) v where not exists (
      select 1 from public.question_exposures x where x.question_version_id = v and x.answer_disclosed_at is not null)) then
    raise exception 'not_disclosed' using errcode = 'QA422'; -- only actually disclosed questions can be confirmed
  end if;
  return public.confirm_disclosed_questions(p_competition_id, p_actor, p_version_ids, btrim(p_reason));
end;
$$;

-- The admin monitor also reports incidents per attempt.
create or replace function public.arena_admin_monitor(p_actor uuid, p_competition_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := public.arena_clock();
begin
  perform public.arena_require_admin(p_actor);
  if not exists (select 1 from public.competitions where id = p_competition_id) then
    raise exception 'competition_not_found' using errcode = 'QA404';
  end if;
  return jsonb_build_object(
    'serverTime', v_now,
    'attempts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'attemptId', a.id, 'profileId', a.profile_id, 'game', a.game_type, 'state', a.state,
        'studentId', p.student_id, 'accountStatus', p.status,
        'displayName', p.display_name || case when p.display_name_suffix is not null then ' (' || p.display_name_suffix || ')' else '' end,
        'score', a.score, 'mainAnswered', a.main_answered, 'mainTotal', a.main_total, 'mainCorrect', a.main_correct,
        'startedAt', a.started_at, 'remainingMs', case when a.state = 'active' then greatest(0, public.arena_ms_between(v_now, a.ends_at)) else 0 end,
        'completionDurationMs', a.completion_duration_ms,
        'heartbeatAgoMs', case when a.last_heartbeat_at is null then null else public.arena_ms_between(a.last_heartbeat_at, v_now) end,
        'deviceTransfers', a.session_version - 1,
        'timeouts', (select count(*) from public.attempt_events e where e.attempt_id = a.id and e.event_type = 'timeout'),
        'pendingQuestion', a.pending_allocation_id is not null,
        'incidents', coalesce((select jsonb_agg(jsonb_build_object('action', i.action, 'reason', i.reason, 'at', i.created_at) order by i.created_at)
                               from public.attempt_incidents i where i.attempt_id = a.id), '[]'::jsonb)
      ) order by a.game_type, a.score desc, a.started_at)
      from public.attempts a join public.profiles p on p.id = a.profile_id
      where a.competition_id = p_competition_id), '[]'::jsonb));
end;
$$;

revoke execute on function public.record_attempt_incident(uuid, uuid, text, text), public.arena_admin_audit(uuid, uuid, int),
  public.arena_admin_disclosed(uuid, uuid), public.arena_confirm_disclosed(uuid, uuid, uuid[], text) from public, anon, authenticated;
grant execute on function public.record_attempt_incident(uuid, uuid, text, text), public.arena_admin_audit(uuid, uuid, int),
  public.arena_admin_disclosed(uuid, uuid), public.arena_confirm_disclosed(uuid, uuid, uuid[], text) to service_role;
