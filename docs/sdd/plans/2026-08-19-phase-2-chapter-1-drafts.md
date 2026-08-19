# Phase 2 Chapter 1 Draft Packages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline, task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not dispatch subagents for this plan.

**Goal:** Deliver Checkpoint A1: Figma Make Phase 2 public-state designs, a split and validated content-authoring architecture, four source-backed Chapter 1 Draft dossiers and a human review pack, while keeping production visibility at the existing three Published dossiers.

**Architecture:** Authoring data is split into a source registry, one file per dossier, a cross-dossier causal-link registry and a publication manifest. A root build script validates and aggregates those files into the existing runtime shape consumed by Next.js and the Supabase seed generator. Draft content is included in the internal catalogue for validation and review but filtered from the generated public repository and API.

**Tech Stack:** Figma Make/Design, Next.js 16.3.1, React 19.2.8, TypeScript 6.0.3, Zod 4.4.3, Vitest 4.1.11, Playwright 1.62.1, Node.js 22.14.0, Supabase SQL contracts.

## Global Constraints

- Use the existing Figma Make project `https://www.figma.com/make/W6ZmtodyEVSDKQEdWyAqMk/VNR202---Mach-Quyet-Sach` and Figma Design file `https://www.figma.com/design/sazgk1wXpc6X80BuqOSAV9`.
- Validate access to the Make URL in a signed-in Figma browser session before editing. If Figma reports the file unavailable, stop Task 1 and restore access; do not substitute direct Design authoring.
- Do not write Phase 2 UI code until the Phase 2A Figma Make states are explicitly approved.
- The four new dossiers remain `draft`; generation scripts SHALL NOT set `reviewedBy`, `reviewedAt`, `approvalRef`, `reviewed` or `published`.
- Production `/ho-so` and `/api/v1/dossiers` SHALL continue to expose exactly three Published dossiers at Checkpoint A1.
- AI drafts academic wording but does not review or publish it.
- Every claim and evidence card references a Verified source and a precise slide range.
- New Draft dossiers use six evidence cards, three decision options, one consequence path per option, six claims and six causal nodes.
- Existing Published dossiers retain their current four-card/two-option experience without editorial mutation in this checkpoint.
- Existing Published dossiers 02, 06 and 13 migrate as unchanged `legacy-baseline` records tied to commit `6c918ce432e7fd7c3c1f6c697a180564fb08b935`; migration SHALL NOT invent academic reviewer metadata.
- No auth, roster, game attempt, scoring, timer or realtime behavior is introduced.
- Keep Node 22.14.0, Next 16.3.1, React 19.2.8, TypeScript 6.0.3 and the current lockfile dependency set.
- Supabase runtime tests remain accurately reported as blocked until Docker or Podman exists; static SQL contract tests still run.

---

## Planned File Map

```text
docs/sdd/content/
  sources.json
  dossiers/
    01-con-duong-nao-cho-doc-lap.json
    02-hop-nhat-de-mo-duong.json
    03-giu-mach-phong-trao.json
    04-linh-hoat-trong-mot-cua-so-dan-chu.json
    05-chop-dung-thoi-co.json
    06-giu-chinh-quyen-giua-vong-vay.json
    07-khi-hoa-hoan-khong-con-du.json
    08-tao-the-cho-quyet-chien.json
    09-mot-dat-nuoc-hai-nhiem-vu-chien-luoc.json
    10-tu-doi-dau-cuc-bo-den-toan-thang.json
    11-bai-toan-hau-chien.json
    12-pha-vo-suc-i-cua-co-che-cu.json
    13-doi-moi-hay-tut-hau.json
    14-mo-cua-nhung-khong-mat-phuong-huong.json
    15-giu-niem-tin-bang-nang-luc-the-che.json
  causal-links.json
  publication-manifest.json
  reviews/chapter-1-review.md
docs/sdd/evidence/phase-2/chapter-1/
  README.md
  figma.json
  catalogue-desktop.png
  catalogue-mobile.png
  scenario-comparison.png
  cause-overview.png
  evidence-filter.png
scripts/
  build-content-catalog.mjs
  generate-content-seed.mjs
  generate-review-pack.mjs
  lib/content-validation.mjs
  lib/content-validation.d.mts
web/src/generated/content-catalog.json
web/tests/unit/content-files.test.ts
web/tests/unit/content-validation.test.ts
web/tests/unit/chapter-1-drafts.test.ts
web/tests/e2e/public-draft-boundary.spec.ts
```

Files removed after successful migration:

```text
docs/sdd/content/phase-1-seed.json
scripts/generate-phase1-seed.mjs
scripts/sync-web-content.mjs
web/src/generated/phase-1-seed.json
```

---

### Task 1: Design Phase 2A States in Figma Make

**Files:**
- Create: `docs/sdd/evidence/phase-2/chapter-1/figma.json`
- Create: `docs/sdd/evidence/phase-2/chapter-1/README.md`
- Create screenshots under `docs/sdd/evidence/phase-2/chapter-1/`
- Modify: `docs/sdd/evidence/phase-0/README.md`

**Interfaces:**
- Consumes: approved Phase 2 design spec and existing Figma variables/components.
- Produces: approved Figma Make version and editable Figma Design frame IDs used by the Chapter 1 review pack.

- [ ] **Step 1: Build the future approved catalogue state in Figma Make**

Extend the existing Make project rather than creating a visually unrelated file. Build a `Kho Hồ sơ · Phase 2` desktop frame at 1440px and mobile frame at 390px with:

- exactly 15 dossier rows, five per chapter;
- filters `Tất cả`, `Chương 1`, `Chương 2`, `Chương 3`, `Đã hoàn thành`, `Chưa hoàn thành`;
- progress copy `Hành trình hồ sơ · 3/15 đã hoàn thành`;
- a no-results state with action `Xóa bộ lọc`;
- a visible design annotation `TRẠNG THÁI TƯƠNG LAI · CHỈ SAU KHI DUYỆT HỌC THUẬT` outside the product viewport.

- [ ] **Step 2: Build the representative full-comparison state**

Use Draft dossier 05 as the content sample. The frame must show:

- `Bạn đã ưu tiên`;
- `Quyết định lịch sử`;
- `Tổ chức thực hiện`;
- `Kết quả`;
- `Hạn chế`;
- `Bài học`;
- source chips with `Session 7`, `Session 9`, `Session 10` and slide locators;
- a visible review-only annotation `DRAFT · CHƯA ĐƯỢC XUẤT BẢN` outside the product viewport.

- [ ] **Step 3: Build global cause-map and evidence-filter states**

Create:

- global cause overview showing 15 decision spines grouped by chapter, without opening all 90 nodes;
- focused six-lane view for dossier 05;
- two-node relation panel with relation label, explanation and source;
- mobile Slice at 390px;
- evidence matrix filters for chapter, dossier, claim category and source type;
- evidence source drawer with issuer, year, locator, support scope and rights note.

- [ ] **Step 4: Add reduced-motion and failure states**

Include variant frames for:

- reduced-motion cause reveal;
- reduced-motion comparison transition;
- no filter results;
- invalid/unavailable content with action `Trở lại Kho Hồ sơ`.

- [ ] **Step 5: Capture the approved Make states into Figma Design**

The Design file currently contains only page `00 Cover & Narrative`. Create these pages, then place editable captures of the approved Make states on them:

- `02 Kho Ho So`;
- `03 Ho So Quyet Sach`;
- `04 Mach Nguyen Nhan`;
- `05 Ma Tran Bang Chung`.

Use Figma Make as the visual source of truth. `use_figma` may create pages and convert the approved Make output into editable frames, but SHALL NOT originate a different layout. Record the actual Make URL/version and returned Design node IDs in `figma.json` using this exact contract:

```ts
type FigmaEvidence = {
  makeUrl: "https://www.figma.com/make/W6ZmtodyEVSDKQEdWyAqMk/VNR202---Mach-Quyet-Sach";
  makeVersion: number;
  designUrl: "https://www.figma.com/design/sazgk1wXpc6X80BuqOSAV9";
  frames: Record<
    | "catalogueDesktop"
    | "catalogueMobile"
    | "scenarioComparison"
    | "causeOverview"
    | "causeMobile"
    | "evidenceFilter"
    | "reducedMotion",
    string
  >;
};
```

Write the version displayed by Make after the edit and the node IDs returned by Figma. Every frame value must match `^\\d+:\\d+$`; blank or invented IDs fail the task.

- [ ] **Step 6: Record screenshots and design evidence**

Write `docs/sdd/evidence/phase-2/chapter-1/README.md` with:

- Make version URL;
- Design frame IDs;
- desktop/mobile dimensions;
- states covered;
- confirmation that Draft annotations are outside the final product frame;
- remaining Phase 2 design gaps.

- [ ] **Step 7: Stop for the required Figma approval gate**

Present the Make version and captured frames to the user. Do not begin Task 2 until the user explicitly approves this Figma version.

- [ ] **Step 8: Commit Figma evidence**

```powershell
git add docs/sdd/evidence/phase-0/README.md docs/sdd/evidence/phase-2/chapter-1
git commit -m "design: add Phase 2A public experience states"
```

---

### Task 2: Split the Canonical Content Model and Preserve Runtime Output

**Files:**
- Create: `docs/sdd/content/sources.json`
- Create: `docs/sdd/content/dossiers/*.json`
- Create: `docs/sdd/content/causal-links.json`
- Create: `docs/sdd/content/publication-manifest.json`
- Create: `scripts/build-content-catalog.mjs`
- Create: `scripts/lib/content-validation.mjs`
- Create: `scripts/lib/content-validation.d.mts`
- Create: `web/src/generated/content-catalog.json`
- Create: `web/tests/unit/content-files.test.ts`
- Modify: `web/package.json`
- Modify: `web/src/features/content/server/local-content.ts`
- Delete after migration: old Phase 1 aggregate/generator files listed in the file map.

**Interfaces:**
- Produces: `buildContentCatalog()` behavior through `node scripts/build-content-catalog.mjs`.
- Produces generated shape `{ schemaVersion, sources, dossiers, causalLinks, publicationManifest }`.
- Preserves `listPublishedDossiers()`, `getPublishedDossierBySlug()`, `getCauseMapData()` and `getEvidenceMatrixData()` return contracts.

- [ ] **Step 1: Write the failing canonical-file test**

