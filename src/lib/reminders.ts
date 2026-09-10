import { REMINDER_LINES } from "./constants";
import type { Reminder } from "./types";

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
    minutes: 14 * 60,
    weekdaysOnly: true,
    kind: "daily",
    enabled: true,
  };
}

export function remindersForPlan(
  breakMinutes: number[],
  weekdaysOnly = true,
): Reminder[] {
  return breakMinutes.map((minutes, index) => ({
    id: `plan-${index + 1}`,
    minutes,
    weekdaysOnly,
    kind: "plan" as const,
    enabled: true,
  }));
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
 * This only fires while DeskBreak is open, which is why email is the reminder
 * channel that a subscription actually rests on.
 */
export function pingLocalNotification(title: string, body: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/icons/icon-192.png" });
  } catch {
    /* some browsers block this outside a secure context */
  }
}
