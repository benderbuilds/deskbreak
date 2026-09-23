"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/Button";
import { pushPreferences } from "@/lib/account-client";
import { track } from "@/lib/analytics";
import { isProEntitlement } from "@/lib/entitlements";
import { pushSupported, subscribeToPush } from "@/lib/push-client";
import { formatReminderTime, requestNotificationPermission } from "@/lib/reminders";
import { saveReminders } from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import type { Reminder } from "@/lib/types";

const DISMISS_KEY = "deskbreak.reminderAsk.v1";

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Now, to the nearest five minutes: the time they chose to move today. */
function minutesNow(date = new Date()): number {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return (Math.round(minutes / 5) * 5) % (24 * 60);
}

/**
 * The return invitation on the Done screen, right after a reset, when the
 * habit is easiest to set up. Uses the same daily reminder as You.
 *
 * The heading does not promise tomorrow: on a Friday, on a weekend, or on a
 * day that is not a working day, tomorrow is not when this arrives.
 *
 * The free daily reminder is shown inside DeskBreak while it is open, which
 * needs no permission and no installed app. An OS notification is a bonus
 * where the browser allows one, so neither a blocked permission nor an
 * iPhone is a reason to withhold the reminder or to ask for an install.
 */
export function ReminderAsk() {
  const state = useAppState();
  const signedIn = Boolean(state.account.profileId);
  const pro = isProEntitlement(state.entitlement);
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [result, setResult] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [minutes] = useState(() => minutesNow());

  const daily = state.settings.reminders.find((entry) => entry.kind === "daily" && entry.enabled);
  if (!result && dismissed && !daily) return null;

  const notifications = typeof window !== "undefined" && "Notification" in window;
  const time = formatReminderTime(minutes);

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function remind() {
    setBusy(true);
    const permission = notifications ? await requestNotificationPermission() : "unsupported";
    const reminder: Reminder = { id: "daily", minutes, weekdaysOnly: true, kind: "daily", enabled: true };
    saveReminders([...state.settings.reminders.filter((entry) => entry.kind !== "daily"), reminder]);
    track("reminder_created", { kind: "daily", channel: signedIn ? "email" : "browser", source: "done" });
    // Signed in, this is what turns the daily email on.
    void pushPreferences();
    // Ready for a workday plan. Push carries planned breaks only, so nothing
    // below promises it for this reminder.
    if (pro && permission === "granted" && pushSupported() && !state.push.endpoint) await subscribeToPush();
    setBusy(false);
    const email = signedIn
      ? "We'll also email you on weekday afternoons."
      : "Save your progress to also get it by email.";
    setResult(
      permission === "denied"
        ? [
            `Reminder set for ${time}. Notifications are blocked in your browser, so it shows while DeskBreak is open.`,
            email,
          ]
        : [`Reminder set for ${time}. It shows while DeskBreak is open.`, email],
    );
  }

  if (result) {
    return (
      <div className="surface px-4 py-4" role="status">
        {result.map((line) => (
          <p key={line} className="text-sm leading-relaxed text-ink">
            {line}
          </p>
        ))}
      </div>
    );
  }

  // Already on: say what is on, and where to change it. Asking again, or
  // asking the browser for permission again, is how a reminder gets turned off.
  if (daily) {
    return (
      <div className="surface px-4 py-4">
        <h2 className="font-display font-extrabold text-base text-ink">
          Your daily reminder is on for {formatReminderTime(daily.minutes)}.
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {daily.weekdaysOnly ? "On weekdays, while DeskBreak is open." : "Every day, while DeskBreak is open."}
          {signedIn ? " You'll also get an email on weekday afternoons." : ""}
        </p>
        <Link href="/app/you" className="mt-2 inline-block text-sm font-semibold text-pen underline underline-offset-4">
          Manage reminders
        </Link>
      </div>
    );
  }

  return (
    <div className="surface px-4 py-4">
      <h2 className="font-display font-extrabold text-base text-ink">Make it a daily break.</h2>
      {/* What it does, before the button that turns it on. */}
      <p className="mt-1 text-sm leading-relaxed text-muted">
        A nudge around {time} on weekdays, while DeskBreak is open.
        {signedIn ? " You'll also get an email on weekday afternoons." : ""}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" block={false} onClick={remind} disabled={busy}>
          Remind me at {time}
        </Button>
        <Button variant="tertiary" size="sm" block={false} onClick={dismiss}>
          Not now
        </Button>
      </div>
    </div>
  );
}
