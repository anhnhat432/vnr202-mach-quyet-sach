// LA-ACC-016: verify Supabase Auth behaviour on a REAL project before choosing the password
// strategy. Creates two throwaway users, probes short-password handling through the admin API and
// the public API, then deletes them. Reads credentials from the environment only.
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/db/verify-hosted-auth.mjs
import { createClient } from "../../web/node_modules/@supabase/supabase-js/dist/index.mjs";

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const opts = { auth: { persistSession: false } };
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opts);
const results = {};
const ids = [];
const tag = crypto.randomUUID();

try {
  const short = await admin.auth.admin.createUser({ email: `probe-short-${tag}@auth.invalid`, password: "1", email_confirm: true });
  results.adminCreateOneCharPassword = short.error ? `rejected: ${short.error.message}` : "accepted";
  if (short.data?.user) ids.push(short.data.user.id);

  const six = await admin.auth.admin.createUser({ email: `probe-six-${tag}@auth.invalid`, password: "abcdef", email_confirm: true });
  results.adminCreateSixCharPassword = six.error ? `rejected: ${six.error.message}` : "accepted";
  if (six.data?.user) ids.push(six.data.user.id);

  if (short.data?.user) {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
    const signIn = await anon.auth.signInWithPassword({ email: `probe-short-${tag}@auth.invalid`, password: "1" });
    results.publicSignInWithOneCharPassword = signIn.error ? `rejected: ${signIn.error.message}` : "accepted";
  }
  if (six.data?.user) {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
    await anon.auth.signInWithPassword({ email: `probe-six-${tag}@auth.invalid`, password: "abcdef" });
    const update = await anon.auth.updateUser({ password: "1" });
    results.selfServiceChangeToOneChar = update.error ? `rejected: ${update.error.message}` : "accepted";
  }
} finally {
  for (const id of ids) await admin.auth.admin.deleteUser(id);
}
console.log(JSON.stringify(results, null, 2));
console.log("Record this output in docs/sdd/evidence/phase-3/README.md (LA-ACC-016). The application uses the derived password either way (LA-ACC-005).");
