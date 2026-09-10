import catalogJson from "../../data/exercises-and-programs.json";
import { doseToDurationSec, storedDose } from "./dose";
import type {
  Catalog,
  DurationBenefit,
  Exercise,
  Program,
  ProgramStep,
  SetupId,
} from "./types";

type RawStep = { exerciseId: string; durationSec?: number; dose?: Parameters<typeof storedDose>[0] };
type RawProgram = Omit<Program, "steps"> & { steps: RawStep[] };
type RawCatalog = {
  exercises: Exercise[];
  programs: RawProgram[];
  durationBenefits: Record<string, DurationBenefit>;
  disclaimer: string;
};

function normalizeProgram(program: RawProgram): Program {
  const steps: ProgramStep[] = program.steps.map((step) => ({
    exerciseId: step.exerciseId,
    durationSec: step.durationSec ?? doseToDurationSec(step.dose),
    dose: storedDose(step.dose),
  }));
  return {
    ...program,
    durationTargetSec: program.durationTargetSec ?? program.durationMin * 60,
    steps,
  };
}

const raw = catalogJson as unknown as RawCatalog;

const catalog: Catalog = {
  exercises: raw.exercises,
  programs: raw.programs.map(normalizeProgram),
  durationBenefits: raw.durationBenefits,
  disclaimer: raw.disclaimer,
};

const exerciseById = new Map(catalog.exercises.map((e) => [e.id, e]));
const programById = new Map(catalog.programs.map((p) => [p.id, p]));

// Content bugs should fail the build, not ship a broken workout.
for (const exercise of catalog.exercises) {
  if (exercise.access !== "free" && exercise.access !== "pro") {
    throw new Error(`Exercise ${exercise.id} needs access "free" or "pro"`);
  }
  if (!exercise.needs?.length) {
    throw new Error(`Exercise ${exercise.id} needs at least one primary need`);
  }
  if (exercise.saferSwapId && !exerciseById.has(exercise.saferSwapId)) {
    throw new Error(`Exercise ${exercise.id} has unknown saferSwapId ${exercise.saferSwapId}`);
  }
}

for (const program of catalog.programs) {
  if (program.access !== "free" && program.access !== "pro") {
    throw new Error(`Program ${program.id} needs access "free" or "pro"`);
  }
  for (const step of program.steps) {
    const exercise = exerciseById.get(step.exerciseId);
    if (!exercise) {
      throw new Error(`Program ${program.id} references missing exercise ${step.exerciseId}`);
    }
    // A free program must stay free all the way down, or the first reset paywalls.
    if (program.access === "free" && exercise.access !== "free") {
      throw new Error(
        `Free program ${program.id} uses Pro exercise ${step.exerciseId}`,
      );
    }
  }
}

export function getCatalog(): Catalog {
  return catalog;
}

export function getExercises(): Exercise[] {
  return catalog.exercises;
}

export function getExercisesById(): Map<string, Exercise> {
  return exerciseById;
}

export function getPrograms(): Program[] {
  return catalog.programs;
}

export function getExercise(id: string): Exercise | undefined {
  return exerciseById.get(id);
}

export function getProgram(id: string): Program | undefined {
  return programById.get(id);
}

export function getDurationBenefit(durationMin: number): DurationBenefit | undefined {
  return catalog.durationBenefits[String(durationMin)];
}

export function getDisclaimer(): string {
  return catalog.disclaimer;
}

export function getProgramDurationSec(program: Program): number {
  if (program.durationTargetSec) return program.durationTargetSec;
  return program.steps.reduce((sum, step) => sum + step.durationSec, 0);
}

/** Whether a move can be done in the position the user is actually in. */
export function fitsSetup(exercise: Exercise, setup: SetupId): boolean {
  return exercise.setup === "either" || exercise.setup === setup;
}

/** The cue phrased for the position the user is in, when the catalog has one. */
export function cueForSetup(exercise: Exercise, setup: SetupId): string {
  return exercise.setupVariants?.[setup]?.cue ?? exercise.cue;
}

export function requireExercise(id: string): Exercise {
  const exercise = exerciseById.get(id);
  if (!exercise) throw new Error(`Unknown exercise id: ${id}`);
  return exercise;
}
