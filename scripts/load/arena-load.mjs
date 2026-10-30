// Stage G load + chaos run against a LOCAL stack (T062): N players play both games through the real
// HTTP API while V viewers (and one projector) follow both Top 10 boards the way the browser does
// (Realtime Broadcast hint -> paced API read, settle read, 15 s safety sync). Measures latency of cell
// open, question content, answer submit, next race question and Top 10 propagation, injects chaos
// (F5 resume, duplicate submit, offline gap, device transfer) and checks server invariants at the end.
//
// Local databases only; rehearsal competition + synthetic [GIẢ LẬP] questions; throwaway accounts that
// are removed afterwards. Needs the same env as the local Next server plus SUPABASE_* of the stack:
//   node scripts/load/arena-load.mjs [--players 60] [--viewers 200] [--base http://127.0.0.1:3000] [--keep]
import crypto from "node:crypto";
import fs from "node:fs";

import { createClient } from "../../web/node_modules/@supabase/supabase-js/dist/index.mjs";
import pg from "../../web/node_modules/pg/lib/index.js";
import { generateFixtures } from "../lib/question-bank.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const PLAYERS = Number(arg("players", 60));
const VIEWERS = Number(arg("viewers", 200));
const BASE = arg("base", "http://127.0.0.1:3000");
const OUT = arg("out", null);
const KEEP = process.argv.includes("--keep");
// --cdn: viewers read the public board through an in-process stand-in for the Vercel CDN that honours
// the route's `s-maxage` and collapses concurrent misses, so origin reads can be told apart from views.
const CDN = process.argv.includes("--cdn");
const JOIN_RATE = Number(arg("join-rate", 10)); // viewers opening the page per second
const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL, AUTH_PASSWORD_PEPPER, ROSTER_DEFAULT_PASSWORD, INTERNAL_AUTH_EMAIL_DOMAIN = "auth.invalid" } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_DB_URL || !AUTH_PASSWORD_PEPPER || !ROSTER_DEFAULT_PASSWORD) {
  console.error("Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL, AUTH_PASSWORD_PEPPER, ROSTER_DEFAULT_PASSWORD (same as the local Next server).");
  process.exit(1);
}
for (const u of [SUPABASE_URL, SUPABASE_DB_URL, BASE]) {
  if (!["127.0.0.1", "localhost"].includes(new URL(u).hostname)) {
    console.error("Local stacks only.");
    process.exit(2);
  }
}

const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const pool = new pg.Pool({ connectionString: SUPABASE_DB_URL, max: 4 });
const run = `${Date.now().toString(36)}${crypto.randomInt(1000)}`.toUpperCase();
const derive = (studentId) => crypto.createHmac("sha256", AUTH_PASSWORD_PEPPER).update(`provider-password:${studentId}:${ROSTER_DEFAULT_PASSWORD}`).digest("base64url");
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const now = () => performance.timeOrigin + performance.now();
const rand = (a, b) => a + Math.random() * (b - a);

// ---- metrics ------------------------------------------------------------------------------------
const samples = {};
const errors = {};
const note = (name, ms) => (samples[name] ??= []).push(ms);
const fail = (name) => (errors[name] = (errors[name] ?? 0) + 1);
const chaos = { f5Resume: 0, f5ContentSame: 0, duplicateSubmit: 0, duplicateIdentical: 0, offlineGap: 0, transfer: 0, oldDeviceRejected: 0 };
const pct = (xs, p) => {
  if (!xs?.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
};

// ---- HTTP client with a cookie jar (one per browser session) -------------------------------------
class Session {
  jar = new Map();
  csrf = "";
  async call(method, path, body, key) {
    const headers = { origin: BASE, cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ") };
    if (method === "POST") {
      headers["content-type"] = "application/json";
      headers["x-csrf-token"] = this.csrf;
      if (key) headers["idempotency-key"] = key;
    }
    const t = now();
    const res = await fetch(`${BASE}/api/v1${path}`, { method, headers, body: method === "POST" ? JSON.stringify(body ?? {}) : undefined });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i);
      const value = pair.slice(i + 1);
      if (/max-age=0/i.test(c) || value === "") this.jar.delete(name);
      else this.jar.set(name, value);
    }
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ms: now() - t, data: json.data, error: json.error };
  }
  async signIn(studentId) {
    const r = await this.call("POST", "/auth/sign-in", { studentId, password: ROSTER_DEFAULT_PASSWORD });
    if (r.status >= 300) throw new Error(`sign-in ${r.status} ${r.error?.code}`);
    this.csrf = r.data.csrfToken;
    note("sign_in", r.ms);
  }
}
const key = (p) => `${p}-${crypto.randomUUID()}`;

