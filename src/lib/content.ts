import exercisesJson from "../../data/exercises.json";
import programsJson from "../../data/programs.json";
import templatesJson from "../../data/templates.json";
import evidenceJson from "../../data/evidence.json";
import { doseToDurationSec, scaleStepsToTarget, stepBounds, storedDose } from "./dose";
import { EXERCISE_ALIASES, canonicalExerciseId } from "./exercise-aliases";
import type {
  Catalog,
  DurationBenefit,
  EvidenceReference,
  Exercise,
  Program,
  ProgramStep,
  RoutineTemplate,
  SetupId,
  SetupRequest,
} from "./types";

/**
 * The one place content enters the app.
 *
 * Content lives in four JSON files under data/: exercises, authored programs,
 * routine templates and evidence. Nothing about a movement is hardcoded in a
 * component, and content bugs fail at import rather than in someone's workout.
 */
type RawStep = {
  exerciseId: string;
  durationSec?: number;
  dose?: Parameters<typeof storedDose>[0];
};
type RawProgram = Omit<Program, "steps"> & { steps: RawStep[] };

function normalizeProgram(program: RawProgram, exercises: Map<string, Exercise>): Program {
  const targetSec = program.durationTargetSec ?? program.durationMin * 60;
  const raw: ProgramStep[] = program.steps.map((step) => ({
    exerciseId: step.exerciseId,
    durationSec:
      step.durationSec ??
      doseToDurationSec(step.dose ?? exercises.get(step.exerciseId)?.defaultDose),
    dose: storedDose(step.dose),
  }));
  // Steps timed from their doses rarely add up to the advertised length; fit
  // them to it, within each move's minimum and maximum.
  const timedByDose = program.steps.some((step) => step.durationSec === undefined);
  const steps = timedByDose
    ? scaleStepsToTarget(raw, targetSec, (step) => stepBounds(exercises.get(step.exerciseId)))
    : raw;
  return {
    ...program,
    durationTargetSec: targetSec,
    steps,
  };
}

const rawExercises = (exercisesJson as unknown as { exercises: Exercise[] }).exercises;
const rawPrograms = programsJson as unknown as {
  programs: RawProgram[];
  durationBenefits: Record<string, DurationBenefit>;
  disclaimer: string;
};
const rawTemplates = (templatesJson as unknown as { templates: RoutineTemplate[] })
  .templates;
const rawEvidence = (evidenceJson as unknown as { references: EvidenceReference[] })
  .references;

const rawExerciseById = new Map(rawExercises.map((exercise) => [exercise.id, exercise]));

const catalog: Catalog = {
  exercises: rawExercises,
  programs: rawPrograms.programs.map((program) => normalizeProgram(program, rawExerciseById)),
  templates: rawTemplates,
  evidence: rawEvidence,
  durationBenefits: rawPrograms.durationBenefits,
  disclaimer: rawPrograms.disclaimer,
};

const exerciseById = new Map(catalog.exercises.map((e) => [e.id, e]));
const programById = new Map(catalog.programs.map((p) => [p.id, p]));
const templateById = new Map(catalog.templates.map((t) => [t.id, t]));

// Content bugs should fail the build, not ship a broken workout.
for (const exercise of catalog.exercises) {
  if (exercise.access !== "free" && exercise.access !== "pro") {
    throw new Error(`Exercise ${exercise.id} needs access "free" or "pro"`);
  }
  if (!exercise.needs?.length) {
    throw new Error(`Exercise ${exercise.id} needs at least one primary need`);
  }
  if (!exercise.bodyAreas?.includes(exercise.bodyArea)) {
    throw new Error(`Exercise ${exercise.id} bodyAreas must include ${exercise.bodyArea}`);
  }
  if (!exercise.movementType) {
    throw new Error(`Exercise ${exercise.id} needs a movementType`);
  }
  if (exercise.saferSwapId && !exerciseById.has(exercise.saferSwapId)) {
    throw new Error(`Exercise ${exercise.id} has unknown saferSwapId ${exercise.saferSwapId}`);
  }
  // A constrained move needs somewhere to go when the constraint is on.
  if (exercise.constraints.length && !exercise.saferSwapId) {
    throw new Error(`Exercise ${exercise.id} has constraints but no saferSwapId`);
  }
  if (exercise.saferSwapId === exercise.id) {
    throw new Error(`Exercise ${exercise.id} is its own saferSwapId`);
  }
  if (exercise.id in EXERCISE_ALIASES) {
    throw new Error(`Exercise ${exercise.id} is a retired id; remove the alias or the move`);
  }
  if (exercise.minSec !== undefined && exercise.maxSec !== undefined && exercise.maxSec < exercise.minSec) {
    throw new Error(`Exercise ${exercise.id} has maxSec below minSec`);
  }
}

for (const [retired, current] of Object.entries(EXERCISE_ALIASES)) {
  if (!exerciseById.has(current)) {
    throw new Error(`Alias ${retired} points at missing exercise ${current}`);
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
      throw new Error(`Free program ${program.id} uses Pro exercise ${step.exerciseId}`);
    }
  }
}

for (const template of catalog.templates) {
  const total = template.slots.reduce((sum, slot) => sum + slot.seconds, 0);
  if (total !== template.durationMin * 60) {
    throw new Error(`Template ${template.id} runs ${total}s, expected ${template.durationMin * 60}s`);
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

export function getTemplates(): RoutineTemplate[] {
  return catalog.templates;
}

export function getTemplate(id: string): RoutineTemplate | undefined {
  return templateById.get(id);
}

export function getEvidence(): EvidenceReference[] {
  return catalog.evidence;
}

/** Resolves retired ids too, so old history and links keep working. */
export function getExercise(id: string): Exercise | undefined {
  return exerciseById.get(id) ?? exerciseById.get(canonicalExerciseId(id));
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

/** A move done lying on the floor. Never part of a desk routine unless opted in. */
export function isFloorMove(exercise: Exercise): boolean {
  return exercise.setup === "floor" || exercise.constraints.includes("floor");
}

/**
 * Whether a move can be done in the position the user is actually in.
 *
 * Floor moves fit no desk position; the engine lets them in only for people
 * who opted in to floor work (see floorAllowed in recommendation.ts).
 */
export function fitsSetup(exercise: Exercise, setup: SetupRequest): boolean {
  if (exercise.setup === "floor") return false;
  if (setup === "either") return true;
  return exercise.setup === "either" || exercise.setup === setup;
}

/**
 * The position a move is actually performed in, given what the user asked for.
 * Floor moves count as "not standing" for sequencing.
 */
export function effectiveSetup(exercise: Exercise, setup: SetupRequest): SetupId {
  if (exercise.setup === "floor") return "seated";
  if (exercise.setup !== "either") return exercise.setup;
  return setup === "either" ? "seated" : setup;
}

/** The cue phrased for the position the user is in, when the catalog has one. */
export function cueForSetup(exercise: Exercise, setup: SetupRequest): string {
  return exercise.setupVariants?.[effectiveSetup(exercise, setup)]?.cue ?? exercise.cue;
}

export function requireExercise(id: string): Exercise {
  const exercise = getExercise(id);
  if (!exercise) throw new Error(`Unknown exercise id: ${id}`);
  return exercise;
}

/** Areas a program touches, in the order they appear. */
export function programBodyAreas(program: Program): string[] {
  const areas: string[] = [];
  for (const step of program.steps) {
    const exercise = getExercise(step.exerciseId);
    if (!exercise) continue;
    for (const area of exercise.bodyAreas) {
      if (!areas.includes(area)) areas.push(area);
    }
  }
  return areas;
}
