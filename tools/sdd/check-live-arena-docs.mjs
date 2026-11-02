// Kiểm tra tính nhất quán của tài liệu Live Arena V1.0 (Giai đoạn A).
// Chạy: node tools/sdd/check-live-arena-docs.mjs  — thoát mã 1 nếu có lỗi.
// In báo cáo Markdown ra stdout (dùng cho docs/sdd/evidence/live-arena/consistency-check.md).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const errors = [];
const fail = (msg) => errors.push(msg);

function walk(dir) {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const rel = join(dir, name);
    return statSync(join(root, rel)).isDirectory() ? walk(rel) : rel.endsWith(".md") ? [rel] : [];
  });
}

const SPEC = "docs/sdd/specs/live-arena-game-spec.md";
const spec = read(SPEC);
const TAGS = ["CHỐT", "CHỐT V0.1", "THỬ NGHIỆM", "ĐỀ XUẤT", "MỞ"];
const ID = String.raw`(?:LA-[A-Z]+-\d{3}|MINE-[A-Z]+-\d{3}|RACE-\d{3})`;

// 1. Định nghĩa luật và nhãn.
const rules = new Map();
for (const m of spec.matchAll(new RegExp(String.raw`^- \`(${ID})\` \`\[([^\]]+)\]\``, "gm"))) {
  if (rules.has(m[1])) fail(`Luật định nghĩa trùng: ${m[1]}`);
  if (!TAGS.includes(m[2])) fail(`Nhãn không hợp lệ ${m[2]} ở ${m[1]}`);
  rules.set(m[1], m[2]);
}
const acs = new Set();
for (const m of spec.matchAll(/^\| `(LA-AC-\d{3})` \|/gm)) {
  if (acs.has(m[1])) fail(`Tiêu chí chấp nhận trùng: ${m[1]}`);
  acs.add(m[1]);
}
const defined = new Set([...rules.keys(), ...acs]);

// Mở rộng tham chiếu: "X-001..003", "X-001/002", "X-*".
function expand(text) {
  const out = new Set();
  const families = new Set();
  const re = new RegExp(String.raw`\b((?:LA-[A-Z]+|MINE-[A-Z]+|RACE))-(\d{3})((?:\.\.\d{3})|(?:\/\d{3})+)?|\b((?:LA-[A-Z]+|MINE-[A-Z]+|RACE))-\*`, "g");
  for (const m of text.matchAll(re)) {
    if (m[4]) {
      families.add(m[4]);
      continue;
    }
    const fam = m[1];
    const start = Number(m[2]);
    const pad = (n) => `${fam}-${String(n).padStart(3, "0")}`;
    out.add(pad(start));
    if (m[3]?.startsWith("..")) {
      for (let n = start + 1; n <= Number(m[3].slice(2)); n += 1) out.add(pad(n));
    } else if (m[3]) {
      for (const part of m[3].split("/").filter(Boolean)) out.add(pad(Number(part)));
    }
  }
  return { ids: out, families };
}
const familyOf = (id) => id.replace(/-\d{3}$/, "");

// 2. Mọi tham chiếu trong tài liệu phải tồn tại.
const docs = [...walk("docs/sdd"), "AGENTS.md"];
for (const doc of docs) {
  const { ids } = expand(read(doc));
  for (const id of ids) if (!defined.has(id)) fail(`${doc}: tham chiếu ${id} không được định nghĩa trong spec`);
}

// 3. Truy vết: mọi luật/tiêu chí được phủ trong traceability matrix.
const TRACE = "docs/sdd/traceability-matrix.md";
const trace = read(TRACE);
const traced = expand(trace);
for (const id of defined) {
  if (!traced.ids.has(id) && !traced.families.has(familyOf(id))) fail(`${TRACE}: chưa truy vết ${id}`);
}

// 4. Task được tham chiếu (đơn lẻ hoặc đầu/cuối khoảng "T050-T054") phải tồn tại trong TASKS.md.
const tasksDoc = read("docs/sdd/TASKS.md");
const tasks = new Set([...tasksDoc.matchAll(/`(T\d{3})`/g)].map((m) => m[1]));
for (const doc of [SPEC, TRACE, "docs/sdd/PLAN.md"]) {
  for (const m of read(doc).matchAll(/\bT(\d{3})(?:[–-]T?(\d{3}))?\b/g)) {
    for (const n of [m[1], m[2]].filter(Boolean)) {
      if (!tasks.has(`T${n}`)) fail(`${doc}: task T${n} không có trong TASKS.md`);
    }
  }
}

