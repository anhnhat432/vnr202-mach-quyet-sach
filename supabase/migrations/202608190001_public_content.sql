create extension if not exists pgcrypto;

create type public.content_status as enum ('draft', 'reviewed', 'published');
create type public.course_chapter as enum ('chapter_1', 'chapter_2', 'chapter_3');
create type public.causal_lane as enum ('context', 'contradiction', 'force', 'decision', 'result', 'lesson');
create type public.causal_relation as enum ('direct_cause', 'condition', 'response', 'outcome', 'limitation', 'lesson');

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 300),
  author_or_issuer text not null check (char_length(author_or_issuer) between 2 and 200),
  publication_year int check (publication_year between 1900 and 2100),
  locator text not null default '',
  url text check (url is null or url ~ '^https://'),
  source_type text not null,
  rights_note text not null default '',
  verification_status text not null check (verification_status in ('pending', 'verified')),
  created_at timestamptz not null default now()
);

create table public.dossiers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  chapter public.course_chapter not null,
  order_index int not null check (order_index between 1 and 15),
  title text not null,
  central_question text not null,
  status public.content_status not null default 'draft',
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chapter, order_index)
);

create table public.dossier_versions (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  version int not null check (version > 0),
  schema_version int not null default 1,
  content jsonb not null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (dossier_id, version)
);

alter table public.dossiers
  add constraint dossiers_current_version_fk
  foreign key (current_version_id) references public.dossier_versions(id);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  dossier_version_id uuid not null references public.dossier_versions(id) on delete cascade,
  category text not null check (category in ('context', 'basis', 'implementation', 'result', 'limitation', 'lesson')),
  statement text not null check (char_length(statement) between 5 and 1000)
);

create table public.claim_source_links (
  claim_id uuid not null references public.claims(id) on delete cascade,
  source_id uuid not null references public.sources(id),
  support_scope text not null check (char_length(support_scope) between 3 and 500),
  locator_override text,
  primary key (claim_id, source_id)
);

create table public.causal_nodes (
  id uuid primary key default gen_random_uuid(),
  dossier_version_id uuid not null references public.dossier_versions(id) on delete cascade,
  lane public.causal_lane not null,
  label text not null,
  explanation text not null,
  occurred_on date,
  sort_index int not null
);

create table public.causal_edges (
  id uuid primary key default gen_random_uuid(),
  source_node_id uuid not null references public.causal_nodes(id) on delete cascade,
  target_node_id uuid not null references public.causal_nodes(id) on delete cascade,
  relation public.causal_relation not null,
  explanation text not null,
  claim_id uuid references public.claims(id),
  check (source_node_id <> target_node_id)
);

create index dossiers_public_order_idx on public.dossiers(status, chapter, order_index);
create index dossier_versions_dossier_idx on public.dossier_versions(dossier_id, version desc);
create index claims_version_idx on public.claims(dossier_version_id);
create index causal_nodes_version_lane_idx on public.causal_nodes(dossier_version_id, lane, sort_index);

alter table public.sources enable row level security;
alter table public.dossiers enable row level security;
alter table public.dossier_versions enable row level security;
alter table public.claims enable row level security;
alter table public.claim_source_links enable row level security;
alter table public.causal_nodes enable row level security;
alter table public.causal_edges enable row level security;

create policy sources_public_read on public.sources for select to anon, authenticated
using (verification_status = 'verified');

create policy dossiers_public_read on public.dossiers for select to anon, authenticated
using (status = 'published');

create policy dossier_versions_public_read on public.dossier_versions for select to anon, authenticated
using (exists (
  select 1 from public.dossiers d
  where d.current_version_id = dossier_versions.id and d.status = 'published'
));

create policy claims_public_read on public.claims for select to anon, authenticated
using (exists (
  select 1 from public.dossiers d
  where d.current_version_id = claims.dossier_version_id and d.status = 'published'
));

create policy claim_links_public_read on public.claim_source_links for select to anon, authenticated
using (
  exists (
    select 1 from public.claims c
    join public.dossiers d on d.current_version_id = c.dossier_version_id
    where c.id = claim_source_links.claim_id and d.status = 'published'
  )
  and exists (
    select 1 from public.sources s
    where s.id = claim_source_links.source_id and s.verification_status = 'verified'
  )
);

create policy causal_nodes_public_read on public.causal_nodes for select to anon, authenticated
using (exists (
  select 1 from public.dossiers d
  where d.current_version_id = causal_nodes.dossier_version_id and d.status = 'published'
));

create policy causal_edges_public_read on public.causal_edges for select to anon, authenticated
using (
  exists (
    select 1 from public.causal_nodes n
    join public.dossiers d on d.current_version_id = n.dossier_version_id
    where n.id = causal_edges.source_node_id and d.status = 'published'
  )
  and exists (
    select 1 from public.causal_nodes n
    join public.dossiers d on d.current_version_id = n.dossier_version_id
    where n.id = causal_edges.target_node_id and d.status = 'published'
  )
);

grant select on public.sources, public.dossiers, public.dossier_versions,
  public.claims, public.claim_source_links, public.causal_nodes, public.causal_edges
  to anon, authenticated;
