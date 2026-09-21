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

/** "10 × 3 s": a number of short holds, not one long one. */
export function isRepsHoldDose(dose?: Dose | null): boolean {
  if (!dose) return false;
  return Boolean(dose.reps && dose.holdSec);
}

/**
 * No step runs shorter than this: below twenty seconds a move is filler.
 * Individual moves can ask for more with Exercise.minSec.
 */
export const MIN_STEP_SEC = 20;

export type StepBounds = { min: number; max: number };

/** Shortest and longest sensible time for one step of a move (per side for split holds). */
export function stepBounds(exercise?: Pick<Exercise, "minSec" | "maxSec"> | null): StepBounds {
  const min = exercise?.minSec ?? MIN_STEP_SEC;
  const max = Math.max(min, exercise?.maxSec ?? Number.POSITIVE_INFINITY);
  return { min, max };
}

/**
 * Whether a program step becomes a Left and a Right step when it runs. The
 * same rule resolveProgramSteps uses to split holds.
 */
export function splitsIntoSides(
  exercise: Pick<Exercise, "defaultDose">,
  stepDose?: Dose | null,
): boolean {
  return (
    isEachSideHoldDose(exercise.defaultDose) ||
    (isEachSideHoldDose(stepDose) && isHoldDose(exercise.defaultDose))
  );
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
  // A slow breath (in 4, out 6) is about ten seconds.
  if (dose.breaths) return Math.max(8, dose.breaths * 10);
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

const LEGACY_BOUNDS = (): StepBounds => ({ min: 8, max: Number.POSITIVE_INFINITY });

/**
 * Fits steps to a target length, proportionally, without squeezing any step
 * below its minimum or stretching it past its maximum.
 *
 * Steps that would fall outside their bounds are pinned there and the rest
 * share what is left. If the minimums alone exceed the target (the caller
 * should have dropped a step), it falls back to plain proportional scaling so
 * the routine still lands on its advertised length. Rounding drift goes to the
 * longest step, never to a short closing one.
 */
export function scaleStepsToTarget(
  steps: ProgramStep[],
  targetSec: number,
  bounds: (step: ProgramStep) => StepBounds = LEGACY_BOUNDS,
): ProgramStep[] {
  const sum = steps.reduce((total, step) => total + step.durationSec, 0);
  if (sum <= 0 || targetSec <= 0 || !steps.length) return steps;

  const limits = steps.map(bounds);
  const pinned: (number | null)[] = steps.map(() => null);
  for (let pass = 0; pass <= steps.length; pass += 1) {
    const free = steps.map((_, index) => index).filter((index) => pinned[index] === null);
    if (!free.length) break;
    const pinnedSum = pinned.reduce<number>((total, value) => total + (value ?? 0), 0);
    const weight = free.reduce((total, index) => total + steps[index].durationSec, 0);
    const scale = weight > 0 ? (targetSec - pinnedSum) / weight : 0;
    const low = free.filter((index) => steps[index].durationSec * scale < limits[index].min);
    if (low.length) {
      for (const index of low) pinned[index] = limits[index].min;
      continue;
    }
    const high = free.filter((index) => steps[index].durationSec * scale > limits[index].max);
    if (high.length) {
      for (const index of high) pinned[index] = limits[index].max;
      continue;
    }
    for (const index of free) pinned[index] = steps[index].durationSec * scale;
    break;
  }

  let values = pinned.map((value, index) => value ?? steps[index].durationSec);
  const total = values.reduce((acc, value) => acc + value, 0);
  if (total > targetSec + 0.5) {
    // Minimums cannot all fit. Stay on the advertised length regardless.
    values = steps.map((step) => Math.max(8, (step.durationSec * targetSec) / sum));
  } else if (total < targetSec - 0.5) {
    // Everything is at its maximum: share the rest proportionally.
    values = values.map((value) => (value * targetSec) / total);
  }

  const rounded = values.map((value) => Math.max(1, Math.round(value)));
  let drift = targetSec - rounded.reduce((acc, value) => acc + value, 0);
  // Settle rounding one second at a time on the step with the most room, so
  // no step is nudged below its minimum or past its maximum.
  for (let guard = 0; drift !== 0 && guard < 1000; guard += 1) {
    const direction = drift > 0 ? 1 : -1;
    let best = -1;
    let bestRoom = 0;
    rounded.forEach((value, index) => {
      const room = direction > 0 ? limits[index].max - value : value - limits[index].min;
      if (room > bestRoom || (room === bestRoom && best >= 0 && value > rounded[best])) {
        best = index;
        bestRoom = room;
      }
    });
    if (best < 0) {
      // Nothing has room: fall back to the longest step.
      best = rounded.reduce((longest, value, index) => (value > rounded[longest] ? index : longest), 0);
    }
    rounded[best] = Math.max(1, rounded[best] + direction);
    drift -= direction;
  }
  return steps.map((step, index) => ({ ...step, durationSec: rounded[index] }));
}

/** "10 × 3 s" for a set of short holds. */
export function formatRepsHold(dose: Dose): string {
  return `${dose.reps} × ${dose.holdSec} s`;
}

export function formatDose(dose: Dose): string {
  const parts: string[] = [];
  if (isRepsHoldDose(dose)) {
    parts.push(formatRepsHold(dose));
  } else {
    if (dose.reps) {
      parts.push(`${dose.reps} reps`);
    }
    if (dose.holdSec) {
      parts.push(`${dose.holdSec}s hold`);
    }
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

  // A set of short holds ("10 × 3 s") is never shown as one long hold, even
  // when the slot it fills is long: a 30-60 s sustained squeeze is a
  // different, worse exercise.
  if (isRepsHoldDose(exerciseDose)) return formatRepsHold(exerciseDose);

  // Setup/goal swaps keep the original slot dose; don't advertise each-side
  // on a move that isn't a per-side hold (e.g. figure-4 → seated march).
  if (isEachSideHoldDose(stepDose) && !isEachSideHoldDose(exerciseDose)) {
    if (isHoldDose(exerciseDose)) return `${duration}s hold`;
    return formatDose(exerciseDose);
  }

  const dose = stepDose ?? exerciseDose;
  if (isRepsHoldDose(dose)) return formatRepsHold(dose);
  if (isEachSideHoldDose(dose)) {
    return `${duration}s each side`;
  }
  if (isHoldDose(dose)) {
    return `${duration}s hold`;
  }
  return formatDose(dose);
}
