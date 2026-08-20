import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "web/src/generated/content-catalog.json"), "utf8"));
const figma = JSON.parse(
  fs.readFileSync(path.join(root, "docs/sdd/evidence/phase-2/chapter-1/figma.json"), "utf8"),
);
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
  "",
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
if (lines.at(-1) === "") lines.pop();
fs.writeFileSync(output, `${lines.join("\n")}\n`, "utf8");