Create `web/tests/unit/content-files.test.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");
const dossierDir = path.join(root, "docs", "sdd", "content", "dossiers");

describe("canonical content files", () => {
  it("stores one dossier per ordered file", () => {
    const files = fs.readdirSync(dossierDir).filter((file) => file.endsWith(".json")).sort();
    expect(files).toHaveLength(15);
    expect(files[0]).toBe("01-con-duong-nao-cho-doc-lap.json");
    expect(files[14]).toBe("15-giu-niem-tin-bang-nang-luc-the-che.json");
  });

  it("keeps the source and publication registries separate", () => {
    expect(fs.existsSync(path.join(root, "docs", "sdd", "content", "sources.json"))).toBe(true);
    expect(fs.existsSync(path.join(root, "docs", "sdd", "content", "publication-manifest.json"))).toBe(true);
    expect(fs.existsSync(path.join(root, "docs", "sdd", "content", "causal-links.json"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm --prefix web run test -- tests/unit/content-files.test.ts
```

Expected: FAIL because `docs/sdd/content/dossiers` does not exist.

- [ ] **Step 3: Create a one-time migration script and run it**

Create temporary `scripts/migrate-phase1-content.mjs`:

```js
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const root = path.resolve(import.meta.dirname, "..");
const input = JSON.parse(fs.readFileSync(path.join(root, "docs/sdd/content/phase-1-seed.json"), "utf8"));
const outputDir = path.join(root, "docs/sdd/content/dossiers");
fs.mkdirSync(outputDir, { recursive: true });
const fingerprint = (value) => {
  const normalized = structuredClone(value);
  if (normalized.experience) delete normalized.experience.sources;
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
};
const migratedById = new Map();

const fileNames = [
  "01-con-duong-nao-cho-doc-lap.json",
  "02-hop-nhat-de-mo-duong.json",
  "03-giu-mach-phong-trao.json",
  "04-linh-hoat-trong-mot-cua-so-dan-chu.json",
  "05-chop-dung-thoi-co.json",
  "06-giu-chinh-quyen-giua-vong-vay.json",
  "07-khi-hoa-hoan-khong-con-du.json",
  "08-tao-the-cho-quyet-chien.json",
  "09-mot-dat-nuoc-hai-nhiem-vu-chien-luoc.json",
  "10-tu-doi-dau-cuc-bo-den-toan-thang.json",
  "11-bai-toan-hau-chien.json",
  "12-pha-vo-suc-i-cua-co-che-cu.json",
  "13-doi-moi-hay-tut-hau.json",
  "14-mo-cua-nhung-khong-mat-phuong-huong.json",
  "15-giu-niem-tin-bang-nang-luc-the-che.json"
];

for (const dossier of input.dossiers) {
  const sourceRefs = dossier.experience?.sources.map((source) => ({
    sourceId: source.id,
    locator: source.locator
  })) ?? [];
  const migrated = {
    ...dossier,
    review: {
      aiAssistance: {
        used: true,
        role: dossier.status === "published"
          ? "Phase 1 preview authoring assistance; no academic-review assertion"
          : "metadata planning only"
      }
    },
    sourceRefs
  };
  if (migrated.experience) delete migrated.experience.sources;
  migratedById.set(migrated.id, migrated);
  fs.writeFileSync(
    path.join(outputDir, fileNames[dossier.orderIndex - 1]),
    `${JSON.stringify(migrated, null, 2)}\n`,
    "utf8"
  );
}

fs.writeFileSync(
  path.join(root, "docs/sdd/content/sources.json"),
  `${JSON.stringify({ schemaVersion: 1, sources: input.sources }, null, 2)}\n`,
  "utf8"
);

fs.writeFileSync(
  path.join(root, "docs/sdd/content/causal-links.json"),
  `${JSON.stringify({ schemaVersion: 1, links: [] }, null, 2)}\n`,
  "utf8"
);

const publications = input.dossiers
  .filter((dossier) => dossier.status === "published")
  .map((dossier) => ({
    kind: "legacy-baseline",
    dossierId: dossier.id,
    status: "published",
    sourceCommit: "6c918ce432e7fd7c3c1f6c697a180564fb08b935",
    capturedAt: "2026-08-19",
    contentSha256: fingerprint(migratedById.get(dossier.id)),
    note: "Migrated unchanged from Phase 1 public preview; this record does not assert academic review."
  }));

fs.writeFileSync(
  path.join(root, "docs/sdd/content/publication-manifest.json"),
  `${JSON.stringify({ schemaVersion: 1, publications }, null, 2)}\n`,
  "utf8"
);
```

Run:

```powershell
node .\scripts\migrate-phase1-content.mjs
```

Review all generated JSON, then delete only the temporary migration script with `apply_patch`:

```text
*** Begin Patch
*** Delete File: scripts/migrate-phase1-content.mjs
*** End Patch
```

- [ ] **Step 4: Add cross-file validation helpers**

Create `scripts/lib/content-validation.mjs` and its TypeScript declaration boundary `scripts/lib/content-validation.d.mts`:

```js
import { createHash } from "node:crypto";

const fingerprint = (value) => {
  const normalized = structuredClone(value);
  if (normalized.experience) delete normalized.experience.sources;
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
};

export function validateContentCatalog(catalog) {
  const errors = [];
  const sourceIds = new Set(catalog.sources.map((source) => source.id));
  const dossierIds = new Set(catalog.dossiers.map((dossier) => dossier.id));
  const slugs = new Set();
  const orders = new Set();

  if (catalog.dossiers.length !== 15) errors.push("CATALOG_COUNT: expected 15 dossiers");

  for (const dossier of catalog.dossiers) {
    if (slugs.has(dossier.slug)) errors.push(`DUPLICATE_SLUG: ${dossier.slug}`);
    if (orders.has(dossier.orderIndex)) errors.push(`DUPLICATE_ORDER: ${dossier.orderIndex}`);
    slugs.add(dossier.slug);
    orders.add(dossier.orderIndex);

    for (const ref of dossier.sourceRefs ?? []) {
      if (!sourceIds.has(ref.sourceId)) errors.push(`UNKNOWN_SOURCE: ${dossier.slug}:${ref.sourceId}`);
      if (!ref.locator?.trim()) errors.push(`EMPTY_LOCATOR: ${dossier.slug}:${ref.sourceId}`);
    }

    if (dossier.status === "draft") {
      for (const field of ["reviewedBy", "reviewedAt", "approvalRef"]) {
        if (dossier.review?.[field]) errors.push(`AI_PUBLICATION_FIELD: ${dossier.slug}:${field}`);
      }
    }
  }

  for (const link of catalog.causalLinks) {
    if (!dossierIds.has(link.sourceDossierId)) errors.push(`UNKNOWN_LINK_SOURCE: ${link.id}`);
    if (!dossierIds.has(link.targetDossierId)) errors.push(`UNKNOWN_LINK_TARGET: ${link.id}`);
  }

  const publications = new Map(catalog.publicationManifest.publications.map((item) => [item.dossierId, item]));
  for (const dossier of catalog.dossiers) {
    const publication = publications.get(dossier.id);
    if (dossier.status === "published" && !publication) {
      errors.push(`MISSING_PUBLICATION_APPROVAL: ${dossier.slug}`);
    }
    if (dossier.status !== "published" && publication) {
      errors.push(`STALE_PUBLICATION_APPROVAL: ${dossier.slug}`);
    }
    if (publication?.kind === "legacy-baseline") {
      if (publication.sourceCommit !== "6c918ce432e7fd7c3c1f6c697a180564fb08b935") {
        errors.push(`INVALID_LEGACY_SOURCE: ${dossier.slug}`);
      }
      if (publication.contentSha256 !== fingerprint(dossier)) {
        errors.push(`LEGACY_CONTENT_CHANGED: ${dossier.slug}`);
      }
      for (const field of ["reviewedBy", "reviewedAt", "approvalRef"]) {
        if (dossier.review?.[field]) errors.push(`LEGACY_REVIEW_CLAIM: ${dossier.slug}:${field}`);
      }
    }
    if (publication?.kind === "human-approval") {
      for (const field of ["reviewedBy", "reviewedAt", "approvalRef"]) {
        if (dossier.review?.[field] !== publication[field]) {
          errors.push(`APPROVAL_MISMATCH: ${dossier.slug}:${field}`);
        }
      }
    }
  }

  if (errors.length) throw new Error(errors.join("\n"));
  return catalog;
}
```

```ts
export declare function validateContentCatalog<TCatalog>(catalog: TCatalog): TCatalog;
```

- [ ] **Step 5: Add the aggregate builder**

Create `scripts/build-content-catalog.mjs`:

```js
import fs from "node:fs";
import path from "node:path";
import { validateContentCatalog } from "./lib/content-validation.mjs";

const root = path.resolve(import.meta.dirname, "..");
const contentDir = path.join(root, "docs/sdd/content");
const dossierDir = path.join(contentDir, "dossiers");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const sourceRegistry = readJson(path.join(contentDir, "sources.json"));
const publicationManifest = readJson(path.join(contentDir, "publication-manifest.json"));
const causalRegistry = readJson(path.join(contentDir, "causal-links.json"));
const dossiers = fs.readdirSync(dossierDir)
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) => readJson(path.join(dossierDir, file)));

const sourcesById = new Map(sourceRegistry.sources.map((source) => [source.id, source]));
const hydratedDossiers = dossiers.map((dossier) => {
  if (!dossier.experience) return dossier;
  return {
    ...dossier,
    experience: {
      ...dossier.experience,
      sources: dossier.sourceRefs.map((ref) => ({
        ...sourcesById.get(ref.sourceId),
        locator: ref.locator
      }))
    }
  };
});

const catalog = validateContentCatalog({
  schemaVersion: 2,
  sources: sourceRegistry.sources,
  dossiers: hydratedDossiers,
  causalLinks: causalRegistry.links,
  publicationManifest
});

const output = path.join(root, "web/src/generated/content-catalog.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
```

- [ ] **Step 6: Update the web generation command and runtime import**

Change `web/package.json`:

```json
{
  "scripts": {
    "generate:content": "node ../scripts/build-content-catalog.mjs"
  }
}
```

In `web/src/features/content/server/local-content.ts`, replace:

```ts
import seed from "@/generated/phase-1-seed.json";
```

with:

```ts
import seed from "@/generated/content-catalog.json";
```

Preserve the existing public filter:

```ts
.filter((item) => item.status === "published" && item.experience)
```

- [ ] **Step 7: Generate the catalogue and remove superseded files**

Run:

```powershell
npm --prefix web run generate:content
```

After comparing the generated output with the previous runtime data for dossiers 02, 06 and 13, remove the superseded Phase 1 aggregate and scripts listed in the file map.

- [ ] **Step 8: Verify GREEN and public invariance**

Run:

```powershell
npm --prefix web run test -- tests/unit/content-files.test.ts tests/unit/content-catalog.test.ts tests/unit/public-knowledge.test.ts
```

