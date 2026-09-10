import catalogJson from "../../data/exercises-and-programs.json";
import scienceCopy from "../../SCIENCE_BENEFITS_STANDING_COPY.json";
import { SEATED_RESET_ID, STANDING_RESET_ID } from "./constants";
import { STANDING_STEP_SWAPS } from "./setup-steps";
import type {
  Access,
  BodyArea,
  Catalog,
  Dose,
  DurationBenefit,
  DurationBenefitKey,
  Exercise,
  ProductDefaults,
  Program,
  ProgramBenefits,
  ProgramStance,
  ProgramStep,
  StretchView,
} from "./types";

type RawDose = Dose & { directions?: string[] };
type RawStep = {
  exerciseId: string;
  durationSec?: number;
  dose?: RawDose;
  positionCue?: string;
  stretchView?: StretchView;
  stretchAsset?: string;
  stretchAssetB?: string;
  stretchAssetFallback?: string;
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
  stance?: ProgramStance;
  setup?: string;
  position?: string;
  startPrompt?: string;
  activeKicker?: string;
  steps: RawStep[];
};
type RawDurationSlot = {
  cardLine: string;
  detail: string;
  doneLine?: string;
};
type RawCatalog = {
  exercises: Exercise[];
  programs: RawProgram[];
  programBenefits?: {
    disclaimer?: string;
    byDuration?: Record<string, unknown>;
  };
  durationBenefits?: Record<"2" | "5" | "10", RawDurationSlot>;
  onboardingBenefits?: {
    beat?: string;
    pills?: Record<"2" | "5" | "10", string>;
  };
  productDefaults?: ProductDefaults;
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

const SHARED_STANDING_DUALS = ["chin-tuck", "long-exhale-reset", "shoulder-rolls"];

function normalizeExercise(exercise: Exercise): Exercise {
  const bodyArea = BODY_AREA_NORMALIZE[exercise.bodyArea];
  if (!bodyArea) {
    throw new Error(
      `Exercise ${exercise.id} has unknown bodyArea ${exercise.bodyArea}`,
    );
  }
  return { ...exercise, bodyArea };
}

function doseToDurationSec(dose?: RawDose, fallback = 20): number {
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

function scaleStepsToTarget(steps: ProgramStep[], targetSec: number): ProgramStep[] {
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

function inferStance(program: RawProgram): ProgramStance | undefined {
  if (program.stance === "seated" || program.stance === "standing") {
    return program.stance;
  }
  if (program.setup === "seated" || program.setup === "standing") {
    return program.setup;
  }
  if (program.position === "seated" || program.position === "standing") {
    return program.position;
  }
  if (program.id === STANDING_RESET_ID) return "standing";
  if (program.id === SEATED_RESET_ID) return "seated";
  return undefined;
}

function normalizeProgram(program: RawProgram): Program {
  const targetSec =
    program.durationTargetSec ??
    (program.durationMin ? program.durationMin * 60 : 0);
  const mapped: ProgramStep[] = program.steps.map((step) => {
    const fallbackCleared = SHARED_STANDING_DUALS.includes(step.exerciseId)
      ? undefined
      : step.stretchAssetFallback;
    return {
      exerciseId: step.exerciseId,
      durationSec: step.durationSec ?? doseToDurationSec(step.dose),
      positionCue: step.positionCue,
      stretchView: step.stretchView,
      stretchAsset: step.stretchAsset ?? fallbackCleared,
      stretchAssetB: step.stretchAssetB,
    };
  });
  const steps = targetSec ? scaleStepsToTarget(mapped, targetSec) : mapped;
  const durationMin =
    program.durationMin ??
    Math.max(
      1,
      Math.round(
        (targetSec || steps.reduce((s, step) => s + step.durationSec, 0)) / 60,
      ),
    );
  return {
    id: program.id,
    access: program.access,
    name: program.name,
    shortLabel: program.shortLabel ?? program.name.replace(/^\d+-min\s+/i, ""),
    durationMin,
    tagline: program.tagline ?? program.goal ?? "",
    stance: inferStance(program),
    startPrompt: program.startPrompt,
    activeKicker: program.activeKicker,
    steps,
  };
}

function durationSlot(
  key: "2" | "5" | "10",
): { cardLine: string; whyThisHelps: string; doneLine: string; onboardingLine: string } {
  const copy = scienceCopy.durationBenefits[key];
  const pill = scienceCopy.onboardingBenefits.pills[key];
  return {
    cardLine: copy.cardLine,
    whyThisHelps: copy.detail,
    doneLine: copy.doneLine,
    onboardingLine: pill,
  };
}

function buildProgramBenefits(raw: RawCatalog): ProgramBenefits {
  const disclaimer =
    raw.programBenefits?.disclaimer ??
    "Educational wellness copy — not medical advice. Benefits describe typical mechanisms from workplace / sedentary-behavior research; individual results vary.";
  return {
    disclaimer,
    whySheetTitle: scienceCopy.whySheetTitle,
    onboardingBeat: scienceCopy.onboardingBenefits.beat,
    byDuration: {
      "2min": durationSlot("2"),
      "5min": durationSlot("5"),
      "10min": durationSlot("10"),
    },
  };
}

const rawCatalog = catalogJson as RawCatalog;
const catalog: Catalog = {
  exercises: rawCatalog.exercises.map(normalizeExercise),
  programs: rawCatalog.programs.map(normalizeProgram),
  programBenefits: buildProgramBenefits(rawCatalog),
  productDefaults: rawCatalog.productDefaults ?? {
    preferredSetup: "standing",
    featuredFreeProgramId: STANDING_RESET_ID,
    alternateFreeProgramId: SEATED_RESET_ID,
  },
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

if (catalog.productDefaults?.featuredFreeProgramId !== STANDING_RESET_ID) {
  throw new Error(
    `productDefaults.featuredFreeProgramId must be ${STANDING_RESET_ID}`,
  );
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

export function getProgramBenefits(): ProgramBenefits | undefined {
  return catalog.programBenefits;
}

export function getProductDefaults(): ProductDefaults {
  return (
    catalog.productDefaults ?? {
      preferredSetup: "standing",
      featuredFreeProgramId: STANDING_RESET_ID,
      alternateFreeProgramId: SEATED_RESET_ID,
    }
  );
}

export function durationBenefitKey(
  durationMin: number,
): DurationBenefitKey | null {
  if (durationMin <= 2) return "2min";
  if (durationMin <= 5) return "5min";
  if (durationMin <= 10) return "10min";
  return null;
}

export function benefitsForProgram(program: Program): DurationBenefit | null {
  const key = durationBenefitKey(program.durationMin);
  if (!key) return null;
  return catalog.programBenefits?.byDuration[key] ?? null;
}
