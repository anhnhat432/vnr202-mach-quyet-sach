# Phase 2A Chapter 1 Figma Evidence

Date: 2026-08-20  
Status: Approved by the user  
Design file: `https://www.figma.com/design/sazgk1wXpc6X80BuqOSAV9`

## Source and approval boundary

- Figma Make Version 5 remains the accepted product baseline: `https://www.figma.com/make/W6ZmtodyEVSDKQEdWyAqMk/VNR202---Mach-Quyet-Sach`.
- Phase 2A states were authored as editable Figma Design frames after the Make quota/auth path was unavailable. The user explicitly approved this fallback and the resulting frames.
- This evidence does not claim that Make Version 5 contains the new Phase 2A states. If the Design result is later rejected, the user requested a Make rebuild after quota reset.

## Approved frames

| State | Node ID | Size |
| --- | --- | --- |
| Catalogue desktop | `22:3` | 1440 x 2648 |
| Catalogue mobile | `22:4` | 390 x 3670 |
| Dossier comparison | `22:7` | 1440 x 1080 |
| Global cause overview | `22:10` | 1440 x 1080 |
| Cause mobile slice | `22:12` | 390 x 1500 |
| Evidence Matrix desktop | `22:14` | 1440 x 1180 |
| Evidence source drawer | `22:15` | 1440 x 1080 |
| Evidence Matrix mobile | `22:16` | 390 x 1420 |
| Empty and unavailable states | `22:18` | 1440 x 1080 |
| Focus and reduced motion | `22:19` | 1440 x 1080 |

## Coverage

- Catalogue contains exactly 15 dossiers on desktop and mobile, with five dossiers per chapter and six approved filters.
- Dossier 05 is represented as unavailable in the public Catalogue; its academic Draft content is not exposed there.
- Dossier comparison includes `Bạn đã ưu tiên`, historical decision, implementation, results, limitations, lessons and Session 7/9/10 locators.
- Cause overview exposes 15 decision spines grouped into three chapters; the focused and mobile states retain the six-lane Dossier 05 path.
- Evidence Matrix includes 20 visible claim-source intersections, a source drawer with issuer/year/locator/support scope/rights note, and a mobile swipe treatment.
- Review Lab includes no-results, unavailable content, visible keyboard focus and reduced-motion replacements for Cause Reveal and Decision Compare.

Draft and review annotations remain confined to review-only frames. Public Catalogue screenshots do not reveal the Dossier 05 title or Draft body.

## Validation

- `figma.hasMissingFont` returned `false` across the Phase 2A pages.
- All approved frames have zero remaining placeholder/shimmer nodes.
- The only font families used are Saira Condensed, Be Vietnam Pro and IBM Plex Mono.
- Catalogue audit returned 15 desktop rows, 15 mobile cards and six filters in each composition.
- Cause audit returned three spine columns and 15 spine entries.
- Evidence audit returned 20 desktop Matrix Cell instances and the complete drawer metadata contract.
- Accessibility audit returned two 4px focus rings plus `0MS`, `NO PATH DRAW` and `NO SLIDE` reduced-motion evidence.

## Screenshots

- `catalogue-desktop.png`
- `catalogue-mobile.png`
- `scenario-comparison.png`
- `cause-overview.png`
- `cause-mobile.png`
- `evidence-filter.png`
- `evidence-drawer.png`
- `evidence-mobile.png`
- `review-states.png`
- `reduced-motion.png`

## Remaining design gaps

- Phase 2A public states are approved; broader Phase 0 Arena, auth, admin, projector and full handoff work remains tracked in `docs/sdd/TASKS.md`.
- The Make project must only be updated later if the user requests the promised Make rebuild after quota reset.