Expected: PASS; exactly 15 canonical files and exactly three Published runtime dossiers.

- [ ] **Step 9: Commit the content split**

```powershell
git add docs/sdd/content scripts web/package.json web/src/features/content/server/local-content.ts web/src/generated web/tests/unit/content-files.test.ts
git commit -m "refactor: split canonical dossier content files"
```

---

### Task 3: Lock Structural and Publication Contracts

**Files:**
- Modify: `web/src/features/content/contracts/dossier.ts`
- Create: `web/tests/unit/content-validation.test.ts`
- Modify: `web/tests/unit/content-catalog.test.ts`

**Interfaces:**
- Produces `authoredDossierSchema`, `sourceRecordSchema`, `causalLinkSchema`, `publicationManifestSchema` and `contentCatalogSchema`.
- Produces a structural gate used by tests and server imports.

- [ ] **Step 1: Write failing structural and publication tests**

Create `web/tests/unit/content-validation.test.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contentCatalogSchema } from "@/features/content/contracts/dossier";
import { validateContentCatalog } from "../../../scripts/lib/content-validation.mjs";

const root = path.resolve(import.meta.dirname, "../../..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "web/src/generated/content-catalog.json"), "utf8"));

describe("content publication contract", () => {
  it("parses the generated aggregate", () => {
    expect(contentCatalogSchema.parse(catalog).dossiers).toHaveLength(15);
  });

  it("rejects publication metadata on a draft", () => {
    const copy = structuredClone(catalog);
    const draft = copy.dossiers.find((item: { status: string }) => item.status === "draft");
    draft.review.reviewedBy = "AI";
    expect(() => validateContentCatalog(copy)).toThrow(/AI_PUBLICATION_FIELD/);
  });

  it("rejects a published dossier without publication evidence", () => {
    const copy = structuredClone(catalog);
    copy.publicationManifest.publications = [];
    expect(() => validateContentCatalog(copy)).toThrow(/MISSING_PUBLICATION_APPROVAL/);
  });

  it("keeps legacy publication truthful and immutable", () => {
    const copy = structuredClone(catalog);
    const legacy = copy.publicationManifest.publications.find(
      (item: { kind: string }) => item.kind === "legacy-baseline"
    );
    const dossier = copy.dossiers.find((item: { id: string }) => item.id === legacy.dossierId);
    expect(dossier.review.reviewedBy).toBeUndefined();
    expect(dossier.review.reviewedAt).toBeUndefined();
    expect(dossier.review.approvalRef).toBeUndefined();
    dossier.title = `${dossier.title} changed`;
    expect(() => validateContentCatalog(copy)).toThrow(/LEGACY_CONTENT_CHANGED/);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm --prefix web run test -- tests/unit/content-validation.test.ts
```

Expected: FAIL because `contentCatalogSchema` is not exported.

- [ ] **Step 3: Implement authored content schemas**

Add to `web/src/features/content/contracts/dossier.ts`:

```ts
export const sourceRecordSchema = z.object({
  id: postgresUuidSchema,
  title: z.string().min(2).max(300),
  authorOrIssuer: z.string().min(2).max(200),
  publicationYear: z.number().int().min(1900).max(2100),
  locator: z.string(),
  url: z.url().nullable(),
  sourceType: z.string().min(2),
  rightsNote: z.string().min(5),
  verificationStatus: z.literal("verified")
});

const sourceRefSchema = z.object({
  sourceId: postgresUuidSchema,
  locator: z.string().min(3)
});

const reviewSchema = z.object({
  aiAssistance: z.object({
    used: z.boolean(),
    role: z.string().min(5)
  }),
  reviewedBy: z.string().min(2).optional(),
  reviewedAt: z.iso.date().optional(),
  approvalRef: z.string().min(5).optional()
});

export const claimSchema = z.object({
  id: z.string().min(1),
  category: z.enum(["context", "basis", "implementation", "result", "limitation", "lesson"]),
  statement: z.string().min(10),
  sourceLinks: z.array(z.object({
    sourceId: postgresUuidSchema,
    locator: z.string().min(3),
    supportScope: z.string().min(10)
  })).min(1)
});

export const causalNodeSchema = z.object({
  id: z.string().min(1),
  lane: z.enum(["context", "contradiction", "force", "decision", "result", "lesson"]),
  label: z.string().min(2),
  explanation: z.string().min(10),
  claimId: z.string().min(1)
});

export const authoredDossierSchema = z.object({
  id: postgresUuidSchema,
  versionId: postgresUuidSchema.optional(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  chapter: chapterSchema,
  orderIndex: z.number().int().min(1).max(15),
  title: z.string().min(2),
  centralQuestion: z.string().min(10),
  status: z.enum(["draft", "reviewed", "published"]),
  review: reviewSchema,
  sourceRefs: z.array(sourceRefSchema),
  experience: dossierExperienceSchema.optional(),
  claims: z.array(claimSchema).length(6).optional(),
  causalNodes: z.array(causalNodeSchema).length(6).optional()
});

export const causalLinkSchema = z.object({
  id: z.string().min(1),
  sourceDossierId: postgresUuidSchema,
  sourceNodeId: z.string().min(1),
  targetDossierId: postgresUuidSchema,
  targetNodeId: z.string().min(1),
  relation: z.enum(["direct_cause", "condition", "response", "outcome", "limitation", "lesson"]),
  explanation: z.string().min(10),
  claimId: z.string().min(1),
  sourceId: postgresUuidSchema,
  locator: z.string().min(3)
});

const humanPublicationSchema = z.object({
  kind: z.literal("human-approval"),
  dossierId: postgresUuidSchema,
  status: z.literal("published"),
  reviewedBy: z.string().min(2),
  reviewedAt: z.iso.date(),
  approvalRef: z.string().min(5)
});

const legacyPublicationSchema = z.object({
  kind: z.literal("legacy-baseline"),
  dossierId: postgresUuidSchema,
  status: z.literal("published"),
  sourceCommit: z.literal("6c918ce432e7fd7c3c1f6c697a180564fb08b935"),
  capturedAt: z.iso.date(),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  note: z.string().min(20)
});

export const publicationManifestSchema = z.object({
  schemaVersion: z.literal(1),
  publications: z.array(z.discriminatedUnion("kind", [
    humanPublicationSchema,
    legacyPublicationSchema
  ]))
});

export const contentCatalogSchema = z.object({
  schemaVersion: z.literal(2),
  sources: z.array(sourceRecordSchema).min(1),
  dossiers: z.array(authoredDossierSchema).length(15),
  causalLinks: z.array(causalLinkSchema),
  publicationManifest: publicationManifestSchema
});
```

Update `dossierExperienceSchema.sources` to reuse `sourceRecordSchema.pick(...)` after moving declarations into dependency-safe order.

- [ ] **Step 4: Parse the generated catalogue in `local-content.ts`**

Replace the local duplicate source/dossier schemas with:

```ts
const parsedSeed = contentCatalogSchema.parse(seed);
```

Keep transformation functions unchanged except where the new canonical `claims` and `causalNodes` fields are consumed later.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
npm --prefix web run test -- tests/unit/content-validation.test.ts tests/unit/content-catalog.test.ts
npm --prefix web run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the contracts**

```powershell
git add scripts/lib/content-validation.mjs scripts/lib/content-validation.d.mts web/src/features/content/contracts/dossier.ts web/src/features/content/server/local-content.ts web/tests/unit
git commit -m "test: enforce academic content publication contracts"
```

---

### Task 4: Register Chapter 1 Verified Course Sources

**Files:**
- Modify: `docs/sdd/content/sources.json`
- Create: `web/tests/unit/chapter-1-drafts.test.ts`

**Interfaces:**
- Produces source IDs `10000000-0000-0000-0000-000000000003`, `10000000-0000-0000-0000-000000000005`, `10000000-0000-0000-0000-000000000006`, `10000000-0000-0000-0000-000000000007`, `10000000-0000-0000-0000-000000000008`, `10000000-0000-0000-0000-000000000009` and `10000000-0000-0000-0000-000000000010`.
- Provides exact course-slide locators for the four Draft dossiers.

- [ ] **Step 1: Write the failing Chapter 1 source test**

Create `web/tests/unit/chapter-1-drafts.test.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");
const sources = JSON.parse(fs.readFileSync(path.join(root, "docs/sdd/content/sources.json"), "utf8")).sources;

describe("Chapter 1 authoring sources", () => {
  it("registers every course session used by the four drafts", () => {
    const ids = new Set(sources.map((source: { id: string }) => source.id));
    for (const session of [3, 5, 6, 7, 8, 9, 10]) {
      expect(ids.has(`10000000-0000-0000-0000-${String(session).padStart(12, "0")}`)).toBe(true);
    }
  });

  it("gives every Chapter 1 source a rights note and verified status", () => {
    const chapterSources = sources.filter((source: { id: string }) => /00000000000(3|5|6|7|8|9)$|000000000010$/.test(source.id));
    expect(chapterSources.every((source: { rightsNote: string }) => source.rightsNote.length >= 5)).toBe(true);
    expect(chapterSources.every((source: { verificationStatus: string }) => source.verificationStatus === "verified")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm --prefix web run test -- tests/unit/chapter-1-drafts.test.ts
```

Expected: FAIL because Sessions 3, 5-10 are absent.

- [ ] **Step 3: Add exact source records**

Append these records to `sources.json`, preserving existing records:

