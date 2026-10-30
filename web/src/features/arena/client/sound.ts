"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Tiny synthesized cues (no audio files). Off by default (owner requirement); the choice is remembered
// per device. Never blocks or delays anything.
const KEY = "vnr202:arena:sound:v1";
type Cue = "tick" | "correct" | "wrong" | "chest" | "bomb" | "shield" | "combo" | "start";

const NOTES: Record<Cue, Array<[number, number, OscillatorType]>> = {
  tick: [[880, 0.05, "square"]],
  correct: [[660, 0.08, "triangle"], [990, 0.12, "triangle"]],
  wrong: [[220, 0.16, "sawtooth"]],
  chest: [[784, 0.07, "triangle"], [1046, 0.07, "triangle"], [1318, 0.12, "triangle"]],
  bomb: [[110, 0.25, "sawtooth"]],
  shield: [[523, 0.1, "sine"], [784, 0.14, "sine"]],
  combo: [[880, 0.06, "square"], [1175, 0.06, "square"], [1568, 0.1, "square"]],
  start: [[440, 0.08, "triangle"], [660, 0.12, "triangle"]],
};

export function useArenaSound() {
  const [enabled, setEnabled] = useState(false);
  const ctx = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KEY) === "on";
      const frame = window.requestAnimationFrame(() => setEnabled(stored));
      return () => window.cancelAnimationFrame(frame);
    } catch {
      return undefined;
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled((value) => {
      try {
        window.localStorage.setItem(KEY, value ? "off" : "on");
      } catch {
        /* private mode */
      }
      return !value;
    });
  }, []);

  const play = useCallback(
    (cue: Cue) => {
      if (!enabled) return;
      try {
        ctx.current ??= new AudioContext();
        const audio = ctx.current;
        let at = audio.currentTime;
        for (const [freq, dur, type] of NOTES[cue]) {
          const osc = audio.createOscillator();
          const gain = audio.createGain();
          osc.type = type;
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.08, at);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
          osc.connect(gain).connect(audio.destination);
          osc.start(at);
          osc.stop(at + dur);
          at += dur * 0.9;
        }
      } catch {
        /* audio unavailable */
      }
    },
    [enabled],
  );

  return { enabled, toggle, play };
}
