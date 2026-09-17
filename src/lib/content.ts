import exercisesJson from "../../data/exercises.json";
import programsJson from "../../data/programs.json";
import templatesJson from "../../data/templates.json";
import evidenceJson from "../../data/evidence.json";
import { doseToDurationSec, storedDose } from "./dose";
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

const catalog: Catalog = {
  exercises: rawExercises,
  programs: rawPrograms.programs.map(normalizeProgram),
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
export function fitsSetup(exercise: Exercise, setup: SetupRequest): boolean {
  if (setup === "either") return true;
  return exercise.setup === "either" || exercise.setup === setup;
}

/** The position a move is actually performed in, given what the user asked for. */
export function effectiveSetup(exercise: Exercise, setup: SetupRequest): SetupId {
  if (exercise.setup !== "either") return exercise.setup;
  return setup === "either" ? "seated" : setup;
}

/** The cue phrased for the position the user is in, when the catalog has one. */
export function cueForSetup(exercise: Exercise, setup: SetupRequest): string {
  return exercise.setupVariants?.[effectiveSetup(exercise, setup)]?.cue ?? exercise.cue;
}

export function requireExercise(id: string): Exercise {
  const exercise = exerciseById.get(id);
  if (!exercise) throw new Error(`Unknown exercise id: ${id}`);
  return exercise;
}

/** Areas a program touches, in the order they appear. */
export function programBodyAreas(program: Program): string[] {
  const areas: string[] = [];
  for (const step of program.steps) {
    const exercise = exerciseById.get(step.exerciseId);
    if (!exercise) continue;
    for (const area of exercise.bodyAreas) {
      if (!areas.includes(area)) areas.push(area);
    }
  }
  return areas;
}