```json
[
  {
    "id": "10000000-0000-0000-0000-000000000003",
    "title": "VNR202 Session 3 - Bối cảnh và sự chuẩn bị của Nguyễn Ái Quốc",
    "authorOrIssuer": "Bộ môn VNR202, FPT University",
    "publicationYear": 2026,
    "locator": "Slides 3-19",
    "url": null,
    "sourceType": "course_slide",
    "rightsNote": "Học liệu nội bộ; sản phẩm chỉ diễn giải và ghi locator, không phân phối lại slide",
    "verificationStatus": "verified"
  },
  {
    "id": "10000000-0000-0000-0000-000000000005",
    "title": "VNR202 Session 5 - Phong trào 1930-1931 và khôi phục 1932-1935",
    "authorOrIssuer": "Bộ môn VNR202, FPT University",
    "publicationYear": 2026,
    "locator": "Slides 3-18",
    "url": null,
    "sourceType": "course_slide",
    "rightsNote": "Học liệu nội bộ; sản phẩm chỉ diễn giải và ghi locator, không phân phối lại slide",
    "verificationStatus": "verified"
  },
  {
    "id": "10000000-0000-0000-0000-000000000006",
    "title": "VNR202 Session 6 - Phong trào dân chủ 1936-1939",
    "authorOrIssuer": "Bộ môn VNR202, FPT University",
    "publicationYear": 2026,
    "locator": "Slides 3-11",
    "url": null,
    "sourceType": "course_slide",
    "rightsNote": "Học liệu nội bộ; sản phẩm chỉ diễn giải và ghi locator, không phân phối lại slide",
    "verificationStatus": "verified"
  },
  {
    "id": "10000000-0000-0000-0000-000000000007",
    "title": "VNR202 Session 7 - Chuyển hướng chiến lược 1939-1941",
    "authorOrIssuer": "Bộ môn VNR202, FPT University",
    "publicationYear": 2026,
    "locator": "Slides 3-16",
    "url": null,
    "sourceType": "course_slide",
    "rightsNote": "Học liệu nội bộ; sản phẩm chỉ diễn giải và ghi locator, không phân phối lại slide",
    "verificationStatus": "verified"
  },
  {
    "id": "10000000-0000-0000-0000-000000000008",
    "title": "VNR202 Session 8 - Chuẩn bị lực lượng và căn cứ 1941-1944",
    "authorOrIssuer": "Bộ môn VNR202, FPT University",
    "publicationYear": 2026,
    "locator": "Slides 3-9",
    "url": null,
    "sourceType": "course_slide",
    "rightsNote": "Học liệu nội bộ; sản phẩm chỉ diễn giải và ghi locator, không phân phối lại slide",
    "verificationStatus": "verified"
  },
  {
    "id": "10000000-0000-0000-0000-000000000009",
    "title": "VNR202 Session 9 - Cao trào kháng Nhật và Tổng khởi nghĩa",
    "authorOrIssuer": "Bộ môn VNR202, FPT University",
    "publicationYear": 2026,
    "locator": "Slides 3-12",
    "url": null,
    "sourceType": "course_slide",
    "rightsNote": "Học liệu nội bộ; sản phẩm chỉ diễn giải và ghi locator, không phân phối lại slide",
    "verificationStatus": "verified"
  },
  {
    "id": "10000000-0000-0000-0000-000000000010",
    "title": "VNR202 Session 10 - Tính chất, ý nghĩa và bài học Cách mạng Tháng Tám",
    "authorOrIssuer": "Bộ môn VNR202, FPT University",
    "publicationYear": 2026,
    "locator": "Slides 3-9",
    "url": null,
    "sourceType": "course_slide",
    "rightsNote": "Học liệu nội bộ; sản phẩm chỉ diễn giải và ghi locator, không phân phối lại slide",
    "verificationStatus": "verified"
  }
]
```

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
npm --prefix web run generate:content
npm --prefix web run test -- tests/unit/chapter-1-drafts.test.ts
```

Then commit:

```powershell
git add docs/sdd/content/sources.json web/src/generated/content-catalog.json web/tests/unit/chapter-1-drafts.test.ts
git commit -m "content: register Chapter 1 review sources"
```

---

### Task 5: Author Draft 01 - Con Đường Nào Cho Độc Lập?

**Files:**
- Modify: `docs/sdd/content/dossiers/01-con-duong-nao-cho-doc-lap.json`
- Modify: `web/tests/unit/chapter-1-drafts.test.ts`

**Interfaces:**
- Produces a complete Draft dossier using textbook source `10000000-0000-0000-0000-000000000001` and Session 3 source `10000000-0000-0000-0000-000000000003`.

- [ ] **Step 1: Add the failing target-shape test**

Append:

```ts
it("authors dossier 01 as a complete hidden Draft", () => {
  const dossier = JSON.parse(fs.readFileSync(path.join(root, "docs/sdd/content/dossiers/01-con-duong-nao-cho-doc-lap.json"), "utf8"));
  expect(dossier.status).toBe("draft");
  expect(dossier.experience.evidence).toHaveLength(6);
  expect(dossier.experience.decision.options).toHaveLength(3);
  expect(dossier.claims).toHaveLength(6);
  expect(dossier.causalNodes).toHaveLength(6);
  expect(dossier.review.reviewedBy).toBeUndefined();
});
```

Run and expect FAIL because `experience` is absent.

- [ ] **Step 2: Populate the exact Draft content from Appendix A.1**

Use version ID `30000000-0000-0000-0000-000000000001`, source refs:

```json
[
  { "sourceId": "10000000-0000-0000-0000-000000000001", "locator": "Chương I - Bối cảnh Việt Nam và sự chuẩn bị thành lập Đảng" },
  { "sourceId": "10000000-0000-0000-0000-000000000003", "locator": "Slides 3-19" }
]
```

Copy the complete field wording from Appendix A.1 without adding human review metadata.

- [ ] **Step 3: Generate and verify GREEN**

```powershell
npm --prefix web run generate:content
npm --prefix web run test -- tests/unit/chapter-1-drafts.test.ts tests/unit/content-validation.test.ts
```

- [ ] **Step 4: Commit Draft 01**

```powershell
git add docs/sdd/content/dossiers/01-con-duong-nao-cho-doc-lap.json web/src/generated/content-catalog.json web/tests/unit/chapter-1-drafts.test.ts
git commit -m "content: draft the independence-path dossier"
```

---

### Task 6: Author Draft 03 - Giữ Mạch Phong Trào

**Files:**
- Modify: `docs/sdd/content/dossiers/03-giu-mach-phong-trao.json`
- Modify: `web/tests/unit/chapter-1-drafts.test.ts`

**Interfaces:**
- Produces a complete Draft dossier using textbook source `10000000-0000-0000-0000-000000000001` and Session 5 source `10000000-0000-0000-0000-000000000005`.

- [ ] **Step 1: Add the failing target-shape test**

```ts
it("authors dossier 03 as a complete hidden Draft", () => {
  const dossier = JSON.parse(fs.readFileSync(path.join(root, "docs/sdd/content/dossiers/03-giu-mach-phong-trao.json"), "utf8"));
  expect(dossier.status).toBe("draft");
  expect(dossier.experience.evidence).toHaveLength(6);
  expect(dossier.experience.decision.options).toHaveLength(3);
  expect(dossier.claims.map((claim: { category: string }) => claim.category)).toEqual([
    "context", "basis", "implementation", "result", "limitation", "lesson"
  ]);
});
```

Run and expect FAIL.

- [ ] **Step 2: Populate Appendix A.2 content**

Use version ID `30000000-0000-0000-0000-000000000003` and source refs:

```json
[
  { "sourceId": "10000000-0000-0000-0000-000000000001", "locator": "Chương I - Phong trào 1930-1935" },
  { "sourceId": "10000000-0000-0000-0000-000000000005", "locator": "Slides 3-18" }
]
```

- [ ] **Step 3: Generate, test and commit**

```powershell
npm --prefix web run generate:content
npm --prefix web run test -- tests/unit/chapter-1-drafts.test.ts tests/unit/content-validation.test.ts
git add docs/sdd/content/dossiers/03-giu-mach-phong-trao.json web/src/generated/content-catalog.json web/tests/unit/chapter-1-drafts.test.ts
git commit -m "content: draft the movement-recovery dossier"
```

---

### Task 7: Author Draft 04 - Linh Hoạt Trong Một Cửa Sổ Dân Chủ

**Files:**
- Modify: `docs/sdd/content/dossiers/04-linh-hoat-trong-mot-cua-so-dan-chu.json`
- Modify: `web/tests/unit/chapter-1-drafts.test.ts`

**Interfaces:**
- Produces a complete Draft dossier using textbook source `10000000-0000-0000-0000-000000000001` and Session 6 source `10000000-0000-0000-0000-000000000006`.

- [ ] **Step 1: Add the failing target-shape test**

```ts
it("authors dossier 04 with open and semi-open struggle choices", () => {
  const dossier = JSON.parse(fs.readFileSync(path.join(root, "docs/sdd/content/dossiers/04-linh-hoat-trong-mot-cua-so-dan-chu.json"), "utf8"));
  expect(dossier.status).toBe("draft");
  expect(dossier.experience.evidence).toHaveLength(6);
  expect(dossier.experience.decision.options).toHaveLength(3);
  expect(dossier.experience.historicalComparison.limitations.length).toBeGreaterThanOrEqual(1);
});
```

Run and expect FAIL.

- [ ] **Step 2: Populate Appendix A.3 content**

Use version ID `30000000-0000-0000-0000-000000000004` and source refs:

```json
[
  { "sourceId": "10000000-0000-0000-0000-000000000001", "locator": "Chương I - Phong trào dân chủ 1936-1939" },
  { "sourceId": "10000000-0000-0000-0000-000000000006", "locator": "Slides 3-11" }
]
```

- [ ] **Step 3: Generate, test and commit**

```powershell
npm --prefix web run generate:content
npm --prefix web run test -- tests/unit/chapter-1-drafts.test.ts tests/unit/content-validation.test.ts
git add docs/sdd/content/dossiers/04-linh-hoat-trong-mot-cua-so-dan-chu.json web/src/generated/content-catalog.json web/tests/unit/chapter-1-drafts.test.ts
git commit -m "content: draft the democratic-window dossier"
```

---

### Task 8: Author Draft 05 - Chớp Đúng Thời Cơ

**Files:**
- Modify: `docs/sdd/content/dossiers/05-chop-dung-thoi-co.json`
- Modify: `web/tests/unit/chapter-1-drafts.test.ts`

**Interfaces:**
- Produces a complete Draft dossier using textbook source `10000000-0000-0000-0000-000000000001` and Session sources `10000000-0000-0000-0000-000000000007`, `10000000-0000-0000-0000-000000000008`, `10000000-0000-0000-0000-000000000009` and `10000000-0000-0000-0000-000000000010`.

- [ ] **Step 1: Add the failing multi-source test**

```ts
it("authors dossier 05 with preparation, opportunity and lesson sources", () => {
  const dossier = JSON.parse(fs.readFileSync(path.join(root, "docs/sdd/content/dossiers/05-chop-dung-thoi-co.json"), "utf8"));
  expect(dossier.status).toBe("draft");
  expect(dossier.experience.evidence).toHaveLength(6);
  expect(dossier.experience.decision.options).toHaveLength(3);
  expect(new Set(dossier.sourceRefs.map((ref: { sourceId: string }) => ref.sourceId))).toEqual(new Set([
    "10000000-0000-0000-0000-000000000001",
    "10000000-0000-0000-0000-000000000007",
    "10000000-0000-0000-0000-000000000008",
    "10000000-0000-0000-0000-000000000009",
    "10000000-0000-0000-0000-000000000010"
  ]));
});
```

Run and expect FAIL.

- [ ] **Step 2: Populate Appendix A.4 content**

Use version ID `30000000-0000-0000-0000-000000000005` and source refs:

```json
[
  { "sourceId": "10000000-0000-0000-0000-000000000001", "locator": "Chương I - Giải phóng dân tộc 1939-1945 và Cách mạng Tháng Tám" },
  { "sourceId": "10000000-0000-0000-0000-000000000007", "locator": "Slides 3-16" },
  { "sourceId": "10000000-0000-0000-0000-000000000008", "locator": "Slides 3-9" },
  { "sourceId": "10000000-0000-0000-0000-000000000009", "locator": "Slides 3-12" },
  { "sourceId": "10000000-0000-0000-0000-000000000010", "locator": "Slides 3-9" }
]
```

- [ ] **Step 3: Generate, test and commit**

```powershell
npm --prefix web run generate:content
npm --prefix web run test -- tests/unit/chapter-1-drafts.test.ts tests/unit/content-validation.test.ts
git add docs/sdd/content/dossiers/05-chop-dung-thoi-co.json web/src/generated/content-catalog.json web/tests/unit/chapter-1-drafts.test.ts
git commit -m "content: draft the August opportunity dossier"
```

---

### Task 9: Add Approved-Path Causal Links and Generate the Review Pack

**Files:**
- Modify: `docs/sdd/content/causal-links.json`
- Create: `scripts/generate-review-pack.mjs`
- Generate: `docs/sdd/content/reviews/chapter-1-review.md`
- Modify: `web/tests/unit/chapter-1-drafts.test.ts`

**Interfaces:**
- Produces `npm run review:chapter-1`.
- Produces one review document covering dossiers 01, 03, 04 and 05.

- [ ] **Step 1: Add failing causal-link tests**

```ts
it("links the four new drafts into the approved Chapter 1 decision chain", () => {
  const registry = JSON.parse(fs.readFileSync(path.join(root, "docs/sdd/content/causal-links.json"), "utf8"));
  const ids = new Set(registry.links.map((link: { id: string }) => link.id));
  expect(ids).toEqual(new Set([
    "ch1-path-to-unification",
    "ch1-unification-to-movement",
    "ch1-movement-to-democratic-window",
    "ch1-democratic-window-to-strategic-shift",
    "ch1-strategic-shift-to-opportunity"
  ]));
});
```

Run and expect FAIL because `causal-links.json` is empty.

- [ ] **Step 2: Add the exact causal links**

Use the following registry entries:

```json
[
  {
    "id": "ch1-path-to-unification",
    "sourceDossierId": "20000000-0000-0000-0000-000000000001",
    "sourceNodeId": "d01-lesson",
    "targetDossierId": "20000000-0000-0000-0000-000000000002",
    "targetNodeId": "hop-nhat-de-mo-duong:context",
    "relation": "condition",
    "explanation": "Việc xác lập con đường cách mạng vô sản và chuẩn bị tư tưởng, chính trị, tổ chức tạo điều kiện cho yêu cầu thống nhất các tổ chức cộng sản.",
    "claimId": "d01-lesson-claim",
    "sourceId": "10000000-0000-0000-0000-000000000003",
    "locator": "Slides 15-19"
  },
  {
    "id": "ch1-unification-to-movement",
    "sourceDossierId": "20000000-0000-0000-0000-000000000002",
    "sourceNodeId": "hop-nhat-de-mo-duong:decision",
    "targetDossierId": "20000000-0000-0000-0000-000000000003",
    "targetNodeId": "d03-context",
    "relation": "condition",
    "explanation": "Sự ra đời của tổ chức lãnh đạo thống nhất và cương lĩnh đầu tiên tạo điều kiện tổ chức phong trào cách mạng 1930-1931.",
    "claimId": "d03-context-claim",
    "sourceId": "10000000-0000-0000-0000-000000000005",
    "locator": "Slides 3-9"
  },
  {
    "id": "ch1-movement-to-democratic-window",
    "sourceDossierId": "20000000-0000-0000-0000-000000000003",
    "sourceNodeId": "d03-lesson",
    "targetDossierId": "20000000-0000-0000-0000-000000000004",
    "targetNodeId": "d04-force",
    "relation": "lesson",
    "explanation": "Kinh nghiệm tổ chức quần chúng và khôi phục lực lượng giúp Đảng sử dụng linh hoạt hình thức công khai, nửa công khai và hợp pháp trong giai đoạn 1936-1939.",
    "claimId": "d03-lesson-claim",
    "sourceId": "10000000-0000-0000-0000-000000000006",
    "locator": "Slides 6-10"
  },
  {
    "id": "ch1-democratic-window-to-strategic-shift",
    "sourceDossierId": "20000000-0000-0000-0000-000000000004",
    "sourceNodeId": "d04-lesson",
    "targetDossierId": "20000000-0000-0000-0000-000000000005",
    "targetNodeId": "d05-contradiction",
    "relation": "response",
    "explanation": "Khi chiến tranh thế giới bùng nổ và không gian dân chủ khép lại, nhiệm vụ trước mắt phải chuyển từ dân sinh, dân chủ sang giải phóng dân tộc.",
    "claimId": "d04-lesson-claim",
    "sourceId": "10000000-0000-0000-0000-000000000007",
    "locator": "Slides 3-10"
  },
  {
    "id": "ch1-strategic-shift-to-opportunity",
    "sourceDossierId": "20000000-0000-0000-0000-000000000005",
    "sourceNodeId": "d05-decision",
    "targetDossierId": "20000000-0000-0000-0000-000000000005",
    "targetNodeId": "d05-result",
    "relation": "outcome",
    "explanation": "Sự chuẩn bị lực lượng gắn với quyết định phát động Tổng khởi nghĩa đúng thời cơ dẫn đến việc giành chính quyền trên phạm vi cả nước.",
    "claimId": "d05-result-claim",
    "sourceId": "10000000-0000-0000-0000-000000000009",
    "locator": "Slides 8-12"
  }
]
```

- [ ] **Step 3: Add the review-pack generator**

Create `scripts/generate-review-pack.mjs`:

```js
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "web/src/generated/content-catalog.json"), "utf8"));
const figma = JSON.parse(fs.readFileSync(path.join(root, "docs/sdd/evidence/phase-2/chapter-1/figma.json"), "utf8"));
const targetOrders = new Set([1, 3, 4, 5]);
const dossiers = catalog.dossiers.filter((dossier) => targetOrders.has(dossier.orderIndex));
const sourcesById = new Map(catalog.sources.map((source) => [source.id, source]));

