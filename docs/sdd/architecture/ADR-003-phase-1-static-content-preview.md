# ADR-003: Phase 1 Static Content Preview Runtime

Status: Accepted for the Phase 1 public preview
Date: 2026-08-19
Scope: Public dossier, cause-map and evidence-matrix reads only

## Context

ADR-001 selects Supabase PostgreSQL and RLS as the production content authority. Phase 1 also needs a deployable public vertical slice while the workstation has no Docker or Podman runtime and no production Supabase project is configured. The public slice is immutable at runtime, contains no roster, authentication, attempt, score, timer or leaderboard mutation, and already has an approved structured seed package.

Silently replacing the database contract would violate the project Constitution. The preview therefore needs an explicit temporary boundary that preserves the final Supabase architecture and keeps the versioned SDD content package as the source of truth.

## Decision

- Canonical authored content is split across `docs/sdd/content/sources.json`, 15 ordered files under `docs/sdd/content/dossiers`, `docs/sdd/content/causal-links.json` and `docs/sdd/content/publication-manifest.json`.
- `scripts/build-content-catalog.mjs` validates cross-file publication boundaries, hydrates source references and writes `web/src/generated/content-catalog.json` before each production build.
- Existing Published dossiers 02, 06 and 13 are protected by `legacy-baseline` manifest fingerprints tied to commit `6c918ce432e7fd7c3c1f6c697a180564fb08b935`; the manifest does not assert human academic review.
- New academic content may exist in the generated internal catalogue as Draft, but `local-content.ts` and public API/UI repositories expose only dossiers whose status is Published and whose structured experience is present.
- `scripts/generate-content-seed.mjs` derives the future SQL seed from the same generated catalogue without assigning review timestamps to legacy baseline content or Drafts.
- The Supabase migration, canonical seed generator and pgTAP tests remain the target database contract. They are not represented as runtime-verified until `supabase db reset` and `supabase test db` run successfully.
- This preview path SHALL NOT be used to implement authentication, attempts, timers, answers, scores, ranks, publication mutations or any other Core state.

## Consequences

### Positive

- The public preview builds and deploys without production secrets or a database dependency.
- The website, generated runtime content, review pack and future SQL seed derive from the same versioned SDD package.
- Draft dossiers remain available for internal validation and human review while staying absent from the public catalogue, API and direct routes.
- Publication evidence and canonical content are separate, so AI-authored Draft data cannot become public by adding content fields alone.

### Limitations

- The public preview is not evidence that RLS policies execute correctly in PostgreSQL.
- Content changes require a new build and deployment; there is no runtime publishing workflow or human-review administration yet.
- Phase 3 identity and all Phase 4-5 game behavior still require Supabase as the authoritative runtime.

## Exit Criteria

Before any protected feature or runtime content publication is released:

1. configure an isolated Supabase environment;
2. run migrations, seed and pgTAP tests successfully;
3. switch protected and mutable repositories to server-authoritative Supabase access;
4. retain or replace this build-time projection only through a reviewed ADR.
