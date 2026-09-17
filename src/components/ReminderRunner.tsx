"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";
import { isProEntitlement } from "@/lib/entitlements";
import { pingLocalNotification } from "@/lib/reminders";
import { getAppState, saveWorkdayPlan } from "@/lib/storage";
import { breakHref, isDue, markDelivered, planForToday, reminderCopy } from "@/lib/workday";
import { personalizationSignals } from "@/lib/storage";

const CHECK_MS = 60_000;

/**
 * While DeskBreak is open, watches the day's plan and nudges when a window
 * opens. Real background delivery is the service worker's job; this is the
 * in-tab version so a planned break never silently passes while the app is
 * sitting in a visible tab.
 */
export function ReminderRunner() {
  const pathname = usePathname();
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    const check = () => {
      const state = getAppState();
      if (!state.plan || !isProEntitlement(state.entitlement)) return;
      if (pathname.startsWith("/app/workout")) return;

      const plan = planForToday(state.plan, {
        signals: personalizationSignals(state),
        preferredDuration: state.preferredDuration,
      });
      if (plan !== state.plan) saveWorkdayPlan(plan);

      for (const entry of plan.breaks) {
        if (!isDue(entry) || entry.status === "delivered" || notified.current.has(entry.id)) continue;
        notified.current.add(entry.id);
        const copy = reminderCopy(entry);
        pingLocalNotification(copy.title, copy.body, breakHref(entry));
        saveWorkdayPlan(markDelivered(plan, entry.id));
        track("push_delivered", { channel: "in_tab", break_id: entry.id, break_type: entry.type });
        break;
      }
    };
    check();
    const id = window.setInterval(check, CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);

  return null;
}