// 5. Điểm còn mở (bảng §12.2.1) phải được gắn vào ít nhất một task.
const openSection = spec.slice(spec.indexOf("### 12.2.1"), spec.indexOf("### 12.3"));
const openItems = [...openSection.matchAll(/^\| `?([A-Z][A-Z0-9-]*\d)`? \|/gm)].map((m) => m[1]);
for (const n of openItems) {
  if (!new RegExp(String.raw`\b${n}\b`).test(tasksDoc)) fail(`TASKS.md: điểm mở ${n} chưa gắn với task nào`);
}
// 5b. Luật được nêu trong bảng quyết định §12.1/§12.2 không còn mang nhãn ĐỀ XUẤT (trừ khi nằm trong §12.2.1).
const decisionSection = spec.slice(spec.indexOf("### 12.1"), spec.indexOf("### 12.2.1"));
const openIds = expand(openSection).ids;
for (const id of expand(decisionSection).ids) {
  if (rules.get(id) === "ĐỀ XUẤT" && !openIds.has(id)) fail(`${id} đã có quyết định nhưng vẫn mang nhãn ĐỀ XUẤT`);
}
// Không còn tham chiếu O1–O14 như điểm chặn trong TASKS (đã quyết định).
if (/Blocked: O\d|blocked: O\d|Open: O\d/.test(tasksDoc)) fail("TASKS.md: còn chặn bởi O1–O14 đã được quyết định");

// 6. Core §16: mọi rule v1.0 được nhắc phải tồn tại trong Core spec.
const core = read("docs/sdd/specs/core-platform-spec.md");
const coreDefined = new Set([...core.matchAll(/^- `([A-Z0-9]+(?:-[A-Z0-9]+)*-\d{3})`:/gm)].map((m) => m[1]));
const amendment = core.slice(core.indexOf("## 16."));
for (const m of amendment.matchAll(/`((?:ACC|ACCESS|EVT|ATT|GAME1|GAME2|GAME2-SCORE|CFG|ALLOC|LEARN|CONTENT|SCORE|PRV|AC-DISC|AC-SCORE|AC-PRV)-\d{3})`/g)) {
  if (!coreDefined.has(m[1])) fail(`Core §16 nhắc ${m[1]} nhưng rule không tồn tại`);
}

