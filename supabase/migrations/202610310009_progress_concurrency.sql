-- A stale device must never silently replace a newer account progress state.
alter table public.student_dossier_progress add column version integer not null default 1 check (version > 0);

create function public.save_dossier_progress_versioned(p_profile_id uuid, p_dossier_id uuid, p_state jsonb, p_expected_version integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_version integer;
begin
  if p_expected_version is null or p_expected_version < 0 then raise exception 'invalid_version' using errcode = 'QA422'; end if;
  if p_expected_version = 0 then
    insert into public.student_dossier_progress(profile_id, dossier_id, state, completed_at)
    values (p_profile_id, p_dossier_id, p_state, case when p_state ->> 'stage' = 'connections' then clock_timestamp() end)
    on conflict (profile_id, dossier_id) do nothing returning version into v_version;
  else
    update public.student_dossier_progress set state = p_state, version = version + 1,
      completed_at = coalesce(completed_at, case when p_state ->> 'stage' = 'connections' then clock_timestamp() end),
      updated_at = clock_timestamp()
    where profile_id = p_profile_id and dossier_id = p_dossier_id and version = p_expected_version
    returning version into v_version;
  end if;
  if v_version is null then raise exception 'progress_conflict' using errcode = 'QA409'; end if;
  return v_version;
end;
$$;
revoke execute on function public.save_dossier_progress_versioned(uuid, uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.save_dossier_progress_versioned(uuid, uuid, jsonb, integer) to service_role;
revoke execute on function public.save_dossier_progress(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