// ---- setup --------------------------------------------------------------------------------------
async function setup() {
  const { rows } = await pool.query("select count(*)::int n from public.questions where origin = 'fixture'");
  if (!rows[0].n) {
    const fixtures = generateFixtures("dev87", { keyPrefix: `load${run.toLowerCase()}` });
    const { data: qs, error } = await svc.from("questions").insert(fixtures.map((q) => ({ external_key: q.key, game_type: q.game, pool: q.pool, chapter: q.chapter, topic: q.topic, question_type: q.type, option_count: q.options.length, difficulty: q.difficulty, origin: "fixture" }))).select("id, external_key");
    if (error) throw error;
    const ids = new Map(qs.map((r) => [r.external_key, r.id]));
    const { error: e2 } = await svc.from("question_versions").insert(fixtures.map((q) => ({ question_id: ids.get(q.key), version: 1, status: "published", content_public: { prompt: q.prompt, options: q.options }, content_private: { correctOptionId: q.correctOptionId, explanation: q.explanation } })));
    if (e2) throw e2;
  }
  await pool.query("update public.competitions set state = 'start_closed' where state = 'open'");
  const admin = await svc.auth.admin.createUser({ email: `load-admin-${run.toLowerCase()}@test.invalid`, password: `Adm-${crypto.randomUUID()}`, email_confirm: true, app_metadata: { role: "admin" } });
  const adminId = admin.data.user.id;
  await svc.from("profiles").insert({ id: adminId, role: "admin", full_name: "Load Admin", display_name: "Load Admin" });
  const players = [];
  for (let i = 0; i < PLAYERS; i += 1) {
    const studentId = `ZZL${run}${String(i).padStart(3, "0")}`;
    const email = `${crypto.randomUUID()}@${INTERNAL_AUTH_EMAIL_DOMAIN}`;
    const u = await svc.auth.admin.createUser({ email, password: derive(studentId), email_confirm: true, app_metadata: { role: "student" } });
    if (u.error) throw u.error;
    const name = `Tải ${String(i + 1).padStart(2, "0")}`;
    await svc.from("profiles").insert({ id: u.data.user.id, role: "student", student_id: studentId, full_name: `Người Tải ${i}`, display_name: name });
    await svc.from("student_auth_identities").insert({ profile_id: u.data.user.id, internal_email: email });
    players.push({ studentId, id: u.data.user.id, name, game: i % 2 ? "race" : "minefield", chaos: i % 8 === 3 });
  }
  const { data: comp, error } = await svc.rpc("create_competition", {
    p_actor: adminId, p_name: `Tải ${run}`, p_kind: "rehearsal", p_opens_at: new Date(Date.now() - 60_000).toISOString(), p_start_deadline_at: new Date(Date.now() + 3_600_000).toISOString(),
    p_minefield_duration_ms: 180000, p_race_duration_ms: 150000,
  });
  if (error) throw error;
  for (const target of ["scheduled", "open"]) {
    const { error: e } = await svc.rpc("transition_competition", { p_competition_id: comp.id, p_actor: adminId, p_target: target });
    if (e) throw e;
  }
  return { adminId, players, competitionId: comp.id, publicId: comp.publicId };
}

