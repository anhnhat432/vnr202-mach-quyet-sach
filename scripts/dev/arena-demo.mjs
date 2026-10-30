// Plays both Live Arena games on a LOCAL database with fixture questions (Stage D acceptance demo).
// No UI, no API: it drives the same RPCs the server routes will call, on the real clock, so you can
// watch scoring, timing and the two leaderboards behave. Local databases only; fixtures only.
//
//   scripts/db/local-stack.sh up
//   set -a; source .local/supabase/stack.env; set +a
//   node scripts/content/load-question-fixtures.mjs dev87
//   node scripts/dev/arena-demo.mjs [players=6]
import crypto from "node:crypto";
import pg from "../../web/node_modules/pg/lib/index.js";

const url = process.env.SUPABASE_DB_URL;
if (!url) { console.error("Set SUPABASE_DB_URL (source .local/supabase/stack.env)."); process.exit(1); }
if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) { console.error("Local databases only."); process.exit(2); }
const players = Number(process.argv[2] ?? 6);
const pool = new pg.Pool({ connectionString: url, max: 20 });
const rpc = async (fn, ...args) => (await pool.query(`select public.${fn}(${args.map((_, i) => `$${i + 1}`).join(",")}) as r`, args)).rows[0].r;
const key = () => crypto.randomUUID().replaceAll("-", "").slice(0, 24);

const tag = crypto.randomUUID().slice(0, 6).toUpperCase();
const mk = async (role, i) => {
  const id = crypto.randomUUID();
  await pool.query("insert into auth.users (id, email) values ($1,$2)", [id, `demo-${tag}-${i}@demo.invalid`]);
  if (role === "admin") await pool.query("insert into public.profiles (id, role, full_name, display_name) values ($1,'admin','Demo Admin','Demo Admin')", [id]);
  else await pool.query("insert into public.profiles (id, role, student_id, full_name, display_name) values ($1,'student',$2,$3,$4)", [id, `DEMO${tag}${i}`, `Demo Student ${i}`, `Người chơi ${i}`]);
  return id;
};
const admin = await mk("admin", 0);
const students = [];
for (let i = 1; i <= players; i += 1) students.push(await mk("student", i));
await pool.query("update public.competitions set state = 'archived' where state = 'open'");

const comp = await rpc("create_competition", admin, `Demo ${tag}`, "rehearsal", new Date(Date.now() - 60_000), new Date(Date.now() + 3_600_000), 400, 2000, 60_000, 60_000, null);
await rpc("transition_competition", comp.id, admin, "scheduled");
await rpc("transition_competition", comp.id, admin, "open");
console.log(`Rehearsal competition open (publicId ${comp.publicId}); ${players} bots, 60 s per game.\n`);

const correctOption = async (alloc) => (await pool.query("select s.snapshot_private->>'correctOptionId' c from public.attempt_allocations a join public.competition_question_snapshots s on s.id=a.snapshot_id where a.id=$1", [alloc])).rows[0].c;
const wrongOption = async (alloc) => (await pool.query("select o->>'id' id from public.attempt_allocations a join public.competition_question_snapshots s on s.id=a.snapshot_id, jsonb_array_elements(s.snapshot_public->'options') o where a.id=$1 and o->>'id'<>s.snapshot_private->>'correctOptionId' limit 1", [alloc])).rows[0].id;

async function answer(profile, proj, accuracy) {
  const id = proj.attempt.id;
  const alloc = proj.interaction.allocationId;
  await rpc("get_interaction_content", profile, id, alloc, proj.attempt.sessionVersion); // long-poll until available
  await new Promise((r) => setTimeout(r, 300 + Math.random() * 1200)); // "thinking"
  const option = Math.random() < accuracy ? await correctOption(alloc) : await wrongOption(alloc);
  return (await rpc("submit_answer", profile, id, alloc, option, key(), proj.attempt.sessionVersion)).projection;
}

async function playRace(profile, accuracy) {
  let proj = (await rpc("start_or_resume_attempt", profile, comp.publicId, "race", key())).projection;
  while (proj.attempt.state === "active" && proj.interaction) proj = await answer(profile, proj, accuracy);
  return proj.attempt.score;
}

async function playMinefield(profile, accuracy) {
  let proj = (await rpc("start_or_resume_attempt", profile, comp.publicId, "minefield", key())).projection;
  const order = [...Array(20).keys()].sort(() => Math.random() - 0.5);
  for (const cell of order) {
    if (proj.attempt.state !== "active") break;
    const opened = proj.board.find((c) => c.index === cell);
    if (opened.opened) continue;
    proj = (await rpc("open_minefield_cell", profile, proj.attempt.id, cell, key(), proj.attempt.sessionVersion)).projection;
    if (proj.interaction) proj = await answer(profile, proj, accuracy);
  }
  return proj.attempt.score;
}

// Half the bots play Bãi Mìn, the other half Đường Đua (one active attempt per student at a time).
const results = await Promise.all(students.map((p, i) => (i % 2 === 0 ? playMinefield(p, 0.7) : playRace(p, 0.7)).then((score) => ({ player: i + 1, game: i % 2 === 0 ? "minefield" : "race", score }))));
console.table(results);
for (const game of ["minefield", "race"]) {
  const board = await rpc("get_leaderboard", comp.publicId, game, 10);
  console.log(`\nBXH ${game} (${board.standing}, v${board.version}, ${board.players} người chơi)`);
  console.table(board.entries.map((e) => ({ hạng: e.rank, tên: e.displayName, điểm: e.score, đúng: e.correctCount, "trạng thái": e.state, "ms": e.completionDurationMs })));
}

// Clean up so the demo can be re-run.
await pool.query("delete from public.question_exposures where competition_id = $1", [comp.id]);
await pool.query("delete from public.audit_logs where target_id = $1", [comp.id]);
await pool.query("delete from public.competitions where id = $1", [comp.id]);
await pool.query("delete from public.auth_events where profile_id = any($1)", [[admin, ...students]]);
await pool.query("delete from public.profiles where id = any($1)", [[admin, ...students]]);
await pool.query("delete from auth.users where id = any($1)", [[admin, ...students]]);
await pool.end();
