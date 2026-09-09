export function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? "pm" : "am";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${period}`;
}

export function currentHour(date = new Date()): number {
  return date.getHours();
}

export function shouldShowReminder(input: {
  enabled: boolean;
  hour: number | null;
  lastReminderDate: string | null;
  today: string;
  hourNow: number;
}): boolean {
  if (!input.enabled || input.hour === null) return false;
  if (input.lastReminderDate === input.today) return false;
  return input.hourNow === input.hour;
}

export async function requestReminderPermission(): Promise<
  "granted" | "denied" | "unsupported" | "default"
> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result;
}

export function pingLocalNotification(title: string, body: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/icons/icon-192.png" });
  } catch {
    /* ignore — some browsers block from insecure contexts */
  }
}
