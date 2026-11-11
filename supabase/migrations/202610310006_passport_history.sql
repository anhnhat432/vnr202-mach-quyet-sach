-- T034: extend the existing private, server-only history projection. Rank stays authoritative.
create or replace function public.arena_my_attempts(p_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'attemptId', a.id, 'game', a.game_type, 'state', a.state, 'score', a.score,
    'mainCorrect', a.main_correct, 'hardCorrect', a.hard_correct, 'mainTotal', a.main_total,
    'completionDurationMs', a.completion_duration_ms,
    'rank', (public.get_player_standing(p_profile_id, a.id) -> 'rank'),
    'competition', jsonb_build_object('id', c.id, 'name', c.name, 'kind', c.kind, 'state', c.state, 'standing', public.arena_standing_label(c.id)),
    'reviewAvailable', c.state in ('finalized', 'archived')
  ) order by a.started_at desc), '[]'::jsonb)
  from public.attempts a join public.competitions c on c.id = a.competition_id
  where a.profile_id = p_profile_id
$$;

revoke execute on function public.arena_my_attempts(uuid) from public, anon, authenticated;
grant execute on function public.arena_my_attempts(uuid) to service_role;
