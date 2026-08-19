import fs from "node:fs";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) throw new Error("usage: node generate-phase1-seed.mjs <input.json> <output.sql>");

const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const nullable = (value) => (value === null || value === undefined ? "null" : quote(value));
const jsonb = (value) => `${quote(JSON.stringify(value))}::jsonb`;
const derivedId = (prefix, value) => `${prefix}-0000-0000-0000-${String(value).padStart(12, "0")}`;
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
  sql.push(`insert into public.dossier_versions
    (id, dossier_id, version, schema_version, content, reviewed_at, published_at)
    values (${quote(dossier.versionId)}, ${quote(dossier.id)}, 1, 1, ${jsonb(dossier.experience)}, now(), now());`);
  sql.push(`update public.dossiers set current_version_id = ${quote(dossier.versionId)}, updated_at = now()
    where id = ${quote(dossier.id)};`);

  const comparison = dossier.experience.historicalComparison;
  const claimSpecs = [
    ["context", dossier.experience.briefing.context[0]],
    ["basis", dossier.experience.briefing.centralContradiction],
    ["implementation", comparison.implementation[0]],
    ["result", comparison.results[0]],
    ["limitation", comparison.limitations[0]],
    ["lesson", dossier.experience.lessons[0]],
  ];
  const claimIds = [];
  claimSpecs.forEach(([category, statement], index) => {
    const claimId = derivedId("40000000", dossier.orderIndex * 10 + index + 1);
    claimIds.push(claimId);
    sql.push(`insert into public.claims (id, dossier_version_id, category, statement)
      values (${quote(claimId)}, ${quote(dossier.versionId)}, ${quote(category)}, ${quote(statement)});`);
    const sourceId = dossier.experience.sources[index % dossier.experience.sources.length].id;
    sql.push(`insert into public.claim_source_links (claim_id, source_id, support_scope)
      values (${quote(claimId)}, ${quote(sourceId)}, ${quote(`Hỗ trợ luận điểm ${category} trong hồ sơ ${dossier.title}.`)});`);
  });

  const nodes = [
    ["context", dossier.experience.briefing.context[0]],
    ["contradiction", dossier.experience.briefing.centralContradiction],
    ["decision", comparison.actualDecision],
    ["result", comparison.results[0]],
    ["lesson", dossier.experience.lessons[0]],
  ];
  const nodeIds = nodes.map(([, label], index) => {
    const nodeId = derivedId("50000000", dossier.orderIndex * 10 + index + 1);
    sql.push(`insert into public.causal_nodes
      (id, dossier_version_id, lane, label, explanation, sort_index)
      values (${quote(nodeId)}, ${quote(dossier.versionId)}, ${quote(nodes[index][0])}, ${quote(label)}, ${quote(label)}, ${index + 1});`);
    return nodeId;
  });
  const edgeSpecs = [
    [0, 1, "condition", claimIds[0]],
    [1, 2, "response", claimIds[1]],
    [2, 3, "outcome", claimIds[3]],
    [3, 4, "lesson", claimIds[5]],
  ];
  edgeSpecs.forEach(([from, to, relation, claimId], index) => {
    sql.push(`insert into public.causal_edges
      (id, source_node_id, target_node_id, relation, explanation, claim_id)
      values (${quote(derivedId("60000000", dossier.orderIndex * 10 + index + 1))}, ${quote(nodeIds[from])},
        ${quote(nodeIds[to])}, ${quote(relation)}, ${quote(nodes[to][1])}, ${quote(claimId)});`);
  });
}

sql.push(`do $$
declare planned_count int; published_count int;
begin
  select count(*) into planned_count from public.dossiers;
  select count(*) into published_count from public.dossiers where status = 'published';
  if planned_count <> 15 then raise exception 'expected 15 planned dossiers, got %', planned_count; end if;
  if published_count <> 3 then raise exception 'expected 3 phase-one published dossiers, got %', published_count; end if;
end $$;`);
sql.push("commit;");
fs.writeFileSync(outputPath, `${sql.join("\n\n")}\n`, "utf8");
