// Bãi Mìn Tri Thức — mô phỏng cân bằng (phân tích, không phải gameplay code).
// Đo mức ảnh hưởng của may rủi (thứ tự mở ô) lên điểm và thứ hạng theo luật đã chốt
// trong docs/sdd/specs/live-arena-game-spec.md. Chạy: node tools/simulations/minefield-balance.mjs
// Giả định: người chơi không có thông tin để chọn ô (không có gợi ý), nên thứ tự mở ô là ngẫu nhiên;
// người chơi luôn kịp xử lý 10 câu chính trước khi hết giờ toàn trận.

const SEED = 20261029;
let state = SEED >>> 0;
function rand() {
  // mulberry32 — RNG có seed để kết quả tái lập được.
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const POINTS = { E: 100, M: 200, H: 300 };
const DIFFS = ["E", "E", "E", "M", "M", "M", "M", "H", "H", "H"];
const CELLS = [...Array(10).fill("Q"), "B", "B", "B", "X", "S", "S", "C", "C", "C", "C"];

// Hồ sơ năng lực: xác suất trả lời đúng câu Dễ/TB/Khó và câu gỡ bom A/B.
const PROFILES = {
  "Xuất sắc": { E: 0.95, M: 0.85, H: 0.7, defuse: 0.9 },
  Khá: { E: 0.85, M: 0.7, H: 0.5, defuse: 0.8 },
  "Trung bình": { E: 0.75, M: 0.55, H: 0.35, defuse: 0.7 },
  Yếu: { E: 0.6, M: 0.4, H: 0.2, defuse: 0.6 },
};

// Kết quả kiến thức (đúng/sai từng câu chính, từng câu gỡ bom) được rút trước,
// tách khỏi may rủi bàn cờ, để so sánh "chỉ kiến thức" với "kiến thức + bàn cờ".
function drawKnowledge(p) {
  const diffs = shuffle([...DIFFS]);
  const main = diffs.map((d) => ({ d, ok: rand() < p[d] }));
  const defuse = [rand() < p.defuse, rand() < p.defuse, rand() < p.defuse];
  return { main, defuse };
}
function baseScore(k) {
  return k.main.reduce((s, q) => s + (q.ok ? POINTS[q.d] : 0), 0);
}
function play(k) {
  const cells = shuffle([...CELLS]);
  if (cells[0] === "B") {
    const j = 1 + Math.floor(rand() * 17);
    // Đổi ô đầu với một ô không phải bom bất kỳ.
    const nonBomb = cells.map((c, i) => (c !== "B" ? i : -1)).filter((i) => i >= 0);
    const k2 = nonBomb[j % nonBomb.length];
    [cells[0], cells[k2]] = [cells[k2], cells[0]];
  }
  let score = 0;
  let shields = 0;
  let dbl = false;
  let qi = 0;
  let bi = 0;
  for (const c of cells) {
    if (qi >= 10) break;
    if (c === "Q") {
      const q = k.main[qi++];
      if (q.ok) score += POINTS[q.d] * (dbl ? 2 : 1);
      dbl = false;
    } else if (c === "C") score += 40;
    else if (c === "S") shields = Math.min(2, shields + 1);
    else if (c === "X") dbl = true;
    else if (c === "B") {
      const ok = k.defuse[bi++];
      if (!ok) {
        if (shields > 0) shields -= 1;
        else score = Math.max(0, score - 100);
      }
    }
  }
  return score;
}
function stats(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const q = (p) => s[Math.floor(p * (n - 1))];
  return { mean: Math.round(mean), sd: Math.round(sd), p5: q(0.05), p50: q(0.5), p95: q(0.95), min: s[0], max: s[n - 1] };
}
const pct = (x) => `${(x * 100).toFixed(1)}%`;

// 1) Biên độ may rủi khi kiến thức cố định (đúng hết mọi câu).
const N1 = 200000;
const perfect = { main: DIFFS.map((d) => ({ d, ok: true })), defuse: [true, true, true] };
const perfectGuess = () => ({ main: DIFFS.map((d) => ({ d, ok: true })), defuse: [rand() < 0.5, rand() < 0.5, rand() < 0.5] });
console.log("## 1. Đúng 100% câu chính");
console.log("gỡ bom 100%:", stats(Array.from({ length: N1 }, () => play(perfect))));
console.log("gỡ bom 50% :", stats(Array.from({ length: N1 }, () => play(perfectGuess()))));

// 2) Phân bố theo hồ sơ năng lực.
console.log("\n## 2. Phân bố điểm theo năng lực (cơ bản = chỉ câu chính; đầy đủ = có bàn cờ)");
for (const [name, p] of Object.entries(PROFILES)) {
  const base = [];
  const full = [];
  for (let i = 0; i < N1; i += 1) {
    const k = drawKnowledge(p);
    base.push(baseScore(k));
    full.push(play(k));
  }
  console.log(name, "cơ bản", stats(base), "đầy đủ", stats(full));
}

// 3) Kiến thức thể hiện kém hơn đúng một câu: xác suất bị vượt chỉ vì bàn cờ.
console.log("\n## 3. Người A hơn người B đúng một câu chính (cùng gỡ bom 100%), bàn cờ độc lập");
for (const [label, lost] of [["Dễ (−100)", "E"], ["TB (−200)", "M"], ["Khó (−300)", "H"]]) {
  let over = 0;
  let tie = 0;
  const N3 = 200000;
  for (let i = 0; i < N3; i += 1) {
    const a = { main: shuffle([...DIFFS]).map((d) => ({ d, ok: true })), defuse: [true, true, true] };
    const bDiffs = shuffle([...DIFFS]);
    const idx = bDiffs.indexOf(lost);
    const b = { main: bDiffs.map((d, j) => ({ d, ok: j !== idx })), defuse: [true, true, true] };
    const sa = play(a);
    const sb = play(b);
    if (sb > sa) over += 1;
    else if (sb === sa) tie += 1;
  }
  console.log(`B sai 1 câu ${label}: B vượt A ${pct(over / N3)}, hòa điểm ${pct(tie / N3)}`);
}

// 4) Cặp hồ sơ năng lực: tỷ lệ người yếu hơn có điểm cao hơn, có và không có bàn cờ.
console.log("\n## 4. Người thuộc nhóm yếu hơn đạt điểm cao hơn (xác suất)");
const names = Object.keys(PROFILES);
for (let i = 0; i < names.length - 1; i += 1) {
  const strong = PROFILES[names[i]];
  const weak = PROFILES[names[i + 1]];
  let baseOver = 0;
  let fullOver = 0;
  const N4 = 200000;
  for (let n = 0; n < N4; n += 1) {
    const ks = drawKnowledge(strong);
    const kw = drawKnowledge(weak);
    if (baseScore(kw) > baseScore(ks)) baseOver += 1;
    if (play(kw) > play(ks)) fullOver += 1;
  }
  console.log(`${names[i + 1]} > ${names[i]}: chỉ câu hỏi ${pct(baseOver / N4)} → có bàn cờ ${pct(fullOver / N4)}`);
}

// 5) Lớp 60 người: kiến thức thể hiện (điểm cơ bản) so với thứ hạng cuối.
console.log("\n## 5. Lớp 60 người, năng lực phân bố liên tục (2.000 lớp mô phỏng)");
function logistic(x) {
  return 1 / (1 + Math.exp(-x));
}
function normal() {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function ranks(xs) {
  // Hạng trung bình cho giá trị bằng nhau (Spearman).
  const idx = xs.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]);
  const r = new Array(xs.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j += 1;
    for (let k = i; k <= j; k += 1) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}
function spearman(a, b) {
  const ra = ranks(a);
  const rb = ranks(b);
  const n = a.length;
  const ma = ra.reduce((s, x) => s + x, 0) / n;
  const mb = rb.reduce((s, x) => s + x, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i += 1) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}
const CLASSES = 2000;
let rho = 0;
let top1Same = 0;
let top10Overlap = 0;
let top1Contested = 0;
for (let c = 0; c < CLASSES; c += 1) {
  const base = [];
  const full = [];
  for (let s = 0; s < 60; s += 1) {
    const theta = normal();
    const p = { E: logistic(theta + 2), M: logistic(theta + 0.8), H: logistic(theta - 0.4), defuse: logistic(theta + 1) };
    const k = drawKnowledge(p);
    base.push(baseScore(k));
    full.push(play(k));
  }
  rho += spearman(base, full);
  const maxBase = Math.max(...base);
  const leaders = base.map((b, i) => (b === maxBase ? i : -1)).filter((i) => i >= 0);
  if (leaders.length > 1) top1Contested += 1;
  const winner = full.indexOf(Math.max(...full));
  if (leaders.includes(winner)) top1Same += 1;
  const topBase = new Set(base.map((b, i) => [b, i]).sort((a, b) => b[0] - a[0]).slice(0, 10).map((x) => x[1]));
  const topFull = full.map((b, i) => [b, i]).sort((a, b) => b[0] - a[0]).slice(0, 10).map((x) => x[1]);
  top10Overlap += topFull.filter((i) => topBase.has(i)).length / 10;
}
console.log(`Spearman(điểm câu chính, điểm cuối): ${(rho / CLASSES).toFixed(3)}`);
console.log(`Người đứng đầu theo câu chính (kể cả đồng hạng) vẫn Top 1 sau bàn cờ: ${pct(top1Same / CLASSES)}`);
console.log(`Lớp có nhiều người cùng điểm câu chính cao nhất: ${pct(top1Contested / CLASSES)}`);
console.log(`Trùng lặp Top 10 (câu chính vs điểm cuối): ${pct(top10Overlap / CLASSES)}`);
