"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { LogoMark } from "@/components/LogoMark";
import { FIRST_WIN_PROGRAM_ID } from "@/lib/constants";
import { completeOnboarding, saveOnboardingAnswers } from "@/lib/storage";
import type { ReminderPref } from "@/lib/types";

const TOTAL = 6;

export function OnboardingView() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [reminder, setReminder] = useState<ReminderPref | null>(null);

  function persistAnd(next: () => void) {
    saveOnboardingAnswers({
      goal: null,
      setup: null,
      reminder: reminder ?? "off",
    });
    completeOnboarding();
    next();
  }

  function goFirstWin() {
    persistAnd(() =>
      router.push(`/workout/${FIRST_WIN_PROGRAM_ID}?src=firstWin`),
    );
  }

  function goPaywallLater() {
    persistAnd(() => router.push("/paywall?from=skip"));
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoMark size={32} />
          <span className="font-display text-lg font-semibold text-ink">
            DeskBreak
          </span>
        </div>
        {step < 5 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(5, s + 1))}
            className="min-h-11 rounded-full px-3 text-sm font-semibold text-ink/45"
          >
            Skip
          </button>
        ) : (
          <span className="w-12" />
        )}
      </header>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink/8" aria-hidden>
        <div
          className="h-full rounded-full bg-coral transition-[width] duration-300 ease-[cubic-bezier(0.34,1.2,0.64,1)]"
          style={{ width: `${((step + 1) / TOTAL) * 100}%` }}
        />
      </div>

      <main className="flex flex-1 flex-col justify-center py-6">
        {step === 0 && (
          <CopyStep
            kicker="Hook"
            title="Your neck shouldn’t pay rent for a laptop."
            body="DeskBreak is a two-minute unstick you start with one tap — still at the chair, still in the workday."
          />
        )}
        {step === 1 && (
          <CopyStep
            kicker="The 3pm slump"
            title="Desk stiffness is not a personality."
            body="Shoulders up by the ears. Wrists humming. Energy gone and it’s still Tuesday. That’s the tax of sitting still — not a lack of grit."
          />
        )}
        {step === 2 && (
          <CopyStep
            kicker="Two minutes"
            title="Two minutes that actually fit a workday."
            body="No mat. No change of clothes. Office workouts and desk exercises between calls — or a home workout routine for busy days at the kitchen table."
          />
        )}
        {step === 3 && (
          <CopyStep
            kicker="The promise"
            title="Show up for the tiny reset. That’s the whole game."
            body="One tap. A lanky coach named Stretch. Cue text you can actually follow. Then back to the calendar."
          />
        )}
        {step === 4 && (
          <ChoiceStep
            kicker="Optional nudge"
            title="Want a reminder to stand up?"
            options={[
              { id: "midday", label: "Around lunch", hint: "A noon ping if this tab is open." },
              { id: "afternoon", label: "Mid-afternoon", hint: "When the slump usually lands." },
              { id: "off", label: "No reminders", hint: "You’ll start breaks yourself." },
            ]}
            value={reminder}
            onChange={(id) => setReminder(id as ReminderPref)}
          />
        )}
        {step === 5 && (
          <CopyStep
            kicker="First win"
            title="Take the 2-min Desk Reset before anything else."
            body="Feel one actual break. Then we’ll show Free vs Pro. You can stay on the 2-minute reset forever — no card required."
          />
        )}
      </main>

      {step < 5 ? (
        <Button onClick={() => setStep((s) => s + 1)}>Continue</Button>
      ) : (
        <div className="flex flex-col gap-3">
          <Button onClick={goFirstWin}>Start my 2-min reset</Button>
          <button
            type="button"
            onClick={goPaywallLater}
            className="min-h-11 text-sm font-semibold text-ink/45"
          >
            I’ll do it later
          </button>
        </div>
      )}
    </div>
  );
}

function CopyStep({
  kicker,
  title,
  body,
}: {
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <div className="animate-[stepIn_280ms_cubic-bezier(0.34,1.2,0.64,1)]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">
        {kicker}
      </p>
      <h1 className="mt-3 font-display text-[2.05rem] font-semibold leading-[1.12] tracking-tight text-ink">
        {title}
      </h1>
      <p className="mt-4 text-[1.05rem] leading-relaxed text-ink/65">{body}</p>
      <div className="mt-6 flex justify-center">
        <CharacterArt pose="idle" size={168} alt="Stretch" />
      </div>
    </div>
  );
}

function ChoiceStep({
  kicker,
  title,
  options,
  value,
  onChange,
}: {
  kicker: string;
  title: string;
  options: { id: string; label: string; hint: string }[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="animate-[stepIn_280ms_cubic-bezier(0.34,1.2,0.64,1)]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">
        {kicker}
      </p>
      <h1 className="mt-3 font-display text-[1.85rem] font-semibold leading-[1.12] tracking-tight text-ink">
        {title}
      </h1>
      <div className="mt-6 flex flex-col gap-2">
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={[
                "min-h-16 rounded-[22px] px-4 py-3 text-left",
                "transition-transform duration-200 ease-[cubic-bezier(0.34,1.4,0.64,1)] active:scale-[0.98]",
                active
                  ? "bg-ink text-paper shadow-[0_4px_0_#0C0A09]"
                  : "bg-white text-ink shadow-[0_4px_0_rgba(28,25,23,0.06)]",
              ].join(" ")}
            >
              <span className="block text-base font-semibold">{option.label}</span>
              <span
                className={[
                  "mt-0.5 block text-sm",
                  active ? "text-paper/70" : "text-ink/55",
                ].join(" ")}
              >
                {option.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
