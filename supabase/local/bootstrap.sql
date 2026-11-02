-- Local fallback harness only (scripts/db/local-stack.sh). Not a migration.
-- Recreates the base roles, schema grants and default privileges that the
-- Supabase Postgres image provides, so migrations, RLS and GoTrue behave as on Supabase.
-- Passwords are injected per run by the harness through psql variables.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit password :'authenticator_password';
grant anon, authenticated, service_role to authenticator;

create role supabase_auth_admin login createrole noinherit password :'auth_admin_password';
create schema auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role;
grant create on database postgres to supabase_auth_admin;
alter role supabase_auth_admin set search_path = auth;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

-- Matches the current Supabase default: new tables, views and functions in `public` are NOT
-- auto-granted to the Data API roles (config.toml `auto_expose_new_tables`). Migrations must
-- GRANT explicitly, so a missing grant fails here exactly as it does on supabase start / hosted.
grant usage on schema public to anon, authenticated, service_role;
