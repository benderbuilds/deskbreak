"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/Button";
import { ProBadge } from "@/components/ProBadge";
import { track } from "@/lib/analytics";
import { NEED_OPTIONS, MOVEMENT_DISCLAIMER, SUPPORT_EMAIL } from "@/lib/constants";
import { isProEntitlement, toEntitlement } from "@/lib/entitlements";
import {
  defaultDailyReminder,
  formatReminderTime,
  requestNotificationPermission,
} from "@/lib/reminders";
import {
  cacheEntitlement,
  ensureAnonymousId,
  saveEmail,
  saveReminders,
  saveSettings,
  setPreferredSetup,
  setPrimaryNeed,
} from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import { formatMinutes, toTimeInput, parseTimeInput } from "@/lib/workday";
import type { PrimaryNeed, SetupId } from "@/lib/types";

export function SettingsView() {
  const isClient = useIsClient();
  const state = useAppState();
  const pro = isProEntitlement(state.entitlement);

  const [restoreEmail, setRestoreEmail] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isClient) return null;

  const reminders = state.settings.reminders;
  const daily = reminders.find((entry) => entry.kind === "daily");
  // Free gets one daily reminder; Pro gets the schedule its plan implies.
  const reminderLimit = pro ? Infinity : 1;

  async function toggleDaily() {
    if (daily?.enabled) {
      saveReminders(reminders.filter((entry) => entry.id !== daily.id));
      setNotice("Daily reminder off.");
      return;
    }
    const permission = await requestNotificationPermission();
    const next = daily
      ? reminders.map((entry) =>
          entry.id === daily.id ? { ...entry, enabled: true } : entry,
        )
      : [...reminders.slice(0, reminderLimit - 1), defaultDailyReminder()];
    saveReminders(next);
    track("reminder_created", { kind: "daily", channel: state.email ? "email" : "browser" });
    setNotice(
      state.email
        ? "We'll email you once a day."
        : permission === "granted"
          ? "We'll nudge you while DeskBreak is open. Add an email below for reminders that reach you anywhere."
          : "Saved. Add an email below so reminders reach you when DeskBreak isn't open.",
    );
  }

  function setDailyTime(value: string) {
    const minutes = parseTimeInput(value);
    if (minutes === null) return;
    const existing = daily ?? defaultDailyReminder();
    saveReminders([
      ...reminders.filter((entry) => entry.id !== existing.id),
      { ...existing, minutes, enabled: true },
    ]);
  }

  async function restorePro() {
    const trimmed = restoreEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      setNotice("That doesn't look like an email address.");
      return;
    }
    setRestoring(true);
    try {
      const response = await fetch("/api/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, anonymousId: ensureAnonymousId() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error("restore_failed");
      cacheEntitlement(toEntitlement(data));
      saveEmail(trimmed);
      setNotice(
        data.pro
          ? "Pro restored on this device."
          : "No active subscription on that email. If you just paid, give it a minute and try again.",
      );
    } catch {
      setNotice("We couldn't check that just now. Try again shortly.");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[2rem] font-semibold leading-tight text-ink">
          You
        </h1>
        {pro ? <ProBadge /> : null}
      </div>

      {notice ? (
        <p
          className="mt-4 rounded-[18px] bg-white px-4 py-3 text-sm leading-relaxed text-ink/70 shadow-[0_2px_0_rgba(28,25,23,0.06)]"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      <Section title="Your DeskBreak">
        <Field label="Primary trouble spot">
          <div className="flex flex-wrap gap-2">
            {NEED_OPTIONS.map((option) => (
              <Chip
                key={option.id}
                label={option.chip}
                active={state.primaryNeed === option.id}
                onClick={() => setPrimaryNeed(option.id as PrimaryNeed)}
              />
            ))}
          </div>
        </Field>
        <Field label="Seated or standing">
          <div className="flex gap-2">
            {(["seated", "standing"] as SetupId[]).map((value) => (
              <Chip
                key={value}
                label={value === "seated" ? "Mostly seated" : "Standing desk"}
                active={state.preferredSetup === value}
                onClick={() => setPreferredSetup(value)}
              />
            ))}
          </div>
        </Field>
        {pro ? (
          <Field label="Workday schedule">
            {state.plan ? (
              <p className="text-sm text-ink/60">
                {formatMinutes(state.plan.startMinutes)} to{" "}
                {formatMinutes(state.plan.endMinutes)} ·{" "}
                <Link href="/app/plan" className="font-semibold text-coral">
                  Edit
                </Link>
              </p>
            ) : (
              <ButtonLink href="/app/plan" variant="ghost">
                Build my workday plan
              </ButtonLink>
            )}
          </Field>
        ) : null}
      </Section>

      <Section title="Reminders">
        <Field label={daily?.enabled ? "Daily reminder is on" : "Daily reminder is off"}>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              block={false}
              variant={daily?.enabled ? "ghost" : "primary"}
              className="min-h-11 px-4 text-sm"
              onClick={toggleDaily}
            >
              {daily?.enabled ? "Turn off" : "Turn on"}
            </Button>
            {daily?.enabled ? (
              <label className="text-sm text-ink/55">
                at{" "}
                <input
                  type="time"
                  aria-label="Reminder time"
                  value={toTimeInput(daily.minutes)}
                  onChange={(event) => setDailyTime(event.target.value)}
                  className="min-h-11 rounded-[14px] border-2 border-ink/12 bg-white px-3 text-sm text-ink outline-none focus-visible:border-coral"
                />
              </label>
            ) : null}
          </div>
          {daily?.enabled ? (
            <p className="mt-2 text-xs text-ink/45">
              Around {formatReminderTime(daily.minutes)}, weekdays.
            </p>
          ) : null}
        </Field>
        {!pro ? (
          <p className="text-sm leading-relaxed text-ink/55">
            Free includes one daily reminder. Pro schedules reminders around your
            workday plan.
          </p>
        ) : null}
      </Section>

      <Section title="Account">
        <Field label="Email">
          <p className="text-sm text-ink/60">
            {state.email ?? "Not set. Add one below to get reminders and keep Pro."}
          </p>
        </Field>
        <Field label="Restore Pro purchase">
          <div className="flex flex-col gap-2">
            <label htmlFor="restore-email" className="sr-only">
              Checkout email
            </label>
            <input
              id="restore-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@work.com"
              value={restoreEmail}
              onChange={(event) => setRestoreEmail(event.target.value)}
              className="min-h-14 w-full rounded-[18px] border-2 border-ink/12 bg-white px-4 text-base text-ink outline-none focus-visible:border-coral"
            />
            <Button variant="ghost" onClick={restorePro} disabled={restoring}>
              {restoring ? "Checking..." : "Restore Pro"}
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
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=Manage%20my%20DeskBreak%20subscription`}
                className="mt-2 inline-block text-sm font-semibold text-coral"
              >
                Manage subscription
              </a>
            </>
          ) : (
            <ButtonLink href="/app/pro?from=settings">See Pro</ButtonLink>
          )}
        </Field>
      </Section>

      <Section title="App">
        <Field label="Sound">
          <Chip
            label={state.settings.soundEnabled ? "On" : "Off"}
            active={state.settings.soundEnabled}
            onClick={() => saveSettings({ soundEnabled: !state.settings.soundEnabled })}
          />
        </Field>
      </Section>

      <Section title="Legal">
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-coral">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/support">Support</Link>
        </nav>
        <p className="mt-3 text-xs leading-relaxed text-ink/45">
          {MOVEMENT_DISCLAIMER}
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">
        {title}
      </h2>
      <div className="mt-3 grid gap-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[20px] bg-white px-4 py-4 shadow-[0_2px_0_rgba(28,25,23,0.06)]">
      <p className="text-sm font-semibold text-ink">{label}</p>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        "min-h-11 rounded-full px-4 text-sm font-semibold transition-colors",
        active ? "bg-ink text-paper" : "bg-ink/5 text-ink/60",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