const lines = [
  "# Chapter 1 Draft Review Pack",
  "",
  "Status: Human review required; no dossier in this report is authorized for publication.",
  "",
  `Figma Make Version: ${figma.makeVersion} - ${figma.makeUrl}`,
  `Figma Design: ${figma.designUrl}`,
  ""
];

for (const dossier of dossiers) {
  lines.push(`## ${String(dossier.orderIndex).padStart(2, "0")} - ${dossier.title}`);
  lines.push("");
  lines.push(`- Status: ${dossier.status}`);
  lines.push(`- Central question: ${dossier.centralQuestion}`);
  lines.push(`- AI role: ${dossier.review.aiAssistance.role}`);
  lines.push("");
  lines.push("### Claims and sources");
  lines.push("");
  for (const claim of dossier.claims) {
    lines.push(`- [ ] **${claim.category}** - ${claim.statement}`);
    for (const link of claim.sourceLinks) {
      const source = sourcesById.get(link.sourceId);
      lines.push(`  - ${source.title}; ${link.locator}; scope: ${link.supportScope}`);
    }
  }
  lines.push("");
  lines.push("### Decision review");
  lines.push("");
  for (const option of dossier.experience.decision.options) {
    lines.push(`- [ ] ${option.label} - ${option.rationale}`);
  }
  lines.push("");
  lines.push("### Human decision");
  lines.push("");
  lines.push("- [ ] Approve");
  lines.push("- [ ] Revise");
  lines.push("- [ ] Reject");
  lines.push("");
}

const output = path.join(root, "docs/sdd/content/reviews/chapter-1-review.md");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${lines.join("\n")}\n`, "utf8");
```

Add to `web/package.json`:

```json
{
  "scripts": {
    "review:chapter-1": "npm run generate:content && node ../scripts/generate-review-pack.mjs"
  }
}
```

- [ ] **Step 4: Generate the review report and verify it contains no approval metadata**

Run:

```powershell
npm --prefix web run review:chapter-1
rg -n "Status: draft|Human review required|Approve|Revise|Reject" docs/sdd/content/reviews/chapter-1-review.md
rg -n "reviewedBy|reviewedAt|approvalRef" docs/sdd/content/dossiers/01-*.json docs/sdd/content/dossiers/03-*.json docs/sdd/content/dossiers/04-*.json docs/sdd/content/dossiers/05-*.json
```

Expected: the report contains review controls; the Draft dossier search returns no human review fields.

- [ ] **Step 5: Commit the causal and review artifacts**

```powershell
git add docs/sdd/content/causal-links.json docs/sdd/content/reviews/chapter-1-review.md scripts/generate-review-pack.mjs web/package.json web/src/generated/content-catalog.json web/tests/unit/chapter-1-drafts.test.ts
git commit -m "docs: generate the Chapter 1 academic review pack"
```

---

### Task 10: Prove Drafts Stay Private End to End

**Files:**
- Create: `web/tests/e2e/public-draft-boundary.spec.ts`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces browser evidence that Draft metadata/content is not public.

- [ ] **Step 1: Write the public-boundary E2E test**

```ts
import { expect, test } from "@playwright/test";

test("Chapter 1 Drafts stay absent from the public catalogue and API", async ({ page, request }) => {
  await page.goto("/ho-so");
  await expect(page.getByRole("link", { name: /Hợp nhất để mở đường/ })).toBeVisible();
  await expect(page.getByText("Con đường nào cho độc lập?")).toHaveCount(0);
  await expect(page.getByText("Giữ mạch phong trào")).toHaveCount(0);
  await expect(page.getByText("Linh hoạt trong một cửa sổ dân chủ")).toHaveCount(0);
  await expect(page.getByText("Chớp đúng thời cơ")).toHaveCount(0);

  const response = await request.get("/api/v1/dossiers");
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.data).toHaveLength(3);
  expect(payload.data.map((item: { status: string }) => item.status)).toEqual(["published", "published", "published"]);

  await page.goto("/ho-so/con-duong-nao-cho-doc-lap");
  await expect(page.getByText(/không tìm thấy|not found/i)).toBeVisible();
});
```

- [ ] **Step 2: Run the E2E test**

```powershell
npm --prefix web run test:e2e -- public-draft-boundary.spec.ts
```

Expected: PASS in desktop and mobile Chromium.

- [ ] **Step 3: Add the Chapter 1 review generator to CI**

