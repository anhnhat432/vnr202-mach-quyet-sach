import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hint scheduling of the leaderboard hook: a constant stream of Broadcast hints must not starve the
// board, reads are spaced, and one settle read follows the last hint (hints are paced server-side).
const handlers: Record<string, (msg: { payload: unknown }) => void> = {};
let statusCb: ((s: string) => void) | null = null;
const channel = {
  on(_type: string, filter: { event: string }, cb: (msg: { payload: unknown }) => void) {
    handlers[filter.event] = cb;
    return channel;
  },
  subscribe(cb: (s: string) => void) {
    statusCb = cb;
    return channel;
  },
};
vi.mock("@/lib/supabase/browser", () => ({ createBrowserClient: () => ({ channel: () => channel, removeChannel: async () => undefined }) }));

const reads: string[] = [];
let serverVersion = 1;
vi.mock("@/features/arena/client/api", () => ({
  arenaApi: {
    leaderboard: async (_p: string, _g: string, hinted?: number, settle?: boolean) => {
      reads.push(hinted === undefined ? "sync" : settle ? `settle:${hinted}` : `v:${hinted}`);
      return { version: serverVersion, standing: "rehearsal", players: 0, completed: 0, entries: [] };
    },
  },
}));

const { useLeaderboard } = await import("@/features/arena/client/use-leaderboard");
const PUBLIC_ID = "11111111-1111-4111-8111-111111111111";
const hint = (version: number) =>
  handlers["leaderboard.changed"]({ payload: { aggregate: { type: "leaderboard", publicId: `${PUBLIC_ID}:race`, version } } });

describe("useLeaderboard hint scheduling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reads.length = 0;
    serverVersion = 1;
  });
  afterEach(() => vi.useRealTimers());

  it("keeps reading under a constant stream of hints, at most every 500 ms, then settles once", async () => {
    const { unmount } = renderHook(() => useLeaderboard(PUBLIC_ID, "race"));
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    await act(async () => { statusCb?.("SUBSCRIBED"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); }); // initial read + catch-up read after subscribing
    reads.length = 0;
    // a hint every 100 ms for 3 s (a trailing-reset debounce would never fire here)
    for (let i = 0; i < 30; i += 1) {
      serverVersion = 10 + i;
      await act(async () => { hint(10 + i); await vi.advanceTimersByTimeAsync(100); });
    }
    const hinted = reads.filter((r) => r.startsWith("v:"));
    expect(hinted.length).toBeGreaterThanOrEqual(5);
    expect(hinted.length).toBeLessThanOrEqual(7);
    expect(reads.some((r) => r.startsWith("settle:"))).toBe(false); // hints still arriving
    await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    expect(reads.filter((r) => r.startsWith("settle:"))).toEqual(["settle:39"]);
    unmount();
  });

  it("a hint for a version already shown still schedules the settle read", async () => {
    serverVersion = 5;
    const { unmount } = renderHook(() => useLeaderboard(PUBLIC_ID, "race"));
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    await act(async () => { statusCb?.("SUBSCRIBED"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); }); // initial read + catch-up read after subscribing
    reads.length = 0;
    await act(async () => { hint(5); await vi.advanceTimersByTimeAsync(1300); });
    expect(reads).toEqual(["settle:5"]);
    unmount();
  });

  it("a forged hint with a version the server never confirms costs one read and one settle read, then nothing", async () => {
    serverVersion = 3;
    const { unmount } = renderHook(() => useLeaderboard(PUBLIC_ID, "race"));
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    await act(async () => { statusCb?.("SUBSCRIBED"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    reads.length = 0;
    await act(async () => { hint(1_000_000); await vi.advanceTimersByTimeAsync(10_000); });
    expect(reads).toEqual(["v:1000000", "settle:3"]); // the unconfirmed version is dropped before the settle read
    unmount();
  });

  it("skips a periodic 15 s tick that lands right after a recent hinted read", async () => {
    const { unmount } = renderHook(() => useLeaderboard(PUBLIC_ID, "race"));
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    await act(async () => { statusCb?.("SUBSCRIBED"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(13_000); });
    serverVersion = 2;
    await act(async () => { hint(2); await vi.advanceTimersByTimeAsync(1300); }); // read at 13.2s + settle at 14.2s
    reads.length = 0;
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); }); // crosses the 15.0s mark since SUBSCRIBED
    expect(reads).toEqual([]);
    unmount();
  });
});
