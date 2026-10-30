// Question bank tooling shared by the import CLI, the fixture loader and the tests.
// Mirrors the database rules in supabase/migrations/202610300002_question_bank.sql so authors get
// errors before import; the database stays the final authority (a parity test covers both).
// Rules: CONTENT-003, LA-CONTENT-001..014, LA-ALLOC-010.

export const TRIAL_LIMITS = { prompt: 80, option: 40 }; // LA-CONTENT-008 [THỬ NGHIỆM]
export const HARD_LIMITS = { prompt: 300, option: 200, explanation: 1000 };

export const POOLS_BY_GAME = { minefield: ["minefield_main", "minefield_defuse"], race: ["race"] };
export const CHAPTERS = ["chapter_1", "chapter_2", "chapter_3"];
export const DIFFICULTIES = ["easy", "medium", "hard"];
export const TYPES = ["single_choice", "before_after", "pair_choice", "defuse_ab"];

// Per-attempt need per slot (LA-ALLOC-002). Used for target sizing, not for allocation (that is SQL).
export const BLUEPRINT = {
  minefield: [
    { pool: "minefield_main", difficulty: "easy", n: 3 },
    { pool: "minefield_main", difficulty: "medium", n: 4 },
    { pool: "minefield_main", difficulty: "hard", n: 3 },
    { pool: "minefield_defuse", difficulty: "easy", n: 3 },
  ],
  race: [
    { pool: "race", difficulty: "easy", n: 5 },
    { pool: "race", difficulty: "medium", n: 7 },
    { pool: "race", difficulty: "hard", n: 3 },
  ],
};

// Bank sizes per slot: 87 questions for development (LA-CONTENT-001), 168 for an official
// competition of 60 players (LA-CONTENT-011).
export const PROFILES = {
  dev87: { minefield_main: { easy: 9, medium: 12, hard: 9 }, minefield_defuse: { easy: 12 }, race: { easy: 15, medium: 21, hard: 9 } },
  official168: { minefield_main: { easy: 18, medium: 24, hard: 18 }, minefield_defuse: { easy: 18 }, race: { easy: 30, medium: 42, hard: 18 } },
};

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const normalizeText = (text) => text.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

export function optionCountFor(question) {
  return Array.isArray(question.options) ? question.options.length : 0;
}