// 7. Thuật ngữ cũ không còn trong hợp đồng hiện hành (trừ dòng ghi chú lịch sử).
const CONTRACTS = ["data-model", "api-contracts", "realtime-contracts", "security-spec"].map((n) => `docs/sdd/architecture/${n}.md`);
const STALE = [/decision_room/, /"timeline"|:timeline\b/, /grace pause|disconnect grace|graceRemaining/i, /mustChangePassword/, /feedback\/continue/, /full_name_snapshot/, /\^\[A-Z\]\{2,4\}\\d\{5,8\}\$`\.?$/];
const ALLOW = /v1\.0|v1\.1|không phải luật|không dùng|không trả|Không có trạng thái|không có grace|Superseded|thay `timeline/i;
for (const doc of [...CONTRACTS, "docs/sdd/specs/product-experience-spec.md", "docs/sdd/specs/figma-make-brief.md"]) {
  read(doc).split("\n").forEach((line, i) => {
    for (const re of STALE) if (re.test(line) && !ALLOW.test(line)) fail(`${doc}:${i + 1}: thuật ngữ cũ (${re}) — ${line.trim().slice(0, 90)}`);
  });
}

// 8. Không phát hành nội dung câu trước available_at trong các response mở ô / trả lời.
const api = read("docs/sdd/architecture/api-contracts.md");
function section(title) {
  const start = api.indexOf(title);
  if (start < 0) {
    fail(`api-contracts: thiếu mục ${title}`);
    return "";
  }
  const next = api.indexOf("\n### ", start + title.length);
  return api.slice(start, next < 0 ? undefined : next);
}
for (const title of ["### `POST /attempts/{attemptId}/cells/{cellIndex}/open`", "### `POST /attempts/{attemptId}/interactions/{allocationId}/submissions`"]) {
  if (/"prompt"|"options"/.test(section(title))) fail(`api-contracts: ${title} chứa nội dung câu`);
}
if (!section("### `GET /attempts/{attemptId}/interactions/{allocationId}/content`").includes("available_at")) fail("api-contracts: endpoint content không nêu điều kiện available_at");

// 9. MSSV: không còn regex cố định gắn [CHỐT]; không còn giới hạn 100 hàng là luật.
for (const doc of [SPEC, ...CONTRACTS]) {
  read(doc).split("\n").forEach((line, i) => {
    if (/\{2,4\}\\d\{5,8\}/.test(line) && /\[CHỐT\]/.test(line)) fail(`${doc}:${i + 1}: mẫu MSSV cố định gắn [CHỐT]`);
    if (/100 hàng/.test(line) && !/v1\.0/.test(line)) fail(`${doc}:${i + 1}: còn giới hạn 100 hàng`);
  });
}

// 10. Không tuyên bố chống tra cứu/chia sẻ tuyệt đối.
for (const doc of docs) {
  read(doc).replaceAll("*", "").split("\n").forEach((line, i) => {
    if (/chống (tra cứu|chia sẻ)[^.]*tuyệt đối/i.test(line) && !/không (được )?tuyên bố|không tuyên bố|không phải|không được trình bày/i.test(line)) {
      fail(`${doc}:${i + 1}: có thể đang tuyên bố chống tra cứu/chia sẻ tuyệt đối`);
    }
  });
}

// 11. Không tài liệu hiện hành nào còn yêu cầu công khai họ tên đầy đủ (quyết định N1).
const NEGATION = /không|never|SHALL NOT|not |chỉ quản trị|chỉ cho chính|only to|Amended|previously|v1\.1|Sửa đổi|thay cho|ngoài/i;
for (const doc of docs) {
  if (doc.replaceAll("\\", "/").includes("evidence/")) continue;
  read(doc).replaceAll("*", "").split("\n").forEach((line, i) => {
    if (/(full names?|họ tên đầy đủ)/i.test(line) && /(public|công khai|leaderboard|bảng xếp hạng|projector|trình chiếu)/i.test(line) && !NEGATION.test(line)) {
      fail(`${doc}:${i + 1}: có thể còn yêu cầu công khai họ tên đầy đủ — ${line.trim().slice(0, 90)}`);
    }
  });
}

// 12. Không có kết luận thời gian dạng tuyệt đối.
for (const doc of docs) {
  read(doc).split("\n").forEach((line, i) => {
    if (/không bao giờ (chạm|là ràng buộc|bị chạm)|never (reaches|hits) (2:30|3:00)/i.test(line) && !/Không được kết luận/.test(line)) {
      fail(`${doc}:${i + 1}: kết luận thời gian tuyệt đối`);
    }
  });
}

// 13. `now()` không được dùng làm mốc quyết định trong spec và hợp đồng.
for (const doc of [SPEC, ...CONTRACTS]) {
  read(doc).split("\n").forEach((line, i) => {
    if (/now\(\)/.test(line) && !/clock_timestamp|không dùng|\*\*không\*\* dùng|not use|thuần audit/i.test(line)) {
      fail(`${doc}:${i + 1}: dùng now() làm mốc quyết định — ${line.trim().slice(0, 90)}`);
    }
  });
}

// Báo cáo.
const byFamily = new Map();
for (const [id, tag] of rules) {
  const fam = familyOf(id);
  if (!byFamily.has(fam)) byFamily.set(fam, Object.fromEntries(TAGS.map((t) => [t, 0])));
  byFamily.get(fam)[tag] += 1;
}
const totals = Object.fromEntries(TAGS.map((t) => [t, [...rules.values()].filter((v) => v === t).length]));
console.log("## Bảng nhãn theo nhóm luật\n");
console.log(`| Nhóm | ${TAGS.join(" | ")} |`);
console.log(`|---|${TAGS.map(() => "---:").join("|")}|`);
for (const [fam, counts] of byFamily) console.log(`| \`${fam}\` | ${TAGS.map((t) => counts[t] || "").join(" | ")} |`);
console.log(`| **Tổng (${rules.size} luật)** | ${TAGS.map((t) => `**${totals[t]}**`).join(" | ")} |`);
console.log("\n## Luật chưa ở trạng thái CHỐT\n");
for (const tag of ["THỬ NGHIỆM", "ĐỀ XUẤT", "MỞ"]) {
  const ids = [...rules].filter(([, t]) => t === tag).map(([id]) => `\`${id}\``);
  console.log(`- **${tag}** (${ids.length}): ${ids.join(", ") || "—"}`);
}
console.log(`\n## Kết quả kiểm tra\n\n- Luật: ${rules.size}; tiêu chí chấp nhận: ${acs.size}; điểm còn mở: ${openItems.join(", ")}.`);
console.log(`- Tài liệu quét: ${docs.length} (${docs.map((d) => relative(".", d)).length} file Markdown dưới docs/sdd và AGENTS.md).`);
console.log(`- Lỗi: ${errors.length}`);
for (const e of errors) console.log(`  - ${e}`);
process.exit(errors.length ? 1 : 0);
