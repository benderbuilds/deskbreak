"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getExercisesById } from "./content";
import { resolveProgramSteps, type ResolvedStep } from "./format";
import type { Program } from "./types";

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
  pause: () => void;
  resume: () => void;
  next: () => void;
  skip: () => void;
};

const TICK_MS = 100;

export function useWorkoutEngine(
  program: Program | null,
  startAtIndex = 0,
): WorkoutEngine {
  const steps = useMemo(
    () => (program ? resolveProgramSteps(program, getExercisesById()) : []),
    [program],
  );

  const initialIndex = Math.min(Math.max(0, startAtIndex), Math.max(0, steps.length - 1));

  const [status, setStatus] = useState<WorkoutStatus>("running");
  const [stepIndex, setStepIndex] = useState(initialIndex);
  const [remainingMs, setRemainingMs] = useState(
    (steps[initialIndex]?.durationSec ?? 0) * 1000,
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);

  const remainingRef = useRef(remainingMs);
  const statusRef = useRef(status);
  const stepIndexRef = useRef(stepIndex);
  const stepsRef = useRef(steps);
  const advancingRef = useRef(false);

  useEffect(() => {
    remainingRef.current = remainingMs;
    statusRef.current = status;
    stepIndexRef.current = stepIndex;
    stepsRef.current = steps;
  }, [remainingMs, status, stepIndex, steps]);

  const startStep = useCallback((index: number) => {
    const step = stepsRef.current[index];
    if (!step) {
      setStatus("complete");
      return;
    }
    advancingRef.current = false;
    setStepIndex(index);
    setRemainingMs(step.durationSec * 1000);
    setStatus("running");
  }, []);

  const finishCurrent = useCallback(
    (mode: "complete" | "skip") => {
      if (advancingRef.current) return;
      advancingRef.current = true;

      const current = stepsRef.current[stepIndexRef.current];
      if (!current) {
        setStatus("complete");
        return;
      }

      const collect = mode === "skip" ? setSkippedIds : setCompletedIds;
      collect((ids) =>
        ids.includes(current.exercise.id) ? ids : [...ids, current.exercise.id],
      );

      let nextIndex = stepIndexRef.current + 1;
      if (mode === "skip") {
        // Skipping the left side skips the right side too; nobody wants half.
        const paired = stepsRef.current[nextIndex];
        if (
          current.side === "left" &&
          paired?.side === "right" &&
          paired.exercise.id === current.exercise.id
        ) {
          nextIndex += 1;
        }
      }

      if (nextIndex >= stepsRef.current.length) {
        setRemainingMs(0);
        setStatus("complete");
        return;
      }
      startStep(nextIndex);
    },
    [startStep],
  );

  useEffect(() => {
    if (status !== "running") return;
    const id = window.setInterval(() => {
      setElapsedMs((ms) => ms + TICK_MS);
      const nextRemaining = remainingRef.current - TICK_MS;
      if (nextRemaining <= 0) {
        setRemainingMs(0);
        finishCurrent("complete");
        return;
      }
      setRemainingMs(nextRemaining);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [status, finishCurrent]);

  const pause = useCallback(() => {
    if (statusRef.current === "running") setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    if (statusRef.current === "paused") setStatus("running");
  }, []);

  const next = useCallback(() => finishCurrent("complete"), [finishCurrent]);
  const skip = useCallback(() => finishCurrent("skip"), [finishCurrent]);

  const current = steps[stepIndex] ?? null;
  const totalMs = steps.reduce((sum, step) => sum + step.durationSec * 1000, 0);
  const consumedMs =
    steps.slice(0, stepIndex).reduce((sum, step) => sum + step.durationSec * 1000, 0) +
    (current ? Math.max(0, current.durationSec * 1000 - remainingMs) : 0);

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
    pause,
    resume,
    next,
    skip,
  };
}