After `npm run generate:content`, add:

```yaml
- run: npm run review:chapter-1
```

Do not add the generated review report to CI diff checks unless CI regenerates deterministically from the committed Figma evidence and Draft data.

- [ ] **Step 4: Commit the public-boundary gate**

```powershell
git add .github/workflows/ci.yml web/tests/e2e/public-draft-boundary.spec.ts
git commit -m "test: keep Chapter 1 drafts outside public routes"
```

---

### Task 11: Close Checkpoint A1 Evidence, Push, PR and Deploy

**Files:**
- Modify: `docs/sdd/TASKS.md`
- Modify: `docs/sdd/traceability-matrix.md`
- Modify: `docs/sdd/evidence/phase-2/chapter-1/README.md`
- Modify: `docs/sdd/architecture/ADR-003-phase-1-static-content-preview.md`

**Interfaces:**
- Produces the four-layer Hybrid validation record for Checkpoint A1.
- Produces a stacked PR based on `feat/phase-1-public-slice` and a Vercel deployment whose public output remains at three dossiers.

- [ ] **Step 1: Run the complete local gate**

```powershell
npm --prefix web run generate:content
npm --prefix web run review:chapter-1
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web run test
npm --prefix web run test:e2e
npm --prefix web run build
npm --prefix web audit --audit-level=high
git diff --check
```

Expected:

- all web checks PASS;
- review report regenerates without diff;
- unit tests count 15 canonical dossiers and four complete Chapter 1 Drafts;
- E2E/API still expose three Published dossiers;
- audit reports zero high vulnerabilities.

- [ ] **Step 2: Record the blocked Supabase runtime commands accurately**

Run:

```powershell
npx --yes supabase@2.115.0 status --debug
npx --yes supabase@2.115.0 db reset
npx --yes supabase@2.115.0 test db
```

If Docker/Podman is still missing, record BLOCKED with exact errors. Do not mark RLS runtime PASS.

- [ ] **Step 3: Update SDD task and traceability status**

Set:

- `T020` to in progress, because only Chapter 1 source packages are drafted and not reviewed;
- `T021` to in progress, because four Chapter 1 Drafts exist but five Published dossiers do not;
- `T024` and `T025` remain pending;
- Phase 2 evidence states public count remains three;
- `UX-AC-002` remains Partial;
- `UX-AC-012` gains automated Draft exclusion evidence.

Update ADR-003 to describe the split canonical source and generated runtime projection while preserving its read-only preview boundary.

- [ ] **Step 4: Commit Checkpoint A1 evidence**

```powershell
git add docs/sdd/TASKS.md docs/sdd/traceability-matrix.md docs/sdd/evidence/phase-2/chapter-1/README.md docs/sdd/architecture/ADR-003-phase-1-static-content-preview.md
git commit -m "docs: record Phase 2A draft checkpoint evidence"
```

- [ ] **Step 5: Push the stacked branch and open a PR without merging**

```powershell
git push -u origin feat/phase-2-chapter-1-drafts
gh pr create --base feat/phase-1-public-slice --head feat/phase-2-chapter-1-drafts --title "content: prepare Chapter 1 dossier review batch" --body "Creates the Phase 2A Figma states, split canonical content model, four source-backed Chapter 1 Draft dossiers, publication validators and a human review pack. Public output remains three Published dossiers. Supabase runtime tests remain blocked if Docker/Podman is unavailable."
```

- [ ] **Step 6: Wait for CI and inspect the exact check result**

```powershell
$prNumber = gh pr view feat/phase-2-chapter-1-drafts --json number --jq '.number'
gh pr checks $prNumber --watch
```

Expected: web check SUCCESS. Do not merge.

- [ ] **Step 7: Deploy the checkpoint and smoke-test public invariance**

```powershell
npx --yes vercel@latest deploy --prod --yes --project vnr202-mach-quyet-sach --logs
```

Then verify:

```powershell
$baseUrl = 'https://vnr202-mach-quyet-sach.vercel.app'
$api = Invoke-RestMethod -Uri "$baseUrl/api/v1/dossiers"
if ($api.data.Count -ne 3) { throw "Expected three Published dossiers, got $($api.data.Count)" }
```

Run the remote Playwright smoke for homepage, one Published dossier, Draft 404 and mobile cause-map Slice. Record the Vercel deployment ID and URL in Phase 2 evidence.

---

## Appendix A - Exact Chapter 1 Draft Content Briefs

These briefs are the approved wording source for Tasks 5-8. The JSON files use the IDs shown below, preserve the listed order and do not add publication metadata.

### A.1 Dossier 01 - Con đường nào cho độc lập?

**Briefing**

- Period: `1858-1929`
- Context 1: `Chế độ thuộc địa làm mất độc lập dân tộc, biến đổi cơ cấu xã hội và làm sâu sắc mâu thuẫn giữa toàn thể dân tộc Việt Nam với thực dân Pháp và bộ máy cai trị.`
- Context 2: `Các phong trào yêu nước theo hệ tư tưởng phong kiến và khuynh hướng dân chủ tư sản thể hiện tinh thần đấu tranh nhưng chưa giải quyết được khủng hoảng về đường lối và tổ chức lãnh đạo.`
- Central contradiction: `Yêu cầu giành độc lập ngày càng cấp thiết đối lập với tình trạng chưa có một con đường cách mạng và lực lượng lãnh đạo đủ khả năng quy tụ phong trào.`
- Objective: `Xác định một con đường giải phóng dân tộc phù hợp với điều kiện Việt Nam và chuẩn bị nền tảng tư tưởng, chính trị, tổ chức để biến đường lối thành lực lượng.`
- Constraints:
  1. `Không thể sao chép nguyên trạng mô hình cứu nước cũ đã bộc lộ giới hạn.`
  2. `Con đường mới phải kết nối mục tiêu độc lập với lực lượng quần chúng và một tổ chức lãnh đạo có kỷ luật.`

**Evidence cards**

1. `d01-e1`, event, `Bộ máy thuộc địa và chính sách chia để trị`, summary `Sự thống trị chính trị, khai thác kinh tế và phân hóa xã hội đặt vấn đề độc lập dân tộc thành mâu thuẫn bao trùm.`, source Session 3 Slides 5-10, not distractor.
2. `d01-e2`, assessment, `Giới hạn của khuynh hướng phong kiến`, summary `Các cuộc khởi nghĩa thể hiện ý chí chống ngoại xâm nhưng không xây dựng được đường lối và tổ chức phù hợp với tương quan lực lượng mới.`, source Session 3 Slide 11, not distractor.
3. `d01-e3`, assessment, `Giới hạn của khuynh hướng dân chủ tư sản`, summary `Các hoạt động cải cách, vận động và tổ chức theo khuynh hướng tư sản mở rộng nhận thức nhưng không đưa phong trào vượt qua khủng hoảng lãnh đạo.`, source Session 3 Slides 12-14, not distractor.
4. `d01-e4`, document, `Luận cương về vấn đề dân tộc và thuộc địa`, summary `Việc tiếp cận chủ nghĩa Mác-Lênin giúp Nguyễn Ái Quốc tìm thấy khả năng gắn giải phóng dân tộc với cách mạng vô sản.`, source Session 3 Slides 15-16, not distractor.
5. `d01-e5`, event, `Chuẩn bị tư tưởng, chính trị và tổ chức`, summary `Hoạt động báo chí, truyền bá lý luận, đào tạo cán bộ và Hội Việt Nam Cách mạng Thanh niên tạo nền tảng cho một tổ chức lãnh đạo mới.`, source Session 3 Slides 17-19, not distractor.
6. `d01-e6`, assessment, `Chỉ kiến nghị cải cách trong khuôn khổ thuộc địa`, summary `Kiến nghị hợp pháp có thể tạo sức ép từng phần nhưng không tự giải quyết vấn đề độc lập và tổ chức lãnh đạo cách mạng.`, source Session 3 Slides 10-14, distractor.

**Decision**

- Prompt: `Hướng chuẩn bị nào có khả năng giải quyết đồng thời khủng hoảng đường lối và khủng hoảng tổ chức lãnh đạo?`
- Required evidence: 4.
- `proletarian-path`: `Lựa chọn con đường cách mạng vô sản và chuẩn bị tổ chức`, rationale `Gắn mục tiêu độc lập với lực lượng quần chúng, lý luận cách mạng và quá trình xây dựng đội ngũ cán bộ.`
- `restore-old-model`: `Khôi phục nguyên trạng một mô hình cứu nước cũ`, rationale `Có thể kế thừa tinh thần yêu nước nhưng không xử lý được những giới hạn đã bộc lộ về đường lối và tổ chức.`
- `external-reform`: `Đặt trọng tâm vào cải cách do chính quyền thuộc địa ban phát`, rationale `Có thể tạo thay đổi cục bộ nhưng đặt quyền chủ động chiến lược bên ngoài phong trào dân tộc.`

**Projected consequences**

- `proletarian-path`: `Hình thành tiêu chí đường lối mới` -> `Đào tạo và liên kết lực lượng tiên tiến` -> `Tạo điều kiện thành lập một chính đảng thống nhất`.
- `restore-old-model`: `Khơi lại biểu tượng đấu tranh quen thuộc` -> `Khó mở rộng liên minh xã hội mới` -> `Khủng hoảng lãnh đạo có nguy cơ tiếp tục`.
- `external-reform`: `Tập trung vào nhượng bộ từng phần` -> `Phụ thuộc ý chí của bộ máy cai trị` -> `Mục tiêu độc lập khó trở thành chương trình hành động chủ động`.

**Historical comparison**

- Actual decision: `Nguyễn Ái Quốc lựa chọn con đường cách mạng vô sản, truyền bá chủ nghĩa Mác-Lênin và chuẩn bị các điều kiện tư tưởng, chính trị, tổ chức cho việc thành lập Đảng.`
- Implementation:
  1. `Truyền bá lý luận giải phóng dân tộc thông qua báo chí, tác phẩm và hoạt động quốc tế.`
  2. `Tổ chức đào tạo cán bộ và xây dựng Hội Việt Nam Cách mạng Thanh niên làm tiền đề tổ chức.`
- Results:
  1. `Con đường giải phóng dân tộc mới dần được xác lập trong lực lượng tiên tiến.`
  2. `Nền tảng cán bộ và tổ chức tạo điều kiện trực tiếp cho sự ra đời các tổ chức cộng sản và yêu cầu hợp nhất.`
- Limitations:
  1. `Quá trình truyền bá và tổ chức diễn ra trong điều kiện thuộc địa đàn áp, lực lượng còn phân tán.`
  2. `Sự xuất hiện nhiều tổ chức cộng sản cuối thập niên 1920 tiếp tục đặt ra yêu cầu thống nhất.`
