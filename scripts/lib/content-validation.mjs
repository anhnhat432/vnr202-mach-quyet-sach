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
  const claimIds = new Set();
  const nodeOwners = new Map();

  if (catalog.dossiers.length !== 15) errors.push("CATALOG_COUNT: expected 15 dossiers");

  for (const dossier of catalog.dossiers) {
    if (slugs.has(dossier.slug)) errors.push(`DUPLICATE_SLUG: ${dossier.slug}`);
    if (orders.has(dossier.orderIndex)) errors.push(`DUPLICATE_ORDER: ${dossier.orderIndex}`);
    slugs.add(dossier.slug);
    orders.add(dossier.orderIndex);

    const declaredSourceIds = new Set((dossier.sourceRefs ?? []).map((ref) => ref.sourceId));
    for (const ref of dossier.sourceRefs ?? []) {
      if (!sourceIds.has(ref.sourceId)) errors.push(`UNKNOWN_SOURCE: ${dossier.slug}:${ref.sourceId}`);
      if (!ref.locator?.trim()) errors.push(`EMPTY_LOCATOR: ${dossier.slug}:${ref.sourceId}`);
    }

    for (const evidence of dossier.experience?.evidence ?? []) {
      for (const sourceId of evidence.sourceIds) {
        if (!sourceIds.has(sourceId)) errors.push(`UNKNOWN_EVIDENCE_SOURCE: ${dossier.slug}:${evidence.id}`);
        if (!declaredSourceIds.has(sourceId)) {
          errors.push(`UNDECLARED_EVIDENCE_SOURCE: ${dossier.slug}:${evidence.id}:${sourceId}`);
        }
      }
    }

    for (const claim of dossier.claims ?? []) {
      if (claimIds.has(claim.id)) errors.push(`DUPLICATE_CLAIM_ID: ${claim.id}`);
      claimIds.add(claim.id);
      for (const link of claim.sourceLinks) {
        if (!sourceIds.has(link.sourceId)) errors.push(`UNKNOWN_CLAIM_SOURCE: ${dossier.slug}:${claim.id}`);
        if (!declaredSourceIds.has(link.sourceId)) {
          errors.push(`UNDECLARED_CLAIM_SOURCE: ${dossier.slug}:${claim.id}:${link.sourceId}`);
        }
      }
    }

    const nodes =
      dossier.causalNodes ??
      (dossier.experience
        ? ["context", "contradiction", "decision", "result", "lesson"].map((lane) => ({
            id: `${dossier.slug}:${lane}`,
          }))
        : []);
    for (const node of nodes) {
      if (nodeOwners.has(node.id)) errors.push(`DUPLICATE_NODE_ID: ${node.id}`);
      nodeOwners.set(node.id, dossier.id);
      if (node.claimId && !dossier.claims?.some((claim) => claim.id === node.claimId)) {
        errors.push(`UNKNOWN_NODE_CLAIM: ${dossier.slug}:${node.id}:${node.claimId}`);
      }
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
    if (nodeOwners.get(link.sourceNodeId) !== link.sourceDossierId) {
      errors.push(`UNKNOWN_LINK_SOURCE_NODE: ${link.id}:${link.sourceNodeId}`);
    }
    if (nodeOwners.get(link.targetNodeId) !== link.targetDossierId) {
      errors.push(`UNKNOWN_LINK_TARGET_NODE: ${link.id}:${link.targetNodeId}`);
    }
    if (!claimIds.has(link.claimId)) errors.push(`UNKNOWN_LINK_CLAIM: ${link.id}:${link.claimId}`);
    if (!sourceIds.has(link.sourceId)) errors.push(`UNKNOWN_LINK_SOURCE_RECORD: ${link.id}:${link.sourceId}`);
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
