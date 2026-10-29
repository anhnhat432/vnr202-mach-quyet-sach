// Repository secret scan for stage B (security-spec §14). Fails on JWT-like tokens, private keys,
// service-role assignments with values, and known harness paths in tracked files.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean).filter((f) => !/\.(png|jpg|ico|svg|lock)$|package-lock\.json$/.test(f));
const rules = [
  ["JWT-like token", /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["service role value", /SERVICE_ROLE_KEY\s*=\s*(?!server-only-service-role-key|\$|["']?\s*$)[A-Za-z0-9._-]{20,}/],
  ["pepper value", /AUTH_PASSWORD_PEPPER\s*=\s*(?!replace-with|\$)[A-Za-z0-9._-]{16,}/],
  ["roster default password literal", /ROSTER_DEFAULT_PASSWORD\s*=\s*(?!\$|replace-with|set-in-deployment-environment)["']?\S+/],
  ["harness secrets file", /\.local\/supabase\/(secrets|stack)\.env/],
];
const allow = new Set(["scripts/security/scan-secrets.mjs", "docs/sdd/evidence/phase-3/README.md", "scripts/db/local-stack.sh", "scripts/db/test-db.sh", ".gitignore"]);
let findings = 0;
for (const file of files) {
  if (allow.has(file)) continue;
  const text = readFileSync(file, "utf8");
  for (const [name, re] of rules) {
    if (re.test(text)) {
      console.error(`${file}: ${name}`);
      findings += 1;
    }
  }
}
console.log(`scanned ${files.length} tracked files, ${findings} finding(s)`);
process.exit(findings ? 1 : 0);
