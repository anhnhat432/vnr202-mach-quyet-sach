-- Identity/roster RLS actor matrix and MSSV constraints (T030, T035).
-- Actors: anon, student A, student B, admin (role in app_metadata), forged admin (role in user_metadata).
begin;
select plan(30);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'a@test.invalid'),
  ('00000000-0000-4000-8000-00000000000b', 'b@test.invalid'),
  ('00000000-0000-4000-8000-0000000000ad', 'admin@test.invalid'),
  ('00000000-0000-4000-8000-0000000000cc', 'c@test.invalid');
insert into public.classes (id, code, name) values ('00000000-0000-4000-8000-0000000c1a55', 'TEST-1', 'Test class');
insert into public.profiles (id, role, student_id, full_name, display_name, class_id) values
  ('00000000-0000-4000-8000-00000000000a', 'student', 'SE000123', 'Nguyễn Văn An', 'An N.V.', '00000000-0000-4000-8000-0000000c1a55'),
  ('00000000-0000-4000-8000-00000000000b', 'student', 'SE000124', 'Trần Thị Bình', 'Bình T.T.', '00000000-0000-4000-8000-0000000c1a55'),
  ('00000000-0000-4000-8000-0000000000ad', 'admin', null, 'Quản trị', 'Quản trị', null);
insert into public.student_auth_identities (profile_id, internal_email) values
  ('00000000-0000-4000-8000-00000000000a', '6f1c2b8e-0000-4000-8000-000000000001@auth.invalid');
insert into public.audit_logs (action, target_type, target_id) values ('test', 'profile', 'x');

-- Table privileges are explicit and minimal; they must not depend on the platform's default grants.
select ok(
  (select bool_and(has_table_privilege('service_role', 'public.' || t, 'SELECT, INSERT, UPDATE, DELETE'))
   from unnest(array['classes','profiles','student_auth_identities','auth_events','roster_imports','roster_import_rows','audit_logs','rate_limit_buckets']) t),
  'service_role has full DML on every identity table'
);
select ok(
  (select bool_and(has_table_privilege('authenticated', 'public.' || t, 'SELECT') and not has_table_privilege('authenticated', 'public.' || t, 'INSERT, UPDATE, DELETE'))
   from unnest(array['classes','profiles','auth_events','roster_imports','roster_import_rows','audit_logs']) t),
  'authenticated can only SELECT the policy-protected identity tables'
);
select ok(
  (select not bool_or(has_table_privilege('authenticated', 'public.' || t, 'SELECT, INSERT, UPDATE, DELETE'))
   from unnest(array['student_auth_identities','rate_limit_buckets']) t),
  'authenticated has no privilege on server-only tables'
);
select ok(
  (select not bool_or(has_table_privilege('anon', 'public.' || t, 'SELECT, INSERT, UPDATE, DELETE'))
   from unnest(array['classes','profiles','student_auth_identities','auth_events','roster_imports','roster_import_rows','audit_logs','rate_limit_buckets']) t),
  'anon has no privilege on any identity table'
);

