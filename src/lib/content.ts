import catalogJson from "../../data/exercises-and-programs.json";
import { STANDING_STEP_SWAPS } from "./setup-steps";
import type { Catalog, Exercise, Program } from "./types";

const catalog = catalogJson as Catalog;

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
  return program.steps.reduce((sum, step) => sum + step.durationSec, 0);
}

export function requireExercise(id: string): Exercise {
  const exercise = getExercise(id);
  if (!exercise) {
    throw new Error(`Unknown exercise id: ${id}`);
  }
  return exercise;
}
