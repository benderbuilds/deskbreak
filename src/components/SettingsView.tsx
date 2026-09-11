"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, ButtonLink, Chip } from "@/components/Button";
import { ProBadge } from "@/components/ProBadge";
import { describeAccountError, pushPreferences, requestMagicLink, signOut } from "@/lib/account-client";
import { track } from "@/lib/analytics";
import {
  CONSTRAINT_OPTIONS,
  DURATION_OPTIONS,
  MOVEMENT_DISCLAIMER,
  SETUP_COPY,
  SUPPORT_EMAIL,
} from "@/lib/constants";
import { formatMinutes } from "@/lib/dates";
import { canAccessDuration, isProEntitlement } from "@/lib/entitlements";
import { canSpeak } from "@/lib/audio-cues";
import { pushSupported, subscribeToPush, unsubscribeFromPush } from "@/lib/push-client";
import { defaultDailyReminder, requestNotificationPermission } from "@/lib/reminders";
import {
  saveEmail,
  saveReminders,
  saveSettings,
  setConstraints,
  setPreferredDuration,
  setPreferredSetup,
} from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import { REMINDER_LEVELS } from "@/lib/workday";
import type { DurationMinutes, FunctionalConstraint, SetupRequest } from "@/lib/types";

/** The "You" tab: account, workday, notifications, movements to avoid, plan, app. */
export function SettingsView() {
  const isClient = useIsClient();
  const state = useAppState();
  const pro = isProEntitlement(state.entitlement);
  const signedIn = Boolean(state.account.profileId);

  const [email, setEmail] = useState(state.account.email ?? state.email ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isClient) return null;

  const reminders = state.settings.reminders;
  const daily = reminders.find((entry) => entry.kind === "daily");

  async function sendLink(next = "/app/you") {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      setNotice("That doesn't look like an email address.");
      return null;
    }
    setBusy("link");
    const result = await requestMagicLink(trimmed, { next });
    setBusy(null);
    if (!result.ok) {
      setNotice(describeAccountError(result.error));
      return null;
    }
    saveEmail(trimmed);
    return result;
  }

  async function sendSignInLink() {
    const result = await sendLink("/app/you");
    if (!result) return;
    setNotice(
      result.devLink
        ? `Email isn't configured here. Open this link to sign in: ${result.devLink}`
        : `Check ${trimmedEmail()} for your sign-in link.`,
    );
  }

  /**
   * Restoring Pro is signing in. The link proves the address; opening it on
   * this device attaches any subscription bought under that address, without
   * ever letting a typed address alone unlock someone else's plan.
   */
  async function restorePro() {
    const result = await sendLink("/app/you?restored=1");
    if (!result) return;
    setNotice(
      result.devLink
        ? `Email isn't configured here. Open this link to sign in and restore Pro: ${result.devLink}`
        : `Check ${trimmedEmail()} for a sign-in link. If that email has a subscription, opening the link restores Pro on this device.`,
    );
  }

  function trimmedEmail() {
    return email.trim();
  }

  async function openPortal() {
    if (!signedIn) {
      setNotice("Sign in with your checkout email first, then manage billing from here.");
      return;
    }
    setBusy("portal");
    track("billing_portal_opened");
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (response.status === 401) {
        setNotice("Sign in with your checkout email first, then manage billing from here.");
        setBusy(null);
        return;
      }
      if (!response.ok || !data.url) throw new Error("portal");
      window.location.href = data.url;
    } catch {
      setNotice(`We couldn't open billing just now. Email ${SUPPORT_EMAIL} and we'll sort it the same day.`);
      setBusy(null);
    }
  }

  async function togglePush() {
    setBusy("push");
    if (state.push.endpoint) {
      await unsubscribeFromPush();
      setNotice("Push reminders off.");
    } else {
      const result = await subscribeToPush();
      setNotice(
        result === "subscribed"
          ? "Push reminders on. They work even when DeskBreak isn't open."
          : result === "denied"
            ? "Notifications are blocked for this site in your browser settings."
            : result === "unsupported"
              ? "This browser doesn't support push. Add DeskBreak to your home screen, or use email reminders."
              : "We couldn't turn that on just now.",
      );
    }
    setBusy(null);
  }

  async function toggleDaily() {
    if (daily?.enabled) {
      saveReminders(reminders.filter((entry) => entry.id !== daily.id));
      // Email reminders are opt-in on the server; turning off here turns them off there.
      void pushPreferences();
      setNotice("Daily reminder off.");
      return;
    }
    const permission = await requestNotificationPermission();
    saveReminders([...reminders.filter((entry) => entry.kind !== "daily"), defaultDailyReminder()]);
    track("reminder_created", { kind: "daily", channel: signedIn ? "email" : "browser" });
    void pushPreferences();
    setNotice(
      signedIn
        ? "We'll email you once a day, mid-afternoon on your workdays."
        : permission === "granted"
          ? "We'll nudge you while DeskBreak is open. Sign in above for reminders by email that reach you anywhere."
          : "Saved. Sign in above so reminders reach you by email when DeskBreak isn't open.",
    );
  }

  function toggleConstraint(id: FunctionalConstraint) {
    const next = state.constraints.includes(id)
      ? state.constraints.filter((entry) => entry !== id)
      : [...state.constraints, id];
    setConstraints(next);
    track("constraints_updated", { constraints: next.join(",") || "none" });
    void pushPreferences();
  }

  return (
    <div className="flex flex-1 flex-col px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] lg:max-w-[640px] lg:px-0">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[2rem] font-semibold leading-tight text-ink">You</h1>
        {pro ? <ProBadge /> : null}
      </div>

      {notice ? (
        <p className="surface mt-4 px-4 py-3 text-sm leading-relaxed break-words text-ink/70" role="status">
          {notice}
        </p>
      ) : null}

      <Section title="Account">
        {signedIn ? (
          <Field label="Signed in">
            <p className="text-sm text-ink/60">{state.account.email}</p>
            <p className="mt-1 text-xs text-ink/45">Your resets sync across devices.</p>
            <div className="mt-3">
              <Button
                size="sm"
                variant="secondary"
                block={false}
                onClick={async () => {
                  await signOut();
                  setNotice("Signed out on this device. Your history stays here.");
                }}
              >
                Sign out
              </Button>
            </div>
          </Field>
        ) : (
          <Field label="Save what works for you">
            <p className="text-sm leading-relaxed text-ink/60">
              A sign-in link by email. No password. Your history so far comes with you.
            </p>
            <label htmlFor="you-email" className="sr-only">
              Email address
            </label>
            <input
              id="you-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@work.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-3 min-h-12 w-full rounded-[14px] border border-ink/12 bg-white px-4 text-base text-ink outline-none focus-visible:border-coral"
            />
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button size="sm" block={false} onClick={sendSignInLink} disabled={busy === "link"}>
                {busy === "link" ? "Sending..." : "Send sign-in link"}
              </Button>
              <Button size="sm" variant="tertiary" block={false} onClick={restorePro} disabled={busy === "link"}>
                Restore Pro
              </Button>
            </div>
          </Field>
        )}
      </Section>

      <Section title="Your Desk Reset">
        <Field label="Default length">
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((option) => (
              <Chip
                key={option.minutes}
                label={`${option.minutes} min${option.pro && !pro ? " · Pro" : ""}`}
                active={(state.preferredDuration ?? 3) === option.minutes}
                disabled={!canAccessDuration(option.minutes as DurationMinutes, state.entitlement)}
                onClick={() => setPreferredDuration(option.minutes)}
              />
            ))}
          </div>
        </Field>
        <Field label="Position">
          <div className="flex flex-wrap gap-2">
            {(["either", "seated", "standing"] as SetupRequest[]).map((value) => (
              <Chip
                key={value}
                label={SETUP_COPY[value].label}
                active={(state.preferredSetup ?? "either") === value}
                onClick={() => setPreferredSetup(value === "either" ? null : value)}
              />
            ))}
          </div>
        </Field>
        <Field label="Movements to avoid">
          <p className="text-sm leading-relaxed text-ink/60">
            Anything you&apos;d prefer DeskBreak not include? These are never shown, whatever the routine.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CONSTRAINT_OPTIONS.map((option) => (
              <Chip
                key={option.id}
                label={option.label}
                active={state.constraints.includes(option.id)}
                onClick={() => toggleConstraint(option.id)}
              />
            ))}
            <Chip
              label="None"
              active={state.constraints.length === 0}
              onClick={() => {
                setConstraints([]);
                void pushPreferences();
              }}
            />
          </div>
        </Field>
      </Section>

      <Section title="Workday">
        <Field label={pro ? "Workday plan" : "Workday plan · Pro"}>
          {pro && state.plan ? (
            <p className="text-sm text-ink/60">
              {formatMinutes(state.plan.preferences.startMinutes)} to {formatMinutes(state.plan.preferences.endMinutes)} ·{" "}
              {REMINDER_LEVELS[state.plan.preferences.level].label} ·{" "}
              <Link href="/app/plan" className="font-semibold text-coral">
                Edit
              </Link>
            </p>
          ) : pro ? (
            <ButtonLink href="/app/plan" variant="secondary" size="sm" block={false}>
              Build my workday
            </ButtonLink>
          ) : (
            <p className="text-sm leading-relaxed text-ink/60">
              Pro puts movement breaks into your workday and reminds you before you&apos;ve been sitting all afternoon.{" "}
              <Link href="/app/pro?from=you" className="font-semibold text-coral">
                See Pro
              </Link>
            </p>
          )}
        </Field>
      </Section>

      <Section title="Notifications">
        {pro ? (
          <Field label={state.push.endpoint ? "Push reminders are on" : "Push reminders are off"}>
            <p className="text-sm leading-relaxed text-ink/60">
              Reminders for your workday plan, delivered even when DeskBreak isn&apos;t open.
              {!pushSupported() ? " Not supported in this browser." : ""}
            </p>
            <div className="mt-3">
              <Button
                size="sm"
                block={false}
                variant={state.push.endpoint ? "secondary" : "primary"}
                onClick={togglePush}
                disabled={busy === "push" || !pushSupported()}
              >
                {state.push.endpoint ? "Turn off" : "Turn on"}
              </Button>
            </div>
          </Field>
        ) : null}
        <Field label={daily?.enabled ? "Daily reminder is on" : "Daily reminder is off"}>
          <p className="text-sm leading-relaxed text-ink/60">
            One nudge on weekday afternoons.{!pro ? " Free includes one daily reminder; Pro reminds you around your workday plan." : ""}
          </p>
          <div className="mt-3">
            <Button size="sm" block={false} variant={daily?.enabled ? "secondary" : "primary"} onClick={toggleDaily}>
              {daily?.enabled ? "Turn off" : "Turn on"}
            </Button>
          </div>
        </Field>
      </Section>

      <Section title="Plan">
        <Field label={pro ? "DeskBreak Pro" : "DeskBreak Free"}>
          {pro ? (
            <>
              <p className="text-sm text-ink/60">
                {state.entitlement.cancelAtPeriodEnd
                  ? "Cancels at the end of the current period."
                  : state.entitlement.proExpiresAt
                    ? `Renews ${new Date(state.entitlement.proExpiresAt).toLocaleDateString()}.`
                    : "Active."}
              </p>
              <div className="mt-3">
                <Button size="sm" variant="secondary" block={false} onClick={openPortal} disabled={busy === "portal"}>
                  {busy === "portal" ? "Opening..." : "Manage subscription"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-ink/45">Cancel, change your card, or see invoices.</p>
            </>
          ) : (
            <ButtonLink href="/app/pro?from=you" size="sm" block={false}>
              See Pro
            </ButtonLink>
          )}
        </Field>
      </Section>

      <Section title="App">
        <Field label="During a reset">
          <div className="flex flex-wrap gap-2">
            <Chip
              label={`Sound ${state.settings.soundEnabled ? "on" : "off"}`}
              active={state.settings.soundEnabled}
              onClick={() => saveSettings({ soundEnabled: !state.settings.soundEnabled })}
            />
            <Chip
              label={`Spoken cues ${state.settings.spokenCues ? "on" : "off"}`}
              active={state.settings.spokenCues}
              disabled={!canSpeak()}
              onClick={() => saveSettings({ spokenCues: !state.settings.spokenCues })}
            />
            <Chip
              label={`Auto-advance ${state.settings.autoAdvance ? "on" : "off"}`}
              active={state.settings.autoAdvance}
              onClick={() => saveSettings({ autoAdvance: !state.settings.autoAdvance })}
            />
          </div>
          <p className="mt-2 text-xs text-ink/45">
            Keyboard: Space pauses, arrows move between exercises, S swaps. Reduced motion follows your system setting.
          </p>
        </Field>
      </Section>

      <Section title="About">
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-coral">
          <Link href="/science">Why this works</Link>
          <Link href="/support">Help</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
        <p className="mt-3 text-xs leading-relaxed text-ink/45">{MOVEMENT_DISCLAIMER}</p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">{title}</h2>
      <div className="mt-3 grid gap-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="surface px-4 py-4">
      <p className="text-sm font-semibold text-ink">{label}</p>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}
