import { todayKey } from "./dates";
import type { Reminder } from "./types";

/**
 * The free daily reminder, in the tab. The server emails signed-in people;
 * this is the "at 2:30 pm while DeskBreak is open" half, for everyone.
 *
 * Once a day at most, on working days, from the chosen time until a couple
 * of hours after it (opening DeskBreak at 8 pm doesn't earn a 2:30 nudge).
 * A reset done in the hour before the time counts as the reminder being
 * answered. A snooze brings it back once its time comes, window or not.
 */
export const DAILY_REMINDER_GRACE_MINUTES = 120;
export const DAILY_REMINDER_SNOOZE_MINUTES = 15;
const ALREADY_MOVED_MINUTES = 60;

export type DailyReminderCheck = {
  reminder: Reminder | null | undefined;
  now: Date;
  /** settings.lastReminderDate: the day it last fired, as a date key. */
  lastShownDate: string | null;
  /** Working days (0 = Sunday). A Pro plan's days, else weekdays for weekdaysOnly. */
  workdays?: number[] | null;
  snoozedUntil?: Date | null;
  /** The latest finished reset or stand-up. */
  lastActiveAt?: Date | null;
};

export type DailyReminderDecision = "due" | "answered" | "wait";

export function dailyReminderDecision(input: DailyReminderCheck): DailyReminderDecision {
  const { reminder, now } = input;
  if (!reminder?.enabled) return "wait";
  const today = todayKey(now);
  if (input.lastShownDate === today) return "wait";

  if (input.snoozedUntil) return now >= input.snoozedUntil ? "due" : "wait";

  const days = input.workdays?.length ? input.workdays : reminder.weekdaysOnly ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
  if (!days.includes(now.getDay())) return "wait";

  const minute = now.getHours() * 60 + now.getMinutes();
  if (minute < reminder.minutes || minute > reminder.minutes + DAILY_REMINDER_GRACE_MINUTES) return "wait";

  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  at.setMinutes(reminder.minutes - ALREADY_MOVED_MINUTES);
  if (input.lastActiveAt && input.lastActiveAt >= at) return "answered";
  return "due";
}
