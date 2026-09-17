"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { ErrorState } from "@/components/StatusStates";
import { SwapSheet, type SwapMode } from "@/components/SwapSheet";
import { track, recommendationProperties } from "@/lib/analytics";
import { playAdvanceChime, playCountdownTick, speak, stopSpeaking, unlockAudio } from "@/lib/audio-cues";
import { cueForSetup, effectiveSetup } from "@/lib/content";
import { canAccessDuration, isProEntitlement } from "@/lib/entitlements";
import { formatActiveDose, formatClock } from "@/lib/format";
import { resolveProgram, swapCandidates, timeOfDayNow } from "@/lib/recommendation";
import {
  clearActiveWorkout,
  ensureAnonymousId,
  getStoredRecommendation,
  newId,
  personalizationSignals,
  recordCompletedWorkout,
  saveActiveWorkout,
  todayKey,
} from "@/lib/storage";
import { playCelebrationTune } from "@/lib/celebration-tune";
import { useAppState } from "@/lib/use-app-state";
import { useWakeLock } from "@/lib/use-wake-lock";
import { useWorkoutEngine } from "@/lib/use-workout-engine";
import type { Exercise, PrimaryNeed, SessionSource, SetupRequest, WorkoutSession } from "@/lib/types";

export function WorkoutView({
  programId,
  need,
  setup,
  resumeAt = 0,
  recommendationId = null,
  source = "unknown",
  plannedBreakId = null,
}: {
  programId: string;
  need: PrimaryNeed;
  setup: SetupRequest;
  resumeAt?: number;
  recommendationId?: string | null;
  source?: SessionSource;
  plannedBreakId?: string | null;
}) {
  const router = useRouter();
  const state = useAppState();
  const pro = isProEntitlement(state.entitlement);

  const stored = useMemo(() => getStoredRecommendation(recommendationId), [recommendationId]);
  const program = useMemo(
    () =>
      resolveProgram(programId, setup, pro, {
        constraints: state.constraints,
        signals: personalizationSignals(state),
        stored,
      }),
    // Signals change as sessions complete; the routine must not change mid-workout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [programId, setup, pro, stored],
  );
  const locked = Boolean(
    program &&
      ((program.access === "pro" && !pro) || !canAccessDuration(program.durationMin, state.entitlement)),
  );

  const engine = useWorkoutEngine(locked ? null : program, resumeAt, {
    autoAdvance: state.settings.autoAdvance,
  });
  useWakeLock(engine.status === "running");

  const startedAtRef = useRef(new Date().toISOString());
  const sessionIdRef = useRef(newId());
  const recordedRef = useRef(false);
  const startTrackedRef = useRef(false);
  const lastStepRef = useRef(-1);
  const lastWholeSecRef = useRef(-1);
  const [sheet, setSheet] = useState<SwapMode | null>(null);
  const [replacement, setReplacement] = useState<Exercise | null>(null);

  const context = useMemo(
    () => ({
      need,
      setup,
      durationMinutes: program?.durationMin ?? 3,
      pro,
      constraints: state.constraints,
      signals: personalizationSignals(state),
      timeOfDay: timeOfDayNow(),
      seed: todayKey(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [need, setup, program?.durationMin, pro, state.constraints],
  );

  useEffect(() => {
    if (locked && program) {
      track("locked_program_clicked", { program_id: program.id, need, source });
      router.replace(`/app/pro?from=locked&program=${program.id}&need=${need}`);
    }
  }, [locked, program, need, router, source]);

  useEffect(() => {
    if (locked || !program || startTrackedRef.current) return;
    startTrackedRef.current = true;
    track("reset_started", {
      ...recommendationProperties({
        recommendationId,
        algorithmVersion: stored?.algorithmVersion ?? null,
        need,
        duration: program.durationMin,
        setup,
        programId: program.id,
        source,
        generated: Boolean(program.generated),
      }),
      resumed: resumeAt > 0,
    });
    if (plannedBreakId) track("planned_break_started", { break_id: plannedBreakId, source });
  }, [locked, program, need, setup, source, recommendationId, stored, resumeAt, plannedBreakId]);

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
      recommendationId,
      source,
      plannedBreakId,
    });
  }, [locked, program, programId, setup, need, engine.stepIndex, engine.status, recommendationId, source, plannedBreakId]);

  // Per-move instrumentation, chime and spoken cue on every new step.
  const current = engine.current;
  const currentExerciseId = current?.exercise.id ?? null;
  const currentStepIndex = engine.stepIndex;
  useEffect(() => {
    if (!currentExerciseId || !current || currentStepIndex === lastStepRef.current) return;
    const first = lastStepRef.current === -1;
    lastStepRef.current = currentStepIndex;
    lastWholeSecRef.current = -1;
    track("exercise_started", {
      exercise_id: currentExerciseId,
      program_id: programId,
      step: currentStepIndex + 1,
      recommendation_id: recommendationId ?? undefined,
    });
    if (!first && state.settings.soundEnabled) playAdvanceChime();
    if (state.settings.spokenCues) {
      speak(`${current.exercise.name}. ${cueForSetup(current.exercise, setup)}`);
    }
  }, [currentExerciseId, currentStepIndex, current, programId, recommendationId, setup, state.settings.soundEnabled, state.settings.spokenCues]);

  // Countdown ticks for the last three seconds of every move.
  useEffect(() => {
    if (engine.status !== "running" || !state.settings.soundEnabled) return;
    const whole = Math.ceil(engine.remainingSec);
    if (whole === lastWholeSecRef.current) return;
    lastWholeSecRef.current = whole;
    if (whole > 0 && whole <= 3) playCountdownTick();
  }, [engine.remainingSec, engine.status, state.settings.soundEnabled]);

  useEffect(() => () => stopSpeaking(), []);

  const candidates = current && program ? swapCandidates(current.exercise.id, program, context) : [];

  const openSwap = useCallback(() => {
    if (!current) return;
    setSheet("swap");
    engine.pause();
  }, [current, engine]);

  // Keyboard shortcuts. Desktop is a first-class target.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (sheet) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        unlockAudio();
        engine.toggle();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        engine.next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        engine.previous();
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        openSwap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine, sheet, openSwap]);

  function doesntFeelRight() {
    if (!current) return;
    const swapTo = candidates[0] ?? null;
    track("exercise_uncomfortable", {
      exercise_id: current.exercise.id,
      program_id: programId,
      swapped_to: swapTo?.id ?? null,
      recommendation_id: recommendationId ?? undefined,
    });
    if (swapTo) {
      engine.swap(swapTo.id, "unspecified");
      setReplacement(swapTo);
    } else {
      engine.skip();
      setReplacement(null);
    }
    setSheet("discomfort");
    engine.pause();
  }

  function swapTo(exercise: Exercise) {
    if (!current) return;
    track("exercise_swapped", {
      exercise_id: current.exercise.id,
      swapped_to: exercise.id,
      program_id: programId,
      recommendation_id: recommendationId ?? undefined,
    });
    engine.swap(exercise.id);
    setSheet(null);
    engine.resume();
  }

  function closeSheet() {
    setSheet(null);
    setReplacement(null);
    engine.resume();
  }

  const skippedCount = engine.skippedIds.length;
  const lastSkippedRef = useRef(0);
  useEffect(() => {
    if (skippedCount <= lastSkippedRef.current) return;
    lastSkippedRef.current = skippedCount;
    track("exercise_skipped", {
      exercise_id: engine.skippedIds[skippedCount - 1],
      program_id: programId,
      recommendation_id: recommendationId ?? undefined,
    });
  }, [skippedCount, engine.skippedIds, programId, recommendationId]);

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
      exercises: engine.records,
      elapsedSec: Math.max(1, Math.round(engine.elapsedSec)),
      startedAt: startedAtRef.current,
      finishedAt: new Date().toISOString(),
      recommendationId,
      algorithmVersion: stored?.algorithmVersion ?? null,
      source,
      plannedBreakId,
      generated: Boolean(program.generated),
    };

    const progress = recordCompletedWorkout(session);
    clearActiveWorkout();

    const props = recommendationProperties({
      recommendationId,
      algorithmVersion: session.algorithmVersion,
      need,
      duration: program.durationMin,
      setup,
      programId: program.id,
      source,
      generated: session.generated,
    });
    for (const record of session.exercises) {
      if (record.completed) track("exercise_completed", { exercise_id: record.exerciseId, program_id: program.id, actual_sec: record.actualSec });
    }
    track("recommendation_completed", {
      ...props,
      completed_moves: session.completedExerciseIds.length,
      skipped_moves: session.skippedExerciseIds.length,
      swapped_moves: session.exercises.filter((r) => r.swapped).length,
      total_resets: progress.totalWorkouts,
    });
    track("reset_completed", { ...props, total_resets: progress.totalWorkouts });
    if (plannedBreakId) track("planned_break_completed", { break_id: plannedBreakId });
    if (progress.totalWorkouts === 3) track("third_reset_completed", { program_id: program.id, need });

    if (state.settings.soundEnabled) playCelebrationTune(session.finishedAt);

    // Fire and forget: a failed write must never block the done screen.
    void fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        anonymousId: ensureAnonymousId(),
        programId: session.programId,
        programName: session.programName,
        primaryNeed: session.primaryNeed,
        setup: session.setup,
        durationMinutes: session.durationMin,
        startedAt: session.startedAt,
        completedAt: session.finishedAt,
        durationSeconds: session.elapsedSec,
        recommendationId: session.recommendationId,
        algorithmVersion: session.algorithmVersion,
        source: session.source,
        plannedBreakId: session.plannedBreakId,
        generated: session.generated,
        exercises: session.exercises,
      }),
    }).catch(() => {});

    router.replace("/app/done");
  }, [
    engine.status,
    engine.completedIds,
    engine.skippedIds,
    engine.records,
    engine.elapsedSec,
    program,
    need,
    setup,
    router,
    state.email,
    state.account.email,
    state.settings.soundEnabled,
    recommendationId,
    stored,
    source,
    plannedBreakId,
  ]);

  const doseLabel = useMemo(() => (current ? formatActiveDose(current) : ""), [current]);

  if (!program) {
    return (
      <div className="flex min-h-dvh flex-col justify-center px-5">
        <ErrorState
          title="That reset isn't here"
          body="We couldn't build that routine. Head back and start a fresh one."
          action={<ButtonLink href="/app">Back to Today</ButtonLink>}
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

  const stepSetup = effectiveSetup(current.exercise, setup);
  const cue = cueForSetup(current.exercise, setup);
  const totalSec = engine.steps.reduce((sum, step) => sum + step.durationSec, 0);
  const sessionRemaining = Math.max(0, totalSec * (1 - engine.progress));
  const stepProgress =
    current.durationSec > 0 ? Math.min(1, Math.max(0, 1 - engine.remainingSec / current.durationSec)) : 0;
  const ring = 2 * Math.PI * 34;
  const paused = engine.status === "paused";
  const isLast = engine.stepIndex === engine.steps.length - 1;

  return (
    <div className="relative flex min-h-dvh flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.9rem,env(safe-area-inset-top))] lg:px-8">
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            track("session_abandoned", { program_id: program.id, step: engine.stepIndex + 1, source });
            clearActiveWorkout();
            router.push("/app");
          }}
          className="grid h-11 w-11 place-items-center rounded-full bg-ink/6 text-ink transition-colors hover:bg-ink/10"
          aria-label="Leave this DeskBreak"
        >
          <CloseIcon />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-ink">
            {engine.stepIndex + 1} of {engine.steps.length}
          </p>
          <p className="text-xs font-semibold text-ink/50 tabular-nums">
            {formatClock(sessionRemaining)} remaining
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={engine.previous}
            disabled={engine.stepIndex === 0}
            className="grid h-11 w-11 place-items-center rounded-full text-ink/60 transition-colors hover:bg-ink/6 disabled:opacity-30"
            aria-label="Previous move"
            title="Previous (←)"
          >
            <ArrowIcon direction="left" />
          </button>
          <button
            type="button"
            onClick={() => {
              unlockAudio();
              engine.next();
            }}
            className="grid h-11 w-11 place-items-center rounded-full text-ink/60 transition-colors hover:bg-ink/6"
            aria-label={isLast ? "Finish" : "Next move"}
            title="Next (→)"
          >
            <ArrowIcon direction="right" />
          </button>
        </div>
      </header>

      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/8"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={engine.steps.length}
        aria-valuenow={engine.stepIndex + 1}
        aria-label="Reset progress"
      >
        <div
          className="h-full rounded-full bg-mint transition-[width] duration-200"
          style={{ width: `${Math.round(engine.progress * 100)}%` }}
        />
      </div>

      <div className="relative flex flex-1 flex-col items-center text-center lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-10 lg:text-left">
        {paused && !sheet ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[28px] bg-paper/85 backdrop-blur-[2px]">
            <p className="font-display text-3xl font-semibold text-ink">Paused</p>
            <p className="mt-2 max-w-[16rem] text-sm text-ink/55">No rush. Resume when you&apos;re ready.</p>
            <div className="mt-6 w-full max-w-[220px]">
              <Button onClick={engine.resume}>Resume</Button>
            </div>
          </div>
        ) : null}

        <div key={`${current.exercise.id}-${engine.stepIndex}`} className="animate-step-in mt-4 flex w-full justify-center lg:mt-0">
          <CharacterArt
            pose="exercise"
            exerciseId={current.exercise.id}
            setup={stepSetup}
            animate={engine.status === "running"}
            size={280}
            alt={`Stretch demonstrating ${current.exercise.name}`}
            className="max-h-[38vh] w-auto lg:max-h-[52vh]"
          />
        </div>

        <div className="w-full">
          <div key={`copy-${current.exercise.id}-${engine.stepIndex}`} className="animate-step-in">
            <h1 className="mt-3 font-display text-[1.9rem] font-semibold leading-tight text-ink lg:mt-0 lg:text-[2.2rem]">
              {current.exercise.name}
            </h1>
            {current.side ? (
              <p className="mt-1 text-sm font-semibold text-coral">
                {current.side === "left" ? "Left side" : "Right side"}
              </p>
            ) : null}
            <p className="mt-3 text-[1.08rem] leading-relaxed text-ink/80">{cue}</p>
            <p className="mt-2 text-sm font-semibold text-ink/55">{doseLabel}</p>
            {current.exercise.feelIt ? (
              <p className="mt-3 text-sm leading-snug text-ink/55">
                You should feel {current.exercise.feelIt}.
              </p>
            ) : null}
          </div>

          <div className="mt-4 flex items-center justify-center gap-3 lg:justify-start">
            <div className="relative grid place-items-center">
              <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90" aria-hidden>
                <circle cx="42" cy="42" r="34" fill="none" stroke="rgba(28,25,23,0.08)" strokeWidth="6" />
                <circle
                  cx="42"
                  cy="42"
                  r="34"
                  fill="none"
                  stroke="#2DD4A8"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={ring}
                  strokeDashoffset={ring * (1 - stepProgress)}
                  className="transition-[stroke-dashoffset] duration-200"
                />
              </svg>
              <p
                className="absolute font-display text-[1.6rem] font-semibold leading-none tracking-tight text-ink tabular-nums"
                aria-live="off"
              >
                {formatClock(engine.remainingSec)}
              </p>
              <span className="sr-only" aria-live="polite">
                {`${current.exercise.name}, ${Math.ceil(engine.remainingSec)} seconds left`}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-2.5 lg:mx-auto lg:w-full lg:max-w-[520px]">
        <Button
          onClick={() => {
            unlockAudio();
            engine.toggle();
          }}
          aria-keyshortcuts="Space"
        >
          {paused ? "Resume" : "Pause"}
        </Button>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" onClick={openSwap} aria-keyshortcuts="S">
            Swap
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              unlockAudio();
              engine.skip();
            }}
          >
            Skip
          </Button>
        </div>
        <button
          type="button"
          onClick={doesntFeelRight}
          className="min-h-11 text-sm font-semibold text-ink/55 transition-colors hover:text-ink"
        >
          Doesn&apos;t feel right
        </button>
      </div>

      {sheet && current ? (
        <SwapSheet
          mode={sheet}
          current={sheet === "discomfort" && replacement ? { ...current.exercise, name: current.exercise.name } : current.exercise}
          candidates={candidates}
          replacement={replacement}
          onSwap={swapTo}
          onReason={(reason) => {
            engine.setDiscomfortReason(reason);
            track("exercise_uncomfortable", {
              exercise_id: current.exercise.id,
              program_id: programId,
              reason,
              stage: "reason",
            });
          }}
          onClose={closeSheet}
        />
      ) : null}
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
      <p className="mt-3 text-center text-ink/60">You were on move {stepIndex + 1}.</p>
      <div className="mt-8 grid gap-3">
        <Button onClick={onResume}>Pick up where I left off</Button>
        <Button variant="secondary" onClick={onRestart}>
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

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden className={direction === "left" ? "rotate-180" : ""}>
      <path d="M4 9h10m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
