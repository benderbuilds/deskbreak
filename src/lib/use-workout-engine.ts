"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getExercise, getExercisesById } from "./content";
import { resolveProgramSteps, type ResolvedStep } from "./format";
import type { BodyArea, DiscomfortReason, Exercise, Program, SessionExerciseRecord } from "./types";

export type WorkoutStatus = "running" | "paused" | "complete";

export type WorkoutEngine = {
  status: WorkoutStatus;
  steps: ResolvedStep[];
  current: ResolvedStep | null;
  stepIndex: number;
  remainingSec: number;
  elapsedSec: number;
  progress: number;
  completedIds: string[];
  skippedIds: string[];
  records: SessionExerciseRecord[];
  pause: () => void;
  resume: () => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  /**
   * Skips the current move. Pass a discomfort reason when "Doesn't feel right"
   * found no replacement, so the move is still suppressed next time.
   */
  skip: (discomfort?: DiscomfortReason | "unspecified") => void;
  /** Replaces the current move (both sides, if it is a per-side hold). */
  swap: (exerciseId: string, discomfort?: DiscomfortReason | "unspecified" | null) => void;
  /** Attaches a reason to the most recent "doesn't feel right" swap. */
  setDiscomfortReason: (reason: DiscomfortReason) => void;
  /**
   * After "Painful": replaces every upcoming move whose main area is `area`
   * with whatever `pick` returns (e.g. discomfortReplacement), or drops it
   * when `pick` returns null. `taken` holds ids already in the routine.
   */
  leaveAreaAlone: (area: BodyArea, pick: (exerciseId: string, taken: Set<string>) => Exercise | null) => void;
  finishNow: () => void;
};

const TICK_MS = 200;

type StepOutcome = {
  actualMs: number;
  completed: boolean;
  skipped: boolean;
  swapped: boolean;
  swappedToExerciseId: string | null;
  discomfortReported: boolean;
  discomfortReason: DiscomfortReason | null;
};

/**
 * The timer behind every workout.
 *
 * Time is measured against wall-clock timestamps rather than by counting
 * ticks, so a tab that gets throttled in the background, a laptop that sleeps,
 * or a phone that locks all come back to the right number of seconds. Pausing
 * simply stops the clock; resuming restarts it from where it left off.
 */
