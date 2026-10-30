-- Phase C: question bank, version governance (Draft -> Reviewed -> Published), exposure tracking
-- and balanced allocation. Rules: CONTENT-001..006, LA-CONTENT-001..014, LA-ALLOC-001..012.
--
-- Status lives on the VERSION (a published version is immutable; edits create a new version).
-- Nothing here is readable by anon/authenticated: correct answers stay server-side (LA-FB-003).
-- Stage D adds the competition tables and the foreign keys on competition_id below.

create type public.game_type as enum ('minefield', 'race');
create type public.question_pool as enum ('minefield_main', 'minefield_defuse', 'race');
create type public.question_type as enum ('single_choice', 'before_after', 'pair_choice', 'defuse_ab');
create type public.question_difficulty as enum ('easy', 'medium', 'hard');
create type public.question_origin as enum ('bank', 'fixture');
create type public.question_status as enum ('draft', 'reviewed', 'published');

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  external_key text unique check (external_key ~ '^[a-z0-9][a-z0-9._-]{2,80}$'),
  game_type public.game_type not null,
  pool public.question_pool not null,
  chapter public.course_chapter not null,
  topic text not null check (char_length(btrim(topic)) between 2 and 120),
  question_type public.question_type not null,
  option_count smallint not null check (option_count in (2, 3)),
  difficulty public.question_difficulty not null,
  origin public.question_origin not null default 'bank',
  current_version_id uuid,
  published_version_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check ((game_type = 'minefield' and pool in ('minefield_main', 'minefield_defuse')) or (game_type = 'race' and pool = 'race')),
  check ((pool = 'minefield_defuse') = (question_type = 'defuse_ab')),
  check (question_type not in ('defuse_ab', 'before_after') or option_count = 2),
  check (pool <> 'minefield_defuse' or difficulty = 'easy')
);

create table public.question_versions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  version int not null check (version > 0),
  schema_version int not null default 1,
  status public.question_status not null default 'draft',
  content_public jsonb not null,
  content_private jsonb not null,
  ai_assisted boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default clock_timestamp(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  published_by uuid references public.profiles(id),
  published_at timestamptz,
  retired_at timestamptz,
  retired_by uuid references public.profiles(id),
  retire_reason text,
  unique (question_id, version)
);

alter table public.questions
  add constraint questions_current_version_fk foreign key (current_version_id) references public.question_versions(id) deferrable initially deferred,
  add constraint questions_published_version_fk foreign key (published_version_id) references public.question_versions(id) deferrable initially deferred;

create table public.question_source_links (
  question_version_id uuid not null references public.question_versions(id) on delete cascade,
  source_id uuid not null references public.sources(id),
  locator text not null check (char_length(btrim(locator)) between 1 and 200),
  usage_note text not null default '',
  primary key (question_version_id, source_id, locator)
);

-- Allocation and display counters per version and competition (LA-ALLOC-012, LA-CONTENT-009/010).
-- competition_id gets its foreign key in the competition migration (stage D).
create table public.question_exposures (
  question_version_id uuid not null references public.question_versions(id) on delete cascade,
  competition_id uuid not null,
  allocated_count int not null default 0 check (allocated_count >= 0),
  displayed_count int not null default 0 check (displayed_count >= 0 and displayed_count <= allocated_count),
  answer_disclosed_at timestamptz,
  primary key (question_version_id, competition_id)
);

create table public.competition_disclosed_question_confirmations (
  competition_id uuid not null,
  question_version_id uuid not null references public.question_versions(id) on delete cascade,
  confirmed_by uuid not null references public.profiles(id),
  reason text not null check (char_length(btrim(reason)) >= 3),
  confirmed_at timestamptz not null default clock_timestamp(),
  primary key (competition_id, question_version_id)
);

create index questions_pool_idx on public.questions (game_type, pool, difficulty, origin);
create index question_versions_question_idx on public.question_versions (question_id, version desc);
create index question_exposures_competition_idx on public.question_exposures (competition_id);

