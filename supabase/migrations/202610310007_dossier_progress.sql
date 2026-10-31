-- T025/T034: private account progress, updated only through the authenticated server route.
create table public.student_dossier_progress (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  dossier_id uuid not null,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  completed_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (profile_id, dossier_id)
);
alter table public.student_dossier_progress enable row level security;
revoke all on public.student_dossier_progress from public, anon, authenticated;
grant select, insert, update on public.student_dossier_progress to service_role;

create function public.save_dossier_progress(p_profile_id uuid, p_dossier_id uuid, p_state jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.student_dossier_progress(profile_id, dossier_id, state, completed_at)
  values (p_profile_id, p_dossier_id, p_state, case when p_state ->> 'stage' = 'connections' then clock_timestamp() end)
  on conflict (profile_id, dossier_id) do update set
    state = excluded.state,
    completed_at = coalesce(public.student_dossier_progress.completed_at, excluded.completed_at),
    updated_at = clock_timestamp();
end;
$$;
revoke execute on function public.save_dossier_progress(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_dossier_progress(uuid, uuid, jsonb) to service_role;
