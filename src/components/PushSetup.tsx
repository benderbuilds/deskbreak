"use client";

import { useState } from "react";
import { InstallSteps } from "@/components/InstallPrompt";
import { SwitchRow } from "@/components/Switch";
import { pushReadiness, subscribeToPush, unsubscribeFromPush } from "@/lib/push-client";
import { useAppState } from "@/lib/use-app-state";

/**
 * Push reminders: the switch when this browser can take them, otherwise the
 * one next step that would make them work. Never a disabled "Turn on".
 *
 * Used on You and right after "Build my workday", where the ask makes sense.
 */
export function PushSetup({ context }: { context: "you" | "plan" }) {
  const state = useAppState();
  const signedIn = Boolean(state.account.profileId);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const readiness = pushReadiness();
  const on = Boolean(state.push.endpoint);
  const fallback = signedIn
    ? "Reminders still show while DeskBreak is open, and your daily email reaches you anywhere."
    : "Reminders still show while DeskBreak is open.";

  async function toggle(next: boolean) {
    setBusy(true);
    if (!next) {
      await unsubscribeFromPush();
      setNotice("Push reminders off.");
    } else {
      const result = await subscribeToPush();
      setNotice(
        result === "subscribed"
          ? "Push reminders on. They reach you even when DeskBreak isn't open."
          : result === "denied"
            ? "Notifications are blocked for DeskBreak in this browser. Allow them in the site settings, then try again."
            : "We couldn't turn that on just now. Try again in a moment.",
      );
    }
    setBusy(false);
  }

  if (on || readiness === "ready") {
    return (
      <div>
        <SwitchRow
          label={context === "plan" ? "Get these as notifications" : "Push reminders"}
          hint="For your workday plan, even when DeskBreak isn't open."
          checked={on}
          disabled={busy}
          onChange={toggle}
        />
        {notice ? (
          <p className="mt-2 text-sm leading-relaxed text-ink/70" role="status">
            {notice}
          </p>
        ) : null}
      </div>
    );
  }

  if (readiness === "ios_install") {
    return (
      <div>
        <p className="text-sm font-semibold text-ink">Add DeskBreak to your Home Screen first</p>
        <p className="mt-1 text-sm leading-relaxed text-ink/60">
          On iPhone and iPad, Safari only sends notifications to apps on your Home Screen.
        </p>
        <InstallSteps platform="ios" className="mt-3 text-sm" />
        <p className="mt-1.5 text-sm leading-relaxed text-ink/65">
          4. Open DeskBreak from the new icon and turn on reminders under You.
        </p>
      </div>
    );
  }

  const reason =
    readiness === "blocked"
      ? "Notifications are blocked for DeskBreak in this browser. Allow them in the site settings, then come back here."
      : readiness === "not_configured"
        ? "Push notifications aren't set up on this version of DeskBreak yet."
        : "This browser can't receive push notifications.";

  return (
    <div>
      <p className="text-sm font-semibold text-ink">Push reminders aren&apos;t available here</p>
      <p className="mt-1 text-sm leading-relaxed text-ink/60">
        {reason} {fallback}
      </p>
    </div>
  );
}