-- ---------------------------------------------------------------------------------------------
-- Content shape. Public payload carries only prompt + options (never the answer); the private
-- payload carries the answer and explanation. Hard limits here are generous: the trial limits
-- 80/40 characters (LA-CONTENT-008) are enforced by the readiness check, not frozen in a CHECK.
-- ---------------------------------------------------------------------------------------------
create function public.question_content_problems(p_type public.question_type, p_option_count int, p_public jsonb, p_private jsonb)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_problems text[] := '{}';
  v_key text;
  v_option jsonb;
  v_ids text[] := '{}';
  v_id text;
begin
  if jsonb_typeof(p_public) is distinct from 'object' then return array['public_not_object']; end if;
  if jsonb_typeof(p_private) is distinct from 'object' then return array['private_not_object']; end if;

  for v_key in select jsonb_object_keys(p_public) loop
    if v_key not in ('prompt', 'options') then v_problems := v_problems || 'public_unknown_key'::text; end if;
  end loop;
  for v_key in select jsonb_object_keys(p_private) loop
    if v_key not in ('correctOptionId', 'explanation') then v_problems := v_problems || 'private_unknown_key'::text; end if;
  end loop;

  if jsonb_typeof(p_public -> 'prompt') is distinct from 'string' or char_length(btrim(p_public ->> 'prompt')) not between 1 and 300 then
    v_problems := v_problems || 'prompt_invalid'::text;
  end if;

  if jsonb_typeof(p_public -> 'options') is distinct from 'array' or jsonb_array_length(p_public -> 'options') <> p_option_count then
    v_problems := v_problems || 'option_count_mismatch'::text;
  else
    for v_option in select * from jsonb_array_elements(p_public -> 'options') loop
      if jsonb_typeof(v_option) is distinct from 'object' then
        v_problems := v_problems || 'option_not_object'::text;
        continue;
      end if;
      for v_key in select jsonb_object_keys(v_option) loop
        if v_key not in ('id', 'label') then v_problems := v_problems || 'option_unknown_key'::text; end if;
      end loop;
      v_id := v_option ->> 'id';
      if jsonb_typeof(v_option -> 'id') is distinct from 'string' or v_id !~ '^[a-z0-9]{1,8}$' then
        v_problems := v_problems || 'option_id_invalid'::text;
      elsif v_id = any (v_ids) then
        v_problems := v_problems || 'option_id_duplicate'::text;
      else
        v_ids := v_ids || v_id;
      end if;
      if jsonb_typeof(v_option -> 'label') is distinct from 'string' or char_length(btrim(v_option ->> 'label')) not between 1 and 200 then
        v_problems := v_problems || 'option_label_invalid'::text;
      end if;
    end loop;
  end if;

  if jsonb_typeof(p_private -> 'correctOptionId') is distinct from 'string' or not ((p_private ->> 'correctOptionId') = any (v_ids)) then
    v_problems := v_problems || 'correct_option_invalid'::text;
  end if;
  if jsonb_typeof(p_private -> 'explanation') is distinct from 'string' or char_length(btrim(p_private ->> 'explanation')) not between 1 and 1000 then
    v_problems := v_problems || 'explanation_invalid'::text;
  end if;
  return v_problems;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Governance. AI can create Drafts but cannot review or publish: a reviewer/publisher must be an
-- active administrator profile, and an AI agent has none. Published versions never change except
-- for retirement. Fixture questions are not academic content and may be Published without review,
-- but are never eligible for an official competition (see eligible_questions).
-- ---------------------------------------------------------------------------------------------
create function public.question_versions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_q public.questions%rowtype;
  v_problems text[];
  v_frozen text[] := array['retired_at', 'retired_by', 'retire_reason'];
