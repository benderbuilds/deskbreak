import { REMINDER_LINES } from "./constants";
import { todayKey } from "./dates";
import type {
  PlannedBreak,
  Reminder,
  StandNudgeSettings,
  WorkdayPreferences,
  WorkoutSession,
} from "./types";

export function formatReminderTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour >= 12 ? "pm" : "am";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${String(minute).padStart(2, "0")} ${period}`;
}

/** Rotates through the voice lines so the nudge does not go stale by Thursday. */
export function reminderLineFor(dateKey: string): string {
  const seed = dateKey.split("-").reduce((sum, part) => sum + Number(part), 0);
  return REMINDER_LINES[seed % REMINDER_LINES.length];
}

export function defaultDailyReminder(): Reminder {
  return {
    id: "daily",
    minutes: 14 * 60 + 30,
    weekdaysOnly: true,
    kind: "daily",
    enabled: true,
  };
}

export async function requestNotificationPermission(): Promise<
  "granted" | "denied" | "unsupported" | "default"
> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

/**
 * Best-effort in-tab notification.
 *
 * Only fires while DeskBreak is open. Background delivery goes through the
 * service worker and Web Push instead.
 */
export function pingLocalNotification(title: string, body: string, href?: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const notification = new Notification(title, {
      body,
      icon: "/icons/icon-192.png",
      tag: "deskbreak-reminder",
    });
    if (href) {
      notification.onclick = () => {
        window.focus();
        window.location.assign(href);
        notification.close();
      };
    }
  } catch {
    /* some browsers block this outside a secure context */
  }
}

/* ------------------------------------------------------------------ *
 * The free "time to stand up" nudge.
 *
 * Breaking up sitting is the health mechanic, so it is not paywalled: while
 * DeskBreak is open, anyone gets a nudge after about 50 minutes without
 * moving, inside their working hours only. Pro's planner and Web Push are
 * separate and unchanged; the nudge steps aside when a planned break is due.
 * ------------------------------------------------------------------ */

/** Micro-breaks every 45 to 60 minutes; 50 sits in the middle. */
export const STAND_NUDGE_INTERVAL_MINUTES = 50;
export const STAND_NUDGE_MIN_INTERVAL = 30;
export const STAND_NUDGE_MAX_INTERVAL = 90;
export const STAND_NUDGE_SNOOZE_MINUTES = 15;

export const STAND_NUDGE_COPY = {
  title: "Time to stand up",
  body: "You've been sitting a while. A minute on your feet is enough.",
  action: "I stood up",
  snooze: "Later",
};

export function defaultStandNudge(): StandNudgeSettings {
  return {
    enabled: true,
    intervalMinutes: STAND_NUDGE_INTERVAL_MINUTES,
    snoozedUntil: null,
    lastNudgeAt: null,
  };
}

/** Outside these hours and days the nudge stays quiet. */
export type NudgeHours = Pick<WorkdayPreferences, "startMinutes" | "endMinutes" | "enabledDays">;

export const DEFAULT_NUDGE_HOURS: NudgeHours = {
  startMinutes: 8 * 60 + 30,
  endMinutes: 17 * 60,
  enabledDays: [1, 2, 3, 4, 5],
};

function atMinutes(day: Date, minutes: number): Date {
  const date = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  date.setMinutes(minutes);
  return date;
}

function laterOf(...dates: (Date | null | undefined)[]): Date | null {
  const valid = dates.filter((date): date is Date => Boolean(date) && !Number.isNaN(date!.getTime()));
  if (!valid.length) return null;
  return valid.reduce((latest, date) => (date > latest ? date : latest));
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** When the person last moved: the latest finished session or micro-break. */
export function lastActiveAt(input: {
  history?: Pick<WorkoutSession, "finishedAt">[];
  microBreaks?: string[];
}): Date | null {
  return laterOf(
    parseDate(input.history?.[0]?.finishedAt),
    ...(input.microBreaks ?? []).slice(0, 1).map(parseDate),
  );
}

/**
 * When the next stand-up nudge is due, or null when it is switched off.
 *
 * The interval runs from whichever is latest: the last time they moved, the
 * last nudge, or the start of today's working hours (nobody is nudged at
 * 8:31 for sitting since yesterday). A snooze pushes it back. Outside working
 * hours it rolls to the next working day. A planned break (Pro) that is due
 * around the same time takes precedence.
 */
export function nextStandNudgeAt(input: {
  settings: StandNudgeSettings;
  now: Date;
  lastActiveAt?: Date | null;
  hours?: NudgeHours | null;
  plannedBreaks?: Pick<PlannedBreak, "date" | "startMinutes" | "endMinutes" | "status">[];
}): Date | null {
  const { settings, now } = input;
  if (!settings.enabled) return null;
  const hours = input.hours ?? DEFAULT_NUDGE_HOURS;
  if (!hours.enabledDays.length || hours.endMinutes <= hours.startMinutes) return null;
  const interval = Math.min(
    STAND_NUDGE_MAX_INTERVAL,
    Math.max(STAND_NUDGE_MIN_INTERVAL, settings.intervalMinutes || STAND_NUDGE_INTERVAL_MINUTES),
  );

  let day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (hours.enabledDays.includes(day.getDay())) {
      const opens = atMinutes(day, hours.startMinutes);
      const closes = atMinutes(day, hours.endMinutes);
      const anchor = laterOf(opens, input.lastActiveAt, parseDate(settings.lastNudgeAt))!;
      let candidate = new Date(anchor.getTime() + interval * 60_000);
      const snoozed = parseDate(settings.snoozedUntil);
      if (snoozed && snoozed > candidate) candidate = snoozed;

      // Step past any open planned break that covers the candidate time.
      for (const entry of input.plannedBreaks ?? []) {
        const open = entry.status === "planned" || entry.status === "delivered" || entry.status === "snoozed";
        if (!open) continue;
        const [y, m, d] = entry.date.split("-").map(Number);
        const breakDay = new Date(y, m - 1, d);
        if (breakDay.getTime() !== day.getTime()) continue;
        const from = atMinutes(breakDay, entry.startMinutes - 20);
        const to = atMinutes(breakDay, entry.endMinutes + 5);
        if (candidate >= from && candidate <= to) candidate = to;
      }

      if (candidate < closes) return candidate;
    }
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  }
  return null;
}

/** True when a nudge should show right now. */
export function isStandNudgeDue(input: Parameters<typeof nextStandNudgeAt>[0]): boolean {
  const next = nextStandNudgeAt(input);
  return Boolean(next && next <= input.now);
}

export function snoozeStandNudge(
  settings: StandNudgeSettings,
  now: Date,
  minutes = STAND_NUDGE_SNOOZE_MINUTES,
): StandNudgeSettings {
  return { ...settings, snoozedUntil: new Date(now.getTime() + minutes * 60_000).toISOString() };
}

export function markStandNudgeShown(settings: StandNudgeSettings, now: Date): StandNudgeSettings {
  return { ...settings, lastNudgeAt: now.toISOString(), snoozedUntil: null };
}

/** How long after its time a missed daily reminder still fires when the app opens. */
export const DAILY_REMINDER_GRACE_MINUTES = 120;

/**
 * Whether the daily reminder should fire now, in the open tab.
 *
 * It fires once per day, from its time until the grace window closes, on
 * weekdays when it is weekday-only. It stays quiet when they already moved
 * after the reminder time, since the reminder has nothing left to ask.
 */
export function isDailyReminderDue(input: {
  reminder: Reminder | undefined;
  now: Date;
  firedOn: string | null;
  lastActiveAt: Date | null;
}): boolean {
  const { reminder, now, firedOn, lastActiveAt: active } = input;
  if (!reminder || !reminder.enabled) return false;
  const day = now.getDay();
  if (reminder.weekdaysOnly && (day === 0 || day === 6)) return false;
  const today = todayKey(now);
  if (firedOn === today) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < reminder.minutes || minutes > reminder.minutes + DAILY_REMINDER_GRACE_MINUTES) return false;
  if (active) {
    const reminderAt = new Date(now);
    reminderAt.setHours(Math.floor(reminder.minutes / 60), reminder.minutes % 60, 0, 0);
    if (active >= reminderAt) return false;
  }
  return true;
}