// ---- CDN stand-in ---------------------------------------------------------------------------------
const cdnCache = new Map();
const cdnInFlight = new Map();
const cdnStats = { hits: 0, origin: 0 };
async function boardFetch(url) {
  if (!CDN) { cdnStats.origin += 1; const r = await fetch(url); return { status: r.status, ok: r.ok, body: await r.json() }; }
  const cached = cdnCache.get(url);
  if (cached && cached.expires > now()) { cdnStats.hits += 1; return cached.value; }
  if (cdnInFlight.has(url)) { cdnStats.hits += 1; return cdnInFlight.get(url); }
  const p = (async () => {
    cdnStats.origin += 1;
    const r = await fetch(url);
    const value = { status: r.status, ok: r.ok, body: await r.json() };
    const maxAge = Number(/s-maxage=(\d+)/.exec(r.headers.get("cache-control") ?? "")?.[1] ?? 0);
    if (r.ok && maxAge > 0) cdnCache.set(url, { expires: now() + maxAge * 1000, value });
    return value;
  })().finally(() => cdnInFlight.delete(url));
  cdnInFlight.set(url, p);
  return p;
}

// ---- viewers: the browser hook's behaviour (use-leaderboard.ts) ----------------------------------
function startViewer(publicId, index, seen, stats) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 10 } } });
  const boards = {};
  for (const game of ["minefield", "race"]) {
    const st = { version: -1, hinted: -1, timer: null, settle: null, inFlight: false, lastRead: 0, live: false };
    boards[game] = st;
    const read = async (hinted, settle = false) => {
      if (st.inFlight) return false;
      st.inFlight = true;
      st.lastRead = now();
      const q = hinted === undefined ? "" : `?v=${hinted}${settle ? "&settle=1" : ""}`;
      const t = now();
      try {
        const res = await boardFetch(`${BASE}/api/v1/arena/leaderboards/${publicId}/${game}${q}`);
        const body = res.body;
        stats.reads += 1;
        note("board_read", now() - t);
        if (!res.ok) { fail(`board_${res.status}`); return true; }
        const b = body.data;
        if (b.version >= st.version) {
          st.version = b.version;
          const at = now();
          for (const e of b.entries) {
            const k = `${index}|${e.displayName}|${e.score}`;
            if (!seen.has(k)) seen.set(k, at);
          }
        }
      } catch {
        fail("board_network");
      } finally {
        st.inFlight = false;
      }
      return true;
    };
    const soon = () => {
      if (st.timer) return;
      st.timer = setTimeout(async () => {
        st.timer = null;
        await read(st.hinted > st.version ? st.hinted : undefined);
        if (st.hinted > st.version) soon();
      }, Math.max(200, st.lastRead + 500 - now()));
    };
    const settleLater = () => {
      clearTimeout(st.settle);
      const go = async () => { if (!(await read(st.hinted, true))) st.settle = setTimeout(go, 250); };
      st.settle = setTimeout(go, 1200);
    };
    st.sync = setInterval(() => void read(), st.live ? 15000 : 4000);
    void read();
    client
      .channel(`leaderboard:${publicId}:${game}`, { config: { private: false } })
      .on("broadcast", { event: "leaderboard.changed" }, ({ payload }) => {
        stats.hints += 1;
        const v = payload?.aggregate?.version;
        if (typeof v !== "number") return;
        st.hinted = Math.max(st.hinted, v);
        settleLater();
        if (v > st.version) soon();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && !st.live) {
          st.live = true;
          stats.subscribed += 1;
          clearInterval(st.sync);
          st.sync = setInterval(() => void read(), 15000);
          soon();
        }
        if (!stats.stopped && (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED")) stats.channelErrors += 1;
      });
  }
  return () => {
    for (const st of Object.values(boards)) { clearInterval(st.sync); clearTimeout(st.timer); clearTimeout(st.settle); }
    void client.removeAllChannels();
  };
}

// ---- players ------------------------------------------------------------------------------------
function pickOption(content, accuracy) {
  const letter = content.prompt.match(/đáp án ([A-D])/)?.[1];
  const good = content.options.find((o) => o.label.trim() === `Đáp án ${letter}`) ?? content.options[0];
  if (Math.random() < accuracy) return good.id;
  return (content.options.find((o) => o.id !== good.id) ?? good).id;
}

async function getContent(s, attemptId, allocationId, label) {
  for (let i = 0; i < 20; i += 1) {
    const r = await s.call("POST", `/arena/attempts/${attemptId}/interactions/${allocationId}/content`);
    if (r.status < 300) { note(label, r.ms); return r.data; }
    if (r.status === 425) { await sleep(Number(r.error?.details?.find((d) => d.field === "availableInMs")?.message ?? 300)); continue; }
    fail(`content_${r.status}_${r.error?.code}`);
    return null;
  }
  return null;
}

