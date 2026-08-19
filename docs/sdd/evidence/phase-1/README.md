# Phase 1 Foundation and Public Slice Evidence

Date: 2026-08-19 (Asia/Saigon)
Method: Hybrid SDD+ADD; Full Core contracts and Standard/Light public Shell
Status: Web gate PASS; Supabase runtime gate BLOCKED; Phase 1 overall remains partial

## Delivered Slice

- Next.js 16.3.1 and React 19.2.8 public application with Vietnamese responsive design derived from Figma Make.
- Public routes: `/`, `/ho-so`, `/ho-so/[slug]`, `/mach-nguyen-nhan`, `/ma-tran-bang-chung`, `/phong-phuong-phap`, `/nguon-va-ai`, `/live-arena`, `/dang-nhap` and `/api/v1/dossiers`.
- Exactly 15 planned dossier metadata records, five per chapter; three source-backed Published dossiers power the Phase 1 vertical slice.
- One shared six-stage Scenario Engine, a six-lane cause map with mobile Slice mode and a source-detail evidence matrix.
- Live Arena and sign-in pages are explicit previews. They do not claim authentication, one-attempt enforcement, scoring, timers or realtime behavior is implemented.

## Design Evidence

- Figma Make Version 5: `https://www.figma.com/make/W6ZmtodyEVSDKQEdWyAqMk/VNR202---Mach-Quyet-Sach`
- Figma Design file: `https://www.figma.com/design/sazgk1wXpc6X80BuqOSAV9`
- Editable captures: Kho Ho so `6:2`, Mach Nguyen Nhan `5:2`, Ma tran `7:2`, Live Arena `4:2`.
- Local screenshots:
  - `home-desktop.png`
  - `home-mobile.png`
  - `dossier-desktop.png`
  - `cause-mobile.png`
  - `figma-foundations.png`

Homepage and dossier Design captures remained in Figma processing after repeated polling. Projector, admin, mobile-state and motion pages are not treated as complete handoff evidence.

## L1 - Automated Evidence

Executed from `C:\VNR202` on 2026-08-19:

| Command | Result |
| --- | --- |
| `npm --prefix web run lint` | PASS; ESLint exit 0 |
| `npm --prefix web run typecheck` | PASS; TypeScript exit 0 |
| `npm --prefix web run test` | PASS; 7 files and 11 tests |
| `npm --prefix web run test:e2e` | PASS; 10 tests across desktop and mobile Chromium |
| `npm --prefix web run build` | PASS; 12 routes generated/registered by Next.js |
| `npm --prefix web audit --audit-level=high` | PASS; 0 vulnerabilities |

The E2E suite demonstrates homepage accessibility, the security-header contract, a complete six-stage dossier flow, saved-progress resume without a hydration mismatch, cause-map navigation and evidence-source inspection on desktop and mobile.

### Supabase Runtime Blocker

| Command | Result |
| --- | --- |
| `npx --yes supabase@2.115.0 db reset` | BLOCKED; `LegacyLocalDbRunningError: failed to inspect service` |
| `npx --yes supabase@2.115.0 status --debug` | Confirms `docker: command not found (podman also not found)` |
| `npx --yes supabase@2.115.0 test db` | BLOCKED; connection refused at `127.0.0.1:54322` |

The Vitest migration contract confirms RLS is enabled on all seven public tables and publication filters exist. This static evidence does not replace a PostgreSQL migration or pgTAP runtime pass.

## L2 - Specification Compliance

- PASS for Phase 1 scope: content tests validate 15 planned dossiers, exactly five per chapter and one Published vertical-slice dossier per chapter.
- PASS for the implemented Scenario Engine: desktop and mobile users reach the historical comparison through all six stages.
- PASS for implemented knowledge navigation: cause relationships open the related dossier and evidence claims open Verified source details.
- PARTIAL for `UX-AC-002`: only three of the required 15 dossiers are Published; the remaining 12 belong to Phase 2.
- PARTIAL for `UX-AC-011`: reduced-motion CSS exists, but the dedicated OS-level motion walkthrough remains pending.
- BLOCKED for runtime `UX-AC-012` RLS evidence until the Supabase container test gate can run.

## L3 - Constitution and Safety

- Public runtime content is generated from `docs/sdd/content/phase-1-seed.json`; ADR-003 records this temporary read-only preview boundary.
- The public projection filters to Published dossiers and Verified sources and renders no raw HTML.
- Browser responses include CSP, `frame-ancestors 'none'`, `X-Content-Type-Options`, strict referrer policy, permissions policy and production HSTS.
- Repository secret scanning found only documented placeholders and specification references; no real roster, password, token or service-role credential was found.
- No Core attempt, timing, scoring, ranking, auth or publication mutation is implemented client-side.

## L4 - Acceptance Evidence

- Desktop and mobile Chromium: anonymous homepage and navigation are usable without login.
- Desktop and mobile Chromium: a visitor completes the representative dossier and reaches `Lich su thuc te`.
- Desktop: the six-lane cause map exposes a textual relationship and opens the linked dossier.
- Mobile: the cause map uses a selectable Slice instead of a shrunken canvas.
- Desktop and mobile Chromium: an evidence claim opens issuer/author source details.
- Serious and critical axe violations on the homepage: zero in the automated run.

## Remaining Gaps

- Install and run Docker Desktop or Podman, then rerun `supabase db reset` and `supabase test db`.
- Publish and review the remaining 12 dossiers in Phase 2.
- Complete the Figma component/state, projector, admin and motion handoff gates.
- Implement identity, one-attempt game Core, two authoritative realtime leaderboards and admin flows in Phases 3-5.
- Production URL and remote smoke-test evidence are added after deployment.