begin
  select * into v_q from public.questions where id = new.question_id;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' and v_q.origin <> 'fixture' then
      raise exception 'new_version_must_be_draft' using errcode = '23514';
    end if;
    if new.retired_at is not null then raise exception 'new_version_cannot_be_retired' using errcode = '23514'; end if;
    if new.status = 'published' then new.published_at := coalesce(new.published_at, clock_timestamp()); end if;
  else
    if old.status = 'published' then
      if (to_jsonb(new) - v_frozen) is distinct from (to_jsonb(old) - v_frozen) then
        raise exception 'published_version_immutable' using errcode = '23514';
      end if;
      if old.retired_at is not null and new.retired_at is distinct from old.retired_at then
        raise exception 'retirement_is_permanent' using errcode = '23514';
      end if;
      return new;
    end if;
    if new.question_id <> old.question_id or new.version <> old.version then
      raise exception 'version_identity_immutable' using errcode = '23514';
    end if;
    if new.retired_at is not null then raise exception 'only_published_can_retire' using errcode = '23514'; end if;
    if old.status <> 'draft' and (new.content_public is distinct from old.content_public or new.content_private is distinct from old.content_private) then
      raise exception 'content_locked_after_draft' using errcode = '23514';
    end if;
    if new.status <> old.status and not (
      (old.status = 'draft' and new.status = 'reviewed')
      or (old.status = 'reviewed' and new.status in ('draft', 'published'))
      or (old.status = 'draft' and new.status = 'published' and v_q.origin = 'fixture')
    ) then
      raise exception 'invalid_status_transition: % -> %', old.status, new.status using errcode = '23514';
    end if;
  end if;

  v_problems := public.question_content_problems(v_q.question_type, v_q.option_count, new.content_public, new.content_private);
  if coalesce(array_length(v_problems, 1), 0) > 0 then
    raise exception 'invalid_question_content: %', array_to_string(v_problems, ',') using errcode = '23514';
  end if;

  if new.status in ('reviewed', 'published') and v_q.origin = 'bank' then
    if new.reviewed_by is null or new.reviewed_at is null
       or not exists (select 1 from public.profiles p where p.id = new.reviewed_by and p.role = 'admin' and p.status = 'active') then
      raise exception 'human_reviewer_required' using errcode = '23514';
    end if;
    if not exists (select 1 from public.question_source_links l where l.question_version_id = new.id)
       or exists (
         select 1 from public.question_source_links l join public.sources s on s.id = l.source_id
         where l.question_version_id = new.id and s.verification_status <> 'verified'
       ) then
      raise exception 'verified_sources_required' using errcode = '23514';
    end if;
    if new.ai_assisted and char_length(btrim(coalesce(new.review_note, ''))) = 0 then
      raise exception 'ai_review_note_required' using errcode = '23514';
    end if;
  end if;
  if new.status = 'published' and v_q.origin = 'bank' then
    if new.published_by is null or new.published_at is null
       or not exists (select 1 from public.profiles p where p.id = new.published_by and p.role = 'admin' and p.status = 'active') then
      raise exception 'human_publisher_required' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger question_versions_guard_trg
before insert or update on public.question_versions
for each row execute function public.question_versions_guard();

create function public.question_versions_sync()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.questions set current_version_id = new.id, updated_at = clock_timestamp() where id = new.question_id;
    if new.status = 'published' then
      update public.questions set published_version_id = new.id where id = new.question_id;
    end if;
  else
    if new.status = 'published' and old.status <> 'published' then
      update public.questions set published_version_id = new.id, updated_at = clock_timestamp() where id = new.question_id;
    end if;
    if new.retired_at is not null and old.retired_at is null then
      update public.questions set published_version_id = null, updated_at = clock_timestamp() where id = new.question_id and published_version_id = new.id;
    end if;
  end if;
  return null;
end;
$$;

create trigger question_versions_sync_trg
after insert or update on public.question_versions
for each row execute function public.question_versions_sync();

-- Shape-defining columns never change; placement columns are frozen once any version is published.
create function public.questions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.game_type <> old.game_type or new.pool <> old.pool or new.question_type <> old.question_type
     or new.option_count <> old.option_count or new.origin <> old.origin then
    raise exception 'question_shape_immutable' using errcode = '23514';
  end if;
  if (new.chapter <> old.chapter or new.difficulty <> old.difficulty)
     and exists (select 1 from public.question_versions v where v.question_id = old.id and v.status = 'published') then
    raise exception 'published_question_placement_immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger questions_guard_trg
before update on public.questions
for each row execute function public.questions_guard();

