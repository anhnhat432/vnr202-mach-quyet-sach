# Phase 2 Content Authoring and Public Experience Design

Status: Section design approved; pending written-spec review
Date: 2026-08-19
Method: Hybrid SDD+ADD
Specification depth: Standard for public experience, Full for academic publication boundaries

## 1. Goal

Phase 2 expands VNR202 - Mạch Quyết Sách from three representative Published dossiers to a reviewable 15-dossier content system and, only after human academic approval, a public experience containing exactly five Published dossiers per chapter.

The first implementation checkpoint creates four Chapter 1 dossier packages as Draft. It does not publish them, expose them through the public API, or change the current public catalogue count.

## 2. Approved Decisions

- The 12 incomplete dossiers are authored as Draft in three chapter batches of four.
- AI may structure, extract, compare and draft content, but SHALL NOT set a dossier to Reviewed or Published.
- Each batch receives a human-readable review pack before any publication change.
- Every product interface and new interaction state SHALL be designed in Figma Make before code implementation.
- Reusable components, variables and handoff frames SHALL be synchronized to the existing Figma Design file.
- Publication is a separate commit and validation event after explicit human approval.

## 3. Scope

### 3.1 Phase 2 authoring batches

#### Batch A - Chapter 1

1. `Con đường nào cho độc lập?`
2. `Giữ mạch phong trào`
3. `Linh hoạt trong một cửa sổ dân chủ`
4. `Chớp đúng thời cơ`

#### Batch B - Chapter 2

1. `Khi hòa hoãn không còn đủ`
2. `Tạo thế cho quyết chiến`
3. `Một đất nước, hai nhiệm vụ chiến lược`
4. `Từ đối đầu cục bộ đến toàn thắng`

#### Batch C - Chapter 3

1. `Bài toán hậu chiến`
2. `Phá vỡ sức ì của cơ chế cũ`
3. `Mở cửa nhưng không mất phương hướng`
4. `Giữ niềm tin bằng năng lực thể chế`

The existing Published dossiers 02, 06 and 13 remain the reference implementation for the shared Scenario Engine.

### 3.2 Public experience after approval

- Kho Hồ sơ shows exactly 15 Published dossiers, five per chapter.
- Scenario Engine renders complete source-backed content for every dossier.
- Mạch Nguyên Nhân covers all 15 dossiers without displaying 90 nodes simultaneously by default.
- Ma trận Bằng chứng provides filters that keep a 90-claim dataset usable.
- Anonymous completion progress is stored locally with schema versioning.
- Nguồn & AI is generated from the source registry and publication metadata.

### 3.3 Out of scope

- Student authentication, roster import and authenticated progress sync.
- Student Passport.
- Game attempts, questions, scoring, timers and realtime leaderboards.
- Admin CMS or browser-based academic publication controls.
- AI-generated alternative-history conclusions.
- Publishing a Draft without explicit human approval.

## 4. Core and Shell Boundary

### Core elements

- Draft, Reviewed and Published state transitions.
- Source verification and locator integrity.
- Claim-to-source support scope.
- Public exclusion of Draft, Reviewed-only or source-incomplete content.
- Human publication authority and audit metadata.
- One canonical content model shared by Scenario Engine, cause map and evidence matrix.

### Shell elements

- Catalogue filters and progress presentation.
- Scenario Engine layout and transition treatment.
- Cause-map overview/focus composition.
- Evidence-matrix filters, drawer and responsive layout.
- Motion, typography, visual hierarchy and editorial labels.

Core rules use Full SDD validation. Shell changes use bounded ADD after their Figma Make states are approved.

## 5. Content Architecture

### 5.1 Canonical files

Phase 2 replaces the growing monolithic seed as the authoring surface with focused files:

```text
docs/sdd/content/
  sources.json
  dossiers/
    01-con-duong-nao-cho-doc-lap.json
    02-hop-nhat-de-mo-duong.json
    ...
    15-giu-niem-tin-bang-nang-luc-the-che.json
  causal-links.json
  reviews/
    chapter-1-review.md
    chapter-2-review.md
    chapter-3-review.md
  publication-manifest.json
```

`sources.json`, the dossier files and `causal-links.json` are the authoring source of truth. A dossier's `status` remains its canonical publication state. `publication-manifest.json` records the corresponding human approval evidence, and validation rejects any mismatch between the manifest and dossier status. Generated web JSON and Supabase SQL remain build artifacts.

### 5.2 Dossier package

Every dossier file contains:

