// @vitest-environment node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

// Q3: the source registry sync never auto-promotes a pending source, refuses unconfirmed non-local
// databases, and leaves audit evidence of every applied run.
const root = path.resolve(import.meta.dirname, "../../..");
const script = path.join(root, "scripts/content/sync-sources.mjs");
const registry = JSON.parse(fs.readFileSync(path.join(root, "docs/sdd/content/sources.json"), "utf8")) as { sources: Array<{ id: string; verificationStatus: string }> };
const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL, max: 2 });
const run = (args: string[], url = process.env.SUPABASE_DB_URL!) =>
  spawnSync("node", [script, ...args], { env: { ...process.env, SUPABASE_DB_URL: url }, encoding: "utf8" });

let preexisting = new Set<string>();
afterAll(async () => {
  const added = registry.sources.map((s) => s.id).filter((id) => !preexisting.has(id));
  if (added.length) await pool.query("delete from public.sources where id = any($1::uuid[])", [added]);
  await pool.query("delete from public.audit_logs where action = 'sources.sync'");
  await pool.end();
});

describe("source registry sync (Q3)", () => {
  it("refuses --apply on a non-local database without --confirm, and does not even connect", () => {
    const refused = run(["--apply"], "postgres://user:pw@db.example.invalid:5432/postgres");
    expect(refused.status).toBe(2);
    expect(refused.stderr).toContain("--confirm db.example.invalid");
  });

  it("never promotes a pending source to verified, and records evidence when applied", async () => {
    preexisting = new Set((await pool.query("select id from public.sources")).rows.map((r) => r.id));
    const target = registry.sources.find((s) => s.verificationStatus === "verified")!;
    await pool.query(
      "insert into public.sources (id, title, author_or_issuer, source_type, verification_status) values ($1, 'Nguồn chờ xác minh', 'Test', 'syllabus', 'pending') on conflict (id) do update set verification_status = 'pending'",
      [target.id],
    );
    const dry = run([]);
    expect(dry.stdout).toContain("needs_manual_review");
    const applied = run(["--apply"]);
    expect(applied.status).toBe(0);
    const { rows } = await pool.query("select verification_status from public.sources where id = $1", [target.id]);
    expect(rows[0].verification_status).toBe("pending");
    const audit = await pool.query("select after_redacted from public.audit_logs where action = 'sources.sync' order by id desc limit 1");
    expect(audit.rows[0].after_redacted).toMatchObject({ host: "local", registrySources: registry.sources.length });
    expect(audit.rows[0].after_redacted.tally.needs_manual_review).toBe(1);
    // restore the original state for the other suites
    if (preexisting.has(target.id)) await pool.query("update public.sources set verification_status = 'verified' where id = $1", [target.id]);
  });
});
