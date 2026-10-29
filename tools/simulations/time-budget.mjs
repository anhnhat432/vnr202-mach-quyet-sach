// Ngân sách thời gian toàn trận — phân tích tất định, không phải gameplay code.
// Câu hỏi: với thời hạn câu đã chốt, đồng hồ toàn trận 3:00 / 2:30 có bị chạm không,
// khi tính thêm thao tác chọn ô, hiệu ứng, phản hồi và độ trễ mạng?
// Chạy: node tools/simulations/time-budget.mjs
// Mô hình theo dòng thời gian của server (xem live-arena-game-spec.md §5.4.1):
// - Mỗi lần mở ô: d (người chơi quyết định + bấm) + rtt (yêu cầu mở) + reveal (offset lật ô).
// - Ô câu hỏi/bom: thêm nhận nội dung (long-poll: rtt/2; gọi sau khi tới giờ: rtt),
//   + thời gian trả lời (tối đa = thời hạn câu), + rtt/2 gửi đáp án, + phản hồi.
// - Game 2: mỗi câu = offset phản hồi + nhận nội dung + thời gian trả lời + rtt/2.

const REVEAL = 0.6; // offset lật ô Game 1 [THỬ NGHIỆM]
const FEEDBACK = 0.9; // phản hồi 0,8–1 s [THỬ NGHIỆM]
const G1_LIMITS = [6, 6, 6, 8, 8, 8, 8, 10, 10, 10];
const DEFUSE = [5, 5, 5];
const G2_LIMITS = [5, 5, 5, 5, 5, 7, 7, 7, 7, 7, 7, 7, 9, 9, 9];
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

function game1(d, rtt, longPoll, useFraction) {
  const fetch = longPoll ? rtt / 2 : rtt;
  const answered = [...G1_LIMITS, ...DEFUSE].map((l) => l * useFraction);
  // Tình huống xấu nhất: câu chính thứ 10 nằm ở ô cuối, tức mở đủ 20 ô.
  const cells = 20 * (d + rtt + REVEAL);
  const questions = sum(answered) + 13 * (fetch + rtt / 2 + FEEDBACK);
  return cells + questions;
}
function game2(rtt, longPoll, useFraction) {
  const fetch = longPoll ? rtt / 2 : rtt;
  return sum(G2_LIMITS.map((l) => l * useFraction)) + 15 * (FEEDBACK + fetch + rtt / 2);
}
const fmt = (s, cap) => `${s.toFixed(0).padStart(4)} s${s > cap ? " ⚠" : ""}`;

console.log("Tổng thời hạn câu: Game 1 =", sum(G1_LIMITS) + sum(DEFUSE), "s; Game 2 =", sum(G2_LIMITS), "s\n");
for (const [label, frac] of [["Dùng hết 100 % thời hạn mọi câu (xấu nhất)", 1], ["Dùng 60 % thời hạn", 0.6]]) {
  console.log(`## Game 1 (giới hạn 180 s) — ${label}, mở đủ 20 ô`);
  console.log("d \\ rtt      0.1 s      0.3 s      0.6 s      1.0 s   (long-poll | gọi sau)");
  for (const d of [1, 2, 3, 4]) {
    const cells = [0.1, 0.3, 0.6, 1.0].map((rtt) => `${fmt(game1(d, rtt, true, frac), 180)}|${fmt(game1(d, rtt, false, frac), 180)}`);
    console.log(`d=${d} s  ${cells.join("  ")}`);
  }
  console.log(`\n## Game 2 (giới hạn 150 s) — ${label}`);
  console.log([0.1, 0.3, 0.6, 1.0].map((rtt) => `rtt=${rtt}s: ${fmt(game2(rtt, true, frac), 150)} | ${fmt(game2(rtt, false, frac), 150)}`).join("   "));
  console.log("");
}
// Ngưỡng d (giây/ô) làm Game 1 chạm 180 s trong tình huống xấu nhất.
for (const rtt of [0.1, 0.3, 0.6, 1.0]) {
  const base = game1(0, rtt, true, 1);
  console.log(`rtt=${rtt}s, long-poll: chạm 3:00 khi thời gian chọn mỗi ô > ${((180 - base) / 20).toFixed(2)} s`);
}
