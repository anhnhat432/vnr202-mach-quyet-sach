-- Stage G: pace leaderboard hints. Every scoring event bumps the game's leaderboard version; sending a
-- Broadcast for each one fans out to every viewer (60 players ≈ 20 events/s × ~200 viewers ≈ 4,000
-- messages/s), far above Supabase Realtime quotas. A hint is now sent at most once per second per game
-- (leading edge; finalization always). Clients read the board once more 1.2 s after the last hint they
-- received, so a change that fell inside a paced second is still shown within about 1.2 s; the periodic
-- sync remains the safety net. Payload and topic are unchanged (realtime-contracts §1-§3).
alter table public.leaderboard_versions add column hinted_at timestamptz;

drop trigger leaderboard_versions_broadcast on public.leaderboard_versions;
drop function public.arena_broadcast_leaderboard();

-- BEFORE trigger on the row the scoring transaction already holds: no extra lock, no extra row.
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
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then return new; end if;
  -- Scoring bumps the version with INSERT .. ON CONFLICT DO UPDATE: the INSERT trigger fires before the
  -- conflict is known. Only a genuinely new row is hinted here; an existing one is handled on UPDATE.
  if tg_op = 'INSERT' and exists (select 1 from public.leaderboard_versions v where v.competition_game_id = new.competition_game_id) then
    return new;
  end if;
  select c.public_id, g.game_type, c.state into v_public, v_game, v_state
  from public.competition_games g join public.competitions c on c.id = g.competition_id
  where g.id = new.competition_game_id;
  v_event := case when v_state in ('finalized', 'archived') then 'leaderboard.finalized' else 'leaderboard.changed' end;
  if v_event = 'leaderboard.changed' and new.hinted_at is not null and clock_timestamp() < new.hinted_at + interval '1 second' then
    return new; -- paced: covered by the clients' follow-up read
  end if;
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
    new.hinted_at := clock_timestamp();
  exception when others then
    null; -- a hint that cannot be sent is recovered by the clients' periodic resync
  end;
  return new;
end;
$$;

create trigger leaderboard_versions_broadcast before insert or update on public.leaderboard_versions
  for each row execute function public.arena_broadcast_leaderboard();

revoke execute on function public.arena_broadcast_leaderboard() from public, anon, authenticated;
