"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { track } from "@/lib/analytics";
import { DAILY_REMINDER_SNOOZE_MINUTES, dailyReminderDecision } from "@/lib/daily-reminder";
import { todayKey } from "@/lib/dates";
import { isProEntitlement } from "@/lib/entitlements";
import {
  STAND_NUDGE_COPY,
  isStandNudgeDue,
  lastActiveAt,
  markStandNudgeShown,
  pingLocalNotification,
  reminderLineFor,
  snoozeStandNudge,
} from "@/lib/reminders";
import {
  getAppState,
  markReminderShown,
  recordMicroBreak,
  saveSettings,
  saveStandNudge,
  saveWorkdayPlan,
} from "@/lib/storage";
import { breakHref, isDue, markDelivered, planForToday, reminderCopy } from "@/lib/workday";
import { personalizationSignals } from "@/lib/storage";

const CHECK_MS = 60_000;

/** Screens where a nudge would interrupt: a reset in progress, its wrap-up, checkout. */
const QUIET_ROUTES = ["/app/start", "/app/workout", "/app/done", "/app/pro", "/app/welcome", "/app/save"];

/**
 * While DeskBreak is open, watches the day's plan and nudges when a window
 * opens. Real background delivery is the service worker's job; this is the
 * in-tab version so a planned break never silently passes while the app is
 * sitting in a visible tab.
 *
 * It also fires the free daily reminder at its chosen time (a browser
 * notification when allowed, otherwise a card here), and runs the free
 * stand-up nudge: after about 50 minutes without
 * moving, inside working hours, a small card asks them to stand up. Anyone
 * gets it, Pro or not; it steps aside when a planned break is due.
 */
export function ReminderRunner() {
  const pathname = usePathname();
  const router = useRouter();
  const notified = useRef<Set<string>>(new Set());
  const pinged = useRef(false);
  const [standDue, setStandDue] = useState(false);
  const [dailyDue, setDailyDue] = useState(false);
  // A snoozed daily reminder only needs to survive while this tab is open.
  const dailySnooze = useRef<Date | null>(null);
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
      const lastActive = lastActiveAt({ history: state.progress.history, microBreaks: state.microBreaks });

      const daily = quiet
        ? "wait"
        : dailyReminderDecision({
            reminder: state.settings.reminders.find((entry) => entry.kind === "daily"),
            now,
            lastShownDate: state.settings.lastReminderDate,
            workdays: plan?.preferences.enabledDays ?? null,
            snoozedUntil: dailySnooze.current,
            lastActiveAt: lastActive,
          });
      if (daily === "answered") markReminderShown(todayKey(now));
      if (daily === "due") {
        markReminderShown(todayKey(now));
        dailySnooze.current = null;
        track("push_delivered", { channel: "daily_in_tab" });
        const allowed = "Notification" in window && Notification.permission === "granted";
        if (allowed) pingLocalNotification(DAILY_TITLE, reminderLineFor(todayKey(now)), "/app");
        else setDailyDue(true);
      }

      const nudgeDue =
        !quiet &&
        isStandNudgeDue({
          settings: state.settings.standNudge,
          now,
          lastActiveAt: laterOf(lastActive, openedAt),
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

  if (quiet || (!standDue && !dailyDue)) return null;

  if (dailyDue) {
    const startDaily = () => {
      track("reminder_clicked", { kind: "daily", action: "start" });
      setDailyDue(false);
      const minutes = getAppState().preferredDuration ?? 3;
      router.push(`/app/start?need=general&minutes=${minutes}&source=today`);
    };
    const snoozeDaily = () => {
      dailySnooze.current = new Date(Date.now() + DAILY_REMINDER_SNOOZE_MINUTES * 60_000);
      // Let it fire once more today, when the snooze runs out.
      saveSettings({ lastReminderDate: null });
      track("reminder_clicked", { kind: "daily", action: "snooze" });
      setDailyDue(false);
    };
    return (
      <ReminderCard
        title={DAILY_TITLE}
        body={reminderLineFor(todayKey())}
        primary={{ label: "Start reset", onClick: startDaily }}
        secondary={{ label: `In ${DAILY_REMINDER_SNOOZE_MINUTES} min`, onClick: snoozeDaily }}
        onDismiss={() => {
          track("reminder_clicked", { kind: "daily", action: "dismiss" });
          setDailyDue(false);
        }}
        dismissLabel="Dismiss today's reminder"
      />
    );
  }

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
    <ReminderCard
      title={STAND_NUDGE_COPY.title}
      body={STAND_NUDGE_COPY.body}
      primary={{ label: STAND_NUDGE_COPY.action, onClick: stoodUp }}
      secondary={{ label: STAND_NUDGE_COPY.snooze, onClick: later }}
      onDismiss={dismiss}
      dismissLabel="Dismiss until the next nudge"
    />
  );
}

const DAILY_TITLE = "Time for your Desk Reset";

type CardAction = { label: string; onClick: () => void };

/** The in-app reminder card, above the bottom nav on phones and bottom-right on desktop. */
function ReminderCard({
  title,
  body,
  primary,
  secondary,
  onDismiss,
  dismissLabel,
}: {
  title: string;
  body: string;
  primary: CardAction;
  secondary: CardAction;
  onDismiss: () => void;
  dismissLabel: string;
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
            <p className="font-display text-base font-semibold text-ink">{title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-ink/65">{body}</p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={dismissLabel}
            className="-mr-2 -mt-1 grid min-h-11 min-w-11 place-items-center rounded-full text-lg text-ink/50 hover:bg-ink/5 hover:text-ink"
          >
            ×
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="ink" block={false} onClick={primary.onClick}>
            {primary.label}
          </Button>
          <Button size="sm" variant="tertiary" block={false} onClick={secondary.onClick}>
            {secondary.label}
          </Button>
        </div>
      </div>
    </div>
  );
}

function laterOf(a: Date | null, b: Date): Date {
  return a && a > b ? a : b;
}
