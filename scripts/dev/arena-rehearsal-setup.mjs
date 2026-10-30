// Prepares a LOCAL rehearsal: synthetic [GIẢ LẬP] questions, demo students and an open rehearsal
// competition, so both games can be played in the browser before any real question is Published.
// Local databases only. Never commits or prints the shared password; students sign in with the
// ROSTER_DEFAULT_PASSWORD of your local server environment.
//
//   (export the local stack env + AUTH_PASSWORD_PEPPER + ROSTER_DEFAULT_PASSWORD used by `next dev`)
//   node scripts/dev/arena-rehearsal-setup.mjs [students=8]
import crypto from "node:crypto";
import { createClient } from "../../web/node_modules/@supabase/supabase-js/dist/index.mjs";
import pg from "../../web/node_modules/pg/lib/index.js";
import { generateFixtures } from "../lib/question-bank.mjs";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL, AUTH_PASSWORD_PEPPER, ROSTER_DEFAULT_PASSWORD, INTERNAL_AUTH_EMAIL_DOMAIN = "auth.invalid" } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_DB_URL || !AUTH_PASSWORD_PEPPER || !ROSTER_DEFAULT_PASSWORD) {
  console.error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL, AUTH_PASSWORD_PEPPER and ROSTER_DEFAULT_PASSWORD (same values as the local Next server).");
  process.exit(1);
}
for (const u of [SUPABASE_URL, SUPABASE_DB_URL]) {
  if (!["127.0.0.1", "localhost"].includes(new URL(u).hostname)) { console.error("Local databases only."); process.exit(2); }
}
const n = Number(process.argv[2] ?? 8);
const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const pool = new pg.Pool({ connectionString: SUPABASE_DB_URL, max: 2 });
const derive = (studentId) => crypto.createHmac("sha256", AUTH_PASSWORD_PEPPER).update(`provider-password:${studentId}:${ROSTER_DEFAULT_PASSWORD}`).digest("base64url");

// 1. fixtures (replace any previous ones; old rehearsal competitions are removed first)
const { rows: old } = await pool.query("select id from public.competitions where kind = 'rehearsal'");
for (const { id } of old) {
  await pool.query("delete from public.question_exposures where competition_id = $1", [id]);
  await pool.query("delete from public.competitions where id = $1", [id]);
}
await pool.query("update public.competitions set state = 'start_closed' where state = 'open'");
await svc.from("questions").delete().eq("origin", "fixture");
const fixtures = generateFixtures("dev87", { keyPrefix: "demo" });
const { data: qs, error } = await svc.from("questions").insert(fixtures.map((q) => ({ external_key: q.key, game_type: q.game, pool: q.pool, chapter: q.chapter, topic: q.topic, question_type: q.type, option_count: q.options.length, difficulty: q.difficulty, origin: "fixture" }))).select("id, external_key");
if (error) throw error;
const ids = new Map(qs.map((r) => [r.external_key, r.id]));
const { error: vErr } = await svc.from("question_versions").insert(fixtures.map((q) => ({ question_id: ids.get(q.key), version: 1, status: "published", content_public: { prompt: q.prompt, options: q.options }, content_private: { correctOptionId: q.correctOptionId, explanation: q.explanation } })));
if (vErr) throw vErr;

// 2. demo administrator and students
async function ensureUser(email, password, role) {
  const { data: list } = await svc.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);
  if (existing) {
    await svc.auth.admin.updateUserById(existing.id, { password, app_metadata: { role } });
    return existing.id;
  }
  const { data, error: e } = await svc.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role } });
  if (e) throw e;
  return data.user.id;
}
const adminEmail = "demo-admin@arena.invalid";
const adminPassword = process.env.DEMO_ADMIN_PASSWORD ?? crypto.randomBytes(12).toString("base64url");
const adminId = await ensureUser(adminEmail, adminPassword, "admin");
await svc.from("profiles").upsert({ id: adminId, role: "admin", full_name: "Demo Admin", display_name: "Demo Admin" });
const names = ["An N.V.", "Bình T.T.", "Chi L.M.", "Dũng P.Q.", "Em H.T.", "Giang V.K.", "Hà Đ.T.", "Khoa N.M.", "Lan P.T.", "Minh T.Đ.", "Nga L.T.", "Phúc H.V."];
for (let i = 1; i <= n; i += 1) {
  const studentId = `DEMO${String(i).padStart(3, "0")}`;
  const { data: existing } = await svc.from("profiles").select("id").eq("student_id", studentId).maybeSingle();
  if (existing) {
    const { data: ident } = await svc.from("student_auth_identities").select("internal_email").eq("profile_id", existing.id).single();
    await ensureUser(ident.internal_email, derive(studentId), "student");
    continue;
  }
  const email = `${crypto.randomUUID()}@${INTERNAL_AUTH_EMAIL_DOMAIN}`;
  const id = await ensureUser(email, derive(studentId), "student");
  const { error: pErr } = await svc.from("profiles").insert({ id, role: "student", student_id: studentId, full_name: `Sinh Viên Demo ${i}`, display_name: names[(i - 1) % names.length], display_name_suffix: i > names.length ? 2 : null });
  if (pErr) throw pErr;
  await svc.from("student_auth_identities").insert({ profile_id: id, internal_email: email });
}

// 3. open rehearsal competition
const rpc = async (fn, args) => { const { data, error: e } = await svc.rpc(fn, args); if (e) throw new Error(`${fn}: ${e.message}`); return data; };
const comp = await rpc("create_competition", { p_actor: adminId, p_name: "Diễn tập Live Arena", p_kind: "rehearsal", p_opens_at: new Date(Date.now() - 60_000).toISOString(), p_start_deadline_at: new Date(Date.now() + 6 * 3_600_000).toISOString() });
await rpc("transition_competition", { p_competition_id: comp.id, p_actor: adminId, p_target: "scheduled" });
await rpc("transition_competition", { p_competition_id: comp.id, p_actor: adminId, p_target: "open" });
console.log(`Rehearsal open (publicId ${comp.publicId}). Students DEMO001..DEMO${String(n).padStart(3, "0")} sign in with the local ROSTER_DEFAULT_PASSWORD.`);
console.log(`Admin: ${adminEmail}${process.env.DEMO_ADMIN_PASSWORD ? "" : ` / ${adminPassword} (generated for this local run)`}`);
await pool.end();
