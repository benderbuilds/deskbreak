"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { LogoMark } from "@/components/LogoMark";
import {
  FIRST_WIN_PROGRAM_ID,
  GOAL_COPY,
  SETUP_COPY,
} from "@/lib/constants";
import { completeOnboarding, saveOnboardingAnswers } from "@/lib/storage";
import type { GoalId, ReminderPref, SetupId } from "@/lib/types";

const TOTAL = 5;
const HOOK_STEP = 0;
const GOAL_STEP = 1;
const SETUP_STEP = 2;
const REMINDER_STEP = 3;
const FIRST_WIN_STEP = 4;

export function OnboardingView() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<GoalId | null>(null);
  const [setup, setSetup] = useState<SetupId | null>(null);
  const [reminder, setReminder] = useState<ReminderPref>("off");

  const canContinue =
    (step === GOAL_STEP && Boolean(goal)) ||
    (step === SETUP_STEP && Boolean(setup)) ||
    (step !== GOAL_STEP && step !== SETUP_STEP);

  function persistAnd(next: () => void) {
    if (!goal || !setup) {
      setStep(goal ? SETUP_STEP : GOAL_STEP);
      return;
    }
    saveOnboardingAnswers({
      goal,
      setup,
      reminder,
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

  const showSkip = step === REMINDER_STEP;

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoMark size={32} />
          <span className="font-display text-lg font-semibold text-ink">
            DeskBreak
          </span>
        </div>
        {showSkip ? (
          <button
            type="button"
            onClick={() => setStep(FIRST_WIN_STEP)}
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
          className="h-full rounded-full bg-coral transition-[width] duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)]"
          style={{ width: `${((step + 1) / TOTAL) * 100}%` }}
        />
      </div>
      {step === FIRST_WIN_STEP ? (
        <p className="mt-2 text-center text-xs font-semibold uppercase tracking-[0.14em] text-coral">
          Almost moving
        </p>
      ) : null}

      <main className="flex flex-1 flex-col justify-center py-6">
        {step === HOOK_STEP && (
          <CopyStep
            kicker="Hook"
            title="Your neck shouldn’t pay rent for a laptop."
            body="Two minutes. Still at your desk. One tap when the meeting gap opens."
            showStretch
          />
        )}
        {step === GOAL_STEP && (
          <ChoiceStep
            kicker="Goal"
            title="What should two minutes fix first?"
            options={[
              {
                id: "neck",
                label: GOAL_COPY.neck.label,
                hint: "Unstick the laptop-neck without leaving the chair.",
              },
              {
                id: "energy",
                label: GOAL_COPY.energy.label,
                hint: "Come back online between blocks.",
              },
              {
                id: "consistent",
                label: GOAL_COPY.consistent.label,
                hint: "Show up for the tiny reset on purpose.",
              },
            ]}
            value={goal}
            onChange={(id) => setGoal(id as GoalId)}
          />
        )}
        {step === SETUP_STEP && (
          <ChoiceStep
            kicker="Work setup"
            title="Where do you actually sit (or stand)?"
            options={[
              {
                id: "seated",
                label: SETUP_COPY.seated.label,
                hint: SETUP_COPY.seated.hint,
              },
              {
                id: "standing",
                label: SETUP_COPY.standing.label,
                hint: SETUP_COPY.standing.hint,
              },
            ]}
            value={setup}
            onChange={(id) => setSetup(id as SetupId)}
          />
        )}
        {step === REMINDER_STEP && (
          <ChoiceStep
            kicker="Optional"
            title="Want a reminder? Off is fine."
            body="We’ll only nudge if this tab is open. Skip anytime."
            options={[
              { id: "off", label: "No reminders", hint: "You’ll start breaks yourself." },
              { id: "midday", label: "Around lunch", hint: "A noon ping if this tab is open." },
              { id: "afternoon", label: "Mid-afternoon", hint: "When the slump usually lands." },
            ]}
            value={reminder}
            onChange={(id) => setReminder(id as ReminderPref)}
          />
        )}
        {step === FIRST_WIN_STEP && (
          <CopyStep
            kicker="First win"
            title="Take the 2-min Desk Reset before anything else."
            body="Feel one actual break. Then we’ll show Free vs Pro. You can stay on the 2-minute reset forever — no card required."
            showStretch
          />
        )}
      </main>

      {step < FIRST_WIN_STEP ? (
        <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
          Continue
        </Button>
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
  showStretch = false,
}: {
  kicker: string;
  title: string;
  body: string;
  showStretch?: boolean;
}) {
  return (
    <div className="animate-[stepIn_280ms_cubic-bezier(0.34,1.4,0.64,1)]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">
        {kicker}
      </p>
      <h1 className="mt-3 font-display text-[2.05rem] font-semibold leading-[1.12] tracking-tight text-ink">
        {title}
      </h1>
      <p className="mt-4 text-[1.05rem] leading-relaxed text-ink/65">{body}</p>
      {showStretch ? (
        <div className="mt-6 flex justify-center">
          <CharacterArt pose="idle" size={168} alt="Stretch" />
        </div>
      ) : null}
    </div>
  );
}

function ChoiceStep({
  kicker,
  title,
  body,
  options,
  value,
  onChange,
}: {
  kicker: string;
  title: string;
  body?: string;
  options: { id: string; label: string; hint: string }[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="animate-[stepIn_280ms_cubic-bezier(0.34,1.4,0.64,1)]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">
        {kicker}
      </p>
      <h1 className="mt-3 font-display text-[1.85rem] font-semibold leading-[1.12] tracking-tight text-ink">
        {title}
      </h1>
      {body ? (
        <p className="mt-3 text-[1.05rem] leading-relaxed text-ink/65">{body}</p>
      ) : null}
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
                "transition-[transform,box-shadow] duration-[240ms] ease-[cubic-bezier(0.34,1.4,0.64,1)]",
                "active:translate-y-[2px] active:shadow-none",
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
