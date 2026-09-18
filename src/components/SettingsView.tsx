"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { Button, ButtonLink, Chip } from "@/components/Button";
import { ProBadge } from "@/components/ProBadge";
import { PushSetup } from "@/components/PushSetup";
import { SignInBanner } from "@/components/SignInBanner";
import { SwitchRow } from "@/components/Switch";
import { describeAccountError, pushPreferences, requestMagicLink, signOut } from "@/lib/account-client";
import { track } from "@/lib/analytics";
import { openBillingPortal, renewalLine } from "@/lib/billing-client";
import {
  CONSTRAINT_OPTIONS,
  DURATION_OPTIONS,
  FLOOR_WORK_OPTION,
  MOVEMENT_DISCLAIMER,
  SETUP_COPY,
  SUPPORT_EMAIL,
} from "@/lib/constants";
import { formatMinutes } from "@/lib/dates";
import { canAccessDuration, isProEntitlement } from "@/lib/entitlements";
import { canSpeak } from "@/lib/audio-cues";
import { STAND_NUDGE_INTERVAL_MINUTES, defaultDailyReminder, requestNotificationPermission } from "@/lib/reminders";
import { SAFETY_FLAG_OPTIONS } from "@/lib/safety";
import {
  saveEmail,
  saveReminders,
  saveSettings,
  saveStandNudge,
  setAllowFloorWork,
  setConstraints,
  setPreferredDuration,
  setPreferredSetup,
  toggleSafetyFlag,
} from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import { REMINDER_LEVELS } from "@/lib/workday";
import type { DurationMinutes, FunctionalConstraint, SetupRequest } from "@/lib/types";

/** The auth route's resend cooldown when it doesn't say (AUTH_LINK_COOLDOWN_SECONDS). */
const DEFAULT_RETRY_SECONDS = 60;

type Notice = { text: string; tone: "info" | "error" };

