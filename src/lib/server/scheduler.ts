/**
 * Pure scheduling decisions. No I/O, no clock of its own: every function takes
 * the moment it is deciding about, so the same code can be tested for a late
 * runner, a snoozed break, a weekend, or a profile on the other side of the
 * world.
 */
import type { PlannedBreak } from "../types";

export type LocalMoment = {
  /** YYYY-MM-DD in the profile's zone. */
  date: string;
  /** Minutes past local midnight. */
  minutes: number;
  /** 0 = Sunday, in the profile's zone. */
  weekday: number;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function localMoment(timezone: string | null | undefined, at = new Date()): LocalMoment {
  const zone = timezone || "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    }).formatToParts(at);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
      weekday: WEEKDAYS.indexOf(get("weekday")),
    };
  } catch {
    return {
      date: at.toISOString().slice(0, 10),
      minutes: at.getUTCHours() * 60 + at.getUTCMinutes(),
      weekday: at.getUTCDay(),
    };
  }
}

/** The daily email goes out once, at or after this local time... */
export const EMAIL_WINDOW_START = 14 * 60;
/** ...and never after this. A late runner inside the window still sends. */
export const EMAIL_WINDOW_END = 16 * 60;

export type EmailCandidate = {
  email: string | null;
  reminderFrequency: string | null;
  timezone: string | null;
  workdays: number[] | null;
};

export type EmailDecision =
  | { send: true; localDate: string }
  | { send: false; reason: "no_email" | "opted_out" | "not_workday" | "outside_window" };

/**
 * Whether this profile should get its daily reminder right now.
 *
 * Opt-in only: a profile has to have asked for daily reminders. The runner's
 * clock is irrelevant beyond "is it currently the afternoon window in this
 * person's zone"; the delivery record keeps it to once per local day.
 */
export function emailDecision(candidate: EmailCandidate, at = new Date()): EmailDecision {
  if (!candidate.email) return { send: false, reason: "no_email" };
  if (candidate.reminderFrequency !== "daily") return { send: false, reason: "opted_out" };
  const moment = localMoment(candidate.timezone, at);
  const workdays = candidate.workdays?.length ? candidate.workdays : [1, 2, 3, 4, 5];
  if (!workdays.includes(moment.weekday)) return { send: false, reason: "not_workday" };
  if (moment.minutes < EMAIL_WINDOW_START || moment.minutes >= EMAIL_WINDOW_END) {
    return { send: false, reason: "outside_window" };
  }
  return { send: true, localDate: moment.date };
}

export type PushDecision =
  | { send: true }
  | {
      send: false;
      reason: "not_open" | "not_due" | "snoozed" | "already_delivered" | "satisfied" | "expired";
    };

/** Grace after a window closes during which a late runner may still send. */
export const PUSH_LATE_GRACE = 15;

/**
 * Whether a planned break should be pushed at this local minute.
 *
 * Planned breaks send once their window opens. Snoozed ones send again at
 * their snoozed time. Delivered, skipped, completed and expired ones never
 * send. A recent session near the window satisfies it instead of sending.
 */
export function pushDecision(
  entry: Pick<PlannedBreak, "status" | "startMinutes" | "endMinutes" | "snoozedUntilMinutes">,
  minutes: number,
  recentSessionMinutes: number[] = [],
): PushDecision {
  if (entry.status === "delivered") return { send: false, reason: "already_delivered" };
  if (entry.status !== "planned" && entry.status !== "snoozed") return { send: false, reason: "not_open" };

  if (recentSessionMinutes.some((minute) => Math.abs(minute - entry.startMinutes) <= 45)) {
    return { send: false, reason: "satisfied" };
  }

  if (entry.status === "snoozed") {
    const until = entry.snoozedUntilMinutes ?? entry.endMinutes;
    if (minutes < until) return { send: false, reason: "snoozed" };
    if (minutes > until + PUSH_LATE_GRACE) return { send: false, reason: "expired" };
    return { send: true };
  }

  if (minutes < entry.startMinutes) return { send: false, reason: "not_due" };
  if (minutes > entry.endMinutes + PUSH_LATE_GRACE) return { send: false, reason: "expired" };
  return { send: true };
}
