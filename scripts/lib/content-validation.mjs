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