- identity: ID, slug, chapter, order, title, central question and status;
- publication metadata: AI-assistance disclosure and optional human review metadata;
- Briefing: period, at least two context statements, central contradiction, objective and at least two constraints;
- Evidence room: at least four evidence cards; each new Phase 2 Draft targets exactly six, including zero or one academically valid distractor;
- Decision room: at least two decision options with rationale; each new Phase 2 Draft targets exactly three;
- Projected consequences: one conditional path for every decision option, each with at least three steps;
- Historical comparison: actual decision, implementation, results, limitations and lessons;
- six claims: one each for context, basis, implementation, result, limitation and lesson;
- six causal nodes: context, contradiction, force, decision, result and lesson;
- source references: at least two Verified sources with exact locators and support scopes.

### 5.3 Publication metadata

A Draft has:

```json
{
  "status": "draft",
  "aiAssistance": {
    "used": true,
    "role": "source extraction, structuring and draft wording"
  }
}
```

`reviewedBy`, `reviewedAt` and `approvalRef` SHALL be absent until a human approves the dossier. AI-authored code, scripts or content generation SHALL NOT populate those fields.

A publication change requires all three human fields, a matching approval record in `publication-manifest.json` and a status transition committed separately from Draft authoring.

## 6. Academic Source Rules

- Every public claim SHALL map to at least one Verified source.
- Every source reference SHALL include a session, slide range, textbook chapter/page or other precise locator.
- Support scope SHALL describe only what the cited location supports.
- A broad conclusion SHALL NOT rely on a source that supports only one narrow detail.
- Evidence marked as a distractor SHALL be historically accurate and merely less relevant to the decision problem.
- Every dossier SHALL balance achievement, limitation, cause and lesson where the topic supports those dimensions.
- Rights notes SHALL identify whether the product paraphrases, quotes or links to the source.
- Raw slide screenshots or copyrighted imagery SHALL NOT be published unless a rights basis is recorded.
- Content about current policy, recent resolutions or Đại hội XIV SHALL use the course package and an approved current source rather than model memory.

## 7. Review Workflow

### 7.1 Automated pre-review

The content validator SHALL reject a batch when:

- a required Scenario Engine field is absent;
- a source ID does not exist or is not Verified;
- a locator or rights note is empty;
- a decision option has no projected-consequence path;
- a claim has no source link or support scope;
- a dossier lacks one of the six causal lanes;
- a causal edge references a missing node;
- publication metadata is inconsistent with status;
- a Draft appears in the public projection.

### 7.2 Human review pack

Each chapter report contains, for all four Draft dossiers:

- central question and intended learning outcome;
- the six claims grouped by approved evidence category;
- source title, issuer, year, locator and support scope;
- the proposed decision options and historical comparison;
- the limitation and lesson statements;
- cross-dossier causal links proposed for approval;
- AI-assistance disclosure;
- Figma preview frame references;
- an explicit approve, revise or reject checklist for each dossier.

### 7.3 Human state transitions

The allowed flow is:

```text
Draft -> Reviewed -> Published
```

- Draft authoring and review-pack generation may be automated.
- A human records approval before Reviewed.
- Published is a separate commit after validating the exact approved content.
- Rejected or revised dossiers remain Draft and public output remains unchanged.

## 8. Figma Make Workflow

Before Phase 2 UI code changes:

1. Extend the existing Figma Make project with the Phase 2 public states.
2. Design at 1440px desktop and 390px mobile.
3. Include reduced-motion variants for every new transition.
4. Capture approved screens into the existing Figma Design file.
5. Update reusable components and handoff notes before implementation.

Required Figma Make compositions:

- Kho Hồ sơ with 15 records, chapter/topic/progress filters and empty-filter state;
- anonymous `Hành trình 15 hồ sơ` progress overview;
- completed and resumed Scenario Engine states;
- historical comparison with implementation, result, limitation, lesson and source links;
- Mạch Nguyên Nhân global overview and focused six-lane dossier view;
- two-node relationship comparison state;
- mobile cause-map Slice;
- Ma trận Bằng chứng filtered view and source drawer;
- Nguồn & AI generated disclosure view;
- loading, invalid-content fallback and no-results states.

The 12 dossiers reuse one Scenario Engine. They SHALL NOT receive 12 unrelated page designs.

## 9. Public UX Design

### 9.1 Kho Hồ sơ

- Displays all 15 dossiers only after they are Published.
- Filters by chapter, period/topic and local completion state.
- Shows `0-15/15` completion progress without implying game score.
- Restores filter state from the URL where practical and remains usable without JavaScript-generated canvas.

### 9.2 Scenario Engine

- Uses the approved six stages for every dossier.
- Validates saved local progress against current evidence and decision IDs before resume.
- Evidence cards link to source detail without revealing future decision feedback.
- Historical comparison displays implementation, results, limitations and lessons, not results alone.
- Completion writes a versioned local marker and offers the related cause-map focus and next dossier.

### 9.3 Mạch Nguyên Nhân