- Lessons:
  1. `Một đường lối chỉ tạo sức mạnh khi gắn với tổ chức và lực lượng có khả năng thực hiện.`
  2. `Tiếp thu lý luận quốc tế phải được vận dụng vào mâu thuẫn và điều kiện cụ thể của Việt Nam.`

**Claims and nodes**

- Claims use IDs `d01-context-claim`, `d01-basis-claim`, `d01-implementation-claim`, `d01-result-claim`, `d01-limitation-claim`, `d01-lesson-claim` and the corresponding statements above.
- Nodes use IDs `d01-context`, `d01-contradiction`, `d01-force`, `d01-decision`, `d01-result`, `d01-lesson`.
- Node labels: `Chế độ thuộc địa và khủng hoảng cứu nước`; `Thiếu đường lối và tổ chức lãnh đạo`; `Quần chúng yêu nước và lực lượng tiên tiến`; `Chọn con đường cách mạng vô sản`; `Chuẩn bị điều kiện thành lập Đảng`; `Lý luận phải gắn với tổ chức và thực tiễn`.

### A.2 Dossier 03 - Giữ mạch phong trào

**Briefing**

- Period: `1930-1935`
- Context 1: `Khủng hoảng kinh tế 1929-1933 tác động mạnh đến Đông Dương, làm đời sống công nhân, nông dân và các tầng lớp lao động thêm khó khăn.`
- Context 2: `Phong trào 1930-1931 phát triển rộng, nổi bật ở Nghệ An và Hà Tĩnh, sau đó bị đàn áp nặng nề khiến hệ thống tổ chức chịu tổn thất.`
- Central contradiction: `Nhu cầu duy trì sức đấu tranh và năng lực lãnh đạo đối lập với khủng bố thuộc địa, tổn thất cán bộ và nguy cơ phong trào bị đứt gãy.`
- Objective: `Bảo toàn hạt nhân tổ chức, tổng kết kinh nghiệm và từng bước khôi phục hệ thống để phong trào có thể tiếp tục phát triển.`
- Constraints:
  1. `Không thể duy trì cường độ đấu tranh như khi cao trào đang lên.`
  2. `Khôi phục tổ chức phải diễn ra trong điều kiện theo dõi, bắt bớ và liên lạc khó khăn.`

**Evidence cards**

1. `d03-e1`, data, `Tác động của khủng hoảng 1929-1933`, `Suy giảm kinh tế và chính sách chuyển gánh nặng khủng hoảng làm mâu thuẫn xã hội thêm gay gắt.`, Session 5 Slides 3-6, not distractor.
2. `d03-e2`, event, `Phong trào công nhân và nông dân 1930`, `Bãi công, biểu tình và hoạt động ngày Quốc tế Lao động cho thấy phong trào có khả năng liên kết và mang nội dung chính trị.`, Session 5 Slide 7, not distractor.
3. `d03-e3`, event, `Xô viết Nghệ-Tĩnh`, `Các hình thức chính quyền cách mạng ở cơ sở thể hiện năng lực tổ chức quần chúng nhưng đối mặt đàn áp quyết liệt.`, Session 5 Slides 8-9, not distractor.
4. `d03-e4`, document, `Luận cương chính trị tháng 10/1930`, `Luận cương hệ thống hóa nhiều vấn đề chiến lược nhưng bộc lộ hạn chế trong nhận thức nhiệm vụ dân tộc và lực lượng cách mạng.`, Session 5 Slides 10-14, not distractor.
5. `d03-e5`, event, `Khôi phục tổ chức 1932-1935`, `Cán bộ và cơ sở còn lại từng bước nối lại liên lạc, xây dựng chương trình hành động và tiến tới Đại hội I.`, Session 5 Slides 15-18, not distractor.
6. `d03-e6`, assessment, `Phát động ngay tổng khởi nghĩa trên toàn quốc`, `Tinh thần tiến công là cần thiết nhưng điều kiện tổ chức và tương quan lực lượng sau đàn áp chưa cho phép một cuộc tổng khởi nghĩa.`, Session 5 Slides 15-18, distractor.

**Decision**

- Prompt: `Sau tổn thất lớn, lựa chọn nào giúp phong trào không bị đứt mạch nhưng vẫn tránh một quyết định vượt quá điều kiện?`
- Required evidence: 4.
- `preserve-rebuild`: `Bảo toàn hạt nhân, tổng kết và từng bước khôi phục tổ chức`, `Giữ lực lượng cốt lõi, điều chỉnh phương thức hoạt động và chuẩn bị cho giai đoạn mới.`
- `immediate-uprising`: `Phát động ngay tổng khởi nghĩa`, `Thể hiện quyết tâm nhưng bỏ qua tổn thất tổ chức và điều kiện khách quan.`
- `permanent-retreat`: `Rút khỏi hoạt động trong nước vô thời hạn`, `Giảm rủi ro trước mắt nhưng làm suy yếu liên hệ với quần chúng và khả năng phục hồi.`

**Projected consequences**

- `preserve-rebuild`: `Giữ hạt nhân cán bộ` -> `Khôi phục cơ sở và liên lạc` -> `Tái lập năng lực lãnh đạo phong trào`.
- `immediate-uprising`: `Huy động trong điều kiện tổ chức suy yếu` -> `Dễ bị cô lập và đàn áp` -> `Tổn thất có thể sâu hơn`.
- `permanent-retreat`: `Giảm hoạt động công khai và bí mật` -> `Mất liên hệ với cơ sở` -> `Phong trào khó phục hồi khi điều kiện thay đổi`.

**Historical comparison**

- Actual decision: `Đảng và các cán bộ còn lại kiên trì khôi phục tổ chức, xây dựng chương trình hành động, nối lại phong trào và tiến tới Đại hội I năm 1935.`
- Implementation: `Duy trì cơ sở bí mật và liên lạc trong điều kiện đàn áp.`; `Tổng kết phong trào, xây dựng chương trình hành động và củng cố hệ thống tổ chức.`
- Results: `Hệ thống tổ chức từng bước được phục hồi.`; `Năng lực lãnh đạo được tái lập để bước vào giai đoạn đấu tranh mới.`
- Limitations: `Nhiều cán bộ, cơ sở và quần chúng bị tổn thất.`; `Một số nhận thức chiến lược và lực lượng vẫn cần tiếp tục điều chỉnh.`
- Lessons: `Sau cao trào và đàn áp, bảo toàn tổ chức là điều kiện để duy trì năng lực hành động lâu dài.`; `Tổng kết hạn chế là một phần của phục hồi, không chỉ khôi phục số lượng cơ sở.`

**Claims and nodes**

- Claim IDs: `d03-context-claim`, `d03-basis-claim`, `d03-implementation-claim`, `d03-result-claim`, `d03-limitation-claim`, `d03-lesson-claim`.
- Node IDs: `d03-context`, `d03-contradiction`, `d03-force`, `d03-decision`, `d03-result`, `d03-lesson`.
- Node labels: `Khủng hoảng và cao trào 1930-1931`; `Đàn áp đe dọa làm đứt gãy phong trào`; `Hạt nhân cán bộ và cơ sở quần chúng`; `Bảo toàn và khôi phục tổ chức`; `Năng lực lãnh đạo được tái lập`; `Phục hồi phải đi cùng tổng kết hạn chế`.

### A.3 Dossier 04 - Linh hoạt trong một cửa sổ dân chủ

**Briefing**

- Period: `1936-1939`
- Context 1: `Nguy cơ phát xít và chiến tranh thúc đẩy phong trào chống phát xít, trong khi Mặt trận Nhân dân Pháp thắng cử tạo ra một khoảng không hoạt động chính trị tương đối thuận lợi hơn.`
- Context 2: `Ở Đông Dương, yêu cầu dân sinh, dân chủ, cơm áo và hòa bình trở thành điểm quy tụ rộng của nhiều tầng lớp.`
- Central contradiction: `Mục tiêu chiến lược giải phóng dân tộc lâu dài phải được duy trì trong khi nhiệm vụ và hình thức đấu tranh trước mắt cần điều chỉnh theo một không gian chính trị tạm thời.`
- Objective: `Mở rộng lực lượng quần chúng và năng lực chính trị thông qua các mục tiêu trước mắt cùng hình thức công khai, nửa công khai, hợp pháp và nửa hợp pháp.`
- Constraints: `Không được nhầm nhiệm vụ trước mắt với từ bỏ mục tiêu chiến lược.`; `Khoảng không dân chủ phụ thuộc tình hình quốc tế và chính sách thuộc địa nên có thể khép lại nhanh chóng.`

**Evidence cards**

1. `d04-e1`, event, `Nguy cơ phát xít và chiến tranh`, `Sự hình thành phe phát xít làm nhiệm vụ chống phát xít, chống chiến tranh trở thành yêu cầu cấp bách.`, Session 6 Slides 3-4, not distractor.
2. `d04-e2`, event, `Mặt trận Nhân dân Pháp thắng cử`, `Thay đổi chính trị tại Pháp tạo điều kiện tương đối cho yêu sách dân chủ ở thuộc địa.`, Session 6 Slide 5, not distractor.
3. `d04-e3`, document, `Chủ trương tháng 7/1936`, `Chủ trương điều chỉnh nhiệm vụ trước mắt và phương thức tập hợp lực lượng phù hợp bối cảnh.`, Session 6 Slides 6-7, not distractor.
4. `d04-e4`, event, `Phong trào dân sinh, dân chủ`, `Mít tinh, hội họp, báo chí và vận động dân nguyện mở rộng khả năng tổ chức quần chúng.`, Session 6 Slides 8-10, not distractor.
5. `d04-e5`, assessment, `Mặt trận tập hợp rộng rãi`, `Việc xây dựng hình thức mặt trận cho phép kết nối nhiều lực lượng quanh yêu cầu trước mắt.`, Session 6 Slides 6-10, not distractor.
6. `d04-e6`, assessment, `Chỉ sử dụng đấu tranh bí mật và vũ trang`, `Hoạt động bí mật vẫn cần thiết nhưng nếu loại bỏ mọi hình thức hợp pháp sẽ bỏ lỡ khả năng mở rộng lực lượng trong cửa sổ dân chủ.`, Session 6 Slides 8-10, distractor.

**Decision**

