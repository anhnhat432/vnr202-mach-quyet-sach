// Question bank command line: validate authoring files, import them as Drafts, build the review pack.
//
//   node scripts/content/questions.mjs validate [file...]        # default: docs/sdd/content/questions/*.json
//   node scripts/content/questions.mjs review-pack [--out file]  # Markdown for the academic reviewer
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… IMPORT_ACTOR_ID=<admin profile id> \
//     node scripts/content/questions.mjs import [file...] [--apply]   # dry run unless --apply
//
// Import creates Drafts only. Review and publication are human actions in the admin API; nothing
// in this tool (or in any file it reads) can mark a question Reviewed or Published.
import fs from "node:fs";
import path from "node:path";
import { analyzeBank, buildReviewPack, toDraftArguments, validateQuestionDocument } from "../lib/question-bank.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const questionsDir = path.join(root, "docs/sdd/content/questions");
const args = process.argv.slice(2);
const command = args.shift();
const flag = (name) => args.includes(name);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const files = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--out").length
  ? args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--out")
  : fs.existsSync(questionsDir) ? fs.readdirSync(questionsDir).filter((f) => f.endsWith(".json")).sort().map((f) => path.join(questionsDir, f)) : [];

const registry = JSON.parse(fs.readFileSync(path.join(root, "docs/sdd/content/sources.json"), "utf8"));
const sources = new Map(registry.sources.map((s) => [s.id, s.verificationStatus]));
const sourceInfo = new Map(registry.sources.map((s) => [s.id, s]));

function loadAll() {
  const all = [];
  let failed = false;
  const knownKeys = new Set();
  for (const file of files) {
    const doc = JSON.parse(fs.readFileSync(file, "utf8"));
    const { errors, warnings } = validateQuestionDocument(doc, { sources, knownKeys });
    for (const q of doc.questions ?? []) knownKeys.add(q.key);
    const rel = path.relative(root, file);
    for (const e of errors) { console.error(`ERROR ${rel}: ${e}`); failed = true; }
    for (const w of warnings) console.warn(`warn  ${rel}: ${w}`);
    for (const q of doc.questions ?? []) all.push({ ...q, game: doc.game });
  }
  return { all, failed };
}

if (command === "validate") {
  const { all, failed } = loadAll();
  const a = analyzeBank(all);
  console.log(`${files.length} file(s), ${a.total} question(s) | two-option ${a.twoOption} | target coverage: 87 → ${a.coverage.dev87}, 168 → ${a.coverage.official168}`);
  console.log("All authored questions are Drafts. None is reviewed or published; that needs a human academic reviewer.");
  process.exit(failed ? 1 : 0);
} else if (command === "review-pack") {
  const { all, failed } = loadAll();
  if (failed) process.exit(1);
  const md = buildReviewPack(all, sourceInfo);
  const out = option("--out");
  if (out) { fs.writeFileSync(out, md); console.log(`wrote ${out} (${all.length} questions)`); } else process.stdout.write(md);
} else if (command === "import") {
  const { all, failed } = loadAll();
  if (failed) process.exit(1);
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IMPORT_ACTOR_ID } = process.env;
  if (!flag("--apply")) { console.log(`dry run: ${all.length} question(s) would be imported as Drafts. Add --apply to write.`); process.exit(0); }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !IMPORT_ACTOR_ID) {
    console.error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and IMPORT_ACTOR_ID (an active administrator's profile id).");
    process.exit(1);
  }
  const { createClient } = await import("../../web/node_modules/@supabase/supabase-js/dist/index.mjs");
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const tally = {};
  for (const q of all) {
    const { data, error } = await admin.rpc("upsert_question_draft", { p_actor: IMPORT_ACTOR_ID, ...toDraftArguments(q.game, q) });
    if (error) { console.error(`FAILED ${q.key}: ${error.message}`); process.exit(1); }
    const outcome = data[0].outcome;
    tally[outcome] = (tally[outcome] ?? 0) + 1;
  }
  console.log(`imported ${all.length} question(s) as Drafts:`, tally);
} else {
  console.error("usage: questions.mjs validate|review-pack|import [files…] [--apply] [--out file]");
  process.exit(2);
}