/** The "You" tab: account, your reset, go easy on, workday, reminders, plan, app. */
export function SettingsView() {
  const isClient = useIsClient();
  const state = useAppState();
  const pro = isProEntitlement(state.entitlement);
  const signedIn = Boolean(state.account.profileId);

  const [email, setEmail] = useState(state.account.email ?? state.email ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  // Account notices sit under the email field, next to the button that caused them.
  const [accountNotice, setAccountNotice] = useState<Notice | null>(null);
  const [billingNotice, setBillingNotice] = useState<string | null>(null);
  const [dailyNotice, setDailyNotice] = useState<string | null>(null);
  const [retryUntil, setRetryUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!retryUntil) return;
    const id = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= retryUntil) setRetryUntil(null);
    }, 1000);
    return () => window.clearInterval(id);
  }, [retryUntil]);

  if (!isClient) return null;

  const reminders = state.settings.reminders;
  const daily = reminders.find((entry) => entry.kind === "daily");
  const waitSeconds = retryUntil ? Math.max(0, Math.ceil((retryUntil - now) / 1000)) : 0;

  async function sendLink(next = "/app/you") {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      setAccountNotice({ text: "That doesn't look like an email address.", tone: "error" });
      return null;
    }
    setBusy("link");
    const result = await requestMagicLink(trimmed, { next });
    setBusy(null);
    if (!result.ok) {
      if (result.error === "rate_limited") {
        const seconds = result.retryAfterSeconds ?? DEFAULT_RETRY_SECONDS;
        setRetryUntil(Date.now() + seconds * 1000);
        setNow(Date.now());
        setAccountNotice({ text: rateLimitCopy(seconds), tone: "error" });
      } else {
        setAccountNotice({ text: describeAccountError(result.error), tone: "error" });
      }
      return null;
    }
    saveEmail(trimmed);
    return result;
  }

  async function sendSignInLink() {
    const result = await sendLink("/app/you");
    if (!result) return;
    setAccountNotice({
      tone: "info",
      text: result.devLink
        ? `Email isn't configured here. Open this link to sign in: ${result.devLink}`
        : `Check ${email.trim()} for your sign-in link. Open it on this device to keep this browser's resets.`,
    });
  }

  /**
   * Restoring Pro is signing in. The link proves the address; opening it on
   * this device attaches any subscription bought under that address, without
   * ever letting a typed address alone unlock someone else's plan.
   */
  async function restorePro() {
    const result = await sendLink("/app/you?restored=1");
    if (!result) return;
    setAccountNotice({
      tone: "info",
      text: result.devLink
        ? `Email isn't configured here. Open this link to sign in and restore Pro: ${result.devLink}`
        : `Check ${email.trim()} for a sign-in link. If that email has a subscription, opening the link restores Pro on this device.`,
    });
  }

  async function openPortal() {
    setBusy("portal");
    const result = await openBillingPortal();
    if (result === "opened") return;
    setBusy(null);
    setBillingNotice(
      result === "signed_out"
        ? "Sign in with your checkout email first, then manage billing from here."
        : `We couldn't open billing just now. Email ${SUPPORT_EMAIL} and we'll sort it the same day.`,
    );
  }

  async function toggleDaily() {
    if (daily?.enabled) {
      saveReminders(reminders.filter((entry) => entry.id !== daily.id));
      // Email reminders are opt-in on the server; turning off here turns them off there.
      void pushPreferences();
      setDailyNotice(null);
      return;
    }
    const permission = await requestNotificationPermission();
    saveReminders([...reminders.filter((entry) => entry.kind !== "daily"), defaultDailyReminder()]);
    track("reminder_created", { kind: "daily", channel: signedIn ? "email" : "browser" });
    void pushPreferences();
    setDailyNotice(
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

  const emailNoticeId = "you-email-notice";

  return (
    <div className="flex flex-1 flex-col px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] lg:max-w-[640px] lg:px-0">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[2rem] font-semibold leading-tight text-ink">You</h1>
        {pro ? <ProBadge /> : null}
      </div>

      <Suspense fallback={null}>
        <SignInBanner />
      </Suspense>

      <Section title="Account">
        {signedIn ? (
          <Field label="Signed in">
            <p className="text-sm break-words text-ink/60">{state.account.email}</p>
            <p className="mt-1 text-xs text-ink/45">Your resets sync across devices.</p>
            {pro ? (
              <div className="mt-4 border-t border-ink/8 pt-4">
                <p className="text-sm font-semibold text-ink">DeskBreak Pro</p>
                <p className="mt-0.5 text-sm text-ink/60">{renewalLine(state.entitlement)}</p>
                <div className="mt-3">
                  <Button size="sm" variant="secondary" block={false} onClick={openPortal} disabled={busy === "portal"}>
                    {busy === "portal" ? "Opening..." : "Manage subscription"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-ink/45">Cancel, change your card, or see invoices.</p>
                {billingNotice ? (
                  <p className="mt-2 text-sm leading-relaxed text-ink/70" role="status">
                    {billingNotice}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="mt-3">
              <Button
                size="sm"
                variant="tertiary"
                block={false}
                className="-ml-4"
                onClick={async () => {
                  await signOut();
                  setAccountNotice({ text: "Signed out on this device. Your history stays here.", tone: "info" });
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
              aria-describedby={accountNotice ? emailNoticeId : undefined}
              aria-invalid={accountNotice?.tone === "error" && !retryUntil ? true : undefined}
              className="mt-3 min-h-12 w-full rounded-[14px] border border-ink/12 bg-white px-4 text-base text-ink outline-none focus-visible:border-coral"
            />
            {accountNotice ? (
              <p
                id={emailNoticeId}
                role="status"
                className={[
                  "mt-2 text-sm leading-relaxed break-words",
                  accountNotice.tone === "error" ? "font-semibold text-ink" : "text-ink/70",
                ].join(" ")}
              >
                {accountNotice.text}
              </p>
            ) : null}
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button size="sm" block={false} onClick={sendSignInLink} disabled={busy === "link" || waitSeconds > 0}>
                {busy === "link"
                  ? "Sending..."
                  : waitSeconds > 0
                    ? `Send again in ${formatCountdown(waitSeconds)}`
                    : "Send sign-in link"}
              </Button>
              <Button
                size="sm"
                variant="tertiary"
                block={false}
                onClick={restorePro}
                disabled={busy === "link" || waitSeconds > 0}
              >
                Restore Pro
              </Button>
            </div>
          </Field>
        )}
        {signedIn && accountNotice ? (
          <p className="text-sm leading-relaxed text-ink/70" role="status">
            {accountNotice.text}
          </p>
        ) : null}
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

      <Section title="Go easy on">
        <div className="surface px-4 py-3">
          <p className="py-1 text-sm leading-relaxed text-ink/60">
            Anything DeskBreak should go easy on? Moves that don&apos;t suit it are left out of every routine.
          </p>
          <ul className="divide-y divide-ink/8">
            {SAFETY_FLAG_OPTIONS.map((option) => (
              <li key={option.id}>
                <SwitchRow
                  label={option.label}
                  hint={option.hint}
                  checked={state.safetyFlags.includes(option.id)}
                  onChange={() => toggleSafetyFlag(option.id)}
                />
              </li>
            ))}
            <li>
              <SwitchRow
                label={FLOOR_WORK_OPTION.label}
                hint={FLOOR_WORK_OPTION.hint}
                checked={state.allowFloorWork}
                onChange={(next) => setAllowFloorWork(next)}
              />
            </li>
          </ul>
          <p className="py-2 text-xs leading-relaxed text-ink/50">
            These answers stay on this device. They aren&apos;t saved to your account.
          </p>
        </div>
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
              Pro puts movement breaks into your workday and reminds you before you&apos;ve been sitting all afternoon.
            </p>
          )}
        </Field>
      </Section>

      <Section title="Reminders">
        <div className="surface px-4 py-3">
          <ul className="divide-y divide-ink/8">
            <li>
              <SwitchRow
                label="Stand-up nudge"
                hint={`While DeskBreak is open, a nudge after about ${STAND_NUDGE_INTERVAL_MINUTES} minutes without moving, during work hours.`}
                checked={state.settings.standNudge.enabled}
                onChange={(next) => saveStandNudge({ enabled: next, snoozedUntil: null })}
              />
            </li>
            <li>
              <SwitchRow
                label="Daily reminder"
                hint={
                  pro
                    ? "One nudge on weekday afternoons."
                    : "One nudge on weekday afternoons. Pro reminds you around your workday plan."
                }
                checked={Boolean(daily?.enabled)}
                onChange={() => void toggleDaily()}
              />
              {dailyNotice ? (
                <p className="pb-2 text-sm leading-relaxed text-ink/70" role="status">
                  {dailyNotice}
                </p>
              ) : null}
            </li>
            {pro ? (
              <li className="py-2">
                <PushSetup context="you" />
              </li>
            ) : null}
          </ul>
        </div>
      </Section>

      <Section title="Plan">
        <Field label={pro ? "DeskBreak Pro" : "DeskBreak Free"}>
          {pro ? (
            signedIn ? (
              <p className="text-sm text-ink/60">
                {renewalLine(state.entitlement)} Manage it from Account above.
              </p>
            ) : (
              <>
                <p className="text-sm text-ink/60">{renewalLine(state.entitlement)}</p>
                <p className="mt-3 text-sm leading-relaxed text-ink/60">
                  To cancel, change your card or see invoices, sign in above with the email you used at checkout.
                  Billing only opens for a signed-in account.
                </p>
              </>
            )
          ) : (
            <>
              <p className="text-sm leading-relaxed text-ink/60">
                A workday plan, reminders around it, 5- and 10-minute workouts and your full history.
              </p>
              <div className="mt-3">
                <ButtonLink href="/app/pro?from=you" variant="secondary" size="sm" block={false}>
                  See Pro
                </ButtonLink>
              </div>
            </>
          )}
        </Field>
      </Section>

      <Section title="App">
        <div className="surface px-4 py-3">
          <p className="py-1 text-sm font-semibold text-ink">During a reset</p>
          <ul className="divide-y divide-ink/8">
            <li>
              <SwitchRow
                label="Sound"
                hint="A tick in the last seconds and a chime between moves."
                checked={state.settings.soundEnabled}
                onChange={(next) => saveSettings({ soundEnabled: next })}
              />
            </li>
            <li>
              <SwitchRow
                label="Spoken cues"
                hint={canSpeak() ? "Reads each move's name and cue aloud." : "This browser can't read cues aloud."}
                checked={state.settings.spokenCues}
                disabled={!canSpeak()}
                onChange={(next) => saveSettings({ spokenCues: next })}
              />
            </li>
            <li>
              <SwitchRow
                label="Auto-advance"
                hint="Moves on to the next exercise when the timer ends."
                checked={state.settings.autoAdvance}
                onChange={(next) => saveSettings({ autoAdvance: next })}
              />
            </li>
          </ul>
          <p className="py-2 text-xs text-ink/45">
            Keyboard: Space pauses, arrows move between exercises, S swaps. Reduced motion follows your system setting.
          </p>
        </div>
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


function rateLimitCopy(seconds: number): string {
  const wait = seconds <= 90 ? `${seconds} seconds` : `${Math.ceil(seconds / 60)} minutes`;
  return `A link was sent to that address recently. Check your inbox and spam folder, or try again in ${wait}.`;
}

function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
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
