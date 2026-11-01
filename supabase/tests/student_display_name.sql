-- CLASS-002..004: owner onboarding, privacy, write-once setup and authoritative start gate.
begin;
select plan(16);
select has_function('public', 'set_student_display_name', array['uuid', 'text']);
select ok(not has_function_privilege('anon', 'public.set_student_display_name(uuid,text)', 'EXECUTE'), 'anonymous cannot call name setup');
select ok(not has_function_privilege('authenticated', 'public.set_student_display_name(uuid,text)', 'EXECUTE'), 'clients cannot spoof the service actor');
insert into auth.users(id,email) values
 ('62000000-0000-4000-8000-000000000001','name-a@test.invalid'),
 ('62000000-0000-4000-8000-000000000002','name-b@test.invalid'),
 ('62000000-0000-4000-8000-000000000003','name-c@test.invalid'),
 ('62000000-0000-4000-8000-000000000004','name-admin@test.invalid');
insert into public.classes(id,code,name) values('62000000-0000-4000-8000-000000000099','NAME-TEST','Synthetic name test');
insert into public.profiles(id,role,student_id,full_name,display_name,class_id,requires_display_name,status) values
 ('62000000-0000-4000-8000-000000000001','student','TESTA0001','Chưa đặt tên','Chưa đặt tên','62000000-0000-4000-8000-000000000099',true,'active'),
 ('62000000-0000-4000-8000-000000000002','student','TESTA0002','Chưa đặt tên','Chờ tên 2','62000000-0000-4000-8000-000000000099',true,'active'),
 ('62000000-0000-4000-8000-000000000003','student','TESTA0003','Chưa đặt tên','Chờ tên 3','62000000-0000-4000-8000-000000000099',true,'locked');
insert into public.profiles(id,role,full_name,display_name) values('62000000-0000-4000-8000-000000000004','admin','Admin','Admin');
select throws_ok($$insert into public.attempts(profile_id) values('62000000-0000-4000-8000-000000000001')$$,'QA409','display_name_required','database blocks a pending student before attempt insert');
select throws_ok($$select public.set_student_display_name('62000000-0000-4000-8000-000000000001','   ')$$,'QA422','invalid_display_name','blank name refused');
select throws_ok($$select public.set_student_display_name('62000000-0000-4000-8000-000000000001',E'An\nNguyen')$$,'QA422','invalid_display_name','control characters refused');
select throws_ok($$select public.set_student_display_name('62000000-0000-4000-8000-000000000001','An TESTA0002')$$,'QA422','student_id_in_name','another student ID cannot enter a public name');
select throws_ok($$select public.set_student_display_name('62000000-0000-4000-8000-000000000003','An')$$,'42501','student_not_active','locked student cannot change name');
select throws_ok($$select public.set_student_display_name('62000000-0000-4000-8000-000000000004','Admin')$$,'42501','actor_not_student','admin does not use the student setter');
select is(public.set_student_display_name('62000000-0000-4000-8000-000000000001','  Nguyễn   Văn An  ')->>'displayName','An N.V.','full name is abbreviated in response');
select is((select requires_display_name from public.profiles where student_id='TESTA0001'),false,'name completion clears pending flag');
select is((select full_name from public.profiles where student_id='TESTA0001'),'Nguyễn Văn An','private self-reported name is normalized');
select throws_ok($$select public.set_student_display_name('62000000-0000-4000-8000-000000000001','Other name')$$,'QA409','display_name_already_set','student setup cannot be replayed to rename');
select is(public.set_student_display_name('62000000-0000-4000-8000-000000000002','Nguyễn Văn An')->>'displayName','An N.V. (2)','duplicate names receive a suffix');
select is((select count(*) from public.audit_logs where action='profile.student_name_set' and actor_profile_id in('62000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000002')),2::bigint,'each successful setup has an audit entry');
select is((select requires_display_name from public.profiles where id='62000000-0000-4000-8000-000000000004'),false,'existing/named profiles are unaffected by default');
select * from finish();
rollback;
