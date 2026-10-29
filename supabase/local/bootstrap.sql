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

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
