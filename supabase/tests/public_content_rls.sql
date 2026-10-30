-- Public content RLS. Assertions are independent of seed data: they compare what anon can see
-- with what exists, instead of assuming an empty database (supabase db reset applies seed.sql).
begin;
select plan(6);

insert into public.sources (id, title, author_or_issuer, publication_year, source_type, verification_status)
values
  ('00000000-0000-0000-0000-000000000001', 'Verified source', 'FPT University', 2026, 'syllabus', 'verified'),
  ('00000000-0000-0000-0000-000000000002', 'Pending source', 'FPT University', 2026, 'syllabus', 'pending');

-- Turn one existing dossier (with its current version) into a draft for this transaction only;
-- if the database has no dossier yet, create one in a free slot.
insert into public.dossiers (id, slug, chapter, order_index, title, central_question, status)
select '00000000-0000-0000-0000-0000000000d1', 'rls-draft-probe', 'chapter_1', 1, 'Draft probe', 'Draft probe?', 'draft'
where not exists (select 1 from public.dossiers);
insert into public.dossier_versions (id, dossier_id, version, content)
select gen_random_uuid(), d.id, 999, '{}'::jsonb from public.dossiers d
where d.current_version_id is null and d.id = '00000000-0000-0000-0000-0000000000d1';
create temp table probe on commit drop as
select d.id as dossier_id,
       coalesce(d.current_version_id, (select v.id from public.dossier_versions v where v.dossier_id = d.id order by v.version desc limit 1)) as version_id
from public.dossiers d order by d.chapter, d.order_index limit 1;
grant select on probe to anon;
update public.dossiers set status = 'draft', current_version_id = (select version_id from probe)
where id = (select dossier_id from probe);

set local role anon;
select is((select count(*) from public.dossiers where status <> 'published'), 0::bigint, 'anon sees no unpublished dossier');
select is((select count(*) from public.dossiers where id = (select dossier_id from probe)), 0::bigint, 'anon cannot see the draft probe');
select is((select count(*) from public.sources where verification_status <> 'verified'), 0::bigint, 'anon sees no pending source');
select is((select count(*) from public.sources where id = '00000000-0000-0000-0000-000000000001'), 1::bigint, 'anon sees a verified source');
select throws_ok($$insert into public.sources (title, author_or_issuer, source_type, verification_status) values ('X','Y','test','verified')$$, '42501', null, 'anon cannot insert source');
select is((select count(*) from public.dossier_versions where id = (select version_id from probe)), 0::bigint, 'anon sees no version of a draft dossier');
select * from finish();
rollback;
