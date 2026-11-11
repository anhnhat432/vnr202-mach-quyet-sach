-- Stage E: bind the gameplay control session to the Supabase Auth session.
-- The HTTP layer passes the profile id verified by Supabase Auth and the `session_id` claim of the
-- verified access token. Signing in on a new device, or resuming on it, moves control to the new
-- Auth session and bumps session_version; every other session is then refused on its next call.
-- Nothing else changes: no new attempt, no clock, no state reset.

alter table public.attempts add column control_auth_session_id uuid;

-- Returns the session_version the caller must use for the gameplay RPCs.
--   p_take_control = false: the caller must already control the attempt (or it is bound for the first time)
--   p_take_control = true : the caller takes control (device transfer / resume on a new device)
create function public.arena_bind_session(p_profile_id uuid, p_attempt_id uuid, p_auth_session_id uuid, p_take_control boolean default false)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.attempts;
begin
  if p_auth_session_id is null then raise exception 'invalid_session' using errcode = 'QA422'; end if;
  a := public.arena_lock_attempt(p_attempt_id, p_profile_id);
  if a.control_auth_session_id is null then
    update public.attempts set control_auth_session_id = p_auth_session_id where id = a.id;
    return a.session_version;
  end if;
  if a.control_auth_session_id = p_auth_session_id then return a.session_version; end if;
  if not p_take_control then raise exception 'stale_session' using errcode = 'QA409'; end if;
  update public.attempts set control_auth_session_id = p_auth_session_id, session_version = session_version + 1, version = version + 1
  where id = a.id returning session_version into a.session_version;
  insert into public.auth_events (profile_id, event) values (p_profile_id, 'session_transfer');
  return a.session_version;
end;
$$;

-- Called right after a successful sign-in: the new Auth session takes over the student's active attempt, if any.
create function public.arena_claim_active_attempt(p_profile_id uuid, p_auth_session_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.attempts;
  v_count int := 0;
begin
  if p_auth_session_id is null then raise exception 'invalid_session' using errcode = 'QA422'; end if;
  perform set_config('lock_timeout', '2000ms', true);
  for a in select * from public.attempts where profile_id = p_profile_id and state = 'active' order by started_at for update loop
    if a.control_auth_session_id is distinct from p_auth_session_id then
      update public.attempts set control_auth_session_id = p_auth_session_id,
        session_version = case when a.control_auth_session_id is null then session_version else session_version + 1 end,
        version = version + 1
      where id = a.id;
      insert into public.auth_events (profile_id, event) values (p_profile_id, 'session_transfer');
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.arena_bind_session(uuid, uuid, uuid, boolean), public.arena_claim_active_attempt(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.arena_bind_session(uuid, uuid, uuid, boolean), public.arena_claim_active_attempt(uuid, uuid) to service_role;
