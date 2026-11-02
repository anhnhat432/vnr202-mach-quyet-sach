import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

import { generateFixtures } from "../../../scripts/lib/question-bank.mjs";
import { deriveProviderPassword } from "../../src/features/auth/domain/provider-password";

// Test world for the Live Arena browser specs: fixture questions, one admin, a few students and an open
// rehearsal competition, all removed afterwards. Needs the local/CI stack env and the server secrets.
export const env = {
  url: process.env.SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  dbUrl: process.env.SUPABASE_DB_URL,
  pepper: process.env.AUTH_PASSWORD_PEPPER,
  defaultPassword: process.env.ROSTER_DEFAULT_PASSWORD,
};
export const ready = Boolean(env.url && env.serviceKey && env.dbUrl && env.pepper && env.defaultPassword);

export type Student = { studentId: string; id: string; name: string };
export type ArenaWorld = { competitionId: string; publicId: string; adminId: string; students: Student[]; cleanup: () => Promise<void> };

export async function createArenaWorld(names: string[], options: { minefieldMs?: number; raceMs?: number } = {}): Promise<ArenaWorld> {
  const svc = createClient(env.url!, env.serviceKey!, { auth: { persistSession: false } });
  const pool = new Pool({ connectionString: env.dbUrl!, max: 2 });
  const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`.toUpperCase();
  await pool.query("update public.competitions set state = 'start_closed' where state = 'open'"); // a test database: one open competition at a time

  const { rows: present } = await pool.query("select count(*)::int as n from public.questions where origin = 'fixture'");
  if (present[0].n === 0) {
    const fixtures = generateFixtures("dev87", { keyPrefix: `ui${run.toLowerCase()}` });
    const { data: qs, error } = await svc.from("questions").insert(fixtures.map((q) => ({ external_key: q.key, game_type: q.game, pool: q.pool, chapter: q.chapter, topic: q.topic, question_type: q.type, option_count: q.options.length, difficulty: q.difficulty, origin: "fixture" }))).select("id, external_key");
    if (error) throw error;
    const ids = new Map(qs!.map((r) => [r.external_key, r.id]));
    const { error: vError } = await svc.from("question_versions").insert(fixtures.map((q) => ({ question_id: ids.get(q.key), version: 1, status: "published", content_public: { prompt: q.prompt, options: q.options }, content_private: { correctOptionId: q.correctOptionId, explanation: q.explanation } })));
    if (vError) throw vError;
  }

  const admin = await svc.auth.admin.createUser({ email: `ui-admin-${run.toLowerCase()}@test.invalid`, password: `Adm-${crypto.randomUUID()}`, email_confirm: true, app_metadata: { role: "admin" } });
  if (admin.error || !admin.data.user) throw admin.error;
  const adminId = admin.data.user.id;
  await svc.from("profiles").insert({ id: adminId, role: "admin", full_name: "UI Admin", display_name: "UI Admin" });
  const students: Student[] = [];
  for (const [i, name] of names.entries()) {
    const studentId = `ZZU${run}${i}`;
    const email = `${crypto.randomUUID()}@auth.invalid`;
    const user = await svc.auth.admin.createUser({ email, password: deriveProviderPassword(env.pepper!, studentId, env.defaultPassword!), email_confirm: true, app_metadata: { role: "student" } });
    if (user.error || !user.data.user) throw user.error;
    const { error } = await svc.from("profiles").insert({ id: user.data.user.id, role: "student", student_id: studentId, full_name: `Họ Tên Thử ${i}`, display_name: name });
    if (error) throw error;
    await svc.from("student_auth_identities").insert({ profile_id: user.data.user.id, internal_email: email });
    students.push({ studentId, id: user.data.user.id, name });
  }
  const rpc = async <T>(fn: string, args: Record<string, unknown>) => {
    const { data, error } = await svc.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data as T;
  };
  const comp = await rpc<{ id: string; publicId: string }>("create_competition", {
    p_actor: adminId, p_name: `UI e2e ${run}`, p_kind: "rehearsal", p_opens_at: new Date(Date.now() - 60_000).toISOString(), p_start_deadline_at: new Date(Date.now() + 3_600_000).toISOString(),
    p_minefield_duration_ms: options.minefieldMs ?? 180000, p_race_duration_ms: options.raceMs ?? 150000,
  });
  await rpc("transition_competition", { p_competition_id: comp.id, p_actor: adminId, p_target: "scheduled" });
  await rpc("transition_competition", { p_competition_id: comp.id, p_actor: adminId, p_target: "open" });

  return {
    competitionId: comp.id, publicId: comp.publicId, adminId, students,
    async cleanup() {
      await pool.query("delete from public.question_exposures where competition_id = $1", [comp.id]);
      await pool.query("delete from public.audit_logs where target_id = $1", [comp.id]);
      await pool.query("delete from public.competitions where id = $1", [comp.id]);
      await pool.query("delete from public.auth_events where profile_id = any($1::uuid[])", [[adminId, ...students.map((s) => s.id)]]);
      for (const s of students) await svc.auth.admin.deleteUser(s.id);
      await svc.auth.admin.deleteUser(adminId);
      await pool.end();
    },
  };
}
