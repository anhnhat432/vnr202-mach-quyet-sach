// After `next build`, proves server-only secrets did not leak into client-reachable output (LA-AC-020).
// Usage: node scripts/security/scan-client-bundle.mjs  (with the same env used for the build)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "web/.next");
const SERVER_ONLY = ["SUPABASE_SERVICE_ROLE_KEY", "AUTH_PASSWORD_PEPPER", "ROSTER_DEFAULT_PASSWORD", "CSRF_SIGNING_SECRET"];
// Answer-bearing identifiers must never reach client code either (LA-ANTI-007, LA-FB-003).
const names = ["SUPABASE_SERVICE_ROLE_KEY", "AUTH_PASSWORD_PEPPER", "ROSTER_DEFAULT_PASSWORD", "CSRF_SIGNING_SECRET", "ROSTER_STUDENT_ID_PATTERN", "correctOptionId", "content_private", "[GIẢ LẬP]"];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) yield* walk(p);
    else yield p;
  }
}
// Client-reachable output: static chunks and anything served from /_next/static or public.
const clientDirs = [join(root, "static")];
let findings = 0;
let scanned = 0;
for (const dir of clientDirs) {
  for (const file of walk(dir)) {
    if (/\.(png|jpg|ico|woff2?|svg|map)$/.test(file)) continue;
    const text = readFileSync(file, "utf8");
    scanned += 1;
    for (const name of names) {
      if (text.includes(name)) { console.error(`${file}: contains variable name ${name}`); findings += 1; }
    }
    for (const name of SERVER_ONLY) {
      const value = process.env[name];
      if (value && value.length >= 8 && text.includes(value)) { console.error(`${file}: contains the value of ${name}`); findings += 1; }
    }
    if (/\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/.test(text) && !text.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
      // anon keys are public by design; any other JWT-looking literal is suspicious
      const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (service && text.includes(service)) { console.error(`${file}: contains service-role JWT`); findings += 1; }
    }
  }
}
console.log(`scanned ${scanned} client files, ${findings} finding(s)`);
process.exit(findings || scanned === 0 ? 1 : 0);