async function play(p, publicId, scores) {
  let s = new Session();
  await sleep(rand(0, 20000)); // a class does not press Start in the same millisecond
  await s.signIn(p.studentId);
  const accuracy = rand(0.55, 0.95);
  const started = await s.call("POST", `/arena/competitions/${publicId}/games/${p.game}/attempt`, {}, key("start"));
  if (started.status >= 300) { fail(`start_${started.status}_${started.error?.code}`); return; }
  note("start", started.ms);
  let proj = started.data.projection;
  const attemptId = proj.attempt.id;
  const record = (projection) => { proj = projection; scores.push({ name: p.name, score: projection.attempt.score, at: now() }); };
  let transferred = false;
  const hb = setInterval(() => void s.call("POST", `/arena/attempts/${attemptId}/heartbeat`).then((r) => r.status < 300 ? note("heartbeat", r.ms) : fail(`heartbeat_${r.status}`)), 10000);

  const answer = async (allocationId, readyAt) => {
    // the browser asks for the question before it is released (reveal / next-question gap), so the request
    // time includes that scheduled wait; content_after_release is the delay after the release time
    const content = await getContent(s, attemptId, allocationId, p.game === "race" ? "content_race_longpoll" : "content_minefield");
    if (!content) return;
    if (readyAt) note("content_after_release", Math.max(0, now() - readyAt));
    if (p.chaos && Math.random() < 0.25) {
      // F5 in the middle of a question: projection + content again, same question and deadline
      const again = await s.call("GET", `/arena/attempts/${attemptId}`);
      const c2 = await getContent(s, attemptId, allocationId, "content_refetch");
      chaos.f5Resume += 1;
      if (again.status < 300 && c2 && c2.allocationId === content.allocationId && c2.remainingMs <= content.remainingMs) chaos.f5ContentSame += 1;
    }
    if (p.chaos && Math.random() < 0.12) {
      chaos.offlineGap += 1;
      await sleep(content.remainingMs + 1500); // offline past the deadline: the server times it out
      const r = await s.call("GET", `/arena/attempts/${attemptId}`);
      if (r.status < 300) record(r.data);
      return;
    }
    await sleep(Math.min(content.remainingMs - 400, rand(900, 3500)));
    const optionId = pickOption(content, accuracy);
    const k = key("ans");
    if (p.chaos && Math.random() < 0.3) {
      chaos.duplicateSubmit += 1;
      const [a, b] = await Promise.all([1, 2].map(() => s.call("POST", `/arena/attempts/${attemptId}/answers`, { allocationId, optionId }, k)));
      if (a.status < 300 && b.status < 300 && a.data.result.scoreAfter === b.data.result.scoreAfter && a.data.result.outcome === b.data.result.outcome) chaos.duplicateIdentical += 1;
      else fail("duplicate_mismatch");
      note("submit", a.ms);
      record(a.data.projection);
      return;
    }
    const r = await s.call("POST", `/arena/attempts/${attemptId}/answers`, { allocationId, optionId }, k);
    if (r.status >= 300) {
      fail(`submit_${r.status}_${r.error?.code}`);
      const back = await s.call("GET", `/arena/attempts/${attemptId}`);
      if (back.status < 300) proj = back.data;
      return;
    }
    note("submit", r.ms);
    record(r.data.projection);
  };

  const maybeTransfer = async () => {
    if (!p.chaos || transferred || proj.attempt.mainAnswered < 3) return;
    transferred = true;
    const fresh = new Session(); // the student picks up another device
    await fresh.signIn(p.studentId);
    const blocked = await fresh.call("POST", `/arena/competitions/${publicId}/games/${p.game}/attempt`, {}, key("start"));
    if (blocked.status !== 409) { fail(`transfer_expected_409_${blocked.status}`); return; }
    const t = await fresh.call("POST", `/arena/attempts/${attemptId}/transfer`, {}, key("transfer"));
    if (t.status >= 300) { fail(`transfer_${t.status}`); return; }
    note("transfer", t.ms);
    chaos.transfer += 1;
    const old = await s.call("POST", `/arena/attempts/${attemptId}/heartbeat`);
    if (old.status === 409) chaos.oldDeviceRejected += 1; else fail(`old_device_${old.status}`);
    s = fresh;
    proj = t.data;
  };

  try {
    if (p.game === "race") {
      let readyAt = null;
      while (proj.attempt.state === "active") {
        const it = proj.interaction;
        if (!it) { await sleep(300); const r = await s.call("GET", `/arena/attempts/${attemptId}`); if (r.status < 300) proj = r.data; continue; }
        await answer(it.allocationId, readyAt);
        await maybeTransfer();
        const next = proj.interaction;
        readyAt = next && next.allocationId !== it.allocationId ? now() + (next.availableInMs ?? 0) : null;
        if (proj.interaction?.allocationId === it.allocationId) { const r = await s.call("GET", `/arena/attempts/${attemptId}`); if (r.status < 300) proj = r.data; }
      }
    } else {
      const order = [...Array(20).keys()].sort(() => Math.random() - 0.5);
      for (const cell of order) {
        if (proj.attempt.state !== "active") break;
        if (proj.board?.find((b) => b.index === cell)?.opened) continue;
        if (proj.interaction && proj.interaction.status !== "expired") await answer(proj.interaction.allocationId);
        if (proj.attempt.state !== "active") break;
        const r = await s.call("POST", `/arena/attempts/${attemptId}/cells/${cell}/open`, {}, key("cell"));
        if (r.status >= 300) {
          if (r.status !== 409) fail(`open_${r.status}_${r.error?.code}`);
          const back = await s.call("GET", `/arena/attempts/${attemptId}`);
          if (back.status < 300) proj = back.data;
          continue;
        }
        note("cell_open", r.ms);
        record(r.data.projection);
        if (proj.interaction) await answer(proj.interaction.allocationId, now() + (proj.interaction.availableInMs ?? 0));
        await maybeTransfer();
        await sleep(rand(300, 900));
      }
    }
  } finally {
    clearInterval(hb);
  }
}

