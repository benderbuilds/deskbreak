"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { ErrorState } from "@/components/StatusStates";
import { UpgradeSheet } from "@/components/UpgradeSheet";
import { getProgram } from "@/lib/content";
import { canAccessProgram } from "@/lib/entitlements";
import { formatClock, formatDose } from "@/lib/format";
import {
  recordCompletedWorkout,
  saveLastSession,
} from "@/lib/storage";
import { playCelebrationTune, unlockCelebrationAudio } from "@/lib/celebration-tune";
import { useAppState } from "@/lib/use-app-state";
import { useWorkoutEngine } from "@/lib/use-workout-engine";

export function WorkoutView({
  programId,
  firstWin = false,
}: {
  programId: string;
  firstWin?: boolean;
}) {
  const router = useRouter();
  const program = getProgram(programId);
  const state = useAppState();
  const allowed = program ? canAccessProgram(program.id, state.entitlement) : false;
  const setup = state.onboardingAnswers.setup;
  const goal = state.onboardingAnswers.goal;
  const engine = useWorkoutEngine(allowed && program ? programId : "", setup, goal);
  const recordedRef = useRef(false);
  const [upgrade, setUpgrade] = useState(false);
  const [skipToast, setSkipToast] = useState(false);
  const skipTimer = useRef<number | null>(null);

  useEffect(() => {
    if (engine.status !== "complete" || !program || recordedRef.current) return;
    recordedRef.current = true;
    const session = {
      programId: program.id,
      programName: program.name,
      durationMin: program.durationMin,
      completedExerciseIds: engine.completedIds,
      skippedExerciseIds: engine.skippedIds,
      elapsedSec: Math.max(1, Math.round(engine.elapsedSec)),
      finishedAt: new Date().toISOString(),
    };
    saveLastSession(session);
    recordCompletedWorkout(session);
    playCelebrationTune(session.finishedAt);
    const next = firstWin || !state.paywallSeen ? "/done?next=paywall" : "/done";
    router.replace(next);
  }, [
    engine.status,
    engine.completedIds,
    engine.skippedIds,
    engine.elapsedSec,
    program,
    router,
    firstWin,
    state.paywallSeen,
  ]);

  useEffect(() => {
    return () => {
      if (skipTimer.current) window.clearTimeout(skipTimer.current);
    };
  }, []);

  const current = engine.current;
  const doseLabel = useMemo(
    () => (current ? formatDose(current.exercise.defaultDose) : ""),
    [current],
  );

  function leaveBreak() {
    // First-win Leave must not dump to the paywall. Paywall comes from Done
    // (?next=paywall) after a completed reset, or “I’ll do it later” in onboarding.
    router.push("/");
  }

  function flashSkipToast() {
    setSkipToast(true);
    if (skipTimer.current) window.clearTimeout(skipTimer.current);
    skipTimer.current = window.setTimeout(() => setSkipToast(false), 2200);
  }

  if (!program) {
    return (
      <div className="flex min-h-dvh flex-col justify-center px-5">
        <ErrorState
          title="That break isn’t here"
          body="The program id is missing from the content file. Head home and pick a reset."
          action={<ButtonLink href="/">Back home</ButtonLink>}
        />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-dvh flex-col justify-center px-5">
        <div className="mb-4 flex justify-center">
          <CharacterArt pose="locked" size={160} alt="Stretch — locked program" />
        </div>
        <ErrorState
          title={`${program.shortLabel} is Pro`}
          body="Stay unlimited on the 2-min Desk Reset, or unlock Lunch Reset and Busy-Day Circuit."
          action={
            <Button onClick={() => setUpgrade(true)}>See Pro</Button>
          }
        />
        <div className="mt-3">
          <ButtonLink href="/" variant="ghost">
            Back home
          </ButtonLink>
        </div>
        <UpgradeSheet
          open={upgrade}
          onClose={() => setUpgrade(false)}
          reason={`${program.name} unlocks with an annual Pro subscription.`}
        />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex min-h-dvh flex-col justify-center px-5">
        <ErrorState
          title="Couldn’t start this break"
          body="The workout engine didn’t load a first move. Try again from Home."
          action={<ButtonLink href="/">Back home</ButtonLink>}
        />
      </div>
    );
  }

  const seconds = formatClock(engine.remainingSec);
  const stepLabel = `${engine.stepIndex + 1} of ${engine.steps.length}`;
  const stepProgress =
    current.durationSec > 0
      ? Math.min(1, Math.max(0, 1 - engine.remainingSec / current.durationSec))
      : 0;
  const ring = 2 * Math.PI * 46;

  return (
    <div className="relative flex min-h-dvh flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.9rem,env(safe-area-inset-top))]">
      <header className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={leaveBreak}
          className="relative z-20 grid h-12 w-12 place-items-center rounded-full bg-white text-ink shadow-[0_3px_0_rgba(28,25,23,0.06)] transition-[transform,box-shadow] duration-[240ms] ease-[cubic-bezier(0.34,1.4,0.64,1)] active:translate-y-[2px] active:shadow-none"
          aria-label="Leave break"
        >
          <CloseIcon />
        </button>
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-coral">
            {program.shortLabel}
          </p>
          <p className="text-sm font-semibold text-ink/60">{stepLabel}</p>
        </div>
        <button
          type="button"
          onClick={engine.status === "paused" ? engine.resume : engine.pause}
          className="relative z-20 grid h-12 w-12 place-items-center rounded-full bg-white text-ink shadow-[0_3px_0_rgba(28,25,23,0.06)] transition-[transform,box-shadow] duration-[240ms] ease-[cubic-bezier(0.34,1.4,0.64,1)] active:translate-y-[2px] active:shadow-none"
          aria-label={engine.status === "paused" ? "Resume" : "Pause"}
        >
          {engine.status === "paused" ? <PlayIcon /> : <PauseIcon />}
        </button>
      </header>

      <div className="mb-3 h-2 overflow-hidden rounded-full bg-ink/8">
        <div
          className="h-full rounded-full bg-mint transition-[width] duration-[260ms] ease-[cubic-bezier(0.34,1.4,0.64,1)]"
          style={{ width: `${Math.round(engine.progress * 100)}%` }}
        />
      </div>

      <div className="relative flex flex-1 flex-col items-center text-center">
        {engine.status === "paused" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[32px] bg-paper/80 backdrop-blur-[2px]">
            <p className="font-display text-3xl font-semibold text-ink">Paused</p>
            <p className="mt-2 max-w-[16rem] text-sm text-ink/55">
              No rush. Resume when you&apos;re ready.
            </p>
            <div className="mt-6 w-full max-w-[220px]">
              <Button onClick={engine.resume}>Resume</Button>
            </div>
          </div>
        )}

        <div
          key={`${current.exercise.id}-copy`}
          className="w-full animate-[stepIn_280ms_cubic-bezier(0.34,1.4,0.64,1)]"
        >
          <h1 className="font-display text-[1.85rem] font-semibold leading-tight text-ink">
            {current.exercise.name}
          </h1>
          {current.exercise.shortLabel ? (
            <p className="mt-1 text-sm font-semibold text-coral">
              {current.exercise.shortLabel}
            </p>
          ) : null}
          <p className="mt-3 text-[1.05rem] leading-relaxed text-ink/70">
            {current.exercise.cue}
          </p>
        </div>

        <div
          key={current.exercise.id}
          className="relative z-0 mt-4 animate-[popIn_280ms_cubic-bezier(0.34,1.45,0.64,1)]"
        >
          <CharacterArt
            pose="exercise"
            exerciseId={current.exercise.id}
            bodyArea={current.exercise.bodyArea}
            stretchAsset={current.exercise.stretchAsset}
            stretchAssetB={current.exercise.stretchAssetB}
            stretchView={current.exercise.stretchView}
            animate={engine.status === "running"}
            tappable
            size={228}
            alt={`Stretch — ${current.exercise.name}`}
          />
        </div>

        <div
          key={`timer-${engine.stepIndex}`}
          className="relative mt-3 grid place-items-center animate-[timerIn_280ms_cubic-bezier(0.34,1.45,0.64,1)]"
        >
          <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90" aria-hidden>
            <circle cx="60" cy="60" r="46" fill="none" stroke="rgba(28,25,23,0.08)" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r="46"
              fill="none"
              stroke="#2DD4A8"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={ring}
              strokeDashoffset={ring * (1 - stepProgress)}
              className="transition-[stroke-dashoffset] duration-[260ms] ease-[cubic-bezier(0.34,1.4,0.64,1)]"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <p className="font-display text-[2.15rem] font-semibold leading-none tracking-tight text-ink tabular-nums">
              {seconds}
            </p>
          </div>
        </div>
        <p className="mt-1 text-sm font-semibold text-ink/45">{doseLabel}</p>

        {current.exercise.commonMistake ? (
          <p className="mt-4 max-w-[22rem] rounded-full bg-white px-4 py-2 text-xs font-semibold leading-snug text-ink/60 shadow-[0_3px_0_rgba(28,25,23,0.06)]">
            Tip · {current.exercise.commonMistake}
          </p>
        ) : null}
      </div>

      {skipToast ? (
        <div
          role="status"
          className="pointer-events-none absolute inset-x-5 bottom-[5.5rem] z-30 animate-[popIn_240ms_cubic-bezier(0.34,1.4,0.64,1)]"
        >
          <p className="rounded-full bg-ink px-4 py-3 text-center text-sm font-semibold text-paper shadow-[0_4px_0_#0C0A09]">
            Skipped. No judgment.
          </p>
        </div>
      ) : null}

      <div className="relative z-20 mt-6 grid grid-cols-[1fr_1.4fr] gap-3">
        <Button
          variant="ghost"
          onClick={() => {
            unlockCelebrationAudio();
            flashSkipToast();
            engine.skip();
          }}
        >
          Skip
        </Button>
        <Button
          onClick={() => {
            unlockCelebrationAudio();
            engine.next();
          }}
        >
          {engine.stepIndex === engine.steps.length - 1 ? "Done" : "Next"}
        </Button>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M4 4l10 10M14 4 4 14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="3" y="2" width="3.5" height="12" rx="1" />
      <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M4 2.5v11l9-5.5-9-5.5Z" />
    </svg>
  );
}
