"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { track } from "@/lib/analytics";
import { isProEntitlement } from "@/lib/entitlements";
import {
  STAND_NUDGE_COPY,
  isDailyReminderDue,
  isStandNudgeDue,
  lastActiveAt,
  markStandNudgeShown,
  pingLocalNotification,
  reminderLineFor,
  snoozeStandNudge,
} from "@/lib/reminders";
import { todayKey } from "@/lib/dates";
import { getAppState, recordMicroBreak, saveStandNudge, saveWorkdayPlan } from "@/lib/storage";
import { breakHref, isDue, markDelivered, planForToday, reminderCopy } from "@/lib/workday";
import { personalizationSignals } from "@/lib/storage";

const CHECK_MS = 60_000;
const DAILY_FIRED_KEY = "deskbreak.dailyReminder.firedOn.v1";
const DAILY_HREF = "/app/start?source=push";

/** Screens where a nudge would interrupt: a reset in progress, its wrap-up, checkout. */
const QUIET_ROUTES = ["/app/start", "/app/workout", "/app/done", "/app/pro", "/app/welcome", "/app/save"];

/**
 * While DeskBreak is open, watches the day's plan and nudges when a window
 * opens. Real background delivery is the service worker's job; this is the
 * in-tab version so a planned break never silently passes while the app is
 * sitting in a visible tab.
 *
 * It also runs the free stand-up nudge: after about 50 minutes without
 * moving, inside working hours, a small card asks them to stand up. Anyone
 * gets it, Pro or not; it steps aside when a planned break is due.
 *
 * And the daily reminder: at its time, once a day, as a notification when
 * the tab is in the background and a card when it is in view. Pro people
 * with a workday plan get planned breaks instead.
 */
export function ReminderRunner() {
  const pathname = usePathname();
  const notified = useRef<Set<string>>(new Set());
  const pinged = useRef(false);
  const router = useRouter();
  const [standDue, setStandDue] = useState(false);
  const [dailyDue, setDailyDue] = useState(false);
  // All DeskBreak can vouch for is the time since it was opened: a first
  // visit at 2 pm is not told it has "been sitting a while".
  const [openedAt] = useState(() => new Date());
  const quiet = QUIET_ROUTES.some((route) => pathname.startsWith(route));

  useEffect(() => {
    const check = () => {
      const state = getAppState();
      const plan =
        state.plan && isProEntitlement(state.entitlement)
          ? planForToday(state.plan, {
              signals: personalizationSignals(state),
              preferredDuration: state.preferredDuration,
            })
          : null;

      const now = new Date();
      const moved = lastActiveAt({ history: state.progress.history, microBreaks: state.microBreaks });
      if (
        !quiet &&
        !plan &&
        isDailyReminderDue({
          reminder: state.settings.reminders.find((entry) => entry.kind === "daily"),
          now,
          firedOn: readFiredOn(),
          lastActiveAt: moved,
        })
      ) {
        writeFiredOn(todayKey(now));
        track("push_delivered", { channel: "daily_in_tab" });
        if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
          pingLocalNotification("Time for a reset", reminderLineFor(todayKey(now)), DAILY_HREF);
        } else {
          setDailyDue(true);
        }
      }

      const nudgeDue =
        !quiet &&
        isStandNudgeDue({
          settings: state.settings.standNudge,
          now,
          lastActiveAt: laterOf(moved, openedAt),
          hours: plan?.preferences ?? null,
          plannedBreaks: plan?.breaks ?? [],
        });
      setStandDue(nudgeDue);
      if (nudgeDue && !pinged.current) {
        pinged.current = true;
        track("push_delivered", { channel: "stand_nudge" });
        if (document.visibilityState === "hidden") {
          pingLocalNotification(STAND_NUDGE_COPY.title, STAND_NUDGE_COPY.body, "/app");
        }
      }
      if (!nudgeDue) pinged.current = false;

      if (!plan || pathname.startsWith("/app/workout")) return;
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
  }, [pathname, quiet, openedAt]);

  if (quiet) return null;

  if (dailyDue) {
    const closeDaily = (action: "start" | "dismiss") => {
      track("reminder_clicked", { kind: "daily", action });
      setDailyDue(false);
      if (action === "start") router.push(DAILY_HREF);
    };
    return (
      <NudgeCard
        title="Time for a reset"
        body={reminderLineFor(todayKey())}
        onDismiss={() => closeDaily("dismiss")}
        dismissLabel="Dismiss today's reminder"
      >
        <Button size="sm" variant="ink" block={false} onClick={() => closeDaily("start")}>
          Start reset
        </Button>
        <Button size="sm" variant="tertiary" block={false} onClick={() => closeDaily("dismiss")}>
          Not now
        </Button>
      </NudgeCard>
    );
  }

  if (!standDue) return null;

  function stoodUp() {
    recordMicroBreak();
    track("reminder_clicked", { kind: "stand_nudge", action: "stood_up" });
    setStandDue(false);
  }

  function later() {
    // Snoozing from a due nudge brings it back in 15 minutes.
    const settings = getAppState().settings.standNudge;
    saveStandNudge({ snoozedUntil: snoozeStandNudge(settings, new Date()).snoozedUntil });
    track("reminder_clicked", { kind: "stand_nudge", action: "snooze" });
    setStandDue(false);
  }

  function dismiss() {
    // Dismissing counts as shown: quiet for a full interval.
    const shown = markStandNudgeShown(getAppState().settings.standNudge, new Date());
    saveStandNudge({ lastNudgeAt: shown.lastNudgeAt, snoozedUntil: shown.snoozedUntil });
    track("reminder_clicked", { kind: "stand_nudge", action: "dismiss" });
    setStandDue(false);
  }

  return (
    <NudgeCard
      title={STAND_NUDGE_COPY.title}
      body={STAND_NUDGE_COPY.body}
      onDismiss={dismiss}
      dismissLabel="Dismiss until the next nudge"
    >
      <Button size="sm" variant="ink" block={false} onClick={stoodUp}>
        {STAND_NUDGE_COPY.action}
      </Button>
      <Button size="sm" variant="tertiary" block={false} onClick={later}>
        {STAND_NUDGE_COPY.snooze}
      </Button>
    </NudgeCard>
  );
}

function NudgeCard({
  title,
  body,
  onDismiss,
  dismissLabel,
  children,
}: {
  title: string;
  body: string;
  onDismiss: () => void;
  dismissLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 px-4 lg:bottom-6 lg:left-auto lg:right-6 lg:w-[380px] lg:px-0"
      role="status"
      aria-live="polite"
    >
      <div className="surface-elevated mx-auto max-w-[488px] px-4 py-4 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display font-extrabold text-base text-ink">{title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted">{body}</p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={dismissLabel}
            className="-mr-2 -mt-1 grid min-h-11 min-w-11 place-items-center rounded-full text-lg text-muted hover:bg-ink/5 hover:text-ink"
          >
            ×
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{children}</div>
      </div>
    </div>
  );
}

function laterOf(a: Date | null, b: Date): Date {
  return a && a > b ? a : b;
}

function readFiredOn(): string | null {
  try {
    return window.localStorage.getItem(DAILY_FIRED_KEY);
  } catch {
    return null;
  }
}

function writeFiredOn(dateKey: string): void {
  try {
    window.localStorage.setItem(DAILY_FIRED_KEY, dateKey);
  } catch {
    // Private mode: the reminder may repeat on reload, which is harmless.
  }
}
