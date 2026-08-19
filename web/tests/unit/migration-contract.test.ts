import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../../supabase/migrations/202608190001_public_content.sql"),
  "utf8",
);

describe("public content migration", () => {
  it("enables RLS on every public content table", () => {
    for (const table of [
      "sources",
      "dossiers",
      "dossier_versions",
      "claims",
      "claim_source_links",
      "causal_nodes",
      "causal_edges",
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security;`);
    }
  });

  it("filters public dossiers and sources by publication state", () => {
    expect(migration).toContain("verification_status = 'verified'");
    expect(migration).toContain("status = 'published'");
  });
});