-- Create or update a Draft in one transaction. Always creates origin = 'bank' Drafts; this path
-- cannot review or publish. Re-importing identical content is a no-op (idempotent by external_key).
create function public.upsert_question_draft(
  p_actor uuid,
  p_external_key text,
  p_question jsonb,
  p_public jsonb,
  p_private jsonb,
  p_sources jsonb,
  p_ai_assisted boolean default false
)
returns table (question_id uuid, version_id uuid, version int, outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q public.questions%rowtype;
  v_v public.question_versions%rowtype;
  v_link jsonb;
  v_sources_json jsonb;
  v_same boolean;
begin
  if not exists (select 1 from public.profiles p where p.id = p_actor and p.role = 'admin' and p.status = 'active') then
    raise exception 'actor_not_admin' using errcode = '42501';
  end if;
  if jsonb_typeof(p_sources) is distinct from 'array' then raise exception 'sources_must_be_array' using errcode = '22023'; end if;

  select * into v_q from public.questions where external_key = p_external_key for update;
  if not found then
    insert into public.questions (external_key, game_type, pool, chapter, topic, question_type, option_count, difficulty, origin, created_by)
    values (p_external_key, (p_question ->> 'game_type')::public.game_type, (p_question ->> 'pool')::public.question_pool,
            (p_question ->> 'chapter')::public.course_chapter, p_question ->> 'topic', (p_question ->> 'question_type')::public.question_type,
            (p_question ->> 'option_count')::smallint, (p_question ->> 'difficulty')::public.question_difficulty, 'bank', p_actor)
    returning * into v_q;
    insert into public.question_versions (question_id, version, content_public, content_private, ai_assisted, created_by)
    values (v_q.id, 1, p_public, p_private, p_ai_assisted, p_actor) returning * into v_v;
    outcome := 'created';
  else
    if v_q.origin <> 'bank' then raise exception 'not_a_bank_question' using errcode = '23514'; end if;
    select * into v_v from public.question_versions where question_versions.question_id = v_q.id order by question_versions.version desc limit 1;
    select coalesce(jsonb_agg(jsonb_build_object('sourceId', l.source_id, 'locator', l.locator, 'usageNote', l.usage_note) order by l.source_id, l.locator), '[]'::jsonb)
      into v_sources_json from public.question_source_links l where l.question_version_id = v_v.id;
    v_same := v_v.content_public = p_public and v_v.content_private = p_private and v_v.ai_assisted = p_ai_assisted
      and v_sources_json = (select coalesce(jsonb_agg(jsonb_build_object('sourceId', e ->> 'sourceId', 'locator', e ->> 'locator', 'usageNote', coalesce(e ->> 'usageNote', '')) order by e ->> 'sourceId', e ->> 'locator'), '[]'::jsonb)
                            from jsonb_array_elements(p_sources) e);
    if v_same then
      question_id := v_q.id; version_id := v_v.id; version := v_v.version; outcome := 'unchanged';
      return next;
      return;
    end if;
    if v_v.status = 'draft' then
      update public.question_versions set content_public = p_public, content_private = p_private, ai_assisted = p_ai_assisted where id = v_v.id returning * into v_v;
      delete from public.question_source_links where question_version_id = v_v.id;
      outcome := 'updated';
    else
      insert into public.question_versions (question_id, version, content_public, content_private, ai_assisted, created_by)
      values (v_q.id, v_v.version + 1, p_public, p_private, p_ai_assisted, p_actor) returning * into v_v;
      outcome := 'new_version';
    end if;
  end if;

  for v_link in select * from jsonb_array_elements(p_sources) loop
    insert into public.question_source_links (question_version_id, source_id, locator, usage_note)
    values (v_v.id, (v_link ->> 'sourceId')::uuid, v_link ->> 'locator', coalesce(v_link ->> 'usageNote', ''));
  end loop;
  question_id := v_q.id; version_id := v_v.id; version := v_v.version;
  return next;
end;
$$;

-- Review / publish / reject / retire. Only an active administrator can act (LA-CONTENT-003).
create function public.transition_question_version(p_version_id uuid, p_actor uuid, p_action text, p_note text default null)
returns public.question_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.question_versions%rowtype;
  v_new public.question_versions%rowtype;
begin
  if not exists (select 1 from public.profiles p where p.id = p_actor and p.role = 'admin' and p.status = 'active') then
    raise exception 'actor_not_admin' using errcode = '42501';
  end if;
  select * into v_old from public.question_versions where id = p_version_id for update;
  if not found then raise exception 'version_not_found' using errcode = 'P0002'; end if;

  if p_action = 'review' then
    update public.question_versions set status = 'reviewed', reviewed_by = p_actor, reviewed_at = clock_timestamp(), review_note = p_note where id = p_version_id returning * into v_new;
  elsif p_action = 'publish' then
    update public.question_versions set status = 'published', published_by = p_actor, published_at = clock_timestamp() where id = p_version_id returning * into v_new;
  elsif p_action = 'reject' then
    update public.question_versions set status = 'draft', reviewed_by = null, reviewed_at = null, review_note = p_note where id = p_version_id returning * into v_new;
  elsif p_action = 'retire' then
    if char_length(btrim(coalesce(p_note, ''))) < 3 then raise exception 'retire_reason_required' using errcode = '23514'; end if;
    update public.question_versions set retired_at = clock_timestamp(), retired_by = p_actor, retire_reason = p_note where id = p_version_id returning * into v_new;
  else
    raise exception 'invalid_action' using errcode = '22023';
  end if;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before_redacted, after_redacted)
  values (p_actor, 'question.' || p_action, 'question_version', p_version_id::text,
          jsonb_build_object('status', v_old.status, 'retired', v_old.retired_at is not null),
          jsonb_build_object('status', v_new.status, 'retired', v_new.retired_at is not null, 'noteGiven', coalesce(p_note, '') <> ''));
  return v_new.status;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Eligibility, shared by allocation and the readiness report so the two can never disagree.
