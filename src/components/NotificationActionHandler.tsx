"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";
import { getAppState, saveWorkdayPlan } from "@/lib/storage";
import { skipBreak, snoozeBreak } from "@/lib/workday";

/**
 * Handles the "15 min" and "Skip" actions on a push notification, which the
 * service worker turns into /app?break=...&action=... .
 */
export function NotificationActionHandler() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const breakId = params.get("break");
    const action = params.get("action");
    if (!breakId || !action) return;
    const plan = getAppState().plan;
    if (plan) {
      if (action === "snooze") {
        saveWorkdayPlan(snoozeBreak(plan, breakId, 15));
        track("planned_break_snoozed", { break_id: breakId, minutes: 15, source: "push" });
      } else if (action === "skip") {
        saveWorkdayPlan(skipBreak(plan, breakId));
        track("planned_break_skipped", { break_id: breakId, source: "push" });
      }
      void fetch("/api/planned-breaks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: breakId, status: action === "snooze" ? "snoozed" : "skipped" }),
      }).catch(() => {});
    }
    track("push_opened", { break_id: breakId, action });
    router.replace("/app");
  }, [params, router]);

  return null;
}