-- MSSV stays text and keeps leading zeros (LA-ACC-011); minimal safety checks (LA-ACC-018).
select is((select student_id from public.profiles where id = '00000000-0000-4000-8000-00000000000a'), 'SE000123', 'MSSV keeps leading zeros as text');
select throws_ok($$insert into public.profiles (id, role, student_id, full_name, display_name) values ('00000000-0000-4000-8000-0000000000cc', 'student', 'se1', 'X', 'X')$$, '23514', null, 'lowercase MSSV rejected (must be normalized)');
select throws_ok($$insert into public.profiles (id, role, student_id, full_name, display_name) values ('00000000-0000-4000-8000-0000000000cc', 'student', '=CMD1', 'X', 'X')$$, '23514', null, 'formula-leading MSSV rejected');
select throws_ok($$insert into public.profiles (id, role, student_id, full_name, display_name) values ('00000000-0000-4000-8000-0000000000cc', 'student', 'SE 1', 'X', 'X')$$, '23514', null, 'MSSV with inner space rejected');
select throws_ok($$insert into public.profiles (id, role, student_id, full_name, display_name, must_change_password) values ('00000000-0000-4000-8000-0000000000cc', 'student', 'SE9', 'X', 'X', true)$$, '23514', null, 'student cannot be forced to change password in V1');
select throws_ok($$insert into public.profiles (id, role, student_id, full_name, display_name, class_id) values ('00000000-0000-4000-8000-0000000000cc', 'student', 'SE9', 'Nguyễn Văn An', 'An N.V.', '00000000-0000-4000-8000-0000000c1a55')$$, '23505', null, 'duplicate display name needs a suffix');
select lives_ok($$insert into public.profiles (id, role, student_id, full_name, display_name, display_name_suffix, class_id) values ('00000000-0000-4000-8000-0000000000cc', 'student', '00042', 'Nguyễn Văn An', 'An N.V.', 2, '00000000-0000-4000-8000-0000000c1a55')$$, 'duplicate display name with suffix 2 accepted; numeric-looking MSSV kept as text');

-- anon
set local role anon;
select throws_ok($$select count(*) from public.profiles$$, '42501', null, 'anon cannot read profiles');
select throws_ok($$select count(*) from public.student_auth_identities$$, '42501', null, 'anon cannot read auth identities');
select throws_ok($$select public.consume_rate_limit(repeat('a', 64), 5, 60)$$, '42501', null, 'anon cannot call consume_rate_limit');
select throws_ok($$select public.revoke_user_sessions('00000000-0000-4000-8000-00000000000a')$$, '42501', null, 'anon cannot revoke sessions');
reset role;

-- student A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated","app_metadata":{"role":"student"}}', true);
select is((select count(*) from public.profiles), 1::bigint, 'student A sees exactly one profile');
select is((select id from public.profiles), '00000000-0000-4000-8000-00000000000a'::uuid, 'student A sees only own profile');
select throws_ok($$update public.profiles set display_name = 'Hacker' where id = '00000000-0000-4000-8000-00000000000a'$$, '42501', null, 'student cannot update own profile');
select throws_ok($$select count(*) from public.student_auth_identities$$, '42501', null, 'student cannot read auth identities');
select is((select count(*) from public.audit_logs), 0::bigint, 'student sees no audit logs');
select is((select count(*) from public.roster_imports), 0::bigint, 'student sees no roster imports');
select throws_ok($$insert into public.audit_logs (action, target_type) values ('x', 'y')$$, '42501', null, 'student cannot write audit logs');
select throws_ok($$select public.revoke_user_sessions('00000000-0000-4000-8000-00000000000b')$$, '42501', null, 'student cannot revoke sessions');

-- student B
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated","app_metadata":{"role":"student"}}', true);
select is((select count(*) from public.profiles where id = '00000000-0000-4000-8000-00000000000a'), 0::bigint, 'student B cannot see student A');

-- forged admin: role claimed in user_metadata only
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated","user_metadata":{"role":"admin"},"app_metadata":{"role":"student"}}', true);
select is((select count(*) from public.profiles), 1::bigint, 'user_metadata role does not grant admin');

-- admin
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000ad","role":"authenticated","app_metadata":{"role":"admin"}}', true);
select is((select count(*) from public.profiles), 4::bigint, 'admin reads all profiles');
select is((select count(*) from public.audit_logs), 1::bigint, 'admin reads audit logs');
select throws_ok($$select count(*) from public.student_auth_identities$$, '42501', null, 'even admin JWT cannot read auth identities directly');
select throws_ok($$update public.profiles set display_name = 'X' where id = '00000000-0000-4000-8000-00000000000a'$$, '42501', null, 'admin JWT cannot write profiles directly (server routes only)');
reset role;

-- rate limit (server role)
select is(
  (select array_agg(public.consume_rate_limit(repeat('b', 64), 2, 600)) from generate_series(1, 3)),
  array[true, true, false],
  'consume_rate_limit allows the limit then refuses'
);

select * from finish();
rollback;
