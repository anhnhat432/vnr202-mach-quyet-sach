# ADR-003: Phase 1 Static Content Preview Runtime

Status: Accepted for the Phase 1 public preview
Date: 2026-08-19
Scope: Public dossier, cause-map and evidence-matrix reads only

## Context

ADR-001 selects Supabase PostgreSQL and RLS as the production content authority. Phase 1 also needs a deployable public vertical slice while the workstation has no Docker or Podman runtime and no production Supabase project is configured. The public slice is immutable at runtime, contains no roster, authentication, attempt, score, timer or leaderboard mutation, and already has an approved structured seed package.

Silently replacing the database contract would violate the project Constitution. The preview therefore needs an explicit temporary boundary that preserves the final Supabase architecture and keeps the approved SDD content package as the source of truth.

## Decision

- `docs/sdd/content/phase-1-seed.json` remains the authored Phase 1 content source of truth.
- `scripts/sync-web-content.mjs` validates that the source is JSON and copies it to `web/src/generated/phase-1-seed.json` before each production build.
- Public Phase 1 routes read the generated projection through `local-content.ts` and expose only the three Published dossiers and Verified sources.
- The Supabase migration, seed generator and pgTAP tests remain the target database contract. They are not represented as runtime-verified until `supabase db reset` and `supabase test db` run successfully.
- This preview path SHALL NOT be used to implement authentication, attempts, timers, answers, scores, ranks, publication mutations or any other Core state.

## Consequences

### Positive

- The public preview builds and deploys without production secrets or a database dependency.
- The website, generated runtime content and future SQL seed derive from the same versioned SDD package.
- Draft dossiers and Pending sources remain absent from the deployed projection.

### Limitations

- The public preview is not evidence that RLS policies execute correctly in PostgreSQL.
- Content changes require a new build and deployment; there is no runtime publishing workflow.
- Phase 3 identity and all Phase 4-5 game behavior still require Supabase as the authoritative runtime.

## Exit Criteria

Before any protected feature or runtime content publication is released:

1. configure an isolated Supabase environment;
2. run migrations, seed and pgTAP tests successfully;
3. switch protected and mutable repositories to server-authoritative Supabase access;
4. retain or replace this build-time projection only through a reviewed ADR.
