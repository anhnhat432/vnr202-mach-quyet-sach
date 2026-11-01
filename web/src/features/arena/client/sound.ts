"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Synthesized Web Audio sound effects (zero external audio files).
// Remembers the player's mute/unmute preference per device and never blocks gameplay.
const KEY = "vnr202:arena:sound:v1";

export type Cue =
  | "tap"
  | "tick"
  | "countdown"
  | "correct"
  | "wrong"
  | "timeout"
  | "chest"
  | "bomb"
  | "defuse"
  | "explode"
  | "shield"
  | "shield_block"
  | "double"
  | "combo"
  | "sprint"
  | "start"
  | "finish"
  | "lead"
  | "overtake";

type ToneStep = {
  freq: number;
  freqEnd?: number;
  dur: number;
  type: OscillatorType;
  gain?: number;
  delay?: number;
};

const CUES: Record<Cue, ToneStep[]> = {
  tap: [
    { freq: 540, freqEnd: 740, dur: 0.045, type: "sine", gain: 0.13, delay: 0 },
  ],
  tick: [
    { freq: 587.33, dur: 0.06, type: "triangle", gain: 0.15, delay: 0 },
    { freq: 880, dur: 0.09, type: "triangle", gain: 0.17, delay: 0.05 },
  ],
  countdown: [
    { freq: 987.77, dur: 0.055, type: "square", gain: 0.11, delay: 0 },
    { freq: 493.88, dur: 0.045, type: "triangle", gain: 0.13, delay: 0 },
  ],
  correct: [
    { freq: 523.25, dur: 0.08, type: "triangle", gain: 0.18, delay: 0 },
    { freq: 659.25, dur: 0.08, type: "triangle", gain: 0.19, delay: 0.065 },
    { freq: 783.99, dur: 0.1, type: "triangle", gain: 0.2, delay: 0.13 },
    { freq: 1046.5, dur: 0.22, type: "triangle", gain: 0.22, delay: 0.2 },
  ],
  wrong: [
    { freq: 260, freqEnd: 210, dur: 0.14, type: "sawtooth", gain: 0.15, delay: 0 },
    { freq: 196, freqEnd: 146.83, dur: 0.26, type: "sawtooth", gain: 0.17, delay: 0.12 },
    { freq: 98, dur: 0.28, type: "triangle", gain: 0.18, delay: 0.12 },
  ],
  timeout: [
    { freq: 440, dur: 0.11, type: "sawtooth", gain: 0.15, delay: 0 },
    { freq: 349.23, dur: 0.11, type: "sawtooth", gain: 0.15, delay: 0.1 },
    { freq: 293.66, freqEnd: 220, dur: 0.28, type: "sawtooth", gain: 0.17, delay: 0.2 },
  ],
  chest: [
    { freq: 783.99, dur: 0.07, type: "triangle", gain: 0.18, delay: 0 },
    { freq: 987.77, dur: 0.07, type: "triangle", gain: 0.19, delay: 0.06 },
    { freq: 1174.66, dur: 0.08, type: "triangle", gain: 0.2, delay: 0.12 },
    { freq: 1567.98, dur: 0.26, type: "sine", gain: 0.22, delay: 0.18 },
  ],
  bomb: [
    { freq: 680, freqEnd: 420, dur: 0.14, type: "sawtooth", gain: 0.18, delay: 0 },
    { freq: 720, freqEnd: 420, dur: 0.16, type: "sawtooth", gain: 0.2, delay: 0.15 },
    { freq: 130, freqEnd: 85, dur: 0.3, type: "triangle", gain: 0.22, delay: 0.02 },
  ],
  defuse: [
    { freq: 698.46, dur: 0.08, type: "triangle", gain: 0.18, delay: 0 },
    { freq: 880, dur: 0.08, type: "triangle", gain: 0.19, delay: 0.06 },
    { freq: 1046.5, dur: 0.1, type: "triangle", gain: 0.21, delay: 0.12 },
    { freq: 1396.91, dur: 0.28, type: "sine", gain: 0.23, delay: 0.18 },
  ],
  explode: [
    { freq: 165, freqEnd: 36, dur: 0.42, type: "sawtooth", gain: 0.25, delay: 0 },
    { freq: 110, freqEnd: 28, dur: 0.48, type: "sine", gain: 0.28, delay: 0 },
    { freq: 95, freqEnd: 42, dur: 0.34, type: "square", gain: 0.15, delay: 0.03 },
  ],
  shield: [
    { freq: 523.25, dur: 0.11, type: "sine", gain: 0.18, delay: 0 },
    { freq: 783.99, dur: 0.13, type: "sine", gain: 0.18, delay: 0.07 },
    { freq: 987.77, dur: 0.15, type: "triangle", gain: 0.19, delay: 0.14 },
    { freq: 1318.51, dur: 0.24, type: "sine", gain: 0.21, delay: 0.21 },
  ],
  shield_block: [
    { freq: 190, freqEnd: 92, dur: 0.12, type: "triangle", gain: 0.22, delay: 0 },
    { freq: 587.33, freqEnd: 880, dur: 0.16, type: "sine", gain: 0.2, delay: 0.08 },
    { freq: 1174.66, dur: 0.24, type: "triangle", gain: 0.22, delay: 0.18 },
  ],
  double: [
    { freq: 440, freqEnd: 880, dur: 0.14, type: "triangle", gain: 0.19, delay: 0 },
    { freq: 659.25, freqEnd: 1318.51, dur: 0.2, type: "sine", gain: 0.22, delay: 0.1 },
  ],
  combo: [
    { freq: 880, dur: 0.065, type: "square", gain: 0.14, delay: 0 },
    { freq: 1108.73, dur: 0.065, type: "square", gain: 0.15, delay: 0.055 },
    { freq: 1318.51, dur: 0.075, type: "square", gain: 0.16, delay: 0.11 },
    { freq: 1760, dur: 0.24, type: "triangle", gain: 0.22, delay: 0.17 },
  ],
  sprint: [
    { freq: 587.33, dur: 0.08, type: "sawtooth", gain: 0.15, delay: 0 },
    { freq: 739.99, dur: 0.08, type: "sawtooth", gain: 0.16, delay: 0.07 },
    { freq: 880, dur: 0.09, type: "sawtooth", gain: 0.17, delay: 0.14 },
    { freq: 1174.66, dur: 0.3, type: "triangle", gain: 0.22, delay: 0.22 },
  ],
  start: [
    { freq: 392, dur: 0.08, type: "triangle", gain: 0.18, delay: 0 },
    { freq: 523.25, dur: 0.08, type: "triangle", gain: 0.19, delay: 0.07 },
    { freq: 659.25, dur: 0.09, type: "triangle", gain: 0.2, delay: 0.14 },
    { freq: 783.99, dur: 0.24, type: "triangle", gain: 0.22, delay: 0.22 },
  ],
  finish: [
    { freq: 523.25, dur: 0.1, type: "triangle", gain: 0.2, delay: 0 },
    { freq: 659.25, dur: 0.1, type: "triangle", gain: 0.2, delay: 0.09 },
    { freq: 783.99, dur: 0.1, type: "triangle", gain: 0.2, delay: 0.18 },
    { freq: 1046.5, dur: 0.18, type: "triangle", gain: 0.22, delay: 0.27 },
    { freq: 783.99, dur: 0.1, type: "triangle", gain: 0.19, delay: 0.44 },
    { freq: 1046.5, dur: 0.36, type: "sine", gain: 0.24, delay: 0.54 },
  ],
  lead: [
    { freq: 659.25, dur: 0.09, type: "triangle", gain: 0.2, delay: 0 },
    { freq: 830.61, dur: 0.09, type: "triangle", gain: 0.2, delay: 0.08 },
    { freq: 987.77, dur: 0.1, type: "triangle", gain: 0.21, delay: 0.16 },
    { freq: 1318.51, dur: 0.32, type: "triangle", gain: 0.24, delay: 0.25 },
  ],
  overtake: [
    { freq: 880, freqEnd: 1174.66, dur: 0.09, type: "triangle", gain: 0.18, delay: 0 },
    { freq: 1318.51, dur: 0.18, type: "sine", gain: 0.2, delay: 0.08 },
  ],
};

