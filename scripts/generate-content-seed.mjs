import fs from "node:fs";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  throw new Error("usage: node generate-content-seed.mjs <content-catalog.json> <output.sql>");
}

const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const nullable = (value) => (value === null || value === undefined ? "null" : quote(value));
const timestamp = (value) => (value ? `${quote(value)}::timestamptz` : "null");
const jsonb = (value) => `${quote(JSON.stringify(value))}::jsonb`;
const derivedId = (prefix, value) => `${prefix}-0000-0000-0000-${String(value).padStart(12, "0")}`;
const publications = new Map(data.publicationManifest.publications.map((item) => [item.dossierId, item]));
const claimIds = new Map();
const nodeIds = new Map();
const sql = ["begin;"];

for (const source of data.sources) {
  sql.push(`insert into public.sources
    (id, title, author_or_issuer, publication_year, locator, url, source_type, rights_note, verification_status)
    values (${quote(source.id)}, ${quote(source.title)}, ${quote(source.authorOrIssuer)}, ${source.publicationYear},
      ${quote(source.locator)}, ${nullable(source.url)}, ${quote(source.sourceType)}, ${quote(source.rightsNote)},
      ${quote(source.verificationStatus)});`);
}

for (const dossier of data.dossiers) {
  sql.push(`insert into public.dossiers
    (id, slug, chapter, order_index, title, central_question, status)
    values (${quote(dossier.id)}, ${quote(dossier.slug)}, ${quote(dossier.chapter)}, ${dossier.orderIndex},
      ${quote(dossier.title)}, ${quote(dossier.centralQuestion)}, ${quote(dossier.status)});`);

  if (!dossier.experience) continue;

  const publication = publications.get(dossier.id);
  const reviewedAt = publication?.kind === "human-approval" ? publication.reviewedAt : dossier.review?.reviewedAt;
  const publishedAt =
    publication?.kind === "legacy-baseline"
      ? publication.capturedAt
      : publication?.kind === "human-approval"
        ? publication.reviewedAt
        : undefined;

  sql.push(`insert into public.dossier_versions
    (id, dossier_id, version, schema_version, content, reviewed_at, published_at)
    values (${quote(dossier.versionId)}, ${quote(dossier.id)}, 1, 2, ${jsonb(dossier.experience)},
      ${timestamp(reviewedAt)}, ${timestamp(publishedAt)});`);
  sql.push(`update public.dossiers set current_version_id = ${quote(dossier.versionId)}, updated_at = now()
    where id = ${quote(dossier.id)};`);

  const comparison = dossier.experience.historicalComparison;
  const authoredClaims = dossier.claims;
  const claims =
    authoredClaims ??
    [
      ["context", dossier.experience.briefing.context[0]],
      ["basis", dossier.experience.briefing.centralContradiction],
      ["implementation", comparison.implementation[0]],
      ["result", comparison.results[0]],
      ["limitation", comparison.limitations[0]],
      ["lesson", dossier.experience.lessons[0]],
    ].map(([category, statement], index) => ({
      id: `${dossier.slug}:claim:${index}`,
      category,
      statement,
      sourceLinks: [
        {
          sourceId: dossier.experience.sources[index % dossier.experience.sources.length].id,
          supportScope: `Hỗ trợ luận điểm ${category} trong hồ sơ ${dossier.title}.`,
        },
      ],
    }));

  claims.forEach((claim, index) => {
    const claimId = derivedId("40000000", dossier.orderIndex * 10 + index + 1);
    claimIds.set(claim.id, claimId);
    sql.push(`insert into public.claims (id, dossier_version_id, category, statement)
      values (${quote(claimId)}, ${quote(dossier.versionId)}, ${quote(claim.category)}, ${quote(claim.statement)});`);
    for (const sourceLink of claim.sourceLinks) {
      const scope = sourceLink.locator
        ? `${sourceLink.supportScope} Locator: ${sourceLink.locator}.`
        : sourceLink.supportScope;
      sql.push(`insert into public.claim_source_links (claim_id, source_id, support_scope)
      values (${quote(claimId)}, ${quote(sourceLink.sourceId)}, ${quote(scope)});`);
    }
  });

  const authoredNodes = dossier.causalNodes;
  const nodes =
    authoredNodes ??
    [
      ["context", dossier.experience.briefing.context[0]],
      ["contradiction", dossier.experience.briefing.centralContradiction],
      ["decision", comparison.actualDecision],
      ["result", comparison.results[0]],
      ["lesson", dossier.experience.lessons[0]],
    ].map(([lane, explanation]) => ({
      id: `${dossier.slug}:${lane}`,
      lane,
      label: explanation,
      explanation,
    }));

  const databaseNodeIds = nodes.map((node, index) => {
    const nodeId = derivedId("50000000", dossier.orderIndex * 10 + index + 1);
    nodeIds.set(node.id, nodeId);
    sql.push(`insert into public.causal_nodes
      (id, dossier_version_id, lane, label, explanation, sort_index)
      values (${quote(nodeId)}, ${quote(dossier.versionId)}, ${quote(node.lane)}, ${quote(node.label)},
        ${quote(node.explanation)}, ${index + 1});`);
    return nodeId;
  });

  const relations =
    nodes.length === 6
      ? ["condition", "condition", "response", "outcome", "lesson"]
      : ["condition", "response", "outcome", "lesson"];
  const edgeClaimIndexes = nodes.length === 6 ? [0, 1, 2, 3, 5] : [0, 1, 3, 5];
  relations.forEach((relation, index) => {
    const claimId = derivedId("40000000", dossier.orderIndex * 10 + edgeClaimIndexes[index] + 1);
    sql.push(`insert into public.causal_edges
      (id, source_node_id, target_node_id, relation, explanation, claim_id)
      values (${quote(derivedId("60000000", dossier.orderIndex * 10 + index + 1))},
        ${quote(databaseNodeIds[index])}, ${quote(databaseNodeIds[index + 1])}, ${quote(relation)},
        ${quote(nodes[index + 1].explanation)}, ${quote(claimId)});`);
  });
}

data.causalLinks.forEach((link, index) => {
  const sourceNodeId = nodeIds.get(link.sourceNodeId);
  const targetNodeId = nodeIds.get(link.targetNodeId);
  const claimId = claimIds.get(link.claimId);
  if (!sourceNodeId || !targetNodeId || !claimId) {
    throw new Error(`Cannot resolve causal link ${link.id}`);
  }
  sql.push(`insert into public.causal_edges
      (id, source_node_id, target_node_id, relation, explanation, claim_id)
      values (${quote(derivedId("61000000", index + 1))}, ${quote(sourceNodeId)}, ${quote(targetNodeId)},
        ${quote(link.relation)}, ${quote(link.explanation)}, ${quote(claimId)});`);
});

sql.push(`do $$
declare planned_count int; published_count int;
begin
  select count(*) into planned_count from public.dossiers;
  select count(*) into published_count from public.dossiers where status = 'published';
  if planned_count <> 15 then raise exception 'expected 15 planned dossiers, got %', planned_count; end if;
  if published_count <> 3 then raise exception 'expected 3 published dossiers, got %', published_count; end if;
end $$;`);
sql.push("commit;");
fs.writeFileSync(outputPath, `${sql.join("\n\n")}\n`, "utf8");
