// Loads synthetic [GIẢ LẬP] questions into a LOCAL development database so both games can be built
// and tested before any academic reviewer has Published a real question (LA-CONTENT-005).
//
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=... node scripts/content/load-question-fixtures.mjs [dev87|official168]
//
// Refuses any non-local database: fixtures must never exist in production. The database also keeps
// them out of official competitions (eligible_questions), this guard is the first line.
import { createClient } from "../../web/node_modules/@supabase/supabase-js/dist/index.mjs";
import { generateFixtures } from "../lib/question-bank.mjs";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const profile = process.argv[2] ?? "dev87";
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the local development stack's values).");
  process.exit(1);
}
const host = new URL(SUPABASE_URL).hostname;
if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) {
  console.error(`Refusing to load fixtures into ${host}: synthetic questions are for local development only.`);
  process.exit(2);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const fixtures = generateFixtures(profile);

const { error: clearError } = await admin.from("questions").delete().eq("origin", "fixture");
if (clearError) throw clearError;

const rows = fixtures.map((q) => ({
  external_key: q.key, game_type: q.game, pool: q.pool, chapter: q.chapter, topic: q.topic,
  question_type: q.type, option_count: q.options.length, difficulty: q.difficulty, origin: "fixture",
}));
const { data: inserted, error } = await admin.from("questions").insert(rows).select("id, external_key");
if (error) throw error;
const idByKey = new Map(inserted.map((r) => [r.external_key, r.id]));
const versions = fixtures.map((q) => ({
  question_id: idByKey.get(q.key), version: 1, status: "published",
  content_public: { prompt: q.prompt, options: q.options },
  content_private: { correctOptionId: q.correctOptionId, explanation: q.explanation },
}));
const { error: versionError } = await admin.from("question_versions").insert(versions);
if (versionError) throw versionError;
console.log(`Loaded ${fixtures.length} synthetic questions (${profile}) into ${host}. They are origin=fixture and can never enter an official competition.`);