export function useWorkoutEngine(
  program: Program | null,
  startAtIndex = 0,
  options: { autoAdvance?: boolean } = {},
): WorkoutEngine {
  const autoAdvance = options.autoAdvance ?? true;
  const [steps, setSteps] = useState<ResolvedStep[]>(() =>
    program ? resolveProgramSteps(program, getExercisesById()) : [],
  );
  const programIdRef = useRef(program?.id ?? null);

  // A different program remounts the sequence; the same program never does.
  useEffect(() => {
    if (!program || program.id === programIdRef.current) return;
    programIdRef.current = program.id;
    setSteps(resolveProgramSteps(program, getExercisesById()));
  }, [program]);

  const initialIndex = Math.min(Math.max(0, startAtIndex), Math.max(0, steps.length - 1));

  const [status, setStatus] = useState<WorkoutStatus>("running");
  const [stepIndex, setStepIndex] = useState(initialIndex);
  const [remainingMs, setRemainingMs] = useState((steps[initialIndex]?.durationSec ?? 0) * 1000);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [outcomes, setOutcomes] = useState<Record<number, StepOutcome>>({});

  // Clock state lives in refs so the interval never closes over stale values.
  // Zero until mounted; the first effect stamps the real start time.
  const stepStartedAtRef = useRef<number>(0);
  const stepConsumedMsRef = useRef<number>(0);
  const sessionStartedAtRef = useRef<number>(0);
  const sessionConsumedMsRef = useRef<number>(0);
  const statusRef = useRef(status);
  const stepIndexRef = useRef(stepIndex);
  const stepsRef = useRef(steps);
  const advancingRef = useRef(false);
  const lastSwapIndexRef = useRef<number | null>(null);

  useEffect(() => {
    statusRef.current = status;
    stepIndexRef.current = stepIndex;
    stepsRef.current = steps;
  }, [status, stepIndex, steps]);

  useEffect(() => {
    const now = Date.now();
    if (!stepStartedAtRef.current) stepStartedAtRef.current = now;
    if (!sessionStartedAtRef.current) sessionStartedAtRef.current = now;
  }, []);

  const stepElapsedMs = useCallback((): number => {
    if (statusRef.current !== "running" || !stepStartedAtRef.current) return stepConsumedMsRef.current;
    return stepConsumedMsRef.current + (Date.now() - stepStartedAtRef.current);
  }, []);

  const sessionElapsedMs = useCallback((): number => {
    if (statusRef.current !== "running" || !sessionStartedAtRef.current) return sessionConsumedMsRef.current;
    return sessionConsumedMsRef.current + (Date.now() - sessionStartedAtRef.current);
  }, []);

  const startStep = useCallback((index: number) => {
    const step = stepsRef.current[index];
    if (!step) {
      setStatus("complete");
      return;
    }
    advancingRef.current = false;
    stepConsumedMsRef.current = 0;
    stepStartedAtRef.current = Date.now();
    setStepIndex(index);
    setRemainingMs(step.durationSec * 1000);
    if (statusRef.current !== "paused") setStatus("running");
  }, []);

  /** Merges `patch` into a step's outcome and adds `addMs` of time actually spent on it. */
  const recordOutcome = useCallback(
    (index: number, patch: Partial<StepOutcome>, addMs = 0) => {
      setOutcomes((current) => {
        const base: StepOutcome = current[index] ?? {
          actualMs: 0,
          completed: false,
          skipped: false,
          swapped: false,
          swappedToExerciseId: null,
          discomfortReported: false,
          discomfortReason: null,
        };
        return { ...current, [index]: { ...base, ...patch, actualMs: base.actualMs + addMs } };
      });
    },
    [],
  );

  const finishCurrent = useCallback(
    (mode: "complete" | "skip") => {
      if (advancingRef.current) return;
      advancingRef.current = true;

      const index = stepIndexRef.current;
      const current = stepsRef.current[index];
      if (!current) {
        setStatus("complete");
        return;
      }

      const actual = stepElapsedMs();
      recordOutcome(
        index,
        {
          completed: mode === "complete",
          skipped: mode === "skip",
        },
        actual,
      );

      let nextIndex = index + 1;
      if (mode === "skip") {
        // Skipping the left side skips the right side too; nobody wants half.
        const paired = stepsRef.current[nextIndex];
        if (current.side === "left" && paired?.side === "right" && paired.exercise.id === current.exercise.id) {
          recordOutcome(nextIndex, { skipped: true });
          nextIndex += 1;
        }
      }

      if (nextIndex >= stepsRef.current.length) {
        sessionConsumedMsRef.current = sessionElapsedMs();
        // The recorded session time is the time actually spent, to the end.
        setElapsedMs(sessionConsumedMsRef.current);
        setRemainingMs(0);
        setStatus("complete");
        return;
      }
      startStep(nextIndex);
    },
    [recordOutcome, startStep, stepElapsedMs, sessionElapsedMs],
  );

  // The clock. Reads timestamps; never trusts how many times it has fired.
  useEffect(() => {
    if (status !== "running") return;
    const tick = () => {
      const step = stepsRef.current[stepIndexRef.current];
      if (!step) return;
      const remaining = step.durationSec * 1000 - stepElapsedMs();
      setElapsedMs(sessionElapsedMs());
      if (remaining <= 0) {
        setRemainingMs(0);
        if (autoAdvance) finishCurrent("complete");
        else setStatus("paused");
        return;
      }
      setRemainingMs(remaining);
    };
    tick();
    const id = window.setInterval(tick, TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status, autoAdvance, finishCurrent, stepElapsedMs, sessionElapsedMs]);

  const pause = useCallback(() => {
    if (statusRef.current !== "running") return;
    stepConsumedMsRef.current = stepElapsedMs();
    sessionConsumedMsRef.current = sessionElapsedMs();
    setStatus("paused");
  }, [stepElapsedMs, sessionElapsedMs]);

  const resume = useCallback(() => {
    if (statusRef.current !== "paused") return;
    const now = Date.now();
    stepStartedAtRef.current = now;
    sessionStartedAtRef.current = now;
    const step = stepsRef.current[stepIndexRef.current];
    // Resuming a move that ran out (auto-advance off) moves on rather than
    // sitting on zero.
    if (step && step.durationSec * 1000 - stepConsumedMsRef.current <= 0) {
      setStatus("running");
      finishCurrent("complete");
      return;
    }
    setStatus("running");
  }, [finishCurrent]);

  const toggle = useCallback(() => {
    if (statusRef.current === "running") pause();
    else if (statusRef.current === "paused") resume();
  }, [pause, resume]);

  const next = useCallback(() => finishCurrent("complete"), [finishCurrent]);
  const skip = useCallback(
    (discomfort?: DiscomfortReason | "unspecified") => {
      if (discomfort) {
        const index = stepIndexRef.current;
        lastSwapIndexRef.current = index;
        recordOutcome(index, {
          discomfortReported: true,
          discomfortReason: discomfort === "unspecified" ? null : discomfort,
        });
      }
      finishCurrent("skip");
    },
    [finishCurrent, recordOutcome],
  );

  const previous = useCallback(() => {
    const index = stepIndexRef.current;
    if (index <= 0) {
      startStep(0);
      return;
    }
    // Going back re-opens the previous move; whatever it had recorded is undone.
    setOutcomes((current) => {
      const copy = { ...current };
      delete copy[index - 1];
      delete copy[index];
      return copy;
    });
    startStep(index - 1);
  }, [startStep]);

  const swap = useCallback(
    (exerciseId: string, discomfort: DiscomfortReason | "unspecified" | null = null) => {
      const index = stepIndexRef.current;
      const current = stepsRef.current[index];
      const replacement = getExercise(exerciseId);
      if (!current || !replacement) return;

      const original = current.exercise;
      const reason = discomfort && discomfort !== "unspecified" ? discomfort : null;
      // Time already spent on the move being replaced still counts.
      const spentMs = stepElapsedMs();

      setSteps((all) => {
        const next = [...all];
        // A per-side hold occupies two steps; both go.
        const isPairStart =
          current.side === "left" &&
          next[index + 1]?.side === "right" &&
          next[index + 1]?.exercise.id === original.id;
        const span = isPairStart ? 2 : 1;
        const totalSec = next.slice(index, index + span).reduce((sum, step) => sum + step.durationSec, 0);
        const replacementStep: ResolvedStep = {
          index,
          step: { exerciseId: replacement.id, durationSec: totalSec, dose: replacement.defaultDose, phase: current.step.phase },
          exercise: replacement,
          durationSec: totalSec,
          dose: replacement.defaultDose,
          side: undefined,
          // Outcomes (and discomfort) belong to the move that was planned.
          originalExerciseId: current.originalExerciseId ?? original.id,
        };
        next.splice(index, span, replacementStep);
        return next.map((step, i) => ({ ...step, index: i }));
      });

      lastSwapIndexRef.current = index;
      recordOutcome(
        index,
        {
          swapped: true,
          swappedToExerciseId: replacement.id,
          discomfortReported: Boolean(discomfort),
          discomfortReason: reason,
        },
        spentMs,
      );

      // Restart the clock for the new move.
      stepConsumedMsRef.current = 0;
      stepStartedAtRef.current = Date.now();
      window.setTimeout(() => {
        const step = stepsRef.current[index];
        if (step) setRemainingMs(step.durationSec * 1000);
      }, 0);
    },
    [recordOutcome, stepElapsedMs],
  );

  const setDiscomfortReason = useCallback(
    (reason: DiscomfortReason) => {
      const index = lastSwapIndexRef.current;
      if (index === null) return;
      recordOutcome(index, { discomfortReported: true, discomfortReason: reason });
    },
    [recordOutcome],
  );

  const leaveAreaAlone = useCallback(
    (area: BodyArea, pick: (exerciseId: string, taken: Set<string>) => Exercise | null) => {
      setSteps((all) => {
        const from = stepIndexRef.current + 1;
        const taken = new Set(all.map((step) => step.exercise.id));
        const tail: ResolvedStep[] = [];
        for (let i = from; i < all.length; i += 1) {
          const step = all[i];
          if (step.exercise.bodyArea !== area) {
            tail.push(step);
            continue;
          }
          let durationSec = step.durationSec;
          const paired = all[i + 1];
          if (step.side === "left" && paired?.side === "right" && paired.exercise.id === step.exercise.id) {
            durationSec += paired.durationSec;
            i += 1;
          }
          const replacement = pick(step.exercise.id, taken);
          if (!replacement) continue;
          taken.add(replacement.id);
          tail.push({
            index: 0,
            step: { exerciseId: replacement.id, durationSec, dose: replacement.defaultDose, phase: step.step.phase },
            exercise: replacement,
            durationSec,
            dose: replacement.defaultDose,
            side: undefined,
          });
        }
        return [...all.slice(0, from), ...tail].map((step, index) => ({ ...step, index }));
      });
    },
    [],
  );

  const finishNow = useCallback(() => {
    sessionConsumedMsRef.current = sessionElapsedMs();
    setElapsedMs(sessionConsumedMsRef.current);
    setStatus("complete");
  }, [sessionElapsedMs]);

  const current = steps[stepIndex] ?? null;
  const totalMs = steps.reduce((sum, step) => sum + step.durationSec * 1000, 0);
  const consumedMs =
    steps.slice(0, stepIndex).reduce((sum, step) => sum + step.durationSec * 1000, 0) +
    (current ? Math.max(0, current.durationSec * 1000 - remainingMs) : 0);

  const records = useMemo<SessionExerciseRecord[]>(() => {
    // One record per original move. Both sides of a hold fold into one line.
    const byExercise = new Map<string, SessionExerciseRecord>();
    steps.forEach((step, index) => {
      const outcome = outcomes[index];
      // A swapped step is recorded against the move that was planned, with
      // swappedToExerciseId naming what was actually done.
      const key = step.originalExerciseId ?? step.exercise.id;
      const existing = byExercise.get(key);
      const record: SessionExerciseRecord = existing ?? {
        exerciseId: key,
        sequence: byExercise.size,
        plannedSec: 0,
        actualSec: 0,
        completed: false,
        skipped: false,
        swapped: false,
        swappedToExerciseId: null,
        discomfortReported: false,
        discomfortReason: null,
      };
      record.plannedSec += step.durationSec;
      if (outcome) {
        record.actualSec += Math.round(outcome.actualMs / 1000);
        record.completed = record.completed || outcome.completed;
        record.skipped = record.skipped || outcome.skipped;
        record.swapped = record.swapped || outcome.swapped;
        record.swappedToExerciseId = outcome.swappedToExerciseId ?? record.swappedToExerciseId;
        record.discomfortReported = record.discomfortReported || outcome.discomfortReported;
        record.discomfortReason = outcome.discomfortReason ?? record.discomfortReason;
      }
      byExercise.set(key, record);
    });
    return [...byExercise.values()];
  }, [steps, outcomes]);

  const completedIds = useMemo(
    // What was actually done: a completed swap counts as the replacement.
    () =>
      records
        .filter((record) => record.completed)
        .map((record) => (record.swapped && record.swappedToExerciseId ? record.swappedToExerciseId : record.exerciseId)),
    [records],
  );
  const skippedIds = useMemo(
    () => records.filter((record) => record.skipped).map((record) => record.exerciseId),
    [records],
  );

  return {
    status,
    steps,
    current,
    stepIndex,
    remainingSec: remainingMs / 1000,
    elapsedSec: elapsedMs / 1000,
    progress: totalMs === 0 ? 0 : Math.min(1, consumedMs / totalMs),
    completedIds,
    skippedIds,
    records,
    pause,
    resume,
    toggle,
    next,
    previous,
    skip,
    swap,
    setDiscomfortReason,
    leaveAreaAlone,
    finishNow,
  };
}
