"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { pushPreferences } from "@/lib/account-client";
import { track } from "@/lib/analytics";
import { isProEntitlement } from "@/lib/entitlements";
import { isIosDevice, isStandaloneDisplay } from "@/lib/pwa-install";
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
 * "Same time tomorrow?" on the Done screen, right after a reset, when the
 * habit is easiest to set up. Uses the same daily reminder as You. Where the
 * browser can't deliver one (iPhone Safari outside the Home Screen app), it
 * says how to fix that instead of pretending.
 */
export function ReminderAsk() {
  const state = useAppState();
  const signedIn = Boolean(state.account.profileId);
  const pro = isProEntitlement(state.entitlement);
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [result, setResult] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [minutes] = useState(() => minutesNow());

  const hasDaily = state.settings.reminders.some((entry) => entry.kind === "daily" && entry.enabled);
  if (!result && (dismissed || hasDaily)) return null;

  const notifications = typeof window !== "undefined" && "Notification" in window;
  // iPhone and iPad only deliver web notifications to the Home Screen app.
  const needsInstall = !signedIn && (!notifications || (isIosDevice() && !isStandaloneDisplay()));
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
        ? ["Notifications are blocked for DeskBreak in your browser settings.", email]
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

  return (
    <div className="surface px-4 py-4">
      <p className="font-display text-base font-semibold text-ink">Same time tomorrow?</p>
      {needsInstall ? (
        <>
          <p className="mt-1 text-sm leading-relaxed text-ink/65">
            Add DeskBreak to your Home Screen to get reminders.
          </p>
          <details className="mt-2 text-sm text-ink/70">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold text-ink">How to add it</summary>
            <ol className="space-y-1 pb-1 text-xs leading-relaxed">
              <li>1. Tap Share (the square with the arrow).</li>
              <li>2. Tap Add to Home Screen, then Add.</li>
              <li>3. Open DeskBreak from that icon, then turn on reminders in You.</li>
            </ol>
          </details>
          <div className="mt-1 flex justify-end">
            <Button variant="tertiary" size="sm" block={false} onClick={dismiss}>
              Not now
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm leading-relaxed text-ink/65">
            A nudge around {time} on weekdays.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" block={false} onClick={remind} disabled={busy}>
              Remind me at {time}
            </Button>
            <Button variant="tertiary" size="sm" block={false} onClick={dismiss}>
              Not now
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
