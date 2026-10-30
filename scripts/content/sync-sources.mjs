// Upserts the verified source registry (docs/sdd/content/sources.json) into public.sources so
// questions and dossiers can reference every registered source by id.
//
//   SUPABASE_DB_URL=postgres://… node scripts/content/sync-sources.mjs [--apply]
//
// Dry run unless --apply. Uses the database owner connection, like a migration: the server role
// deliberately has no write access to the public source tables. Sources are content, not fixtures,
// so this is allowed on any database you point it at; read the dry-run output first.
import fs from "node:fs";
import path from "node:path";
import pg from "../../web/node_modules/pg/lib/index.js";

const root = path.resolve(import.meta.dirname, "../..");
const registry = JSON.parse(fs.readFileSync(path.join(root, "docs/sdd/content/sources.json"), "utf8"));
const { SUPABASE_DB_URL } = process.env;
const apply = process.argv.includes("--apply");
if (!SUPABASE_DB_URL) { console.error("Set SUPABASE_DB_URL."); process.exit(1); }

const client = new pg.Client({ connectionString: SUPABASE_DB_URL });
await client.connect();
try {
  const { rows } = await client.query("select id, verification_status from public.sources");
  const existing = new Map(rows.map((r) => [r.id, r.verification_status]));
  const plan = registry.sources.map((s) => ({ s, action: existing.has(s.id) ? (existing.get(s.id) === s.verificationStatus ? "unchanged" : "update") : "insert" }));
  const tally = plan.reduce((t, p) => ({ ...t, [p.action]: (t[p.action] ?? 0) + 1 }), {});
  console.log(`${registry.sources.length} registry source(s):`, tally, apply ? "" : "(dry run, add --apply)");
  if (apply) {
    await client.query("begin");
    for (const { s, action } of plan) {
      if (action === "unchanged") continue;
      await client.query(
        `insert into public.sources (id, title, author_or_issuer, publication_year, locator, url, source_type, rights_note, verification_status)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (id) do update set title = excluded.title, author_or_issuer = excluded.author_or_issuer, publication_year = excluded.publication_year,
           locator = excluded.locator, url = excluded.url, source_type = excluded.source_type, rights_note = excluded.rights_note, verification_status = excluded.verification_status`,
        [s.id, s.title, s.authorOrIssuer, s.publicationYear ?? null, s.locator ?? "", s.url ?? null, s.sourceType, s.rightsNote ?? "", s.verificationStatus],
      );
    }
    await client.query("commit");
    console.log("synced.");
  }
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  await client.end();
}
