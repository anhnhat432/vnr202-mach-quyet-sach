begin;
select plan(4);
set local role anon;
select is((select count(*) from public.dossiers), 0::bigint, 'anon sees no draft dossiers');
reset role;

insert into public.sources (id, title, author_or_issuer, publication_year, source_type, verification_status)
values
  ('00000000-0000-0000-0000-000000000001', 'Verified source', 'FPT University', 2026, 'syllabus', 'verified'),
  ('00000000-0000-0000-0000-000000000002', 'Pending source', 'FPT University', 2026, 'syllabus', 'pending');

set local role anon;
select is((select count(*) from public.sources), 1::bigint, 'anon sees verified source only');
select throws_ok($$insert into public.sources (title, author_or_issuer, source_type, verification_status) values ('X','Y','test','verified')$$, '42501', null, 'anon cannot insert source');
select is((select count(*) from public.dossier_versions), 0::bigint, 'anon sees no unpublished version');
select * from finish();
rollback;
