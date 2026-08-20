import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");
const dossierDir = path.join(root, "docs", "sdd", "content", "dossiers");

describe("canonical content files", () => {
  it("stores one dossier per ordered file", () => {
    const files = fs.readdirSync(dossierDir).filter((file) => file.endsWith(".json")).sort();
    expect(files).toHaveLength(15);
    expect(files[0]).toBe("01-con-duong-nao-cho-doc-lap.json");
    expect(files[14]).toBe("15-giu-niem-tin-bang-nang-luc-the-che.json");
  });

  it("keeps the source and publication registries separate", () => {
    expect(fs.existsSync(path.join(root, "docs", "sdd", "content", "sources.json"))).toBe(true);
    expect(fs.existsSync(path.join(root, "docs", "sdd", "content", "publication-manifest.json"))).toBe(true);
    expect(fs.existsSync(path.join(root, "docs", "sdd", "content", "causal-links.json"))).toBe(true);
  });

  it("replaces the Phase 1 aggregate and generators", () => {
    expect(fs.existsSync(path.join(root, "scripts", "build-content-catalog.mjs"))).toBe(true);
    expect(fs.existsSync(path.join(root, "scripts", "generate-content-seed.mjs"))).toBe(true);
    expect(fs.existsSync(path.join(root, "docs", "sdd", "content", "phase-1-seed.json"))).toBe(false);
    expect(fs.existsSync(path.join(root, "scripts", "generate-phase1-seed.mjs"))).toBe(false);
    expect(fs.existsSync(path.join(root, "scripts", "sync-web-content.mjs"))).toBe(false);
    expect(fs.existsSync(path.join(root, "web", "src", "generated", "phase-1-seed.json"))).toBe(false);
  });

  it("generates a database seed without inventing legacy review metadata", () => {
    const output = path.join(os.tmpdir(), `vnr202-content-seed-${process.pid}.sql`);
    try {
      const result = spawnSync(
        process.execPath,
        [
          path.join(root, "scripts", "generate-content-seed.mjs"),
          path.join(root, "web", "src", "generated", "content-catalog.json"),
          output,
        ],
        { encoding: "utf8" },
      );
      expect(result.status, result.stderr).toBe(0);
      const sql = fs.readFileSync(output, "utf8");
      expect(sql.match(/insert into public\.dossiers/g)).toHaveLength(15);
      expect(sql).toContain("expected 3 published dossiers");
      expect(sql).not.toContain("now(), now()");
      expect(sql).toMatch(
        /30000000-0000-0000-0000-000000000002[\s\S]*?null, '2026-08-19'::timestamptz\);/,
      );
    } finally {
      fs.rmSync(output, { force: true });
    }
  });
});
