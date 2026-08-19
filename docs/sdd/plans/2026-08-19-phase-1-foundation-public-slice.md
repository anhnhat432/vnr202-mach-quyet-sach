# Phase 1 Foundation and Public Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tested Next.js/Supabase foundation and a public vertical slice containing the app shell, three Published representative dossiers, Scenario Engine, cause map and evidence matrix.

**Architecture:** The Next.js application lives in `web/`; project specifications and Supabase migrations remain at repository root. Server Components read Published content through a server Supabase client. Structured content is validated by Zod before rendering. Anonymous clients have read-only RLS access to verified public content; all future Core mutations remain server-only.

**Tech Stack:** Node 22.14+, Next.js 16.3.1, React 19.2.8, TypeScript 7.0.2, Tailwind CSS 4.3.3, Supabase JS 2.112.3, `@supabase/ssr` 0.12.4, Zod 4.4.3, Vitest 4.1.11, Playwright 1.62.1.

## Global Constraints

- Phase starts only after `T006` Figma handoff records token/component names.
- Exactly 15 planned dossier metadata records exist; only three fully reviewed records are Published in this phase.
- Anonymous queries return only Published dossier versions and Verified sources.
- No raw HTML, score, timer, roster, auth or competition behavior is added in this phase.
- User-facing Vietnamese copy is meaningful; no lorem ipsum.
- Desktop 1440 and mobile 390 are first-class; reduced motion is implemented from the first shell.
- Every change follows TDD and ends with an independently testable commit.

---

## Planned File Map

```text
web/
  src/app/
    layout.tsx
    page.tsx
    globals.css
    ho-so/page.tsx
    ho-so/[slug]/page.tsx
    mach-nguyen-nhan/page.tsx
    ma-tran-bang-chung/page.tsx
    api/v1/dossiers/route.ts
  src/features/content/
    contracts/dossier.ts
    domain/build-dossier-catalog.ts
    server/dossier-repository.ts
    ui/dossier-card.tsx
    ui/scenario-engine.tsx
    ui/cause-map.tsx
    ui/evidence-matrix.tsx
  src/lib/api/
    errors.ts
    response.ts
    request-id.ts
  src/lib/supabase/
    browser.ts
    server.ts
  tests/unit/
  tests/e2e/
supabase/
  migrations/202608190001_public_content.sql
  seed.sql
  tests/public_content_rls.sql
.github/workflows/ci.yml
```

### Task 1: Repository and Next.js Scaffold

**Files:**
- Create: `.gitignore`
- Create: `.nvmrc`
- Create: `.env.example`
- Create: `README.md`
- Generate: `web/**`

**Interfaces:**
- Produces: a Next.js application invoked through `npm --prefix web run <script>`.
- Produces: environment names consumed by `src/lib/supabase/*`.

- [ ] **Step 1: Initialize Git and write root safety files**

Run:

```powershell
git init
```

Create `.gitignore` with:

```gitignore
web/node_modules/
web/.next/
web/playwright-report/
web/test-results/
web/coverage/
.env
.env.*
!.env.example
supabase/.branches/
supabase/.temp/
*.log
course_materials/
analysis/course_corpus.json
roster*.csv
```

Create `.nvmrc`:

```text
22.14.0
```

Create `.env.example`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=public-anon-key
SUPABASE_SERVICE_ROLE_KEY=server-only-service-role-key
CSRF_SIGNING_SECRET=replace-with-at-least-32-random-bytes
CRON_SECRET=replace-with-at-least-32-random-bytes
INTERNAL_AUTH_EMAIL_DOMAIN=auth.invalid
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 2: Generate the app without touching root documentation**

Run:

```powershell
npx create-next-app@16.3.1 web --typescript --eslint --tailwind --app --src-dir --import-alias "@/*" --use-npm --yes
```

Expected: `web/package.json` pins Next `16.3.1` and React `19.2.8`; `npm --prefix web run dev` can start the default page.

- [ ] **Step 3: Pin Phase 1 dependencies**

Run:

```powershell
npm --prefix web install @supabase/supabase-js@2.112.3 @supabase/ssr@0.12.4 zod@4.4.3 clsx@2.1.1 motion@13.1.0 lucide-react@1.32.0
npm --prefix web install --save-dev vitest@4.1.11 jsdom@30.0.1 @vitejs/plugin-react@6.0.5 @testing-library/react@16.3.2 @testing-library/jest-dom@7.0.1 @playwright/test@1.62.1 @axe-core/playwright@4.13.0
```

