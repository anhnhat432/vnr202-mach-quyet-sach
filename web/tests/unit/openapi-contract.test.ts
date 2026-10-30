import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// api-contracts §12: the published OpenAPI document and the Route Handler exports must not drift.
// Covers the stage E surface (arena + admin competitions). The YAML is read structurally (paths and
// HTTP methods) without a YAML dependency.
const root = path.resolve(import.meta.dirname, "../../..");
const apiRoot = path.join(root, "web/src/app/api/v1");
const SCOPES = ["arena", "admin/competitions"];

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? routeFiles(path.join(dir, e.name)) : e.name === "route.ts" ? [path.join(dir, e.name)] : []));
}

function fromCode(): Set<string> {
  const out = new Set<string>();
  for (const scope of SCOPES) {
    for (const file of routeFiles(path.join(apiRoot, scope))) {
      const url = "/" + path.relative(apiRoot, path.dirname(file)).split(path.sep).map((s) => s.replace(/^\[(.+)\]$/, "{$1}")).join("/");
      for (const m of fs.readFileSync(file, "utf8").matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\b/g)) out.add(`${m[1]} ${url}`);
    }
  }
  return out;
}

function fromSpec(): Set<string> {
  const out = new Set<string>();
  let current = "";
  let inPaths = false;
  for (const line of fs.readFileSync(path.join(root, "openapi/v1.yaml"), "utf8").split("\n")) {
    if (/^paths:/.test(line)) { inPaths = true; continue; }
    if (inPaths && /^\S/.test(line)) inPaths = false;
    if (!inPaths) continue;
    const p = line.match(/^ {2}(\/\S+):\s*$/);
    if (p) { current = p[1]; continue; }
    const m = line.match(/^ {4}(get|post|put|patch|delete):\s*$/);
    if (m && current && SCOPES.some((s) => current.startsWith("/" + s))) out.add(`${m[1].toUpperCase()} ${current}`);
  }
  return out;
}

describe("OpenAPI document and route handlers agree", () => {
  it("every stage E route is published and every published stage E path exists", () => {
    const code = fromCode();
    const spec = fromSpec();
    expect(code.size).toBeGreaterThanOrEqual(15);
    expect([...code].filter((x) => !spec.has(x))).toEqual([]);
    expect([...spec].filter((x) => !code.has(x))).toEqual([]);
  });

  it("the document requires an Idempotency-Key on the operations that change attempt state", () => {
    const text = fs.readFileSync(path.join(root, "openapi/v1.yaml"), "utf8");
    for (const op of ["/attempt:", "/transfer:", "/open:", "/answers:"]) {
      const block = text.slice(text.indexOf(op)).split(/\n {2}\//)[0];
      expect(block, op).toContain("IdempotencyKey");
    }
  });
});