- Default overview displays the 15 decision spines grouped by chapter and time, not all 90 nodes.
- Selecting a dossier expands its six lanes.
- Selecting two connected nodes displays relation type, explanation and supporting source.
- Chapter and relation filters preserve a readable overview.
- Mobile always uses cards and selection controls rather than a reduced canvas.

### 9.4 Ma trận Bằng chứng

- Maintains six claim categories for each Published dossier.
- Filters by chapter, dossier, claim category and source type.
- Renders only the filtered rows and relevant source columns.
- Source detail includes issuer, year, locator, rights note, support scope and approved URL when available.

### 9.5 Nguồn & AI

- Lists only sources referenced by Published content.
- Explains the Drafting versus Human Review boundary.
- Displays publication reviewer metadata without exposing private credentials or unrelated personal data.

## 10. Data Flow

```text
Course PDFs/PPTX + syllabus
  -> source extraction and locator selection
  -> per-dossier Draft JSON
  -> schema and academic-contract validation
  -> chapter review Markdown + Figma preview
  -> human approve/revise/reject
  -> publication manifest update in a separate commit
  -> generated web projection + Supabase seed
  -> public catalogue, Scenario Engine, cause map and evidence matrix
```

The browser never determines publication state. Build-time projection and later database RLS enforce public visibility.

## 11. Error Handling

- Invalid Draft: fail validation with dossier slug, field and rule ID.
- Missing source or locator: block the review pack from reporting the dossier as ready.
- Unsupported causal link: omit it from public output and report it as a review error.
- Corrupt local progress: discard only that dossier's saved state and start at Briefing.
- Unknown saved evidence or decision ID: remove invalid IDs and resume at the earliest valid stage.
- Empty filter result: display a designed no-results state and a clear reset action.
- Missing Published dossier at runtime: return the existing not-found behavior without exposing Draft existence.
- Partial batch approval: publish only individually approved dossiers; unapproved dossiers remain absent.

## 12. Testing Strategy

### 12.1 Automated content tests

- Exactly 15 dossier metadata records and five per chapter.
- Every Draft and Published dossier satisfies the same structural schema.
- Existing Published dossiers retain their approved minimum of four evidence cards and two decisions unless separately re-reviewed; every new Phase 2 Draft has six evidence cards and three decisions.
- Every decision has a matching consequence path, and every full dossier has six claims and six causal nodes.
- All source references resolve to Verified source records with locators and rights notes.
- Public projection contains only Published dossiers and Verified referenced sources.
- AI cannot provide human review metadata through generation scripts.
- Cross-dossier edge endpoints and support claims exist.

### 12.2 Unit and integration tests

- Catalogue filtering and completion calculations.
- Local progress versioning, corruption recovery and safe resume.
- Cause-map overview/focus/filter projections.
- Evidence-matrix filtering and source-column reduction.
- Publication projection and API response counts.
- Supabase migration and RLS runtime tests when Docker or Podman becomes available.

### 12.3 Browser acceptance

- Desktop and mobile show the correct public dossier count for the current publication manifest.
- Draft slugs return not found and never appear in navigation or API output.
- A visitor completes and resumes representative dossiers from every chapter.
- Mạch overview expands a six-lane dossier and explains an approved relation.
- Mobile Mạch uses Slice mode.
- Ma trận filters and source drawer work with keyboard and touch.
- Reduced-motion mode removes large transition movement.
- Serious and critical accessibility violations remain zero on representative routes.

## 13. Checkpoints and Exit Gates

### Checkpoint A1 - Chapter 1 Draft authoring

- Four Chapter 1 Draft packages complete.
- Chapter 1 review report complete.
- Figma Make Phase 2 screens drafted and captured for review.
- Automated validation passes.
- Public catalogue remains at three Published dossiers.

### Checkpoint A2 - Chapter 1 publication

- Requires explicit human approval for each dossier.
- Approved reviewer metadata recorded.
- Publication commit passes all four Hybrid validation layers.
- Public catalogue count changes only by the number of approved dossiers.

### Checkpoints B and C

Repeat the same Draft and publication separation for Chapters 2 and 3.

### Phase 2 exit gate

- Exactly 15 Published dossiers, five per chapter.
- Every claim and causal relationship traces to an approved source.
- Figma Make and Figma Design handoff evidence covers Phase 2 states.
- Public desktop/mobile flows, local progress, accessibility and reduced motion pass.
- No Draft or source-incomplete dossier is accessible publicly.

## 14. Execution Boundary

After this written spec is approved, implementation planning may cover Checkpoint A1 only. Checkpoint A1 may create Figma designs, content architecture, four Chapter 1 Drafts, validators, tests and the review report. It SHALL NOT publish the four dossiers.

Publication, Chapter 2 authoring and Chapter 3 authoring require their own observable checkpoints, but do not require redesigning the approved architecture.
