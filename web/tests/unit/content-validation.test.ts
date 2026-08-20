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
});