- Prompt: `Lựa chọn nào vừa tận dụng được không gian dân chủ tạm thời vừa giữ được định hướng chiến lược lâu dài?`
- Required evidence: 4.
- `flexible-front`: `Mở rộng mặt trận và kết hợp hình thức đấu tranh linh hoạt`, `Tập hợp lực lượng quanh yêu cầu trước mắt, đồng thời duy trì tổ chức và định hướng chiến lược.`
- `unchanged-slogans`: `Giữ nguyên toàn bộ khẩu hiệu và hình thức của giai đoạn trước`, `Thể hiện tính liên tục nhưng không phản ánh nhiệm vụ trước mắt và tương quan chính trị mới.`
- `abandon-strategy`: `Chỉ theo đuổi cải cách dân chủ và từ bỏ mục tiêu độc lập`, `Có thể mở rộng hoạt động trước mắt nhưng làm mất định hướng giải phóng dân tộc.`

**Projected consequences**

- `flexible-front`: `Mở rộng yêu cầu dễ quy tụ` -> `Tăng năng lực tổ chức công khai và nửa công khai` -> `Tích lũy lực lượng và kinh nghiệm chính trị`.
- `unchanged-slogans`: `Khẩu hiệu ít phù hợp không gian mới` -> `Khó hình thành liên minh rộng` -> `Bỏ lỡ cơ hội phát triển lực lượng`.
- `abandon-strategy`: `Tập trung hoàn toàn vào cải cách` -> `Phụ thuộc không gian dân chủ do chính quyền quyết định` -> `Khó chuyển hướng khi chiến tranh và đàn áp trở lại`.

**Historical comparison**

- Actual decision: `Đảng điều chỉnh nhiệm vụ trước mắt, xây dựng mặt trận rộng rãi và kết hợp nhiều hình thức đấu tranh công khai, nửa công khai, hợp pháp và nửa hợp pháp.`
- Implementation: `Tổ chức phong trào dân nguyện, mít tinh, hội họp và hoạt động báo chí.`; `Tập hợp nhiều tầng lớp quanh yêu cầu tự do, dân chủ, cơm áo và hòa bình.`
- Results: `Lực lượng quần chúng và ảnh hưởng chính trị được mở rộng.`; `Đội ngũ cán bộ tích lũy kinh nghiệm tổ chức và hoạt động công khai.`
- Limitations: `Các yêu sách chưa thể giải quyết mâu thuẫn dân tộc căn bản.`; `Không gian hoạt động nhanh chóng bị thu hẹp khi chiến tranh bùng nổ và đàn áp trở lại.`
- Lessons: `Nhiệm vụ và hình thức đấu tranh phải được điều chỉnh theo bối cảnh cụ thể.`; `Linh hoạt trước mắt phải gắn với việc giữ mục tiêu chiến lược và tổ chức lâu dài.`

**Claims and nodes**

- Claim IDs: `d04-context-claim`, `d04-basis-claim`, `d04-implementation-claim`, `d04-result-claim`, `d04-limitation-claim`, `d04-lesson-claim`.
- Node IDs: `d04-context`, `d04-contradiction`, `d04-force`, `d04-decision`, `d04-result`, `d04-lesson`.
- Node labels: `Cửa sổ chống phát xít và dân chủ`; `Điều chỉnh trước mắt nhưng không mất mục tiêu`; `Mặt trận rộng và quần chúng đô thị-nông thôn`; `Kết hợp hình thức đấu tranh linh hoạt`; `Mở rộng lực lượng và kinh nghiệm`; `Linh hoạt phải gắn với mục tiêu chiến lược`.

### A.4 Dossier 05 - Chớp đúng thời cơ

**Briefing**

- Period: `1939-1945`
- Context 1: `Chiến tranh thế giới thứ hai làm thay đổi sâu sắc tình hình Đông Dương, đặt dân tộc dưới sự thống trị chồng chéo và làm nhiệm vụ giải phóng dân tộc trở nên cấp bách.`
- Context 2: `Từ chuyển hướng chiến lược 1939-1941, phong trào từng bước xây dựng mặt trận, lực lượng chính trị, lực lượng vũ trang và căn cứ địa trước khi thời cơ trực tiếp xuất hiện năm 1945.`
- Central contradiction: `Khởi nghĩa quá sớm khi lực lượng chưa đủ có thể thất bại, nhưng chậm quyết định khi bộ máy đối phương khủng hoảng có thể làm mất thời cơ giành chính quyền.`
- Objective: `Kết hợp chuẩn bị lâu dài với khả năng đánh giá tình thế và phát động Tổng khởi nghĩa trong khoảng thời gian có lợi nhất.`
- Constraints: `Phải thống nhất hành động trên phạm vi rộng trong thời gian rất ngắn.`; `Quyết định phải dựa trên cả sự tan rã của đối phương và mức độ sẵn sàng của lực lượng trong nước.`

**Evidence cards**

1. `d05-e1`, document, `Chuyển hướng chiến lược 1939-1941`, `Các Hội nghị Trung ương VI-VIII từng bước đặt nhiệm vụ giải phóng dân tộc lên hàng đầu và xác định chuẩn bị khởi nghĩa là nhiệm vụ trung tâm.`, Session 7 Slides 3-16, not distractor.
2. `d05-e2`, event, `Việt Minh và khối đoàn kết dân tộc`, `Mặt trận Việt Minh tạo khuôn khổ tập hợp rộng rãi lực lượng theo mục tiêu giải phóng dân tộc.`, Session 7 Slides 10-15 and Session 8 Slides 5-7, not distractor.
3. `d05-e3`, event, `Lực lượng vũ trang và căn cứ địa`, `Cứu quốc quân, đội vũ trang và hệ thống căn cứ tạo năng lực hỗ trợ khởi nghĩa khi tình thế chuyển biến.`, Session 8 Slides 8-9, not distractor.
4. `d05-e4`, document, `Nhật đảo chính Pháp và chỉ thị tháng 3/1945`, `Sự thay đổi kẻ thù trực tiếp dẫn đến điều chỉnh khẩu hiệu và phát động cao trào kháng Nhật cứu nước.`, Session 9 Slides 3-7, not distractor.
5. `d05-e5`, event, `Nhật đầu hàng và khoảng trống quyền lực`, `Tháng 8/1945, thất bại của Nhật làm bộ máy cai trị khủng hoảng trong khi lực lượng cách mạng đã được huy động.`, Session 9 Slides 8-12, not distractor.
6. `d05-e6`, assessment, `Chờ lực lượng Đồng minh thiết lập trật tự mới`, `Chờ đợi có thể tránh rủi ro tức thời nhưng trao quyền chủ động cho lực lượng bên ngoài và làm thời cơ trong nước trôi qua.`, Session 9 Slides 8-11, distractor.

**Decision**

- Prompt: `Khi đối phương khủng hoảng và lực lượng trong nước đã được chuẩn bị, quyết định nào bảo đảm quyền chủ động?`
- Required evidence: 4.
- `general-uprising`: `Phát động Tổng khởi nghĩa trong thời cơ tháng Tám`, `Kết hợp khoảng trống quyền lực với lực lượng chính trị, vũ trang và căn cứ đã chuẩn bị.`
- `uprising-1939`: `Phát động tổng khởi nghĩa ngay từ năm 1939`, `Thể hiện quyết tâm nhưng chưa có đủ lực lượng, mặt trận và điều kiện trực tiếp.`
- `wait-allies`: `Chờ trật tự sau chiến tranh do lực lượng bên ngoài xác lập`, `Giảm quyết định trong ngắn hạn nhưng có nguy cơ mất quyền chủ động và để lực lượng khác chiếm khoảng trống.`

**Projected consequences**

- `general-uprising`: `Phát lệnh khi bộ máy đối phương rối loạn` -> `Huy động lực lượng trên phạm vi rộng` -> `Giành chính quyền trước khi trật tự thuộc địa được tái lập`.
- `uprising-1939`: `Hành động khi lực lượng chưa hoàn chỉnh` -> `Khó phối hợp toàn quốc` -> `Nguy cơ bị đàn áp trước khi thời cơ xuất hiện`.
- `wait-allies`: `Không sử dụng khoảng trống quyền lực` -> `Các lực lượng bên ngoài tiến vào` -> `Điều kiện giành chính quyền chủ động trở nên bất lợi hơn`.

**Historical comparison**

- Actual decision: `Sau quá trình chuyển hướng và chuẩn bị lực lượng, Đảng quyết định phát động Tổng khởi nghĩa khi Nhật đầu hàng và bộ máy cai trị khủng hoảng trong tháng 8/1945.`
- Implementation: `Phát triển cao trào kháng Nhật, mở rộng các hình thức giành chính quyền từng phần và chuẩn bị cơ quan lãnh đạo khởi nghĩa.`; `Triệu tập Hội nghị toàn quốc và Đại hội Quốc dân, phát lệnh khởi nghĩa và huy động lực lượng tại các địa phương.`
- Results: `Chính quyền được giành trên phạm vi cả nước trong thời gian ngắn.`; `Nước Việt Nam Dân chủ Cộng hòa ra đời, mở ra kỷ nguyên độc lập dân tộc.`
- Limitations: `Chính quyền mới phải đối mặt ngay với nhiều khó khăn trong nước và sự can thiệp của các lực lượng bên ngoài.`; `Thắng lợi không xóa bỏ ngay mọi hậu quả kinh tế, xã hội và tổ chức do chế độ cũ để lại.`
- Lessons: `Thời cơ chỉ có thể được tận dụng khi đã có quá trình chuẩn bị lực lượng lâu dài.`; `Quyết định chiến lược phải kết hợp đánh giá đúng tình thế với khả năng tổ chức hành động nhanh và thống nhất.`

**Claims and nodes**

- Claim IDs: `d05-context-claim`, `d05-basis-claim`, `d05-implementation-claim`, `d05-result-claim`, `d05-limitation-claim`, `d05-lesson-claim`.
- Node IDs: `d05-context`, `d05-contradiction`, `d05-force`, `d05-decision`, `d05-result`, `d05-lesson`.
- Node labels: `Chiến tranh và sự thống trị chồng chéo`; `Khởi nghĩa sớm hay để lỡ thời cơ`; `Việt Minh, lực lượng vũ trang và căn cứ`; `Phát động Tổng khởi nghĩa đúng thời cơ`; `Giành chính quyền và lập nhà nước mới`; `Chuẩn bị lâu dài để hành động đúng lúc`.

---

## Plan Self-Review Checklist

- Every Checkpoint A1 requirement maps to a task.
- Figma Make approval is a hard gate before repository implementation.
- Four Drafts remain hidden; no publication task exists in this plan.
- All source sessions and locator ranges are explicit.
- New data contracts preserve the existing public repository API.
- The review generator cannot add human approval metadata.
- Tests cover structure, publication safety, API visibility and Draft 404 behavior.
- Supabase runtime limitations remain explicit.
- Final integration includes commit, push, stacked PR, CI, deployment and remote smoke without merge.