// ---- invariants ----------------------------------------------------------------------------------
async function invariants(competitionId) {
  const q = async (sql) => (await pool.query(sql, [competitionId])).rows;
  return {
    attemptsPerPlayerGame: (await q("select max(n)::int m from (select count(*) n from public.attempts where competition_id = $1 group by profile_id, game_type) x"))[0].m,
    activeAtOnce: (await q("select count(*)::int n from (select profile_id from public.attempts where competition_id = $1 and state = 'active' group by profile_id having count(*) > 1) x"))[0].n,
    scoreEqualsLedger: (await q("select count(*)::int n from public.attempts a where a.competition_id = $1 and a.score <> coalesce((select e.score_after from public.attempt_events e where e.attempt_id = a.id order by e.seq desc limit 1), 0)"))[0].n === 0,
    boardMatchesAttempts: (await q("select count(*)::int n from public.leaderboard_entries e join public.competition_games g on g.id = e.competition_game_id join public.attempts a on a.competition_id = g.competition_id and a.profile_id = e.profile_id and a.game_type = g.game_type where g.competition_id = $1 and e.score <> a.score"))[0].n === 0,
    duplicateSubmissions: (await q("select count(*)::int n from (select allocation_id from public.answer_submissions s join public.attempts a on a.id = s.attempt_id where a.competition_id = $1 group by allocation_id having count(*) > 1) x"))[0].n,
    attemptStates: Object.fromEntries((await q("select state::text, count(*)::int n from public.attempts where competition_id = $1 group by 1")).map((r) => [r.state, r.n])),
    timeouts: (await q("select count(*)::int n from public.attempt_events e join public.attempts a on a.id = e.attempt_id where a.competition_id = $1 and e.event_type = 'timeout'"))[0].n,
  };
}

