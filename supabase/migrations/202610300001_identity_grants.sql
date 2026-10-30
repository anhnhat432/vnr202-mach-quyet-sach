-- Explicit privileges for the identity/roster tables.
-- Since Supabase stopped auto-granting new `public` tables to the Data API roles
-- (config.toml `auto_expose_new_tables`), policies alone are not enough: a role needs the table
-- privilege first and RLS then filters rows. The previous migration relied on the old default.
--
-- authenticated: SELECT only, and only on tables that have a policy (rows still filtered by RLS).
-- service_role: full DML on every table; server routes use it after their own authorization check.
-- anon: nothing.

grant select on public.classes, public.profiles, public.auth_events, public.roster_imports,
  public.roster_import_rows, public.audit_logs to authenticated;

grant select, insert, update, delete on public.classes, public.profiles, public.student_auth_identities,
  public.auth_events, public.roster_imports, public.roster_import_rows, public.audit_logs,
  public.rate_limit_buckets to service_role;

-- Identity columns on auth_events / audit_logs use implicit sequences.
grant usage, select on all sequences in schema public to service_role;
