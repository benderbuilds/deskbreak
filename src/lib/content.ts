import catalogJson from "../../data/exercises-and-programs.json";
import { doseToDurationSec, storedDose } from "./dose";
import { STANDING_STEP_SWAPS } from "./setup-steps";
import type { Access, BodyArea, Catalog, Dose, Exercise, Program, ProgramStep } from "./types";

type RawDose = Dose & { directions?: string[] };
type RawStep = {
  exerciseId: string;
  durationSec?: number;
  dose?: RawDose;
};
type RawProgram = {
  id: string;
  access: Access;
  name: string;
  shortLabel?: string;
  durationMin?: number;
  durationTargetSec?: number;
  tagline?: string;
  goal?: string;
  steps: RawStep[];
};
type RawCatalog = {
  exercises: Exercise[];
  programs: RawProgram[];
};

const BODY_AREA_NORMALIZE: Record<string, BodyArea> = {
  neck: "neck",
  shoulders: "shoulders",
  upperBack: "upperBack",
  upper_back: "upperBack",
  wrists: "wrists",
  hips: "hips",
  legs: "legs",
  breathing: "breathing",
  core: "core",
  posture: "posture",
};

function normalizeExercise(exercise: Exercise): Exercise {
  const bodyArea = BODY_AREA_NORMALIZE[exercise.bodyArea];
  if (!bodyArea) {
    throw new Error(
      `Exercise ${exercise.id} has unknown bodyArea ${exercise.bodyArea}`,
    );
  }
  return { ...exercise, bodyArea };
}

function normalizeProgram(program: RawProgram): Program {
  const durationTargetSec =
    program.durationTargetSec ??
    (program.durationMin ? program.durationMin * 60 : undefined);
  const steps: ProgramStep[] = program.steps.map((step) => ({
    exerciseId: step.exerciseId,
    durationSec: step.durationSec ?? doseToDurationSec(step.dose),
    dose: storedDose(step.dose),
  }));
  const durationMin =
    program.durationMin ??
    Math.max(
      1,
      Math.round(
        (durationTargetSec ||
          steps.reduce((sum, step) => sum + step.durationSec, 0)) / 60,
      ),
    );
  return {
    id: program.id,
    access: program.access,
    name: program.name,
    shortLabel: program.shortLabel ?? program.name.replace(/^\d+-min\s+/i, ""),
    durationMin,
    durationTargetSec,
    tagline: program.tagline ?? program.goal ?? "",
    steps,
  };
}

const rawCatalog = catalogJson as RawCatalog;
const catalog: Catalog = {
  exercises: rawCatalog.exercises.map(normalizeExercise),
  programs: rawCatalog.programs.map(normalizeProgram),
};

const exerciseById = new Map(
  catalog.exercises.map((exercise) => [exercise.id, exercise]),
);

const programById = new Map(
  catalog.programs.map((program) => [program.id, program]),
);

for (const exercise of catalog.exercises) {
  if (exercise.access !== "free" && exercise.access !== "pro") {
    throw new Error(`Exercise ${exercise.id} needs access "free" or "pro"`);
  }
  if (exercise.saferSwapId && !exerciseById.has(exercise.saferSwapId)) {
    throw new Error(
      `Exercise ${exercise.id} has unknown saferSwapId ${exercise.saferSwapId}`,
    );
  }
  if (
    exercise.stretchView &&
    exercise.stretchView !== "side" &&
    exercise.stretchView !== "front" &&
    exercise.stretchView !== "threeQuarter"
  ) {
    throw new Error(
      `Exercise ${exercise.id} has invalid stretchView ${exercise.stretchView}`,
    );
  }
  for (const field of [
    exercise.stretchAsset,
    exercise.stretchAssetB,
    exercise.stretchAssetFrontArchive,
  ]) {
    if (field && /-side\.(svg|png)$/i.test(field)) {
      throw new Error(
        `Exercise ${exercise.id} stretch asset must not use a -side suffix: ${field}`,
      );
    }
  }
}

for (const [fromId, toId] of Object.entries(STANDING_STEP_SWAPS)) {
  if (!exerciseById.has(fromId)) {
    throw new Error(`Standing swap source missing from catalog: ${fromId}`);
  }
  if (!exerciseById.has(toId)) {
    throw new Error(`Standing swap target missing from catalog: ${toId}`);
  }
}

for (const program of catalog.programs) {
  if (program.access !== "free" && program.access !== "pro") {
    throw new Error(`Program ${program.id} needs access "free" or "pro"`);
  }
  for (const step of program.steps) {
    if (!exerciseById.has(step.exerciseId)) {
      throw new Error(
        `Program ${program.id} references missing exercise ${step.exerciseId}`,
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

export function getFreeExercises(): Exercise[] {
  return catalog.exercises.filter((exercise) => exercise.access === "free");
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

export function getProgramDurationSec(program: Program): number {
  if (program.durationTargetSec) return program.durationTargetSec;
  return program.steps.reduce((sum, step) => sum + step.durationSec, 0);
}

export function requireExercise(id: string): Exercise {
  const exercise = getExercise(id);
  if (!exercise) {
    throw new Error(`Unknown exercise id: ${id}`);
  }
  return exercise;
}
