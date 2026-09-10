import type { Dose, Exercise, ProgramStep, StepSide } from "./types";

export type ActiveDoseStep = {
  durationSec: number;
  side?: StepSide;
  dose?: Dose;
  exercise: Pick<Exercise, "defaultDose">;
};

type DoseWithDirections = Dose & { directions?: string[] };

export function isEachSideDose(dose?: Dose | null): boolean {
  if (!dose) return false;
  return Boolean(
    dose.perSide ||
      (typeof dose.type === "string" && /EachSide/i.test(dose.type)),
  );
}

export function isHoldDose(dose?: Dose | null): boolean {
  if (!dose) return false;
  if (dose.holdSec || dose.seconds) return true;
  return typeof dose.type === "string" && /holdSec/i.test(dose.type);
}

export function isEachSideHoldDose(dose?: Dose | null): boolean {
  return isHoldDose(dose) && isEachSideDose(dose);
}

export function storedDose(raw?: DoseWithDirections): Dose | undefined {
  if (!raw) return undefined;
  return {
    type: raw.type,
    reps: raw.reps,
    holdSec: raw.holdSec,
    breaths: raw.breaths,
    seconds: raw.seconds,
    perSide: raw.perSide,
    rounds: raw.rounds,
  };
}

/** Per-side seconds for holds; reps/breaths/rounds stay a single timed window. */
export function doseToDurationSec(dose?: DoseWithDirections, fallback = 20): number {
  if (!dose) return fallback;
  if (dose.seconds) return Math.max(8, dose.seconds);
  if (dose.holdSec) return Math.max(8, dose.holdSec);
  if (dose.breaths) return Math.max(8, dose.breaths * 8);
  if (dose.rounds) return Math.max(8, dose.rounds * 16);
  if (dose.reps) {
    const ways =
      typeof dose.type === "string" && /EachWay/i.test(dose.type)
        ? dose.directions?.length || 2
        : 1;
    return Math.max(8, dose.reps * 2 * ways);
  }
  return fallback;
}

export function scaleStepsToTarget(steps: ProgramStep[], targetSec: number): ProgramStep[] {
  const sum = steps.reduce((total, step) => total + step.durationSec, 0);
  if (sum <= 0 || targetSec <= 0) return steps;
  const scaled = steps.map((step) => ({
    ...step,
    durationSec: Math.max(8, Math.round((step.durationSec * targetSec) / sum)),
  }));
  const scaledSum = scaled.reduce((total, step) => total + step.durationSec, 0);
  const last = scaled[scaled.length - 1];
  if (last) {
    last.durationSec = Math.max(8, last.durationSec + (targetSec - scaledSum));
  }
  return scaled;
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
  if (dose.rounds) {
    parts.push(`${dose.rounds} rounds`);
  }
  if (dose.seconds && parts.length === 0) {
    parts.push(`${dose.seconds}s`);
  }
  if (isEachSideDose(dose)) {
    parts.push("each side");
  }
  return parts.join(" · ") || "Move with the timer";
}

/**
 * Workout copy must match the timer. Catalog defaultDose can say 25s/side
 * while the program step (after scaling) is shorter — never show that lie.
 */
export function formatActiveDose(step: ActiveDoseStep): string {
  const exerciseDose = step.exercise.defaultDose;
  const stepDose = step.dose;
  const duration = Math.max(1, Math.round(step.durationSec));
  const side =
    step.side === "left" ? "Left" : step.side === "right" ? "Right" : null;

  if (side) {
    return `${duration}s each side · ${side}`;
  }

  // Setup/goal swaps keep the original slot dose; don't advertise each-side
  // on a move that isn't a per-side hold (e.g. figure-4 → seated march).
  if (isEachSideHoldDose(stepDose) && !isEachSideHoldDose(exerciseDose)) {
    if (isHoldDose(exerciseDose)) return `${duration}s hold`;
    return formatDose(exerciseDose);
  }

  const dose = stepDose ?? exerciseDose;
  if (isEachSideHoldDose(dose)) {
    return `${duration}s each side`;
  }
  if (isHoldDose(dose)) {
    return `${duration}s hold`;
  }
  return formatDose(dose);
}