// Validates one authoring-file document. `sources` is the verified source registry (id -> status).
// Returns { errors, warnings }: errors block import, warnings are trial limits and advice.
export function validateQuestionDocument(doc, { sources = new Map(), knownKeys = new Set() } = {}) {
  const errors = [];
  const warnings = [];
  const err = (key, code, detail = "") => errors.push(`${code}: ${key}${detail ? ` ${detail}` : ""}`);
  const warn = (key, code, detail = "") => warnings.push(`${code}: ${key}${detail ? ` ${detail}` : ""}`);

  if (!isObject(doc) || doc.schemaVersion !== 1) return { errors: ["SCHEMA_VERSION: expected schemaVersion 1"], warnings };
  if (!POOLS_BY_GAME[doc.game]) return { errors: [`GAME: expected minefield or race, got ${String(doc.game)}`], warnings };
  if (!Array.isArray(doc.questions)) return { errors: ["QUESTIONS: expected an array"], warnings };

  const keys = new Set(knownKeys);
  const prompts = new Map();
  for (const q of doc.questions) {
    const key = typeof q?.key === "string" ? q.key : "(no key)";
    if (!isObject(q)) { err(key, "NOT_OBJECT"); continue; }
    if (!/^[a-z0-9][a-z0-9._-]{2,80}$/.test(q.key ?? "")) err(key, "KEY_FORMAT");
    if (keys.has(q.key)) err(key, "DUPLICATE_KEY");
    keys.add(q.key);
    if (q.origin !== undefined) err(key, "ORIGIN_FORBIDDEN", "authoring files are always bank Drafts; fixtures come from the fixture generator");
    if (q.status !== undefined) err(key, "STATUS_FORBIDDEN", "status is set by human review in the database, never in a file");

    if (!POOLS_BY_GAME[doc.game].includes(q.pool)) err(key, "POOL_GAME_MISMATCH", `${q.pool} not in ${doc.game}`);
    if (!CHAPTERS.includes(q.chapter)) err(key, "CHAPTER");
    if (!DIFFICULTIES.includes(q.difficulty)) err(key, "DIFFICULTY");
    if (!TYPES.includes(q.type)) err(key, "TYPE");
    if (typeof q.topic !== "string" || q.topic.trim().length < 2 || q.topic.length > 120) err(key, "TOPIC");
    if ((q.pool === "minefield_defuse") !== (q.type === "defuse_ab")) err(key, "DEFUSE_TYPE_POOL");
    if (q.pool === "minefield_defuse" && q.difficulty !== "easy") err(key, "DEFUSE_DIFFICULTY");

    const n = optionCountFor(q);
    if (n < 2 || n > 3) err(key, "OPTION_COUNT", `got ${n}`);
    if ((q.type === "defuse_ab" || q.type === "before_after") && n !== 2) err(key, "TWO_OPTION_TYPE", `${q.type} needs exactly 2 options`);

    if (typeof q.prompt !== "string" || q.prompt.trim().length === 0 || q.prompt.length > HARD_LIMITS.prompt) err(key, "PROMPT");
    else if (q.prompt.length > TRIAL_LIMITS.prompt) warn(key, "PROMPT_OVER_TRIAL_LIMIT", `${q.prompt.length}>${TRIAL_LIMITS.prompt}`);

    const ids = new Set();
    for (const option of Array.isArray(q.options) ? q.options : []) {
      if (!isObject(option) || !/^[a-z0-9]{1,8}$/.test(option.id ?? "")) { err(key, "OPTION_ID"); continue; }
      if (ids.has(option.id)) err(key, "OPTION_ID_DUPLICATE", option.id);
      ids.add(option.id);
      if (typeof option.label !== "string" || option.label.trim().length === 0 || option.label.length > HARD_LIMITS.option) err(key, "OPTION_LABEL", option.id);
      else if (option.label.length > TRIAL_LIMITS.option) warn(key, "OPTION_OVER_TRIAL_LIMIT", `${option.id} ${option.label.length}>${TRIAL_LIMITS.option}`);
    }
    if (!ids.has(q.correctOptionId)) err(key, "CORRECT_OPTION");
    if (typeof q.explanation !== "string" || q.explanation.trim().length === 0 || q.explanation.length > HARD_LIMITS.explanation) err(key, "EXPLANATION");

    if (!Array.isArray(q.sources) || q.sources.length === 0) err(key, "SOURCES_REQUIRED");
    for (const link of Array.isArray(q.sources) ? q.sources : []) {
      const status = sources.get(link?.sourceId);
      if (!status) err(key, "UNKNOWN_SOURCE", String(link?.sourceId));
      else if (status !== "verified") err(key, "SOURCE_NOT_VERIFIED", link.sourceId);
      if (typeof link?.locator !== "string" || link.locator.trim().length === 0) err(key, "SOURCE_LOCATOR", String(link?.sourceId));
    }

    const fingerprint = typeof q.prompt === "string" ? `${q.pool}|${normalizeText(q.prompt)}` : null;
    if (fingerprint) {
      if (prompts.has(fingerprint)) err(key, "DUPLICATE_PROMPT", `same as ${prompts.get(fingerprint)}`);
      prompts.set(fingerprint, q.key);
    }
    if (q.aiAssisted !== undefined && typeof q.aiAssisted !== "boolean") err(key, "AI_ASSISTED_TYPE");
  }
  return { errors, warnings };
}

// Arguments for public.upsert_question_draft(...). Always a bank Draft.
export function toDraftArguments(game, q) {
  return {
    p_external_key: q.key,
    p_question: { game_type: game, pool: q.pool, chapter: q.chapter, topic: q.topic.trim(), question_type: q.type, option_count: q.options.length, difficulty: q.difficulty },
    p_public: { prompt: q.prompt.trim(), options: q.options.map((o) => ({ id: o.id, label: o.label.trim() })) },
    p_private: { correctOptionId: q.correctOptionId, explanation: q.explanation.trim() },
    p_sources: q.sources.map((s) => ({ sourceId: s.sourceId, locator: s.locator.trim(), usageNote: (s.usageNote ?? "").trim() })),
    p_ai_assisted: q.aiAssisted ?? false,
  };
}

// Size and balance of a set of questions, against the 87 / 168 targets.
export function analyzeBank(questions) {
  const bySlot = {};
  const answerPosition = {};
  let twoOption = 0;
  for (const q of questions) {
    const slot = `${q.pool}/${q.difficulty}`;
    bySlot[slot] = (bySlot[slot] ?? 0) + 1;
    if (q.options.length === 2) twoOption += 1;
    const position = q.options.findIndex((o) => o.id === q.correctOptionId);
    answerPosition[position] = (answerPosition[position] ?? 0) + 1;
  }
  const targets = Object.fromEntries(Object.entries(PROFILES).map(([name, profile]) => [name, Object.entries(profile).flatMap(([pool, byDifficulty]) => Object.entries(byDifficulty).map(([difficulty, n]) => [`${pool}/${difficulty}`, n]))]));
  const progress = Object.fromEntries(Object.entries(targets).map(([name, slots]) => [name, Object.fromEntries(slots.map(([slot, n]) => [slot, { have: bySlot[slot] ?? 0, target: n }]))]));
  const total = questions.length;
  const dev = Object.values(progress.dev87).reduce((s, x) => s + Math.min(x.have, x.target), 0);
  const official = Object.values(progress.official168).reduce((s, x) => s + Math.min(x.have, x.target), 0);
  return { total, bySlot, twoOption, answerPosition, progress, coverage: { dev87: `${dev}/87`, official168: `${official}/168` } };
}

