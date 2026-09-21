import type { Dose, Exercise, Program, ProgramStep, StepSide } from "./types";
import {
  formatActiveDose,
  formatDose,
  isEachSideHoldDose,
  scaleStepsToTarget,
  splitsIntoSides,
  stepBounds,
} from "./dose";
import { canonicalExerciseId } from "./exercise-aliases";

export { formatActiveDose, formatDose, isEachSideHoldDose };

export type ResolvedStep = {
  index: number;
  step: ProgramStep;
  exercise: Exercise;
  durationSec: number;
  dose?: Dose;
  side?: StepSide;
  /** Set when this step replaced another move mid-workout (swap, "Doesn't feel right"). */
  originalExerciseId?: string;
};

function expandEachSideHolds(step: ProgramStep, exercise: Exercise): ProgramStep[] {
  const stepDose = step.dose;
  const exerciseDose = exercise.defaultDose;
  if (!splitsIntoSides(exercise, stepDose)) return [{ ...step, dose: stepDose }];

  const dose = isEachSideHoldDose(stepDose) ? stepDose : exerciseDose;
  return [
    { ...step, dose, side: "left" },
    { ...step, dose, side: "right" },
  ];
}

/**
 * Turns a program into the exact sequence the timer runs.
 *
 * Setup and access are already settled by the recommendation engine, so this
 * only splits per-side holds and fits the result into the advertised duration,
 * keeping every step within its move's minimum and maximum (a breath gets time
 * for its breaths, a walk gets long enough to go somewhere, nothing is filler).
 */
export function resolveProgramSteps(
  program: Program,
  exercisesById: Map<string, Exercise>,
): ResolvedStep[] {
  const expanded: ProgramStep[] = [];
  for (const raw of program.steps) {
    // Retired ids (merged moves) run as the move that replaced them.
    const step = { ...raw, exerciseId: canonicalExerciseId(raw.exerciseId) };
    const exercise = exercisesById.get(step.exerciseId);
    if (!exercise) {
      throw new Error(`Program ${program.id} references missing exercise ${raw.exerciseId}`);
    }
    expanded.push(...expandEachSideHolds(step, exercise));
  }

  const targetSec = program.durationTargetSec ?? program.durationMin * 60;
  const scaled = targetSec
    ? scaleStepsToTarget(expanded, targetSec, (step) => stepBounds(exercisesById.get(step.exerciseId)))
    : expanded;

  return scaled.map((step, index) => {
    const exercise = exercisesById.get(step.exerciseId);
    if (!exercise) {
      throw new Error(`Program ${program.id} references missing exercise ${step.exerciseId}`);
    }
    return {
      index,
      step,
      exercise,
      durationSec: step.durationSec,
      dose: step.dose,
      side: step.side,
    };
  });
}

export function formatClock(totalSec: number): string {
  const safe = Math.max(0, Math.ceil(totalSec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
