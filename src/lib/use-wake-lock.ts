"use client";

import { useEffect } from "react";

type WakeLockSentinelLike = { release: () => Promise<void>; released?: boolean };

/**
 * Keeps the screen on while a workout runs.
 *
 * The lock is dropped by the browser whenever the tab is hidden, so it is
 * re-acquired on every visibility change. Unsupported browsers simply do
 * nothing; the timer itself does not depend on the screen staying on.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    };
    if (!nav.wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        sentinel = await nav.wakeLock!.request("screen");
      } catch {
        /* low battery, or the browser said no; fine */
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", acquire);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
