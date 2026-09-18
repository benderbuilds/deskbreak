"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { ErrorState } from "@/components/StatusStates";
import { SwapSheet, type SwapMode } from "@/components/SwapSheet";
import { track, recommendationProperties } from "@/lib/analytics";
import {
  playAdvanceChime,
  playCountdownTick,
  speak,
  stopSpeaking,
  unlockAudio,
  vibrateCue,
} from "@/lib/audio-cues";
import { cueForSetup, effectiveSetup } from "@/lib/content";
import { canAccessDuration, isProEntitlement } from "@/lib/entitlements";
import { formatActiveDose, formatClock } from "@/lib/format";
import { STOP_RULE } from "@/lib/constants";
import {
  discomfortReplacement,
  resolveProgram,
  swapCandidates,
  timeOfDayNow,
} from "@/lib/recommendation";
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
import { useAppState } from "@/lib/use-app-state";
import { useWakeLock } from "@/lib/use-wake-lock";
import { useWorkoutEngine } from "@/lib/use-workout-engine";
import type {
  DiscomfortReason,
  Exercise,
  PrimaryNeed,
  Program,
  SessionSource,
  SetupRequest,
  WorkoutSession,
} from "@/lib/types";

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
  // The move "Doesn't feel right" took out, so the sheet can name it.
  const [swappedFrom, setSwappedFrom] = useState<Exercise | null>(null);
  const [announcement, setAnnouncement] = useState("");

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
    if (!first && state.settings.soundEnabled) {
      playAdvanceChime();
      vibrateCue();
    }
    const side = current.side ? `, ${current.side} side` : "";
    setAnnouncement(
      `Now: ${current.exercise.name}${side}. ${Math.round(current.durationSec)} seconds.`,
    );
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
        if (engine.status === "running") engine.next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (engine.status === "running") engine.previous();
      } else if (event.key.toLowerCase() === "s" && engine.status === "running") {
        event.preventDefault();
        openSwap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine, sheet, openSwap]);

  function doesntFeelRight() {
    if (!current || !program) return;
    const original = current.exercise;
    // A different body area or a breath, never a neighbour of the same region.
    const swapTo = discomfortReplacement(original.id, liveProgram(program, engine.steps), context);
    track("exercise_uncomfortable", {
      exercise_id: original.id,
      program_id: programId,
      swapped_to: swapTo?.id ?? null,
      recommendation_id: recommendationId ?? undefined,
    });
    if (swapTo) engine.swap(swapTo.id, "unspecified");
    else engine.skip("unspecified");
    // After the change, so the replacement waits on the sheet at full time.
    engine.pause();
    setSwappedFrom(original);
    setReplacement(swapTo);
    setSheet("discomfort");
  }

  function reportReason(reason: DiscomfortReason) {
    if (!swappedFrom || !program) return;
    engine.setDiscomfortReason(reason);
    track("exercise_uncomfortable", {
      exercise_id: swappedFrom.id,
      program_id: programId,
      reason,
      stage: "reason",
    });
    if (reason === "painful") {
      // Nothing else from that area for the rest of this reset.
      engine.leaveAreaAlone(swappedFrom.bodyArea, (exerciseId, taken) =>
        discomfortReplacement(exerciseId, { ...program, steps: [...taken].map((id) => ({ exerciseId: id, durationSec: 0 })) }, context),
      );
    }
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
    setSwappedFrom(null);
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
  const paused = engine.status === "paused";
  const isLast = engine.stepIndex === engine.steps.length - 1;
  const upcoming = engine.steps[engine.stepIndex + 1] ?? null;
  const upNext = !upcoming
    ? "Last move"
    : upcoming.exercise.id === current.exercise.id && upcoming.side
      ? `Up next: ${upcoming.side === "left" ? "Left" : "Right"} side`
      : `Up next: ${upcoming.exercise.name}`;

  return (
    <div className="relative flex min-h-dvh flex-col pt-[max(0.9rem,env(safe-area-inset-top))]">
      <p className="sr-only" aria-live="polite" role="status">
        {paused && !sheet ? "Paused" : announcement}
      </p>

      <div className="px-5 lg:px-8">
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
            <p className="text-xs font-semibold text-ink/60 tabular-nums">
              {formatClock(sessionRemaining)} remaining
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={engine.previous}
              disabled={paused || engine.stepIndex === 0}
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
              disabled={paused}
              className="grid h-11 w-11 place-items-center rounded-full text-ink/60 transition-colors hover:bg-ink/6 disabled:opacity-30"
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
      </div>

      <div className="relative flex flex-1 flex-col items-center px-5 text-center lg:mx-auto lg:grid lg:w-full lg:max-w-[1100px] lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-10 lg:px-8 lg:text-left">
        {paused && !sheet ? (
          // The whole field resumes; the bottom bar holds the only Resume button.
          <button
            type="button"
            onClick={() => {
              unlockAudio();
              engine.resume();
            }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[28px] bg-paper/85 backdrop-blur-[2px]"
            aria-label="Paused. Tap to resume"
          >
            <span className="font-display text-3xl font-semibold text-ink">Paused</span>
            <span className="mt-2 text-sm text-ink/65">Tap anywhere to resume.</span>
          </button>
        ) : null}

        <div
          key={`${current.exercise.id}-${engine.stepIndex}`}
          className="animate-step-in mt-3 flex w-full justify-center lg:mt-0"
        >
          <CharacterArt
            pose="exercise"
            exerciseId={current.exercise.id}
            setup={stepSetup}
            animate={engine.status === "running"}
            mirror={current.side === "right"}
            size={280}
            alt={`Stretch demonstrating ${current.exercise.name}${current.side ? `, ${current.side} side` : ""}`}
            className="max-h-[28vh] w-auto lg:max-h-[56vh]"
          />
        </div>

        <div className="w-full">
          <div key={`copy-${current.exercise.id}-${engine.stepIndex}`} className="animate-step-in">
            {current.side ? (
              <p className="mt-2 text-2xl font-bold text-ink lg:mt-0">
                {current.side === "left" ? "Left side" : "Right side"}
              </p>
            ) : null}
            <h1 className="mt-1 font-display text-[1.6rem] font-semibold leading-tight text-ink lg:text-[2.2rem]">
              {current.exercise.name}
            </h1>
          </div>

          <p
            className="mt-1 font-sans text-[clamp(4rem,18vw,7.5rem)] font-bold leading-none tracking-tight text-ink tabular-nums"
            aria-hidden
          >
            {formatClock(engine.remainingSec)}
          </p>
          <p className="mt-1 text-[15px] font-semibold text-ink/65">{upNext}</p>

          <div key={`cue-${current.exercise.id}-${engine.stepIndex}`} className="animate-step-in">
            <p className="mt-4 text-[1.05rem] leading-relaxed text-ink/80">{cue}</p>
            <p className="mt-2 text-sm font-semibold text-ink/60">{doseLabel}</p>
            {current.exercise.feelIt ? (
              <p className="mt-2 text-sm leading-snug text-ink/60">You should feel {current.exercise.feelIt}.</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 mt-4 border-t border-ink/8 bg-paper/95 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-[2px]">
        <div className="mx-auto grid w-full max-w-[560px] gap-1">
          <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
            <Button
              onClick={() => {
                unlockAudio();
                engine.toggle();
              }}
              aria-keyshortcuts="Space"
            >
              {paused ? "Resume" : "Pause"}
            </Button>
            <Button variant="secondary" onClick={openSwap} disabled={paused} aria-keyshortcuts="S">
              Swap
            </Button>
            <Button
              variant="secondary"
              disabled={paused}
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
            className="min-h-11 text-sm font-semibold text-ink/65 transition-colors hover:text-ink"
          >
            Doesn&apos;t feel right
          </button>
          <p className="text-center text-xs leading-snug text-ink/65">{STOP_RULE}</p>
        </div>
      </div>

      {sheet && current ? (
        <SwapSheet
          mode={sheet}
          current={sheet === "discomfort" && swappedFrom ? swappedFrom : current.exercise}
          candidates={candidates}
          replacement={replacement}
          onSwap={swapTo}
          onReason={reportReason}
          onClose={closeSheet}
        />
      ) : null}
    </div>
  );
}

/** The routine as it stands now, after any swaps, so replacements never repeat a move. */
function liveProgram(program: Program, steps: { exercise: Exercise }[]): Program {
  return { ...program, steps: steps.map((step) => ({ exerciseId: step.exercise.id, durationSec: 0 })) };
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
