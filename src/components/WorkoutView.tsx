"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { ErrorState } from "@/components/StatusStates";
import { track } from "@/lib/analytics";
import { cueForSetup } from "@/lib/content";
import { isProEntitlement } from "@/lib/entitlements";
import { formatActiveDose, formatClock } from "@/lib/format";
import { resolveProgram } from "@/lib/recommendation";
import {
  clearActiveWorkout,
  ensureAnonymousId,
  newId,
  recordCompletedWorkout,
  saveActiveWorkout,
} from "@/lib/storage";
import { playCelebrationTune, unlockCelebrationAudio } from "@/lib/celebration-tune";
import { useAppState } from "@/lib/use-app-state";
import { useWorkoutEngine } from "@/lib/use-workout-engine";
import type { PrimaryNeed, SetupId, WorkoutSession } from "@/lib/types";

export function WorkoutView({
  programId,
  need,
  setup,
  resumeAt = 0,
}: {
  programId: string;
  need: PrimaryNeed;
  setup: SetupId;
  resumeAt?: number;
}) {
  const router = useRouter();
  const state = useAppState();
  const pro = isProEntitlement(state.entitlement);

  const program = useMemo(
    () => resolveProgram(programId, setup, pro),
    [programId, setup, pro],
  );
  const locked = Boolean(program && program.access === "pro" && !pro);

  const engine = useWorkoutEngine(locked ? null : program, resumeAt);
  const startedAtRef = useRef(new Date().toISOString());
  const sessionIdRef = useRef(newId());
  const recordedRef = useRef(false);
  const startTrackedRef = useRef(false);
  const lastStepRef = useRef(-1);

  useEffect(() => {
    if (locked && program) {
      track("locked_program_clicked", { program_id: program.id, need });
      router.replace(`/app/pro?from=locked&program=${program.id}&need=${need}`);
    }
  }, [locked, program, need, router]);

  useEffect(() => {
    if (locked || !program || startTrackedRef.current) return;
    startTrackedRef.current = true;
    track("reset_started", {
      program_id: program.id,
      need,
      setup,
      duration: program.durationMin,
      generated: Boolean(program.generated),
    });
  }, [locked, program, need, setup]);

  // Persist the step we are on so a refresh offers to pick up where we left off.
  useEffect(() => {
    if (locked || !program || engine.status === "complete") return;
    saveActiveWorkout({
      programId,
      setup,
      need,
      stepIndex: engine.stepIndex,
      startedAt: startedAtRef.current,
      savedAt: new Date().toISOString(),
    });
  }, [locked, program, programId, setup, need, engine.stepIndex, engine.status]);

  const currentExerciseId = engine.current?.exercise.id ?? null;
  const currentStepIndex = engine.stepIndex;
  useEffect(() => {
    if (!currentExerciseId || currentStepIndex === lastStepRef.current) return;
    lastStepRef.current = currentStepIndex;
    track("exercise_started", {
      exercise_id: currentExerciseId,
      program_id: programId,
      step: currentStepIndex + 1,
    });
  }, [currentExerciseId, currentStepIndex, programId]);

  const skippedCount = engine.skippedIds.length;
  const lastSkippedRef = useRef(0);
  useEffect(() => {
    if (skippedCount <= lastSkippedRef.current) return;
    lastSkippedRef.current = skippedCount;
    track("exercise_skipped", {
      exercise_id: engine.skippedIds[skippedCount - 1],
      program_id: programId,
    });
  }, [skippedCount, engine.skippedIds, programId]);

  useEffect(() => {
    if (engine.status !== "complete" || !program || recordedRef.current) return;
    recordedRef.current = true;

    const session: WorkoutSession = {
      sessionId: sessionIdRef.current,
      programId: program.id,
      programName: program.name,
      primaryNeed: need,
      setup,
      durationMin: program.durationMin,
      completedExerciseIds: engine.completedIds,
      skippedExerciseIds: engine.skippedIds,
      elapsedSec: Math.max(1, Math.round(engine.elapsedSec)),
      startedAt: startedAtRef.current,
      finishedAt: new Date().toISOString(),
    };

    const progress = recordCompletedWorkout(session);
    clearActiveWorkout();

    track("reset_completed", {
      program_id: program.id,
      need,
      setup,
      duration: program.durationMin,
      completed_moves: session.completedExerciseIds.length,
      skipped_moves: session.skippedExerciseIds.length,
      total_resets: progress.totalWorkouts,
    });
    if (progress.totalWorkouts === 3) {
      track("third_reset_completed", { program_id: program.id, need });
    }

    if (state.settings.soundEnabled) playCelebrationTune(session.finishedAt);

    // Fire and forget: a failed write must never block the done screen.
    void fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        anonymousId: ensureAnonymousId(),
        email: state.email,
        programId: session.programId,
        primaryNeed: session.primaryNeed,
        setup: session.setup,
        startedAt: session.startedAt,
        completedAt: session.finishedAt,
        durationSeconds: session.elapsedSec,
      }),
    }).catch(() => {});

    router.replace("/app/done");
  }, [
    engine.status,
    engine.completedIds,
    engine.skippedIds,
    engine.elapsedSec,
    program,
    need,
    setup,
    router,
    state.email,
    state.settings.soundEnabled,
  ]);

  const current = engine.current;
  const doseLabel = useMemo(
    () => (current ? formatActiveDose(current) : ""),
    [current],
  );

  if (!program) {
    return (
      <div className="flex min-h-dvh flex-col justify-center px-5">
        <ErrorState
          title="That reset isn't here"
          body="We couldn't build that routine. Head back and pick what's bothering you."
          action={<ButtonLink href="/app">Back to DeskBreak</ButtonLink>}
        />
      </div>
    );
  }

  if (locked || !current) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-5" role="status">
        <CharacterArt pose="ready" size={150} alt="Stretch, ready to go" />
        <p className="text-sm font-semibold text-ink/50">One moment...</p>
      </div>
    );
  }

  const seconds = formatClock(engine.remainingSec);
  const stepProgress =
    current.durationSec > 0
      ? Math.min(1, Math.max(0, 1 - engine.remainingSec / current.durationSec))
      : 0;
  const ring = 2 * Math.PI * 46;
  const cue = cueForSetup(current.exercise, setup);

  return (
    <div className="relative flex min-h-dvh flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.9rem,env(safe-area-inset-top))]">
      <header className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            clearActiveWorkout();
            router.push("/app");
          }}
          className="grid h-12 w-12 place-items-center rounded-full bg-white text-ink shadow-[0_3px_0_rgba(28,25,23,0.06)] transition-transform duration-200 active:translate-y-[2px] active:shadow-none"
          aria-label="Leave this DeskBreak"
        >
          <CloseIcon />
        </button>
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-coral">
            {program.shortLabel}
          </p>
          <p className="text-sm font-semibold text-ink/60">
            {engine.stepIndex + 1} of {engine.steps.length}
          </p>
        </div>
        <button
          type="button"
          onClick={engine.status === "paused" ? engine.resume : engine.pause}
          className="grid h-12 w-12 place-items-center rounded-full bg-white text-ink shadow-[0_3px_0_rgba(28,25,23,0.06)] transition-transform duration-200 active:translate-y-[2px] active:shadow-none"
          aria-label={engine.status === "paused" ? "Resume" : "Pause"}
        >
          {engine.status === "paused" ? <PlayIcon /> : <PauseIcon />}
        </button>
      </header>

      <div
        className="mb-3 h-2 overflow-hidden rounded-full bg-ink/8"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={engine.steps.length}
        aria-valuenow={engine.stepIndex + 1}
        aria-label="Reset progress"
      >
        <div
          className="h-full rounded-full bg-mint transition-[width] duration-[260ms]"
          style={{ width: `${Math.round(engine.progress * 100)}%` }}
        />
      </div>

      <div className="relative flex flex-1 flex-col items-center text-center">
        {engine.status === "paused" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[32px] bg-paper/85 backdrop-blur-[2px]">
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
          key={`${current.exercise.id}-${engine.stepIndex}`}
          className="w-full animate-[stepIn_280ms_cubic-bezier(0.34,1.4,0.64,1)]"
        >
          <h1 className="font-display text-[1.85rem] font-semibold leading-tight text-ink">
            {current.exercise.name}
          </h1>
          {current.side ? (
            <p className="mt-1 text-sm font-semibold text-coral">
              {current.side === "left" ? "Left side" : "Right side"}
            </p>
          ) : current.exercise.tagline ? (
            <p className="mt-1 text-sm font-semibold text-coral">
              {current.exercise.tagline}
            </p>
          ) : null}
          <p className="mt-3 text-[1.05rem] leading-relaxed text-ink/70">{cue}</p>
        </div>

        <div key={current.exercise.id} className="mt-4 animate-[popIn_280ms_cubic-bezier(0.34,1.45,0.64,1)]">
          <CharacterArt
            pose="exercise"
            exerciseId={current.exercise.id}
            setup={setup}
            animate={engine.status === "running"}
            tappable
            size={210}
            alt={`Stretch demonstrating ${current.exercise.name}`}
          />
        </div>

        <div className="relative mt-3 grid place-items-center">
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
              className="transition-[stroke-dashoffset] duration-[260ms]"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            {/* The number carries the meaning; the ring is decoration. */}
            <p
              className="font-display text-[2.15rem] font-semibold leading-none tracking-tight text-ink tabular-nums"
              aria-live="off"
            >
              {seconds}
            </p>
          </div>
          <span className="sr-only" aria-live="polite">
            {`${current.exercise.name}, ${Math.ceil(engine.remainingSec)} seconds left`}
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold text-ink/45">{doseLabel}</p>

        {current.exercise.feelIt ? (
          <p className="mt-4 max-w-[22rem] rounded-full bg-white px-4 py-2 text-xs font-semibold leading-snug text-ink/60 shadow-[0_3px_0_rgba(28,25,23,0.06)]">
            Feel it: {current.exercise.feelIt}
          </p>
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-[1fr_1.4fr] gap-3">
        <Button
          variant="ghost"
          onClick={() => {
            unlockCelebrationAudio();
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

/** Offered after a refresh, so nobody loses a reset they were halfway through. */
export function ResumePrompt({
  stepIndex,
  onResume,
  onRestart,
}: {
  stepIndex: number;
  onResume: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col justify-center px-5">
      <div className="mb-6 flex justify-center">
        <CharacterArt pose="ready" size={170} alt="Stretch, ready to go" />
      </div>
      <h1 className="text-center font-display text-[2rem] font-semibold leading-tight text-ink">
        Continue your DeskBreak?
      </h1>
      <p className="mt-3 text-center text-ink/60">
        You were on move {stepIndex + 1}.
      </p>
      <div className="mt-8 grid gap-3">
        <Button onClick={onResume}>Pick up where I left off</Button>
        <Button variant="ghost" onClick={onRestart}>
          Start over
        </Button>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M4 4l10 10M14 4 4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
