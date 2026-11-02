"use client";

import { useEffect } from "react";

// Read-only resynchronization. Never overlaps reads or polls a hidden/offline screen.
export function useVisibleRefresh(read: () => Promise<unknown>, enabled: boolean, intervalMs = 10000) {
  useEffect(() => {
    if (!enabled) return;
    let pending = false;
    let disposed = false;
    const refresh = () => {
      if (disposed || pending || document.visibilityState !== "visible" || !navigator.onLine) return;
      pending = true;
      void Promise.resolve().then(read).catch(() => { /* the caller owns error presentation */ }).finally(() => { pending = false; });
    };
    const timer = window.setInterval(refresh, intervalMs);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enabled, intervalMs, read]);
}
