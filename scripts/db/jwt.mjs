// Signs HS256 API keys for the local harness: node scripts/db/jwt.mjs <secret> <role>
import { createHmac } from "node:crypto";

const [secret, role] = process.argv.slice(2);
if (!secret || !role) {
  console.error("usage: node scripts/db/jwt.mjs <secret> <role>");
  process.exit(1);
}
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ iss: "supabase-local", role, iat: now, exp: now + 60 * 60 * 24 * 30 })}`;
const signature = createHmac("sha256", secret).update(body).digest("base64url");
console.log(`${body}.${signature}`);
