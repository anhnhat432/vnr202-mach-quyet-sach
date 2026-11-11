import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useVisibleRefresh } from "@/features/arena/client/use-visible-refresh";

beforeEach(() => { vi.useFakeTimers(); vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible"); vi.spyOn(navigator, "onLine", "get").mockReturnValue(true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
it("reads every ten seconds and on return, but not while hidden/offline; cleans up", async () => {
  const read = vi.fn(async () => {});
  const { unmount } = renderHook(() => useVisibleRefresh(read, true));
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(read).toHaveBeenCalledTimes(1);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(read).toHaveBeenCalledTimes(1);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(read).toHaveBeenCalledTimes(2);
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  await act(async () => { window.dispatchEvent(new Event("focus")); await vi.advanceTimersByTimeAsync(10000); });
  expect(read).toHaveBeenCalledTimes(2);
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  await act(async () => { window.dispatchEvent(new Event("online")); });
  expect(read).toHaveBeenCalledTimes(3);
  unmount();
  await act(async () => { window.dispatchEvent(new Event("focus")); await vi.advanceTimersByTimeAsync(10000); });
  expect(read).toHaveBeenCalledTimes(3);
});
it("never overlaps an unfinished read and can be disabled", async () => {
  let finish!: () => void;
  const read = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const { rerender } = renderHook(({ enabled }) => useVisibleRefresh(read, enabled), { initialProps: { enabled: true } });
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); window.dispatchEvent(new Event("focus")); await vi.advanceTimersByTimeAsync(10000); });
  expect(read).toHaveBeenCalledTimes(1);
  await act(async () => { finish(); });
  rerender({ enabled: false });
  await act(async () => { window.dispatchEvent(new Event("online")); await vi.advanceTimersByTimeAsync(10000); });
  expect(read).toHaveBeenCalledTimes(1);
});