-- official: bank questions only (never fixtures), Published and not retired.
-- rehearsal: fixtures and Published bank questions.
-- ---------------------------------------------------------------------------------------------
create function public.eligible_questions(p_game public.game_type, p_kind text, p_competition_id uuid)
returns table (
  question_id uuid, version_id uuid, pool public.question_pool, difficulty public.question_difficulty,
  chapter public.course_chapter, option_count smallint, prompt_len int, max_option_len int,
  disclosed boolean, confirmed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, v.id, q.pool, q.difficulty, q.chapter, q.option_count,
         char_length(v.content_public ->> 'prompt'),
         (select max(char_length(o ->> 'label')) from jsonb_array_elements(v.content_public -> 'options') o),
         exists (select 1 from public.question_exposures x where x.question_version_id = v.id and x.answer_disclosed_at is not null),
         exists (select 1 from public.competition_disclosed_question_confirmations c where c.question_version_id = v.id and c.competition_id = p_competition_id)
  from public.questions q
  join public.question_versions v on v.id = q.published_version_id
  where q.game_type = p_game
    and v.status = 'published'
    and v.retired_at is null
    and (p_kind = 'rehearsal' or (p_kind = 'official' and q.origin = 'bank'))
$$;

-- Balanced allocation of one attempt's question set (LA-ALLOC-001..012).
-- Called inside the start-attempt transaction (stage D). Serialized per competition and game by an
-- advisory lock so 60 near-simultaneous starts all see the latest counters.
--   - blueprint by game, difficulty and pool (LA-ALLOC-002)
--   - within a slot: fewest allocations first (keeps the spread within 1), then the chapter least
--     represented in this set, then fewest displays over all competitions, then random
--   - never repeats a version within a set (LA-ALLOC-006)
--   - race: at most 5 two-option questions, reserved so later slots stay satisfiable (LA-ALLOC-010)
--   - official excludes disclosed questions unless confirmed for this competition (LA-ALLOC-009)
create function public.allocate_question_set(p_competition_id uuid, p_game public.game_type, p_kind text)
returns table (slot int, role text, difficulty public.question_difficulty, question_id uuid, question_version_id uuid, chapter public.course_chapter, option_count smallint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_blueprint jsonb;
  v_n int;
  v_i int;
  v_k int;
  v_slot jsonb;
  v_cap int := case when p_game = 'race' then 5 else null end;
  v_supply3 int[] := '{}';
  v_forced int[] := '{}';
  v_used_two int := 0;
  v_chosen uuid[] := '{}';
  v_chapters jsonb := '{}'::jsonb;
  v_picked_in_slot int;
  v_picked3_in_slot int;
  v_forced_after int;
  v_need int;
  v_pick record;
  v_slot_no int := 0;
  v_pool public.question_pool;
  v_diff public.question_difficulty;
begin
  if p_kind not in ('official', 'rehearsal') then raise exception 'invalid_kind' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('alloc:' || p_competition_id::text || ':' || p_game::text, 0));

  v_blueprint := case p_game
    when 'minefield' then '[
      {"role":"main","pool":"minefield_main","difficulty":"easy","n":3},
      {"role":"main","pool":"minefield_main","difficulty":"medium","n":4},
      {"role":"main","pool":"minefield_main","difficulty":"hard","n":3},
      {"role":"defuse","pool":"minefield_defuse","difficulty":"easy","n":3}]'::jsonb
    else '[
      {"role":"main","pool":"race","difficulty":"easy","n":5},
      {"role":"main","pool":"race","difficulty":"medium","n":7},
      {"role":"main","pool":"race","difficulty":"hard","n":3}]'::jsonb
  end;
  v_n := jsonb_array_length(v_blueprint);

  -- Per slot: how many questions are forced to be two-option because three-option supply is short.
  for v_i in 0 .. v_n - 1 loop
    v_slot := v_blueprint -> v_i;
    v_pool := (v_slot ->> 'pool')::public.question_pool;
    v_diff := (v_slot ->> 'difficulty')::public.question_difficulty;
    v_supply3 := v_supply3 || (
      select count(*)::int from public.eligible_questions(p_game, p_kind, p_competition_id) e
      where e.pool = v_pool and e.difficulty = v_diff and e.option_count = 3 and (p_kind <> 'official' or not e.disclosed or e.confirmed));
    v_forced := v_forced || greatest(0, (v_slot ->> 'n')::int - v_supply3[v_i + 1]);
  end loop;

  for v_i in 0 .. v_n - 1 loop
    v_slot := v_blueprint -> v_i;
    v_pool := (v_slot ->> 'pool')::public.question_pool;
    v_diff := (v_slot ->> 'difficulty')::public.question_difficulty;
    v_need := (v_slot ->> 'n')::int;
    v_picked_in_slot := 0;
    v_picked3_in_slot := 0;

    for v_k in 1 .. v_need loop
      v_forced_after := coalesce((select sum(f) from unnest(v_forced[v_i + 2 : v_n]) f), 0)
                        + greatest(0, (v_need - v_picked_in_slot - 1) - (v_supply3[v_i + 1] - v_picked3_in_slot));
      select e.question_id, e.version_id, e.chapter, e.option_count
        into v_pick
      from public.eligible_questions(p_game, p_kind, p_competition_id) e
      left join public.question_exposures x on x.question_version_id = e.version_id and x.competition_id = p_competition_id
      where e.pool = v_pool and e.difficulty = v_diff
        and not (e.version_id = any (v_chosen))
        and (p_kind <> 'official' or not e.disclosed or e.confirmed)
        and (v_cap is null or e.option_count = 3 or v_used_two + 1 + v_forced_after <= v_cap)
      order by coalesce(x.allocated_count, 0),
               coalesce((v_chapters ->> e.chapter::text)::int, 0),
               (select coalesce(sum(x2.displayed_count), 0) from public.question_exposures x2 where x2.question_version_id = e.version_id),
               random()
      limit 1;
      if v_pick.version_id is null then
        raise exception 'question_pool_insufficient' using errcode = 'QB001', detail = format('%s/%s/%s needs %s', p_game, v_pool, v_diff, v_need);
      end if;

      insert into public.question_exposures (question_version_id, competition_id, allocated_count)
      values (v_pick.version_id, p_competition_id, 1)
      on conflict on constraint question_exposures_pkey do update set allocated_count = public.question_exposures.allocated_count + 1;

      v_chosen := v_chosen || v_pick.version_id;
      v_chapters := jsonb_set(v_chapters, array[v_pick.chapter::text], to_jsonb(coalesce((v_chapters ->> v_pick.chapter::text)::int, 0) + 1));
      v_picked_in_slot := v_picked_in_slot + 1;
      if v_pick.option_count = 3 then v_picked3_in_slot := v_picked3_in_slot + 1; else v_used_two := v_used_two + 1; end if;

      v_slot_no := v_slot_no + 1;
      slot := v_slot_no; role := v_slot ->> 'role'; difficulty := v_diff; question_id := v_pick.question_id;
      question_version_id := v_pick.version_id; chapter := v_pick.chapter; option_count := v_pick.option_count;
      return next;
    end loop;
  end loop;
