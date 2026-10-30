-- Phase 3 / Stage B: identity, roster import, audit and rate limiting.
-- Rules: LA-ACC-001..018, LA-PRV-001..005, ACCESS-002/003, security-spec §3-§5, §11, §13.
-- Clients never write these tables: every mutation goes through server routes using the
-- service role after a server-side authorization check. RLS only grants reads.

create type public.profile_role as enum ('student', 'admin');
create type public.profile_status as enum ('active', 'locked');
create type public.auth_event_type as enum (
  'sign_in_success', 'sign_in_failure', 'sign_out', 'session_revoked', 'password_reset', 'session_transfer'
);
create type public.roster_import_status as enum ('validated', 'applying', 'applied', 'failed', 'compensated');
create type public.roster_row_status as enum ('valid', 'warning', 'error');

-- One active class in the first release (SCOPE-001).
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(btrim(code)) between 1 and 40),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index classes_single_active_idx on public.classes ((true)) where is_active;

-- MSSV is always text: leading zeros kept, never cast to a number (LA-ACC-011).
-- Minimal safety checks only (LA-ACC-018); the format pattern stays open (LA-ACC-013).
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.profile_role not null,
  student_id text unique check (
    student_id is null or (
      char_length(student_id) between 1 and 32
      and student_id = btrim(student_id)
      and student_id !~ '[a-z]'
      and student_id !~ '[[:space:][:cntrl:]]'
      and left(student_id, 1) not in ('=', '+', '-', '@')
    )
  ),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 100 and full_name !~ '[[:cntrl:]]'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40 and display_name !~ '[[:cntrl:]]'),
  display_name_suffix int check (display_name_suffix is null or display_name_suffix >= 2),
  class_id uuid references public.classes(id),
  status public.profile_status not null default 'active',
  must_change_password boolean not null default false,
  public_entry_id uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((role = 'student') = (student_id is not null)),
  check (role <> 'student' or must_change_password = false)
);
-- Duplicate display names stay distinct through a stable suffix (LA-LB-012).
create unique index profiles_display_name_unique_idx
  on public.profiles (class_id, display_name, coalesce(display_name_suffix, 1)) where role = 'student';

-- Server-only mapping MSSV -> random internal Auth email (LA-ACC-015).
create table public.student_auth_identities (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  internal_email text not null unique check (internal_email ~ '^[0-9a-f-]{36}@[a-z0-9.-]+$'),
  created_at timestamptz not null default now()
);

-- Sign-in and session events for impersonation disputes (LA-ACC-009).
create table public.auth_events (
  id bigint generated always as identity primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  event public.auth_event_type not null,
  student_id_hash text,
  device_label_hash text,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index auth_events_profile_time_idx on public.auth_events (profile_id, created_at desc);

create table public.roster_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  file_format text not null check (file_format in ('xlsx', 'csv')),
  class_id uuid not null references public.classes(id),
  status public.roster_import_status not null default 'validated',
  row_count int not null check (row_count >= 0),
  valid_count int not null check (valid_count >= 0),
  warning_count int not null check (warning_count >= 0),
  error_count int not null check (error_count >= 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  error_summary jsonb
);

-- No password column: every account uses the server-configured default (LA-ACC-003).
create table public.roster_import_rows (
  import_id uuid not null references public.roster_imports(id) on delete cascade,
  row_number int not null check (row_number >= 1),
  student_id text not null default '',
  full_name text not null default '',
  display_name text not null default '',
  student_id_cell_type text check (student_id_cell_type in ('text', 'number', 'other')),
  row_status public.roster_row_status not null,
  issues jsonb not null default '[]'::jsonb,
  admin_confirmed boolean not null default false,
  created_profile_id uuid references public.profiles(id) on delete set null,
  primary key (import_id, row_number)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  target_type text not null check (char_length(target_type) between 1 and 40),
  target_id text,
  request_id uuid,
  before_redacted jsonb,
  after_redacted jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_target_idx on public.audit_logs (target_type, target_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_profile_id, created_at desc);

create table public.rate_limit_buckets (
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  count int not null default 0,
  expires_at timestamptz not null,
  primary key (key_hash, window_start)
);

-- Role comes from app_metadata, which only the service role can change (security-spec §4).
create function public.is_admin() returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

-- Fixed-window counter. Uses clock_timestamp() so a long transaction cannot reuse a stale window.
create function public.consume_rate_limit(p_key_hash text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window timestamptz := to_timestamp(floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds);
  v_count int;
begin
  if p_limit < 1 or p_window_seconds < 1 or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid rate limit arguments' using errcode = '22023';
  end if;
  insert into public.rate_limit_buckets as b (key_hash, window_start, count, expires_at)
  values (p_key_hash, v_window, 1, v_window + make_interval(secs => p_window_seconds))
  on conflict (key_hash, window_start) do update set count = b.count + 1
  returning b.count into v_count;
  delete from public.rate_limit_buckets where expires_at < v_now - interval '1 hour';
  return v_count <= p_limit;
end;
$$;

-- Read-only check used to count only failed sign-ins against the per-MSSV limit.
create function public.rate_limit_exceeded(p_key_hash text, p_limit int, p_window_seconds int)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select b.count >= p_limit from public.rate_limit_buckets b
    where b.key_hash = p_key_hash
      and b.window_start = to_timestamp(floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds)
  ), false)
$$;

-- Admin incident action (LA-ADMIN-003a, T033): end every Auth session of one user.
-- Deleting auth.sessions cascades to refresh tokens; GoTrue then rejects the old access token.
create function public.revoke_user_sessions(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  delete from auth.sessions where user_id = p_user_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- RLS: reads only. No insert/update/delete policies exist for anon or authenticated.
alter table public.classes enable row level security;
alter table public.profiles enable row level security;
alter table public.student_auth_identities enable row level security;
alter table public.auth_events enable row level security;
alter table public.roster_imports enable row level security;
alter table public.roster_import_rows enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limit_buckets enable row level security;

create policy classes_admin_read on public.classes for select to authenticated using (public.is_admin());
create policy profiles_self_read on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_admin_read on public.profiles for select to authenticated using (public.is_admin());
create policy auth_events_admin_read on public.auth_events for select to authenticated using (public.is_admin());
create policy roster_imports_admin_read on public.roster_imports for select to authenticated using (public.is_admin());
create policy roster_rows_admin_read on public.roster_import_rows for select to authenticated using (public.is_admin());
create policy audit_logs_admin_read on public.audit_logs for select to authenticated using (public.is_admin());

-- Defense in depth on top of RLS: server-only tables carry no client privileges at all.
revoke all on public.student_auth_identities, public.rate_limit_buckets from anon, authenticated;
revoke all on public.classes, public.profiles, public.auth_events, public.roster_imports,
  public.roster_import_rows, public.audit_logs from anon;
revoke insert, update, delete, truncate, references, trigger on public.classes, public.profiles,
  public.auth_events, public.roster_imports, public.roster_import_rows, public.audit_logs from authenticated;
revoke execute on function public.consume_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, int, int) to service_role;
revoke execute on function public.rate_limit_exceeded(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_exceeded(text, int, int) to service_role;
revoke execute on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
