-- CLASS-001..004: opt-in IDs-only roster and first-login student naming.
-- Existing named students are unchanged. Clients retain read-only profile access.
alter table public.profiles add column requires_display_name boolean not null default false;
alter table public.profiles add constraint profiles_student_name_setup_only check (role = 'student' or not requires_display_name);
alter table public.roster_import_rows add column requires_display_name boolean not null default false;

create function public.set_student_display_name(p_actor uuid, p_name text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_name text;
  v_parts text[];
  v_display text;
  v_initials text := '';
  v_folded text;
  v_suffix int;
  v_i int;
begin
  select * into v_profile from public.profiles where id = p_actor for update;
  if not found or v_profile.role <> 'student' then
    raise exception 'actor_not_student' using errcode = '42501';
  end if;
  if v_profile.status <> 'active' then raise exception 'student_not_active' using errcode = '42501'; end if;
  if not v_profile.requires_display_name then raise exception 'display_name_already_set' using errcode = 'QA409'; end if;
  if p_name is null or char_length(p_name) > 100 or p_name ~ '[[:cntrl:]]' then
    raise exception 'invalid_display_name' using errcode = 'QA422';
  end if;
  v_name := btrim(regexp_replace(normalize(p_name, NFC), '[[:space:]]+', ' ', 'g'));
  if char_length(v_name) not between 1 and 100 then raise exception 'invalid_display_name' using errcode = 'QA422'; end if;
  v_folded := upper(regexp_replace(v_name, '[^[:alnum:]]', '', 'g'));
  if exists (
    select 1 from public.profiles p where p.role = 'student' and (
      upper(p.student_id) = any(regexp_split_to_array(upper(v_name), '[[:space:]]+'))
      or (char_length(p.student_id) >= 4 and position(upper(regexp_replace(p.student_id, '[^[:alnum:]]', '', 'g')) in v_folded) > 0)
    )
  ) then raise exception 'student_id_in_name' using errcode = 'QA422'; end if;
  v_parts := regexp_split_to_array(v_name, '[[:space:]]+');
  if array_length(v_parts, 1) > 1 then
    for v_i in 1..array_length(v_parts, 1)-1 loop
      v_initials := v_initials || upper(left(v_parts[v_i], 1)) || '.';
    end loop;
  end if;
  v_display := left(v_parts[array_length(v_parts, 1)] || case when v_initials <> '' then ' ' || v_initials else '' end, 40);
  -- Serialize setup within a class so two simultaneous identical names receive stable suffixes.
  perform pg_advisory_xact_lock(hashtextextended('student-name:' || coalesce(v_profile.class_id::text, 'none'), 0));
  select max(coalesce(p.display_name_suffix, 1)) + 1 into v_suffix
    from public.profiles p where p.role = 'student' and p.class_id is not distinct from v_profile.class_id
      and p.display_name = v_display and p.id <> p_actor;
  update public.profiles set full_name = v_name, display_name = v_display,
    display_name_suffix = v_suffix, requires_display_name = false, updated_at = clock_timestamp()
    where id = p_actor;
  insert into public.audit_logs(actor_profile_id, action, target_type, target_id, after_redacted)
    values(p_actor, 'profile.student_name_set', 'profile', p_actor::text,
      jsonb_build_object('displayName', v_display, 'suffix', v_suffix));
  return jsonb_build_object('displayName', v_display || case when v_suffix is not null then ' (' || v_suffix || ')' else '' end);
end;
$$;
revoke all on function public.set_student_display_name(uuid,text) from public, anon, authenticated;
grant execute on function public.set_student_display_name(uuid,text) to service_role;

create function public.guard_attempt_student_name() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists(select 1 from public.profiles where id = new.profile_id and requires_display_name) then
    raise exception 'display_name_required' using errcode = 'QA409';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_attempt_student_name() from public, anon, authenticated;
create trigger attempts_student_name_required before insert on public.attempts
  for each row execute function public.guard_attempt_student_name();
