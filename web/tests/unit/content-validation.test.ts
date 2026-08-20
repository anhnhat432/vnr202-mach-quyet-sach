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
      (item: { kind: string }) => item.kind === "legacy-baseline",
    );
    const dossier = copy.dossiers.find((item: { id: string }) => item.id === legacy.dossierId);
    expect(dossier.review.reviewedBy).toBeUndefined();
    expect(dossier.review.reviewedAt).toBeUndefined();
    expect(dossier.review.approvalRef).toBeUndefined();
    dossier.title = `${dossier.title} changed`;
    expect(() => validateContentCatalog(copy)).toThrow(/LEGACY_CONTENT_CHANGED/);
  });

  it("rejects unresolved evidence and claim source references", () => {
    const evidenceCopy = structuredClone(catalog);
    const evidenceDraft = evidenceCopy.dossiers.find((item: { orderIndex: number }) => item.orderIndex === 1);
    evidenceDraft.experience.evidence[0].sourceIds[0] = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    expect(() => validateContentCatalog(evidenceCopy)).toThrow(/UNKNOWN_EVIDENCE_SOURCE/);

    const claimCopy = structuredClone(catalog);
    const claimDraft = claimCopy.dossiers.find((item: { orderIndex: number }) => item.orderIndex === 1);
    claimDraft.claims[0].sourceLinks[0].sourceId = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    expect(() => validateContentCatalog(claimCopy)).toThrow(/UNKNOWN_CLAIM_SOURCE/);
  });

  it("rejects causal links that do not resolve to canonical nodes and claims", () => {
    const nodeCopy = structuredClone(catalog);
    nodeCopy.causalLinks[0].sourceNodeId = "missing-node";
    expect(() => validateContentCatalog(nodeCopy)).toThrow(/UNKNOWN_LINK_SOURCE_NODE/);

    const claimCopy = structuredClone(catalog);
    claimCopy.causalLinks[0].claimId = "missing-claim";
    expect(() => validateContentCatalog(claimCopy)).toThrow(/UNKNOWN_LINK_CLAIM/);
  });
});
