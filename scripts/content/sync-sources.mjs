// Upserts the verified source registry (docs/sdd/content/sources.json) into public.sources so
// questions and dossiers can reference every registered source by id.
//
//   SUPABASE_DB_URL=postgres://… node scripts/content/sync-sources.mjs [--apply [--confirm <db-host>]]
//
// Dry run unless --apply. On a database that is not local, --apply also needs --confirm <db-host>
// (the exact host name printed by the dry run), so a real database is never changed by accident.
// A source that is `pending` in the database is NEVER promoted to `verified` here: verification is a
// human decision made in the database; such rows are reported as `needs_manual_review`.
// Every applied run writes an audit_logs row (registry sha256 + counts) as sync evidence.
// Uses the database owner connection, like a migration: the server role has no write access to the
// public source tables.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pg from "../../web/node_modules/pg/lib/index.js";

const root = path.resolve(import.meta.dirname, "../..");
const registry = JSON.parse(fs.readFileSync(path.join(root, "docs/sdd/content/sources.json"), "utf8"));
const { SUPABASE_DB_URL } = process.env;
const apply = process.argv.includes("--apply");
const confirmIndex = process.argv.indexOf("--confirm");
const confirmed = confirmIndex >= 0 ? process.argv[confirmIndex + 1] : undefined;
if (!SUPABASE_DB_URL) { console.error("Set SUPABASE_DB_URL."); process.exit(1); }
const dbHost = new URL(SUPABASE_DB_URL).hostname;
const isLocal = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(dbHost) || dbHost === "" || dbHost.startsWith("/");
const registrySha256 = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "docs/sdd/content/sources.json"))).digest("hex");
console.log(`target database host: ${dbHost || "(unix socket)"}${isLocal ? " (local)" : ""}; registry sha256 ${registrySha256.slice(0, 16)}…`);
if (apply && !isLocal && confirmed !== dbHost) {
  console.error(`Refusing to change a non-local database without --confirm ${dbHost}. Review the dry run first.`);
  process.exit(2);
}

const client = new pg.Client({ connectionString: SUPABASE_DB_URL });
await client.connect();
try {
  const { rows } = await client.query("select id, verification_status from public.sources");
  const existing = new Map(rows.map((r) => [r.id, r.verification_status]));
  const decide = (s) => {
    if (!existing.has(s.id)) return "insert";
    const current = existing.get(s.id);
    if (current === s.verificationStatus) return "unchanged";
    if (current === "pending" && s.verificationStatus === "verified") return "needs_manual_review"; // never auto-promote
    return "update";
  };
  const plan = registry.sources.map((s) => ({ s, action: decide(s) }));
  const tally = plan.reduce((t, p) => ({ ...t, [p.action]: (t[p.action] ?? 0) + 1 }), {});
  console.log(`${registry.sources.length} registry source(s):`, tally, apply ? "" : "(dry run, add --apply)");
  if (apply) {
    await client.query("begin");
    for (const { s, action } of plan) {
      if (action === "unchanged" || action === "needs_manual_review") continue;
      await client.query(
        `insert into public.sources (id, title, author_or_issuer, publication_year, locator, url, source_type, rights_note, verification_status)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (id) do update set title = excluded.title, author_or_issuer = excluded.author_or_issuer, publication_year = excluded.publication_year,
           locator = excluded.locator, url = excluded.url, source_type = excluded.source_type, rights_note = excluded.rights_note, verification_status = excluded.verification_status`,
        [s.id, s.title, s.authorOrIssuer, s.publicationYear ?? null, s.locator ?? "", s.url ?? null, s.sourceType, s.rightsNote ?? "", s.verificationStatus],
      );
    }
    await client.query(
      "insert into public.audit_logs (action, target_type, target_id, after_redacted) values ('sources.sync', 'source_registry', $1, $2)",
      [registrySha256, JSON.stringify({ host: isLocal ? "local" : dbHost, registrySources: registry.sources.length, tally })],
    );
    await client.query("commit");
    console.log("synced; evidence row written to audit_logs (sources.sync).");
  }
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  await client.end();
}