// ---- main ---------------------------------------------------------------------------------------
const world = await setup();
console.log(`run ${run}: ${PLAYERS} players, ${VIEWERS} viewers + projector, competition ${world.publicId}`);
const seen = new Map();
const vstats = { reads: 0, hints: 0, subscribed: 0, channelErrors: 0, stopped: false };
const stops = [];
for (let i = 0; i <= VIEWERS; i += 1) {
  stops.push(startViewer(world.publicId, i, seen, vstats));
  await sleep(1000 / JOIN_RATE);
}
await sleep(3000);
const subscribedAtStart = vstats.subscribed;
const scores = [];
const t0 = now();
await Promise.all(world.players.map((p) => play(p, world.publicId, scores).catch((e) => { fail(`player_crash_${e.message.slice(0, 40)}`); })));
const playMs = now() - t0;
await svc.rpc("reconcile_competition", { p_competition_id: world.competitionId });
await sleep(3000); // let the boards settle
vstats.stopped = true;
for (const stop of stops) stop();

// Top 10 propagation: score change seen by the player -> first time each viewer's board showed it.
const prop = [];
let visibleEvents = 0;
let scoreChanges = 0;
const lastScore = new Map();
for (const ev of scores) {
  if (lastScore.get(ev.name) === ev.score) continue;
  lastScore.set(ev.name, ev.score);
  scoreChanges += 1;
  let any = false;
  for (let v = 0; v <= VIEWERS; v += 1) {
    const at = seen.get(`${v}|${ev.name}|${ev.score}`);
    if (at !== undefined && at >= ev.at - 50) { prop.push(Math.max(0, at - ev.at)); any = true; }
  }
  if (any) visibleEvents += 1;
}
const inv = await invariants(world.competitionId);
const report = {
  run, players: PLAYERS, realtimeQuotas: (await pool.query("select max_concurrent_users, max_events_per_second, max_joins_per_second from _realtime.tenants limit 1").catch(() => ({ rows: [] }))).rows[0] ?? null, viewers: VIEWERS + 1, playSeconds: Math.round(playMs / 1000),
  latencyMs: Object.fromEntries(["sign_in", "start", "cell_open", "content_minefield", "content_race_longpoll", "content_after_release", "content_refetch", "submit", "heartbeat", "transfer", "board_read"].map((k) => [k, { n: samples[k]?.length ?? 0, p50: pct(samples[k], 50), p95: pct(samples[k], 95), p99: pct(samples[k], 99), max: pct(samples[k], 100) }])),
  top10Propagation: { scoreChanges, changesSeenOnBoards: visibleEvents, samples: prop.length, p50: pct(prop, 50), p95: pct(prop, 95), p99: pct(prop, 99), max: pct(prop, 100) },
  viewers: { subscribedChannelsAtStart: subscribedAtStart, channelsExpected: (VIEWERS + 1) * 2, hintsReceived: vstats.hints, hintsPerViewerPerMinute: Math.round(vstats.hints / (VIEWERS + 1) / (playMs / 60000)), viewerBoardReads: vstats.reads, cdn: CDN, originBoardReads: cdnStats.origin, originReadsPerSecond: Math.round(cdnStats.origin / (playMs / 1000)), channelErrors: vstats.channelErrors },
  chaos, errors, invariants: inv,
};
const row = (k, v) => `${k.padEnd(18)} n=${String(v.n).padStart(5)}  p50=${String(v.p50).padStart(5)}  p95=${String(v.p95).padStart(5)}  p99=${String(v.p99).padStart(5)}  max=${String(v.max).padStart(5)} ms`;
console.log(Object.entries(report.latencyMs).map(([k, v]) => row(k, v)).join("\n"));
console.log(row("top10_propagation", { n: prop.length, ...report.top10Propagation }));
console.log(JSON.stringify({ top10Propagation: report.top10Propagation, viewers: report.viewers, chaos, errors, invariants: inv }, null, 2));
if (OUT) fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

if (!KEEP) {
  await pool.query("delete from public.audit_logs where target_id = $1", [world.competitionId]);
  await pool.query("delete from public.question_exposures where competition_id = $1", [world.competitionId]);
  await pool.query("delete from public.competitions where id = $1", [world.competitionId]);
  const ids = [world.adminId, ...world.players.map((p) => p.id)];
  await pool.query("delete from public.auth_events where profile_id = any($1::uuid[])", [ids]);
  for (const id of ids) await svc.auth.admin.deleteUser(id);
}
await pool.end();
process.exit(0);
