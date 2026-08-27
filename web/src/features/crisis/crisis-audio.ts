// Âm thanh tổng hợp bằng Web Audio — không cần file, nhẹ, tắt mặc định.
// Chỉ khởi tạo AudioContext sau cử chỉ người dùng (bấm nút) để hợp chính sách autoplay.

type Osc = OscillatorType;

export type CrisisSound = {
  resume: () => void;
  tick: () => void;
  thud: () => void;
  win: () => void;
  lose: () => void;
};

export function createSound(): CrisisSound {
  let ctx: AudioContext | null = null;

  const ac = (): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    return ctx;
  };

  const blip = (freq: number, dur: number, type: Osc, gain = 0.06, delay = 0) => {
    const c = ac();
    if (!c) return;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  };

  return {
    resume: () => {
      const c = ac();
      if (c && c.state === "suspended") void c.resume();
    },
    tick: () => blip(430, 0.08, "triangle", 0.05),
    thud: () => {
      blip(92, 0.5, "sine", 0.13);
      blip(58, 0.62, "sine", 0.1, 0.02);
    },
    win: () => [523.25, 659.25, 783.99].forEach((f, i) => blip(f, 0.5, "triangle", 0.05, i * 0.09)),
    lose: () => [330, 247, 175].forEach((f, i) => blip(f, 0.55, "sine", 0.06, i * 0.12)),
  };
}