Expected: lockfile changes only under `web/package-lock.json`; no install error.

- [ ] **Step 4: Replace the generated README with project commands**

Create `README.md`:

```markdown
# VNR202 - Mạch Quyết Sách

## Commands

- `npm --prefix web run dev`
- `npm --prefix web run lint`
- `npm --prefix web run typecheck`
- `npm --prefix web run test`
- `npm --prefix web run test:e2e`
- `npm --prefix web run build`
- `npx supabase@2.115.0 start`
- `npx supabase@2.115.0 db reset`

Read `AGENTS.md` and `docs/sdd/CONSTITUTION.md` before changing Core behavior.
```

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm --prefix web run lint
npm --prefix web run build
git add .gitignore .nvmrc .env.example README.md web
git commit -m "chore: scaffold VNR202 web application"
```

Expected: lint/build PASS and one initial commit.

### Task 2: Test Harness and CI

**Files:**
- Create: `web/vitest.config.ts`
- Create: `web/vitest.setup.ts`
- Create: `web/tests/unit/smoke.test.ts`
- Create: `web/playwright.config.ts`
- Create: `web/tests/e2e/home.spec.ts`
- Modify: `web/package.json`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces scripts: `typecheck`, `test`, `test:watch`, `test:e2e`.
- Produces `@/*` alias support in Vitest.

- [ ] **Step 1: Write the failing unit smoke test**

Create `web/tests/unit/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { PROJECT_NAME } from "@/lib/project";

describe("project foundation", () => {
  it("exposes the approved project name", () => {
    expect(PROJECT_NAME).toBe("VNR202 - Mạch Quyết Sách");
  });
});
```

- [ ] **Step 2: Configure Vitest and verify the test fails**

Create `web/vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    coverage: { reporter: ["text", "json", "html"] },
  },
});
```

Create `web/vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Add scripts to `web/package.json`:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

Run:

```powershell
npm --prefix web run test
```

Expected: FAIL because `src/lib/project.ts` does not exist.

- [ ] **Step 3: Add the minimal project module**

Create `web/src/lib/project.ts`:

```ts
export const PROJECT_NAME = "VNR202 - Mạch Quyết Sách" as const;
```

Run `npm --prefix web run test` and expect PASS.

- [ ] **Step 4: Add browser smoke and accessibility test**

Create `web/playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
```

Create `web/tests/e2e/home.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("homepage identifies the product and has no serious axe violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Mạch Quyết Sách");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
});
```

- [ ] **Step 5: Add CI**

Create `.github/workflows/ci.yml`:

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  web:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22.14.0
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build
```

Run lint/typecheck/test/build, then commit:

```powershell
git add web .github/workflows/ci.yml
git commit -m "test: add web quality gates"
```

### Task 3: Public Content Database and RLS

**Files:**
- Generate: `supabase/config.toml`
- Create: `supabase/migrations/202608190001_public_content.sql`
- Create: `supabase/tests/public_content_rls.sql`
- Create: `scripts/generate-phase1-seed.mjs`
- Generate: `supabase/seed.sql`

**Interfaces:**
- Produces tables: `sources`, `dossiers`, `dossier_versions`, `claims`, `claim_source_links`, `causal_nodes`, `causal_edges`.
- Produces public read contract: only Verified sources and current Published dossier versions.

- [ ] **Step 1: Initialize Supabase**

Run:

```powershell
npx supabase@2.115.0 init
```

Expected: `supabase/config.toml` exists; no remote project is linked.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/202608190001_public_content.sql`:

```sql
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
using (exists (select 1 from public.claims c where c.id = claim_source_links.claim_id));

create policy causal_nodes_public_read on public.causal_nodes for select to anon, authenticated
using (exists (
  select 1 from public.dossiers d
  where d.current_version_id = causal_nodes.dossier_version_id and d.status = 'published'
));

create policy causal_edges_public_read on public.causal_edges for select to anon, authenticated
using (
  exists (select 1 from public.causal_nodes n where n.id = causal_edges.source_node_id)
  and exists (select 1 from public.causal_nodes n where n.id = causal_edges.target_node_id)
);

grant select on public.sources, public.dossiers, public.dossier_versions,
  public.claims, public.claim_source_links, public.causal_nodes, public.causal_edges
  to anon, authenticated;
```

- [ ] **Step 3: Write RLS tests before seed**

Create `supabase/tests/public_content_rls.sql` using pgTAP:

```sql
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
```

Run `npx supabase@2.115.0 db reset` and `npx supabase@2.115.0 test db`. Expected: four tests PASS.

- [ ] **Step 4: Seed 15 planned metadata and three Published versions**

Use the approved, exact content package `docs/sdd/content/phase-1-seed.json`. Create `scripts/generate-phase1-seed.mjs`:

```js
import fs from "node:fs";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) throw new Error("usage: node generate-phase1-seed.mjs <input.json> <output.sql>");

const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const nullable = (value) => (value === null || value === undefined ? "null" : quote(value));
const jsonb = (value) => `${quote(JSON.stringify(value))}::jsonb`;
const derivedId = (prefix, value) => `${prefix}-0000-0000-0000-${String(value).padStart(12, "0")}`;
const sql = ["begin;"];

for (const source of data.sources) {
  sql.push(`insert into public.sources
    (id, title, author_or_issuer, publication_year, locator, url, source_type, rights_note, verification_status)
    values (${quote(source.id)}, ${quote(source.title)}, ${quote(source.authorOrIssuer)}, ${source.publicationYear},
      ${quote(source.locator)}, ${nullable(source.url)}, ${quote(source.sourceType)}, ${quote(source.rightsNote)},
      ${quote(source.verificationStatus)});`);
}

for (const dossier of data.dossiers) {
  sql.push(`insert into public.dossiers
    (id, slug, chapter, order_index, title, central_question, status)
    values (${quote(dossier.id)}, ${quote(dossier.slug)}, ${quote(dossier.chapter)}, ${dossier.orderIndex},
      ${quote(dossier.title)}, ${quote(dossier.centralQuestion)}, ${quote(dossier.status)});`);

  if (!dossier.experience) continue;
  sql.push(`insert into public.dossier_versions
    (id, dossier_id, version, schema_version, content, reviewed_at, published_at)
    values (${quote(dossier.versionId)}, ${quote(dossier.id)}, 1, 1, ${jsonb(dossier.experience)}, now(), now());`);
  sql.push(`update public.dossiers set current_version_id = ${quote(dossier.versionId)}, updated_at = now()
    where id = ${quote(dossier.id)};`);

  const comparison = dossier.experience.historicalComparison;
  const claimSpecs = [
    ["context", dossier.experience.briefing.context[0]],
    ["basis", dossier.experience.briefing.centralContradiction],
    ["implementation", comparison.implementation[0]],
    ["result", comparison.results[0]],
    ["limitation", comparison.limitations[0]],
    ["lesson", dossier.experience.lessons[0]],
  ];
  const claimIds = [];
  claimSpecs.forEach(([category, statement], index) => {
    const claimId = derivedId("40000000", dossier.orderIndex * 10 + index + 1);
    claimIds.push(claimId);
    sql.push(`insert into public.claims (id, dossier_version_id, category, statement)
      values (${quote(claimId)}, ${quote(dossier.versionId)}, ${quote(category)}, ${quote(statement)});`);
    const sourceId = dossier.experience.sources[index % dossier.experience.sources.length].id;
    sql.push(`insert into public.claim_source_links (claim_id, source_id, support_scope)
      values (${quote(claimId)}, ${quote(sourceId)}, ${quote(`Hỗ trợ luận điểm ${category} trong hồ sơ ${dossier.title}.`)});`);
  });

  const nodes = [
    ["context", dossier.experience.briefing.context[0]],
    ["contradiction", dossier.experience.briefing.centralContradiction],
    ["decision", comparison.actualDecision],
    ["result", comparison.results[0]],
    ["lesson", dossier.experience.lessons[0]],
  ];
  const nodeIds = nodes.map(([, label], index) => {
    const nodeId = derivedId("50000000", dossier.orderIndex * 10 + index + 1);
    sql.push(`insert into public.causal_nodes
      (id, dossier_version_id, lane, label, explanation, sort_index)
      values (${quote(nodeId)}, ${quote(dossier.versionId)}, ${quote(nodes[index][0])}, ${quote(label)}, ${quote(label)}, ${index + 1});`);
    return nodeId;
  });
  const edgeSpecs = [
    [0, 1, "condition", claimIds[0]],
    [1, 2, "response", claimIds[1]],
    [2, 3, "outcome", claimIds[3]],
    [3, 4, "lesson", claimIds[5]],
  ];
  edgeSpecs.forEach(([from, to, relation, claimId], index) => {
    sql.push(`insert into public.causal_edges
      (id, source_node_id, target_node_id, relation, explanation, claim_id)
      values (${quote(derivedId("60000000", dossier.orderIndex * 10 + index + 1))}, ${quote(nodeIds[from])},
        ${quote(nodeIds[to])}, ${quote(relation)}, ${quote(nodes[to][1])}, ${quote(claimId)});`);
  });
}

sql.push(`do $$
declare planned_count int; published_count int;
begin
  select count(*) into planned_count from public.dossiers;
  select count(*) into published_count from public.dossiers where status = 'published';
  if planned_count <> 15 then raise exception 'expected 15 planned dossiers, got %', planned_count; end if;
  if published_count <> 3 then raise exception 'expected 3 phase-one published dossiers, got %', published_count; end if;
end $$;`);
sql.push("commit;");
fs.writeFileSync(outputPath, `${sql.join("\n\n")}\n`, "utf8");
```

Generate the SQL:

```powershell
node .\scripts\generate-phase1-seed.mjs .\docs\sdd\content\phase-1-seed.json .\supabase\seed.sql
```

Run reset/test again and commit:

```powershell
git add supabase scripts/generate-phase1-seed.mjs docs/sdd/content/phase-1-seed.json
git commit -m "feat: add source-backed public content schema"
```

### Task 4: Environment, Supabase Clients and API Envelope

**Files:**
- Create: `web/src/lib/config/env.ts`
- Create: `web/src/lib/supabase/browser.ts`
- Create: `web/src/lib/supabase/server.ts`
- Create: `web/src/lib/api/errors.ts`
- Create: `web/src/lib/api/request-id.ts`
- Create: `web/src/lib/api/response.ts`
- Create: `web/tests/unit/api-response.test.ts`

**Interfaces:**
- Produces: `getPublicEnv()`, `createBrowserClient()`, `createServerClient()`.
- Produces: `ok(data, requestId, init?)`, `fail(error, requestId, init?)`.

- [ ] **Step 1: Write API envelope tests**

Create `web/tests/unit/api-response.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { fail, ok } from "@/lib/api/response";

describe("API response envelope", () => {
  it("wraps success with request ID", async () => {
    const response = ok({ value: 1 }, "req-1");
    expect(await response.json()).toEqual({ data: { value: 1 }, meta: { requestId: "req-1" } });
  });

  it("does not expose internal error details", async () => {
    const response = fail(new ApiError(422, "validation_error", "Yêu cầu không hợp lệ."), "req-2");
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: { code: "validation_error", message: "Yêu cầu không hợp lệ." },
      meta: { requestId: "req-2" },
    });
  });
});
```

Run test and expect FAIL because modules do not exist.

- [ ] **Step 2: Implement environment validation**

Create `web/src/lib/config/env.ts`:

```ts
import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.url(),
});

export function getPublicEnv() {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
}
```

- [ ] **Step 3: Implement Supabase clients**

Create `web/src/lib/supabase/browser.ts`:

```ts
import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/config/env";

export function createBrowserClient() {
  const env = getPublicEnv();
  return createSupabaseBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
```

Create `web/src/lib/supabase/server.ts`:

```ts
import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/lib/config/env";

export async function createServerClient() {
  const env = getPublicEnv();
  const cookieStore = await cookies();
  return createSupabaseServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot always set cookies; route handlers refresh sessions.
        }
      },
    },
  });
}
```

- [ ] **Step 4: Implement errors and envelope**

Create `web/src/lib/api/errors.ts`:

```ts
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Array<{ field: string; code: string; message: string }>,
  ) {
    super(message);
  }
}
```

Create `web/src/lib/api/request-id.ts`:

```ts
export function requestIdFrom(request: Request): string {
  const candidate = request.headers.get("x-request-id");
  return candidate && /^[0-9a-f-]{36}$/i.test(candidate) ? candidate : crypto.randomUUID();
}
```

Create `web/src/lib/api/response.ts`:

```ts
import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/errors";

export function ok<T>(data: T, requestId: string, init: ResponseInit = {}) {
  return NextResponse.json({ data, meta: { requestId } }, init);
}

export function fail(error: ApiError, requestId: string, init: ResponseInit = {}) {
  return NextResponse.json(
    {
      error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
      meta: { requestId },
    },
    { ...init, status: error.status },
  );
}
```

Run unit tests, typecheck and commit.

### Task 5: Content Contracts and Repository

**Files:**
- Create: `web/src/features/content/contracts/dossier.ts`
- Create: `web/src/features/content/server/dossier-repository.ts`
- Create: `web/tests/unit/dossier-contract.test.ts`
- Create: `web/src/app/api/v1/dossiers/route.ts`

**Interfaces:**
- Produces: `DossierSummary`, `DossierExperience`, `listPublishedDossiers()`, `getPublishedDossierBySlug(slug)`.

- [ ] **Step 1: Write contract validation tests**

Create `web/tests/unit/dossier-contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { dossierExperienceSchema } from "@/features/content/contracts/dossier";

describe("dossier experience schema", () => {
  it("requires all six experience stages", () => {
    const parsed = dossierExperienceSchema.safeParse({ title: "Thiếu dữ liệu" });
    expect(parsed.success).toBe(false);
  });
});
```

- [ ] **Step 2: Implement the schema**

Create `web/src/features/content/contracts/dossier.ts`:

```ts
import { z } from "zod";

export const chapterSchema = z.enum(["chapter_1", "chapter_2", "chapter_3"]);

const sourceSchema = z.object({
  id: z.uuid(),
  title: z.string().min(2),
  authorOrIssuer: z.string().min(2),
  locator: z.string(),
  url: z.url().nullable(),
});

const evidenceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(2),
  kind: z.enum(["document", "event", "data", "map", "quotation", "assessment"]),
  summary: z.string().min(10),
  sourceIds: z.array(z.uuid()).min(1),
  isDistractor: z.boolean().default(false),
});

export const dossierExperienceSchema = z.object({
  briefing: z.object({
    period: z.string().min(2),
    context: z.array(z.string().min(5)).min(2),
    centralContradiction: z.string().min(10),
    objective: z.string().min(10),
    constraints: z.array(z.string().min(5)).min(2),
  }),
  evidence: z.array(evidenceSchema).min(4),
  decision: z.object({
    prompt: z.string().min(10),
    requiredEvidenceCount: z.number().int().min(1).max(6),
    options: z.array(z.object({ id: z.string(), label: z.string(), rationale: z.string() })).min(2),
  }),
  projectedConsequences: z.array(z.object({ optionId: z.string(), steps: z.array(z.string()).min(2) })).min(2),
  historicalComparison: z.object({
    actualDecision: z.string().min(10),
    implementation: z.array(z.string().min(5)).min(1),
    results: z.array(z.string().min(5)).min(1),
    limitations: z.array(z.string().min(5)).min(1),
  }),
  lessons: z.array(z.string().min(5)).min(1),
  sources: z.array(sourceSchema).min(1),
});

export type DossierExperience = z.infer<typeof dossierExperienceSchema>;

export type DossierSummary = {
  id: string;
  slug: string;
  chapter: z.infer<typeof chapterSchema>;
  orderIndex: number;
  title: string;
  centralQuestion: string;
};
```

- [ ] **Step 3: Implement the server repository**

Create `web/src/features/content/server/dossier-repository.ts`:

```ts
import "server-only";

import { notFound } from "next/navigation";

import { dossierExperienceSchema, type DossierSummary } from "@/features/content/contracts/dossier";
import { createServerClient } from "@/lib/supabase/server";

export async function listPublishedDossiers(): Promise<DossierSummary[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("dossiers")
    .select("id, slug, chapter, order_index, title, central_question")
    .eq("status", "published")
    .order("chapter")
    .order("order_index");
  if (error) throw new Error("Không thể tải danh mục hồ sơ.");
  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    chapter: row.chapter,
    orderIndex: row.order_index,
    title: row.title,
    centralQuestion: row.central_question,
  }));
}

export async function getPublishedDossierBySlug(slug: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("dossiers")
    .select("id, slug, chapter, order_index, title, central_question, dossier_versions!dossiers_current_version_fk(content)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error("Không thể tải hồ sơ.");
  if (!data) notFound();
  const version = Array.isArray(data.dossier_versions) ? data.dossier_versions[0] : data.dossier_versions;
  return { ...data, experience: dossierExperienceSchema.parse(version.content) };
}
```

- [ ] **Step 4: Implement the versioned GET endpoint**

Create `web/src/app/api/v1/dossiers/route.ts`:

```ts
import { listPublishedDossiers } from "@/features/content/server/dossier-repository";
import { ok } from "@/lib/api/response";
import { requestIdFrom } from "@/lib/api/request-id";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  return ok(await listPublishedDossiers(), requestId, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
```

Run tests/typecheck and commit.

### Task 6: Figma Tokens and Responsive App Shell

**Files:**
- Modify: `web/src/app/globals.css`
- Modify: `web/src/app/layout.tsx`
- Create: `web/src/components/site-header.tsx`
- Create: `web/src/components/site-footer.tsx`
- Create: `web/tests/unit/site-shell.test.tsx`

**Interfaces:**
- Produces CSS custom properties: `--paper`, `--ink`, `--command-red`, `--signal-amber`, `--evidence-teal`, `--night-panel`.
- Produces landmarks and navigation reused by all public pages.

- [ ] **Step 1: Write the shell test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "@/components/site-header";

describe("SiteHeader", () => {
  it("exposes the three main public experiences", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Hồ sơ" })).toHaveAttribute("href", "/ho-so");
    expect(screen.getByRole("link", { name: "Mạch nguyên nhân" })).toHaveAttribute("href", "/mach-nguyen-nhan");
    expect(screen.getByRole("link", { name: "Bằng chứng" })).toHaveAttribute("href", "/ma-tran-bang-chung");
  });
});
```

- [ ] **Step 2: Implement approved tokens**

In `globals.css`, define:

```css
:root {
  --paper: #f3ebdd;
  --ink: #14212b;
  --command-red: #b1282e;
  --signal-amber: #d6922e;
  --evidence-teal: #0d6b66;
  --night-panel: #182126;
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --content-max: 80rem;
}

html { background: var(--paper); color: var(--ink); }
body {
  min-height: 100vh;
  background:
    linear-gradient(rgba(20, 33, 43, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(20, 33, 43, 0.045) 1px, transparent 1px),
    var(--paper);
  background-size: 32px 32px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Implement semantic header/footer and fonts**

Use `next/font/google` with `Saira_Condensed` and `Be_Vietnam_Pro`. `layout.tsx` must render skip link, header, main and footer. Header mobile control has `aria-expanded` and keyboard focus styles. Do not use a dark full-page theme.

- [ ] **Step 4: Match Figma handoff screenshots**

At 1440 and 390 widths, compare header, grid, typography and color tokens to Figma. Record screenshot paths under `docs/sdd/evidence/phase-1/`.

Run unit/E2E tests and commit.

### Task 7: Homepage, Catalogue and Scenario Engine

**Files:**
- Modify: `web/src/app/page.tsx`
- Create: `web/src/app/ho-so/page.tsx`
- Create: `web/src/app/ho-so/[slug]/page.tsx`
- Create: `web/src/features/content/ui/dossier-card.tsx`
- Create: `web/src/features/content/ui/scenario-engine.tsx`
- Create: `web/tests/e2e/public-dossier.spec.ts`

**Interfaces:**
- `DossierCard({ dossier: DossierSummary })`.
- `ScenarioEngine({ dossierId, experience })` manages local six-stage progress only.

- [ ] **Step 1: Write failing E2E flow**

```ts
import { expect, test } from "@playwright/test";

test("visitor completes a published dossier and reaches historical comparison", async ({ page }) => {
  await page.goto("/ho-so");
  await page.getByRole("link", { name: /Hợp nhất để mở đường/ }).click();
  await page.getByRole("button", { name: "Mở phòng dữ kiện" }).click();
  await page.getByRole("button", { name: /Chọn dữ kiện/ }).first().click();
  await page.getByRole("button", { name: "Đi tới bàn quyết sách" }).click();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Phân tích hệ quả" }).click();
  await page.getByRole("button", { name: "Đối chiếu lịch sử" }).click();
  await expect(page.getByRole("heading", { name: "Lịch sử thực tế" })).toBeVisible();
});
```

- [ ] **Step 2: Implement catalogue page**

`/ho-so` calls `listPublishedDossiers`, groups by chapter and renders only the three Published rows. The page also states `3/15 hồ sơ đã hoàn thiện trong bản dựng hiện tại`; this copy is development-only and must be removed when Phase 2 publishes all 15.

- [ ] **Step 3: Implement the Scenario Engine state machine**

Use this finite state union:

```ts
type ScenarioStage = "briefing" | "evidence" | "decision" | "consequences" | "comparison" | "connections";
```

The client component stores selected evidence IDs and decision ID in React state. It never claims the projected consequence is certain. It exposes one primary action per stage and supports keyboard selection. Completion writes only localStorage key `vnr202:dossier:<id>:v1`; authenticated sync is Phase 3.

- [ ] **Step 4: Implement route metadata and 404**

`/ho-so/[slug]` fetches via `getPublishedDossierBySlug`. Draft slugs return Next.js 404 because RLS/repository cannot retrieve them.

- [ ] **Step 5: Run desktop/mobile E2E and commit**

Expected: the same flow passes in both Playwright projects and serious/critical axe violations are empty.

### Task 8: Cause Map, Evidence Matrix and Phase Gate

**Files:**
- Create: `web/src/app/mach-nguyen-nhan/page.tsx`
- Create: `web/src/app/ma-tran-bang-chung/page.tsx`
- Create: `web/src/features/content/ui/cause-map.tsx`
- Create: `web/src/features/content/ui/evidence-matrix.tsx`
- Create: `web/tests/e2e/public-evidence.spec.ts`
- Modify: `docs/sdd/traceability-matrix.md`
- Create: `docs/sdd/evidence/phase-1/README.md`

**Interfaces:**
- Cause map consumes `causal_nodes` and `causal_edges` already filtered by RLS.
- Evidence matrix consumes claims, links and Verified sources.

- [ ] **Step 1: Write navigation tests**

```ts
import { expect, test } from "@playwright/test";

test("cause node and evidence claim trace back to source-backed dossier", async ({ page }) => {
  await page.goto("/mach-nguyen-nhan");
  await page.getByRole("button", { name: /Hợp nhất các tổ chức/ }).click();
  await expect(page.getByText(/Quan hệ/)).toBeVisible();
  await page.getByRole("link", { name: "Mở hồ sơ" }).click();
  await expect(page).toHaveURL(/\/ho-so\//);

  await page.goto("/ma-tran-bang-chung");
  await page.getByRole("button", { name: /Xem nguồn/ }).first().click();
  await expect(page.getByText(/Tác giả|Cơ quan/)).toBeVisible();
});
```

- [ ] **Step 2: Implement desktop and mobile cause map**

Desktop renders six horizontal lanes. Mobile renders a selected-node slice as cards and never shrinks a canvas. Each edge has relation label and explanation. Use semantic buttons/list elements; SVG lines are `aria-hidden` because textual relations are present.

- [ ] **Step 3: Implement evidence matrix**

Rows are claims; columns are the six approved categories. Source drawer includes title, issuer, year, locator, HTTPS URL and support scope. Never show a Pending source.

- [ ] **Step 4: Run the complete Phase 1 gate**

Run:

```powershell
npx supabase@2.115.0 db reset
npx supabase@2.115.0 test db
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web run test
npm --prefix web run test:e2e
npm --prefix web run build
```

Expected: every command PASS.

- [ ] **Step 5: Record evidence and close traceability rows**

Create `docs/sdd/evidence/phase-1/README.md` listing command, timestamp, result, screenshots and remaining Phase 2 gaps. Update UX-AC-001/003/004/005/006/011/012 rows to `Partial` with exact tests; do not mark UX-AC-002 complete until all 15 are Published.

- [ ] **Step 6: Commit the vertical slice**

```powershell
git add web supabase docs/sdd/evidence/phase-1 docs/sdd/traceability-matrix.md
git commit -m "feat: deliver public decision dossier vertical slice"
```

## Phase 1 Self-Review Checklist

- All eight tasks map to `T010`-`T019`.
- No Phase 3 authentication or Phase 4 gameplay rule is implemented early.
- Public RLS hides Draft dossiers and Pending sources.
- The public vertical slice contains one complete dossier per chapter.
- UI uses approved token values and has reduced-motion behavior.
- Unit, RLS, E2E, accessibility and build evidence are recorded.
- UX-AC-002 remains Planned until Phase 2 publishes all 15 dossiers.
