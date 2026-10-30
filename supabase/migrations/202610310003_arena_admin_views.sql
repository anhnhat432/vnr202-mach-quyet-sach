-- Stage F5: read models for the competition admin screen and the student's own history.
-- Admin views require an active admin actor; the student view returns only the caller's attempts.
-- MSSV appears only in the admin monitor (never in public or student-facing payloads).

create function public.arena_admin_competitions(p_actor uuid)
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
      'id', c.id, 'publicId', c.public_id, 'name', c.name, 'kind', c.kind, 'state', c.state,
      'opensAt', c.opens_at, 'startDeadlineAt', c.start_deadline_at, 'createdAt', c.created_at, 'finalizedAt', c.finalized_at,
      'standing', public.arena_standing_label(c.id),
      'attempts', (select count(*) from public.attempts a where a.competition_id = c.id),
      'active', (select count(*) from public.attempts a where a.competition_id = c.id and a.state = 'active')
    ) order by c.created_at desc)
    from public.competitions c), '[]'::jsonb);
end;
$$;

create function public.arena_admin_monitor(p_actor uuid, p_competition_id uuid)
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
        'attemptId', a.id, 'game', a.game_type, 'state', a.state,
        'studentId', p.student_id,
        'displayName', p.display_name || case when p.display_name_suffix is not null then ' (' || p.display_name_suffix || ')' else '' end,
        'score', a.score, 'mainAnswered', a.main_answered, 'mainTotal', a.main_total, 'mainCorrect', a.main_correct,
        'startedAt', a.started_at, 'remainingMs', case when a.state = 'active' then greatest(0, public.arena_ms_between(v_now, a.ends_at)) else 0 end,
        'completionDurationMs', a.completion_duration_ms,
        'heartbeatAgoMs', case when a.last_heartbeat_at is null then null else public.arena_ms_between(a.last_heartbeat_at, v_now) end,
        'deviceTransfers', a.session_version - 1,
        'timeouts', (select count(*) from public.attempt_events e where e.attempt_id = a.id and e.event_type = 'timeout'),
        'pendingQuestion', a.pending_allocation_id is not null
      ) order by a.game_type, a.score desc, a.started_at)
      from public.attempts a join public.profiles p on p.id = a.profile_id
      where a.competition_id = p_competition_id), '[]'::jsonb));
end;
$$;

-- The student's own attempts across competitions, with whether the post-final review is open.
create function public.arena_my_attempts(p_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'attemptId', a.id, 'game', a.game_type, 'state', a.state, 'score', a.score,
    'mainCorrect', a.main_correct, 'mainTotal', a.main_total, 'completionDurationMs', a.completion_duration_ms,
    'competition', jsonb_build_object('name', c.name, 'kind', c.kind, 'state', c.state, 'standing', public.arena_standing_label(c.id)),
    'reviewAvailable', c.state in ('finalized', 'archived')
  ) order by a.started_at desc), '[]'::jsonb)
  from public.attempts a join public.competitions c on c.id = a.competition_id
  where a.profile_id = p_profile_id
$$;

revoke execute on function public.arena_admin_competitions(uuid), public.arena_admin_monitor(uuid, uuid), public.arena_my_attempts(uuid)
  from public, anon, authenticated;
grant execute on function public.arena_admin_competitions(uuid), public.arena_admin_monitor(uuid, uuid), public.arena_my_attempts(uuid) to service_role;