export const ALL_CUES = Object.keys(CUES) as Cue[];

function getAudioConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
    null
  );
}

export function useArenaSound(defaultEnabled = true) {
  const [enabled, setEnabled] = useState(defaultEnabled);
  const ctx = useRef<AudioContext | null>(null);

  const ensureContext = useCallback((): AudioContext | null => {
    try {
      if (!ctx.current) {
        const Ctor = getAudioConstructor();
        if (!Ctor) return null;
        ctx.current = new Ctor();
      }
      if (ctx.current.state === "suspended" && typeof ctx.current.resume === "function") {
        void ctx.current.resume();
      }
      return ctx.current;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KEY);
      if (stored === "on" || stored === "off") {
        const next = stored === "on";
        const frame = window.requestAnimationFrame(() => setEnabled(next));
        return () => window.cancelAnimationFrame(frame);
      }
    } catch {
      /* private mode */
    }
    return undefined;
  }, []);

  // Unlock AudioContext on the first user gesture so async server callbacks can play audio on mobile.
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    const unlock = () => {
      ensureContext();
    };
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [enabled, ensureContext]);

  const synthesize = useCallback(
    (cue: Cue) => {
      const audio = ensureContext();
      if (!audio) return;
      try {
        const base = audio.currentTime;
        for (const step of CUES[cue]) {
          const startAt = base + (step.delay ?? 0);
          const peak = step.gain ?? 0.16;
          const osc = audio.createOscillator();
          const gain = audio.createGain();
          osc.type = step.type;
          osc.frequency.value = step.freq;
          if (typeof osc.frequency.setValueAtTime === "function") {
            osc.frequency.setValueAtTime(step.freq, startAt);
          }
          if (step.freqEnd && typeof osc.frequency.exponentialRampToValueAtTime === "function") {
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, step.freqEnd), startAt + step.dur);
          }
          gain.gain.setValueAtTime(0.0001, startAt);
          if (typeof gain.gain.linearRampToValueAtTime === "function") {
            gain.gain.linearRampToValueAtTime(peak, startAt + Math.min(0.012, step.dur * 0.25));
          } else {
            gain.gain.setValueAtTime(peak, startAt);
          }
          gain.gain.exponentialRampToValueAtTime(0.0001, startAt + step.dur);
          osc.connect(gain).connect(audio.destination);
          osc.start(startAt);
          osc.stop(startAt + step.dur + 0.02);
        }
      } catch {
        /* audio unavailable */
      }
    },
    [ensureContext],
  );

  const toggle = useCallback(() => {
    setEnabled((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(KEY, next ? "on" : "off");
      } catch {
        /* private mode */
      }
      if (next) synthesize("start");
      return next;
    });
  }, [synthesize]);

  const play = useCallback(
    (cue: Cue) => {
      if (!enabled) return;
      synthesize(cue);
    },
    [enabled, synthesize],
  );

  return { enabled, toggle, play };
}
