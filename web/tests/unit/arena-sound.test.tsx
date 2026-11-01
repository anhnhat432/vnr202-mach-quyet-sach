// @vitest-environment jsdom
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ALL_CUES, useArenaSound, type Cue } from "@/features/arena/client/sound";
import { QuestionPanel } from "@/features/arena/ui/arena-ui";

class MockOscillator {
  type: OscillatorType = "sine";
  frequency = {
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn((target: unknown) => target);
  start = vi.fn();
  stop = vi.fn();
}

class MockGain {
  gain = {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn((target: unknown) => target);
}

class MockAudioContext {
  static instances: MockAudioContext[] = [];
  state: AudioContextState = "suspended";
  currentTime = 1;
  destination = {};
  oscillators: MockOscillator[] = [];
  gains: MockGain[] = [];
  resume = vi.fn(async () => {
    this.state = "running";
  });

  constructor() {
    MockAudioContext.instances.push(this);
  }

  createOscillator() {
    const osc = new MockOscillator();
    this.oscillators.push(osc);
    return osc;
  }

  createGain() {
    const g = new MockGain();
    this.gains.push(g);
    return g;
  }
}

describe("Live Arena sound effects", () => {
  beforeEach(() => {
    MockAudioContext.instances = [];
    window.localStorage.clear();
    vi.stubGlobal("AudioContext", MockAudioContext);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("enables sound by default, resumes suspended AudioContext, and synthesizes all gameplay cues", () => {
    const { result } = renderHook(() => useArenaSound());
    expect(result.current.enabled).toBe(true);
    expect(ALL_CUES.length).toBeGreaterThanOrEqual(18);

    for (const cue of ALL_CUES) {
      act(() => {
        result.current.play(cue);
      });
    }

    expect(MockAudioContext.instances).toHaveLength(1);
    const ctx = MockAudioContext.instances[0]!;
    expect(ctx.resume).toHaveBeenCalled();
    expect(ctx.oscillators.length).toBeGreaterThan(ALL_CUES.length);
    // At least one cue uses a frequency sweep (e.g. bomb / explode / double / tap)
    expect(
      ctx.oscillators.some((o) => o.frequency.exponentialRampToValueAtTime.mock.calls.length > 0),
    ).toBe(true);
  });

  it("respects mute toggle and persists preference in localStorage", () => {
    const { result } = renderHook(() => useArenaSound());
    expect(result.current.enabled).toBe(true);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.enabled).toBe(false);
    expect(window.localStorage.getItem("vnr202:arena:sound:v1")).toBe("off");

    const countBefore = MockAudioContext.instances[0]?.oscillators.length ?? 0;
    act(() => {
      result.current.play("correct");
    });
    expect(MockAudioContext.instances[0]?.oscillators.length ?? 0).toBe(countBefore);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.enabled).toBe(true);
    expect(window.localStorage.getItem("vnr202:arena:sound:v1")).toBe("on");
  });

  it("plays countdown ticks at 3s, 2s, 1s and tap cue on answer selection in QuestionPanel", () => {
    const played: Cue[] = [];
    const onAnswer = vi.fn();
    const question = {
      allocationId: "alloc-1",
      sequence: 1,
      role: "main" as const,
      questionType: "mcq",
      prompt: "Đại hội VI diễn ra năm nào?",
      options: [
        { id: "opt-1", label: "1986" },
        { id: "opt-2", label: "1991" },
      ],
      remainingMs: 4000,
    };

    const { rerender } = render(
      <QuestionPanel
        question={question}
        endsAt={10_000}
        now={6_000}
        answering={false}
        onAnswer={onAnswer}
        onPlay={(cue) => played.push(cue)}
        limitMs={5_000}
      />,
    );
    expect(played).toEqual([]);

    // 2.9s left -> ceil is 3s -> first countdown tick
    rerender(
      <QuestionPanel
        question={question}
        endsAt={10_000}
        now={7_100}
        answering={false}
        onAnswer={onAnswer}
        onPlay={(cue) => played.push(cue)}
        limitMs={5_000}
      />,
    );
    expect(played).toEqual(["countdown"]);

    // Still in the 3s bucket -> no duplicate tick
    rerender(
      <QuestionPanel
        question={question}
        endsAt={10_000}
        now={7_500}
        answering={false}
        onAnswer={onAnswer}
        onPlay={(cue) => played.push(cue)}
        limitMs={5_000}
      />,
    );
    expect(played).toEqual(["countdown"]);

    // 1.9s left -> ceil is 2s -> second countdown tick
    rerender(
      <QuestionPanel
        question={question}
        endsAt={10_000}
        now={8_100}
        answering={false}
        onAnswer={onAnswer}
        onPlay={(cue) => played.push(cue)}
        limitMs={5_000}
      />,
    );
    expect(played).toEqual(["countdown", "countdown"]);

    // Clicking an option plays immediate tactile "tap" cue and triggers onAnswer
    fireEvent.click(screen.getByRole("button", { name: /1986/i }));
    expect(played).toEqual(["countdown", "countdown", "tap"]);
    expect(onAnswer).toHaveBeenCalledWith("opt-1");
  });
});