// Deterministic synthetic questions. Obviously fake on purpose (LA-CONTENT-005): no historical
// claims, every text starts with a marker, so nobody can mistake them for reviewed content.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FIXTURE_MARKER = "[GIẢ LẬP]";

export function generateFixtures(profile = "dev87", { seed = 20261030, keyPrefix = "fx" } = {}) {
  const spec = PROFILES[profile];
  if (!spec) throw new Error(`unknown fixture profile ${profile}`);
  const rand = mulberry32(seed);
  const out = [];
  for (const [pool, byDifficulty] of Object.entries(spec)) {
    const game = pool === "race" ? "race" : "minefield";
    for (const [difficulty, count] of Object.entries(byDifficulty)) {
      for (let i = 1; i <= count; i += 1) {
        let type = "single_choice";
        if (pool === "minefield_defuse") type = "defuse_ab";
        else if (pool === "race") {
          // about a third two-option per slot, a few pair questions, the rest A/B/C
          const roll = i % 3;
          type = roll === 0 ? "before_after" : i % 7 === 0 ? "pair_choice" : "single_choice";
        }
        const optionCount = type === "single_choice" || type === "pair_choice" ? 3 : 2;
        const ids = ["a", "b", "c"].slice(0, optionCount);
        const correct = ids[Math.floor(rand() * ids.length)];
        const label = `${pool}-${difficulty}-${String(i).padStart(2, "0")}`;
        out.push({
          key: `${keyPrefix}-${pool.replace("_", "-")}-${difficulty}-${String(i).padStart(3, "0")}`,
          game,
          pool,
          chapter: CHAPTERS[(i - 1) % 3],
          topic: `${FIXTURE_MARKER} ${label}`,
          type,
          difficulty,
          prompt: `${FIXTURE_MARKER} Câu ${label}: chọn đáp án ${correct.toUpperCase()}`,
          options: ids.map((id) => ({ id, label: `Đáp án ${id.toUpperCase()}` })),
          correctOptionId: correct,
          explanation: `${FIXTURE_MARKER} Dữ liệu giả lập để phát triển và kiểm thử, không phải nội dung lịch sử.`,
          sources: [],
        });
      }
    }
  }
  return out;
}

// Markdown pack for the human academic reviewer. Shows every Draft with its sources and the
// AI-assistance flag; says plainly that nothing in it is reviewed or published.
export function buildReviewPack(questions, sources = new Map(), { title = "Gói duyệt học thuật – ngân hàng câu hỏi" } = {}) {
  const lines = [`# ${title}`, "", "> **Trạng thái:** tất cả câu dưới đây là **Draft**, chưa được người duyệt học thuật xem xét và **chưa được Published**. AI chỉ soạn nháp; chỉ quản trị viên/giảng viên mới được duyệt và xuất bản.", ""];
  const analysis = analyzeBank(questions);
  lines.push(`Tổng: ${analysis.total} câu · phủ mục tiêu 87: ${analysis.coverage.dev87} · phủ mục tiêu 168: ${analysis.coverage.official168}`, "");
  for (const q of questions) {
    const aiNote = q.aiAssisted ? " · **AI soạn nháp**" : "";
    lines.push(`## ${q.key}${aiNote}`, "", `- Trò chơi/nhóm: ${q.pool} · độ khó: ${q.difficulty} · chương: ${q.chapter} · dạng: ${q.type}`, `- Chủ đề: ${q.topic}`, "", `**${q.prompt}**`, "");
    for (const o of q.options) lines.push(`- ${o.id.toUpperCase()}. ${o.label}${o.id === q.correctOptionId ? "  ← đáp án đúng" : ""}`);
    lines.push("", `Giải thích: ${q.explanation}`, "", "Nguồn:");
    for (const s of q.sources) lines.push(`- ${sources.get(s.sourceId)?.title ?? s.sourceId} — ${s.locator}${s.usageNote ? ` (${s.usageNote})` : ""}`);
    lines.push("", "Quyết định của người duyệt: ☐ Duyệt  ☐ Sửa  ☐ Loại — Ghi chú: ______", "");
  }
  return lines.join("\n");
}
