"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { LogoMark } from "@/components/LogoMark";
import { GOAL_COPY, SETUP_COPY } from "@/lib/constants";
import { saveOnboardingAnswers } from "@/lib/storage";
import type { GoalId, ReminderPref, SetupId } from "@/lib/types";

type Answers = {
  goal: GoalId | null;
  setup: SetupId | null;
  reminder: ReminderPref | null;
};

const TOTAL = 7;

export function OnboardingView() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    goal: null,
    setup: null,
    reminder: null,
  });

  function persistAnd(next: () => void) {
    saveOnboardingAnswers(answers);
    next();
  }

  function goFirstWin() {
    persistAnd(() => router.push("/workout/desk-reset-2min?src=firstWin"));
  }

  function goPaywallLater() {
    persistAnd(() => router.push("/paywall?from=skip"));
  }

  const canAdvance =
    step === 2 ? Boolean(answers.goal) :
    step === 3 ? Boolean(answers.setup) :
    step === 4 ? Boolean(answers.reminder) :
    true;

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoMark size={32} />
          <span className="font-display text-lg font-semibold text-ink">
            DeskBreak
          </span>
        </div>
        {step < 6 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(6, s + 1))}
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
            kicker="The 3pm slump"
            title="Desk stiffness is not a personality."
            body="Shoulders up by the ears. Wrists humming. Energy gone and it’s still Tuesday. That’s the tax of sitting still — not a lack of grit."
          />
        )}
        {step === 1 && (
          <CopyStep
            kicker="The promise"
            title="Two minutes that actually fit a workday."
            body="No mat. No change of clothes. Office workouts and desk exercises you start with one tap between calls — or a home workout routine for busy days at the kitchen table."
          />
        )}
        {step === 2 && (
          <ChoiceStep
            kicker="Make it yours"
            title="What do you want out of a reset?"
            options={[
              { id: "neck", label: GOAL_COPY.neck.label, hint: "Unstick the screen hunch." },
              { id: "energy", label: GOAL_COPY.energy.label, hint: "Come back online without coffee #4." },
              { id: "consistent", label: GOAL_COPY.consistent.label, hint: "A tiny habit that doesn’t nag." },
            ]}
            value={answers.goal}
            onChange={(goal) => setAnswers((a) => ({ ...a, goal: goal as GoalId }))}
          />
        )}
        {step === 3 && (
          <ChoiceStep
            kicker="Your setup"
            title="Where do you actually work?"
            options={[
              { id: "seated", label: SETUP_COPY.seated.label, hint: SETUP_COPY.seated.hint },
              { id: "standing", label: SETUP_COPY.standing.label, hint: SETUP_COPY.standing.hint },
            ]}
            value={answers.setup}
            onChange={(setup) => setAnswers((a) => ({ ...a, setup: setup as SetupId }))}
          />
        )}
        {step === 4 && (
          <ChoiceStep
            kicker="A nudge, not a guilt trip"
            title="Want a reminder to stand up?"
            options={[
              { id: "midday", label: "Around lunch", hint: "A noon ping if this tab is open." },
              { id: "afternoon", label: "Mid-afternoon", hint: "When the slump usually lands." },
              { id: "off", label: "No reminders", hint: "You’ll start breaks yourself." },
            ]}
            value={answers.reminder}
            onChange={(reminder) =>
              setAnswers((a) => ({ ...a, reminder: reminder as ReminderPref }))
            }
          />
        )}
        {step === 5 && (
          <CopyStep
            kicker="No fake stats"
            title="We won’t invent a user count."
            body="DeskBreak is for people who sit through standups, then sit through the work after. No clinical trial. No “10,000 desk athletes.” Just a two-minute reset that fits between calendar blocks."
          />
        )}
        {step === 6 && (
          <CopyStep
            kicker="First win"
            title="Take the 2-min Desk Reset before anything else."
            body="Feel one actual break. Then we’ll show Free vs Pro. You can stay on the 2-minute reset forever — no card required."
          />
        )}
      </main>

      {step < 6 ? (
        <Button disabled={!canAdvance} onClick={() => setStep((s) => s + 1)}>
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