end;
$$;

-- Display counter (LA-ALLOC-012): called when a question's content is first released to a player.
create function public.record_question_displayed(p_competition_id uuid, p_question_version_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.question_exposures set displayed_count = displayed_count + 1
  where competition_id = p_competition_id and question_version_id = p_question_version_id and displayed_count < allocated_count
$$;

-- Finalization marks only questions somebody actually saw as disclosed (LA-CONTENT-009, LA-AC-037).
create function public.mark_competition_answers_disclosed(p_competition_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare v_count int;
begin
  update public.question_exposures set answer_disclosed_at = clock_timestamp()
  where competition_id = p_competition_id and displayed_count > 0 and answer_disclosed_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Explicit confirmation to reuse a disclosed question in one competition, with audit (LA-CONTENT-009).
create function public.confirm_disclosed_questions(p_competition_id uuid, p_actor uuid, p_version_ids uuid[], p_reason text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare v_count int;
begin
  if not exists (select 1 from public.profiles p where p.id = p_actor and p.role = 'admin' and p.status = 'active') then
    raise exception 'actor_not_admin' using errcode = '42501';
  end if;
  insert into public.competition_disclosed_question_confirmations (competition_id, question_version_id, confirmed_by, reason)
  select p_competition_id, v, p_actor, p_reason from unnest(p_version_ids) v
  on conflict do nothing;
  get diagnostics v_count = row_count;
  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, after_redacted)
  values (p_actor, 'question.confirm_disclosed_reuse', 'competition', p_competition_id::text, jsonb_build_object('questions', v_count, 'reason', p_reason));
  return v_count;
end;
$$;

-- Readiness report (LA-CONTENT-007/011/013/014). Blockers stop an official competition from opening;
-- the 168-question target is reported separately and does not block (owner decision N3).
create function public.question_bank_readiness(
  p_kind text, p_competition_id uuid default null, p_expected_attempts int default 60, p_max_prompt int default 80, p_max_option int default 40
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_games jsonb := '{}'::jsonb;
  v_blockers text[] := '{}';
  v_target_ok boolean := true;
  v_game public.game_type;
  v_blueprint jsonb;
  v_slot jsonb;
  v_slots jsonb;
  v_avail int;
  v_avail3 int;
  v_need int;
  v_forced int;
  v_forced_total int;
  v_over int;
  v_excluded int;
  v_expected int;
begin
  if p_kind not in ('official', 'rehearsal') then raise exception 'invalid_kind' using errcode = '22023'; end if;
  foreach v_game in array array['minefield', 'race']::public.game_type[] loop
    v_blueprint := case v_game
      when 'minefield' then '[{"role":"main","pool":"minefield_main","difficulty":"easy","n":3},{"role":"main","pool":"minefield_main","difficulty":"medium","n":4},{"role":"main","pool":"minefield_main","difficulty":"hard","n":3},{"role":"defuse","pool":"minefield_defuse","difficulty":"easy","n":3}]'::jsonb
      else '[{"role":"main","pool":"race","difficulty":"easy","n":5},{"role":"main","pool":"race","difficulty":"medium","n":7},{"role":"main","pool":"race","difficulty":"hard","n":3}]'::jsonb
    end;
    v_slots := '[]'::jsonb;
    v_forced_total := 0;
    for v_slot in select * from jsonb_array_elements(v_blueprint) loop
      v_need := (v_slot ->> 'n')::int;
      select count(*) filter (where p_kind <> 'official' or not e.disclosed or e.confirmed),
             count(*) filter (where e.option_count = 3 and (p_kind <> 'official' or not e.disclosed or e.confirmed))
        into v_avail, v_avail3
      from public.eligible_questions(v_game, p_kind, p_competition_id) e
      where e.pool = (v_slot ->> 'pool')::public.question_pool and e.difficulty = (v_slot ->> 'difficulty')::public.question_difficulty;
      v_forced := greatest(0, v_need - v_avail3);
      v_forced_total := v_forced_total + v_forced;
      v_expected := case when v_avail > 0 then ceil(p_expected_attempts::numeric * v_need / v_avail)::int else null end;
      if v_avail < v_need then v_blockers := v_blockers || format('insufficient_pool:%s/%s/%s', v_game, v_slot ->> 'pool', v_slot ->> 'difficulty'); end if;
      if v_expected is null or v_expected > 10 then v_target_ok := false; end if;
      v_slots := v_slots || jsonb_build_object('role', v_slot ->> 'role', 'pool', v_slot ->> 'pool', 'difficulty', v_slot ->> 'difficulty',
        'needed', v_need, 'available', v_avail, 'availableThreeOption', v_avail3, 'shortfall', greatest(0, v_need - v_avail), 'expectedAllocationsPerQuestion', v_expected);
    end loop;
    if v_game = 'race' and v_forced_total > 5 then v_blockers := v_blockers || 'two_option_cap_unsatisfiable:race'::text; end if;
    select count(*) into v_over from public.eligible_questions(v_game, p_kind, p_competition_id) e
      where (p_kind <> 'official' or not e.disclosed or e.confirmed) and (e.prompt_len > p_max_prompt or e.max_option_len > p_max_option);
    if v_over > 0 then v_blockers := v_blockers || format('over_length:%s:%s', v_game, v_over); end if;
    select count(*) into v_excluded from public.eligible_questions(v_game, p_kind, p_competition_id) e where e.disclosed and not e.confirmed;
    v_games := v_games || jsonb_build_object(v_game::text, jsonb_build_object('slots', v_slots, 'disclosedExcluded', case when p_kind = 'official' then v_excluded else 0 end));
  end loop;
  return jsonb_build_object('kind', p_kind, 'ready', coalesce(array_length(v_blockers, 1), 0) = 0, 'blockers', to_jsonb(v_blockers),
    'limits', jsonb_build_object('maxPrompt', p_max_prompt, 'maxOption', p_max_option),
    'target', jsonb_build_object('expectedAttempts', p_expected_attempts, 'maxPerQuestion', 10, 'meetsTarget', v_target_ok), 'games', v_games);
end;
$$;

-- Access: server only. RLS on with no policies = nothing for anon/authenticated even if a grant slipped in.
alter table public.questions enable row level security;
alter table public.question_versions enable row level security;
alter table public.question_source_links enable row level security;
alter table public.question_exposures enable row level security;
alter table public.competition_disclosed_question_confirmations enable row level security;

revoke all on public.questions, public.question_versions, public.question_source_links, public.question_exposures,
  public.competition_disclosed_question_confirmations from anon, authenticated;
grant select, insert, update, delete on public.questions, public.question_versions, public.question_source_links,
  public.question_exposures, public.competition_disclosed_question_confirmations to service_role;

revoke execute on function
  public.question_content_problems(public.question_type, int, jsonb, jsonb),
  public.question_versions_guard(), public.question_versions_sync(), public.questions_guard(),
  public.upsert_question_draft(uuid, text, jsonb, jsonb, jsonb, jsonb, boolean),
  public.transition_question_version(uuid, uuid, text, text),
  public.eligible_questions(public.game_type, text, uuid),
  public.allocate_question_set(uuid, public.game_type, text),
  public.record_question_displayed(uuid, uuid),
  public.mark_competition_answers_disclosed(uuid),
  public.confirm_disclosed_questions(uuid, uuid, uuid[], text),
  public.question_bank_readiness(text, uuid, int, int, int)
from public, anon, authenticated;
grant execute on function
  public.upsert_question_draft(uuid, text, jsonb, jsonb, jsonb, jsonb, boolean),
  public.transition_question_version(uuid, uuid, text, text),
  public.eligible_questions(public.game_type, text, uuid),
  public.allocate_question_set(uuid, public.game_type, text),
  public.record_question_displayed(uuid, uuid),
  public.mark_competition_answers_disclosed(uuid),
  public.confirm_disclosed_questions(uuid, uuid, uuid[], text),
  public.question_bank_readiness(text, uuid, int, int, int),
  public.question_content_problems(public.question_type, int, jsonb, jsonb)
to service_role;
