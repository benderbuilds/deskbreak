"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { Button, ButtonLink } from "@/components/Button";
import { ProBadge } from "@/components/ProBadge";
import { SETUP_COPY } from "@/lib/constants";
import { canDemoUnlock, isProEntitlement } from "@/lib/entitlements";
import { formatHourLabel, requestReminderPermission } from "@/lib/reminders";
import {
  resetOnboarding,
  saveSettings,
  saveSetup,
  setCelebrationTheme,
  setPlanFree,
  unlockPro,
} from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import type { CelebrationTheme, SetupId } from "@/lib/types";

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17];

export function SettingsView() {
  const router = useRouter();
  const state = useAppState();
  const pro = isProEntitlement(state.entitlement);
  const demo = canDemoUnlock();
  const [notice, setNotice] = useState<string | null>(null);

  async function toggleReminders() {
    const next = !state.settings.remindersEnabled;
    if (!next) {
      saveSettings({ remindersEnabled: false });
      setNotice("Reminders off.");
      return;
    }
    const permission = await requestReminderPermission();
    if (permission === "unsupported") {
      saveSettings({
        remindersEnabled: true,
        reminderHour: state.settings.reminderHour ?? 12,
      });
      setNotice(
        "This browser can’t send system notifications. We’ll show an in-app nudge if DeskBreak is open at your reminder hour.",
      );
      return;
    }
    if (permission === "denied") {
      saveSettings({
        remindersEnabled: true,
        reminderHour: state.settings.reminderHour ?? 12,
      });
      setNotice(
        "Notifications are blocked. We’ll still flag your reminder time while this tab is open.",
      );
      return;
    }
    saveSettings({
      remindersEnabled: true,
      reminderHour: state.settings.reminderHour ?? 12,
    });
    setNotice("Reminders on. We’ll ping if this tab is open at that hour.");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1 px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-coral">
          You
        </p>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="font-display text-[2rem] font-semibold text-ink">Settings</h1>
          {pro ? <ProBadge /> : null}
        </div>

        <section className="mt-6 rounded-[24px] bg-white p-4 shadow-[0_4px_0_rgba(28,25,23,0.06)]">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/45">
            Plan
          </h2>
          <p className="mt-2 font-display text-xl font-semibold text-ink">
            {pro ? "DeskBreak Pro" : "Free"}
          </p>
          <p className="mt-1 text-sm text-ink/60">
            {pro
              ? state.entitlement.proExpiresAt
                ? `Year access on this device through ${new Date(state.entitlement.proExpiresAt).toLocaleDateString()}. Source: ${state.entitlement.source ?? "unknown"}.`
                : "Pro is active on this device."
              : "2-min Desk Reset is unlimited. Longer circuits are Pro."}
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {pro ? (
              demo ? (
                <Button variant="ghost" onClick={() => setPlanFree()}>
                  Downgrade to Free (demo)
                </Button>
              ) : (
                <p className="text-xs text-ink/45">
                  Manage billing in Stripe if you subscribed with a card.
                </p>
              )
            ) : (
              <ButtonLink href="/paywall">Upgrade to Pro</ButtonLink>
            )}
            {demo && !pro ? (
              <Button variant="mint" onClick={() => unlockPro("demo")}>
                Unlock Pro for demo
              </Button>
            ) : null}
          </div>
        </section>

        <section className="mt-4 rounded-[24px] bg-white p-4 shadow-[0_4px_0_rgba(28,25,23,0.06)]">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/45">
            Desk setup
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/65">
            Standing is the default 2-min reset. Switch to seated anytime — both stay Free.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {(["standing", "seated"] as SetupId[]).map((id) => {
              const active = state.onboardingAnswers.setup === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => saveSetup(id)}
                  className={[
                    "min-h-12 rounded-[18px] px-4 py-3 text-left",
                    active ? "bg-ink text-paper" : "bg-paper text-ink/70",
                  ].join(" ")}
                >
                  <span className="block text-sm font-semibold">{SETUP_COPY[id].label}</span>
                  <span className={["block text-xs", active ? "text-paper/70" : "text-ink/50"].join(" ")}>
                    {SETUP_COPY[id].hint}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-4 rounded-[24px] bg-white p-4 shadow-[0_4px_0_rgba(28,25,23,0.06)]">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/45">
            Reminders
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/65">
            Browsers can’t reliably ping you at 2pm unless DeskBreak is open.
            We’ll try a system notification, and always show an in-app nudge at
            your hour.
          </p>
          <div className="mt-4">
            <Button variant={state.settings.remindersEnabled ? "mint" : "ghost"} onClick={toggleReminders}>
              {state.settings.remindersEnabled ? "Reminders on" : "Turn reminders on"}
            </Button>
          </div>
          {pro ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">
                Custom time
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {HOURS.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => saveSettings({ reminderHour: hour, remindersEnabled: true })}
                    className={[
                      "min-h-11 rounded-full px-3 text-sm font-semibold",
                      state.settings.reminderHour === hour
                        ? "bg-ink text-paper"
                        : "bg-paper text-ink/70",
                    ].join(" ")}
                  >
                    {formatHourLabel(hour)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink/50">
              Custom reminder times are a Pro unlock.{" "}
              <a href="/paywall" className="font-semibold text-coral">
                See plans
              </a>
            </p>
          )}
        </section>

        <section className="mt-4 rounded-[24px] bg-white p-4 shadow-[0_4px_0_rgba(28,25,23,0.06)]">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/45">
            Celebrations
          </h2>
          {pro ? (
            <div className="mt-3 flex flex-col gap-2">
              {(
                [
                  ["classic", "Classic mint check"],
                  ["confetti", "Extra confetti"],
                  ["spark", "Spark burst"],
                ] as [CelebrationTheme, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCelebrationTheme(id)}
                  className={[
                    "min-h-12 rounded-[18px] px-4 text-left text-sm font-semibold",
                    state.settings.celebrationTheme === id
                      ? "bg-ink text-paper"
                      : "bg-paper text-ink/70",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink/55">
              XP and celebration themes unlock with Pro.
            </p>
          )}
        </section>

        {notice ? (
          <p className="mt-4 text-sm leading-relaxed text-ink/60" role="status">
            {notice}
          </p>
        ) : null}

        <section className="mt-4 rounded-[24px] bg-white p-4 shadow-[0_4px_0_rgba(28,25,23,0.06)]">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/45">
            Data
          </h2>
          <p className="mt-2 text-sm text-ink/60">
            Progress lives in this browser. Resetting onboarding does not remove
            Pro or your streak.
          </p>
          <div className="mt-4">
            <Button
              variant="ghost"
              onClick={() => {
                resetOnboarding();
                router.replace("/");
              }}
            >
              Replay onboarding
            </Button>
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
