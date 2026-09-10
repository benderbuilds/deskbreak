import type { Dose, Exercise, Program, ProgramStep, GoalId, SetupId, StepSide } from "./types";
import {
  formatActiveDose,
  formatDose,
  isEachSideHoldDose,
  isHoldDose,
  scaleStepsToTarget,
} from "./dose";
import { stepsForGoal } from "./goal-steps";
import { stepsForSetup } from "./setup-steps";

export { formatActiveDose, formatDose, isEachSideHoldDose };

export type ResolvedStep = {
  index: number;
  step: ProgramStep;
  exercise: Exercise;
  durationSec: number;
  dose?: Dose;
  side?: StepSide;
};

function expandEachSideHolds(
  step: ProgramStep,
  exercise: Exercise,
): ProgramStep[] {
  const stepDose = step.dose;
  const exerciseDose = exercise.defaultDose;
  const split =
    isEachSideHoldDose(exerciseDose) ||
    (isEachSideHoldDose(stepDose) && isHoldDose(exerciseDose));
  if (!split) {
    return [{ ...step, dose: stepDose }];
  }
  const dose = isEachSideHoldDose(stepDose) ? stepDose : exerciseDose;
  return [
    { ...step, dose, side: "left" },
    { ...step, dose, side: "right" },
  ];
}

export function resolveProgramSteps(
  program: Program,
  exercisesById: Map<string, Exercise>,
  setup?: SetupId | null,
  goal?: GoalId | null,
): ResolvedStep[] {
  const prepared = stepsForGoal(
    stepsForSetup(program.steps, setup),
    goal,
    program.id,
  );
  const expanded: ProgramStep[] = [];
  for (const step of prepared) {
    const exercise = exercisesById.get(step.exerciseId);
    if (!exercise) {
      throw new Error(
        `Program ${program.id} references missing exercise ${step.exerciseId}`,
      );
    }
    expanded.push(...expandEachSideHolds(step, exercise));
  }
  const targetSec =
    program.durationTargetSec ??
    (program.durationMin ? program.durationMin * 60 : 0);
  const scaled = targetSec ? scaleStepsToTarget(expanded, targetSec) : expanded;
  return scaled.map((step, index) => {
    const exercise = exercisesById.get(step.exerciseId);
    if (!exercise) {
      throw new Error(
        `Program ${program.id} references missing exercise ${step.exerciseId}`,
      );
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

export function buildSessionSummary(input: {
  programName: string;
  durationMin: number;
  completedNames: string[];
  skippedNames: string[];
  streak: number;
  elapsedSec: number;
}): string {
  const lines = [
    `DeskBreak · ${input.programName}`,
    `Finished ${input.completedNames.length} move${input.completedNames.length === 1 ? "" : "s"} in ${formatClock(input.elapsedSec)} (about ${input.durationMin} min).`,
    `Streak: ${input.streak} day${input.streak === 1 ? "" : "s"}`,
  ];
  if (input.completedNames.length) {
    lines.push("", input.completedNames.map((name) => `• ${name}`).join("\n"));
  }
  if (input.skippedNames.length) {
    lines.push("", `Skipped: ${input.skippedNames.join(", ")}`);
  }
  return lines.join("\n");
}
