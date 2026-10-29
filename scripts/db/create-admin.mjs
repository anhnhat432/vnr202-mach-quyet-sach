// Creates (or repairs) the first administrator. Credentials come from the environment only,
// never from arguments or files in the repository:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_EMAIL=... ADMIN_PASSWORD=... [ADMIN_NAME=...] node scripts/db/create-admin.mjs
import { createClient } from "../../web/node_modules/@supabase/supabase-js/dist/index.mjs";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = "Quản trị viên" } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL and ADMIN_PASSWORD in the environment.");
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 12) {
  console.error("ADMIN_PASSWORD must be at least 12 characters (the shared student password does not apply to administrators).");
  process.exit(1);
}
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = ADMIN_EMAIL.trim().toLowerCase();

const { data: created, error } = await admin.auth.admin.createUser({ email, password: ADMIN_PASSWORD, email_confirm: true, app_metadata: { role: "admin" } });
let userId = created?.user?.id;
if (error) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  userId = list?.users.find((u) => u.email === email)?.id;
  if (!userId) {
    console.error("Could not create the administrator:", error.message);
    process.exit(1);
  }
  await admin.auth.admin.updateUserById(userId, { password: ADMIN_PASSWORD, app_metadata: { role: "admin" } });
}
const { error: profileError } = await admin.from("profiles").upsert({ id: userId, role: "admin", full_name: ADMIN_NAME, display_name: ADMIN_NAME.slice(0, 40) });
if (profileError) {
  console.error("Profile upsert failed:", profileError.message);
  process.exit(1);
}
console.log(`Administrator ready: ${email}`);
