-- Stage F3: leaderboard change notifications (realtime-contracts §1-§3).
-- Every leaderboard version bump (one per scoring event, finalization included) emits a public
-- Broadcast `leaderboard.changed` / `leaderboard.finalized` on `leaderboard:{publicId}:{game}`, after
-- commit (Realtime delivers realtime.messages rows once the transaction commits). The payload is a
-- hint only: no names, no scores, no answers, no attempt or profile ids. Clients always re-read the
-- authoritative board through the API. Without the Realtime extension (local harness) this is a no-op,
-- and a notification failure can never undo or block a scoring transaction.
create function public.arena_broadcast_leaderboard() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_public uuid;
  v_game public.game_type;
  v_state public.competition_state;
  v_event text;
begin
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then return null; end if;
  select c.public_id, g.game_type, c.state into v_public, v_game, v_state
  from public.competition_games g join public.competitions c on c.id = g.competition_id
  where g.id = new.competition_game_id;
  v_event := case when v_state in ('finalized', 'archived') then 'leaderboard.finalized' else 'leaderboard.changed' end;
  begin
    perform realtime.send(
      jsonb_build_object(
        'eventId', gen_random_uuid(),
        'eventType', v_event,
        'occurredAt', public.arena_clock(),
        'aggregate', jsonb_build_object('type', 'leaderboard', 'publicId', v_public::text || ':' || v_game::text, 'version', new.version),
        'data', jsonb_build_object('competitionPublicId', v_public, 'game', v_game)),
      v_event,
      format('leaderboard:%s:%s', v_public, v_game),
      false);
  exception when others then
    null; -- a hint that cannot be sent is recovered by the clients' periodic resync
  end;
  return null;
end;
$$;

create trigger leaderboard_versions_broadcast after insert or update on public.leaderboard_versions
  for each row execute function public.arena_broadcast_leaderboard();

revoke execute on function public.arena_broadcast_leaderboard() from public, anon, authenticated;

-- Public: the competition the boards and the projector show (the open one, else the most recently
-- updated closing / settling / finalized one). Only public fields.
create function public.arena_current_competition() returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('publicId', c.public_id, 'name', c.name, 'kind', c.kind, 'state', c.state,
    'startDeadlineAt', c.start_deadline_at, 'standing', public.arena_standing_label(c.id))
  from public.competitions c
  where c.state in ('open', 'start_closed', 'settling', 'finalized')
  order by (c.state = 'open') desc, c.updated_at desc
  limit 1
$$;
revoke execute on function public.arena_current_competition() from public, anon, authenticated;
grant execute on function public.arena_current_competition() to service_role;
