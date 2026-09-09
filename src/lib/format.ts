import type { Dose, Exercise, Program, ProgramStep } from "./types";

export type ResolvedStep = {
  index: number;
  step: ProgramStep;
  exercise: Exercise;
  durationSec: number;
};

export function resolveProgramSteps(
  program: Program,
  exercisesById: Map<string, Exercise>,
): ResolvedStep[] {
  return program.steps.map((step, index) => {
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
    };
  });
}

export function formatDose(dose: Dose): string {
  const parts: string[] = [];
  if (dose.reps) {
    parts.push(`${dose.reps} reps`);
  }
  if (dose.holdSec) {
    parts.push(`${dose.holdSec}s hold`);
  }
  if (dose.breaths) {
    parts.push(`${dose.breaths} breaths`);
  }
  if (dose.seconds && parts.length === 0) {
    parts.push(`${dose.seconds}s`);
  }
  if (dose.perSide) {
    parts.push("each side");
  }
  return parts.join(" · ") || "Move with the timer";
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
