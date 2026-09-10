import { scaleStepsToTarget } from "./dose";
import {
  fitsSetup,
  getExercise,
  getExercises,
  getProgram,
  getPrograms,
} from "./content";
import { doseToDurationSec } from "./dose";
import type {
  Exercise,
  PrimaryNeed,
  Program,
  ProgramStep,
  SetupId,
  TimeOfDay,
} from "./types";

export type RecommendationContext = {
  need: PrimaryNeed;
  setup: SetupId;
  durationMinutes: 2 | 3 | 4 | 5 | 10;
  /** Exercise ids from recent sessions, so we do not serve the same five moves. */
  recentExerciseIds?: string[];
  timeOfDay?: TimeOfDay;
  /** Pro unlocks the deeper catalog; free stays on the free movements. */
  pro?: boolean;
};

export type RecommendedProgram = {
  program: Program;
  /** One short line explaining why this, right now. */
  reason: string;
};

/**
 * Ordered move preferences per need. Ids not in the catalog are ignored, so this
 * table can name aspirational content without breaking the build.
 */
const NEED_PREFERENCES: Record<PrimaryNeed, string[]> = {
  neck_shoulders: [
    "chin-tuck",
    "shoulder-rolls",
    "suboccipital-nod",
    "neck-side-stretch",
    "unshrug",
    "seated-scap-squeeze",
    "upper-trap-release",
    "chest-opener",
    "long-exhale-reset",
  ],
  back_hips: [
    "seated-cat-cow",
    "seated-pelvic-tilts",
    "seated-figure-4",
    "standing-hip-flexor",
    "standing-glute-squeeze",
    "seated-hip-opener",
    "sit-bones-find",
    "seated-thoracic-rotation",
    "long-exhale-reset",
  ],
  wrists_hands: [
    "wrist-circles",
    "standing-wrist-shake",
    "finger-fans",
    "wrist-flexor-stretch",
    "wrist-extensor-stretch",
    "shoulder-rolls",
    "seated-scap-squeeze",
  ],
  energy: [
    "standing-posture-reset",
    "calf-raise",
    "seated-march",
    "standing-overhead-reach",
    "shoulder-rolls",
    "walk-to-water-march",
    "standing-glute-squeeze",
    "long-exhale-reset",
  ],
  stress: [
    "long-exhale-reset",
    "unshrug",
    "shoulder-rolls",
    "chin-tuck",
    "seated-cat-cow",
    "box-breathing",
    "screen-distance-blink",
  ],
  general: [
    "chin-tuck",
    "shoulder-rolls",
    "seated-cat-cow",
    "standing-posture-reset",
    "wrist-flexor-stretch",
    "seated-figure-4",
    "standing-hip-flexor",
    "long-exhale-reset",
  ],
};

const NEED_LABELS: Record<PrimaryNeed, string> = {
  neck_shoulders: "Neck + Shoulder",
  back_hips: "Back + Hip",
  wrists_hands: "Wrist + Hand",
  energy: "Energy",
  stress: "Calm",
  general: "Desk",
};

const NEED_PROMISE: Record<PrimaryNeed, string> = {
  neck_shoulders: "Undo the laptop hunch.",
  back_hips: "Loosen up after sitting.",
  wrists_hands: "Give keyboard hands a break.",
  energy: "Wake yourself up without another coffee.",
  stress: "Slow things down for two minutes.",
  general: "Two minutes. Still at your desk.",
};

const TIME_REASONS: Partial<Record<TimeOfDay, string>> = {
  morning: "Start the day before the chair starts shaping you.",
  midday: "Halfway through. Good time to undo the morning.",
  afternoon: "You've been working a while. Let's loosen up.",
  evening: "Last stretch of the day. Leave the desk in better shape.",
};

export function needLabel(need: PrimaryNeed): string {
  return NEED_LABELS[need];
}

export function needPromise(need: PrimaryNeed): string {
  return NEED_PROMISE[need];
}

export function timeOfDayNow(date = new Date()): TimeOfDay {
  const hour = date.getHours();
  if (hour < 11) return "morning";
  if (hour < 14) return "midday";
  if (hour < 18) return "afternoon";
  return "evening";
}

/** How many moves fit comfortably in a window of this length. */
function targetMoveCount(durationMinutes: number): number {
  if (durationMinutes <= 2) return 5;
  if (durationMinutes <= 3) return 6;
  if (durationMinutes <= 5) return 8;
  return 12;
}

function eligible(exercise: Exercise, context: RecommendationContext): boolean {
  if (!fitsSetup(exercise, context.setup)) return false;
  if (!context.pro && exercise.access !== "free") return false;
  return true;
}

function scoreExercise(
  exercise: Exercise,
  context: RecommendationContext,
  preferenceIndex: number,
): number {
  let score = 100;
  // Explicit ordering for the need comes first.
  score -= preferenceIndex >= 0 ? preferenceIndex : 40;
  if (exercise.needs.includes(context.need)) score += 25;
  if (context.need === "general" && exercise.needs.length > 1) score += 5;
  // Variety: push down anything they just did.
  const recentAt = context.recentExerciseIds?.indexOf(exercise.id) ?? -1;
  if (recentAt >= 0) score -= 60 - Math.min(50, recentAt * 6);
  if (context.need === "stress" && exercise.intensity === "moderate") score -= 15;
  if (context.need === "energy" && exercise.intensity === "moderate") score += 10;
  return score;
}

/**
 * Picks the moves for one reset.
 *
 * Deterministic on purpose: same context in, same routine out, so the workout a
 * user resumes after a refresh is the workout they started.
 */
function selectExercises(context: RecommendationContext): Exercise[] {
  const preferences = NEED_PREFERENCES[context.need];
  const pool = getExercises().filter((exercise) => eligible(exercise, context));

  const ranked = pool
    .map((exercise) => ({
      exercise,
      score: scoreExercise(exercise, context, preferences.indexOf(exercise.id)),
    }))
    .sort((a, b) => b.score - a.score || a.exercise.id.localeCompare(b.exercise.id))
    .map((entry) => entry.exercise);

  const wanted = targetMoveCount(context.durationMinutes);
  const chosen: Exercise[] = [];
  const usedAreas = new Map<string, number>();

  const onTopic = (exercise: Exercise) => exercise.needs.includes(context.need);

  /**
   * Variety caps, per body area.
   *
   * A routine should not be five versions of the same move, but a wrist reset is
   * allowed to be mostly wrists: capping the area the user actually asked about
   * defeats the whole point of asking. So the cap is generous for moves that
   * address the stated need and tight for the ones rounding out the routine.
   */
  const capFor = (exercise: Exercise): number => {
    if (context.need === "general") return context.durationMinutes <= 2 ? 2 : 3;
    if (onTopic(exercise)) return context.durationMinutes <= 2 ? 4 : 6;
    return 1;
  };

  // Most of a routine has to be about the thing the user picked.
  const minOnTopic =
    context.need === "general" ? 0 : Math.ceil((wanted * 2) / 3);
  let onTopicCount = 0;

  for (const exercise of ranked) {
    if (chosen.length >= wanted) break;
    const remaining = wanted - chosen.length;
    // Once only the reserved slots are left, they go to on-topic moves.
    if (!onTopic(exercise) && onTopicCount + remaining <= minOnTopic) continue;

    const areaCount = usedAreas.get(exercise.bodyArea) ?? 0;
    if (areaCount >= capFor(exercise)) continue;

    chosen.push(exercise);
    usedAreas.set(exercise.bodyArea, areaCount + 1);
    if (onTopic(exercise)) onTopicCount += 1;
  }

  // If the caps starved us, top up with whatever is left rather than ship short.
  for (const exercise of ranked) {
    if (chosen.length >= wanted) break;
    if (!chosen.includes(exercise)) chosen.push(exercise);
  }

  // Always land on something calming when one is available.
  const calming = chosen.find((e) => e.bodyArea === "breathing");
  if (calming && chosen.length > 1) {
    chosen.splice(chosen.indexOf(calming), 1);
    chosen.push(calming);
  }

  return chosen;
}

function buildSteps(exercises: Exercise[], targetSec: number): ProgramStep[] {
  const steps: ProgramStep[] = exercises.map((exercise) => ({
    exerciseId: exercise.id,
    durationSec: doseToDurationSec(exercise.defaultDose),
    dose: exercise.defaultDose,
  }));
  return scaleStepsToTarget(steps, targetSec);
}

export function generatedProgramId(context: RecommendationContext): string {
  return `reset-${context.need}-${context.setup}-${context.durationMinutes}`;
}

/** Parses an id produced by generatedProgramId back into a context. */
export function parseGeneratedProgramId(
  id: string,
): Pick<RecommendationContext, "need" | "setup" | "durationMinutes"> | null {
  const match = /^reset-(.+)-(seated|standing)-(\d+)$/.exec(id);
  if (!match) return null;
  const [, need, setup, minutes] = match;
  return {
    need: need as PrimaryNeed,
    setup: setup as SetupId,
    durationMinutes: Number(minutes) as RecommendationContext["durationMinutes"],
  };
}

export function buildProgram(context: RecommendationContext): Program {
  const exercises = selectExercises(context);
  const targetSec = context.durationMinutes * 60;
  const label = NEED_LABELS[context.need];
  return {
    id: generatedProgramId(context),
    access: "free",
    name: `${context.durationMinutes}-Minute ${label} Reset`,
    shortLabel: `${label} Reset`,
    durationMin: context.durationMinutes,
    durationTargetSec: targetSec,
    tagline: NEED_PROMISE[context.need],
    promise: NEED_PROMISE[context.need],
    primaryNeed: context.need,
    setup: context.setup,
    steps: buildSteps(exercises, targetSec),
    generated: true,
  };
}

/**
 * The one place that decides what a user should do next.
 *
 * Prefers a hand-authored catalog program when one matches the context exactly,
 * because those are written and illustrated; otherwise assembles one.
 */
export function getRecommendedProgram(
  context: RecommendationContext,
): RecommendedProgram {
  const authored = getPrograms().find(
    (program) =>
      program.primaryNeed === context.need &&
      program.setup === context.setup &&
      program.durationMin === context.durationMinutes &&
      (context.pro || program.access === "free") &&
      !overlapsRecent(program, context.recentExerciseIds),
  );

  const program = authored ?? buildProgram(context);
  return { program, reason: reasonFor(context) };
}

function overlapsRecent(program: Program, recent?: string[]): boolean {
  if (!recent?.length) return false;
  const ids = new Set(program.steps.map((step) => step.exerciseId));
  const shared = recent.filter((id) => ids.has(id)).length;
  // Same routine two sessions running is fine; near-identical three times is not.
  return shared >= Math.max(3, Math.ceil(ids.size * 0.8));
}

function reasonFor(context: RecommendationContext): string {
  if (context.need !== "general") return NEED_PROMISE[context.need];
  return (
    (context.timeOfDay && TIME_REASONS[context.timeOfDay]) ??
    "A balanced pass at the parts a desk day gets to first."
  );
}

/**
 * Adapts an authored program to the position the user is actually in, swapping
 * any move that does not fit for the closest one that does.
 */
export function adaptProgramToSetup(program: Program, setup: SetupId): Program {
  const needsAdapting = program.steps.some((step) => {
    const exercise = getExercise(step.exerciseId);
    return exercise ? !fitsSetup(exercise, setup) : false;
  });
  if (!needsAdapting) return { ...program, setup };

  const used = new Set(program.steps.map((step) => step.exerciseId));
  const steps = program.steps.map((step) => {
    const exercise = getExercise(step.exerciseId);
    if (!exercise || fitsSetup(exercise, setup)) return step;

    const replacement = getExercises().find(
      (candidate) =>
        !used.has(candidate.id) &&
        fitsSetup(candidate, setup) &&
        candidate.access === exercise.access &&
        candidate.bodyArea === exercise.bodyArea,
    );
    if (!replacement) return null;
    used.add(replacement.id);
    return {
      exerciseId: replacement.id,
      durationSec: step.durationSec,
      dose: replacement.defaultDose,
    };
  });

  const kept = steps.filter((step): step is ProgramStep => step !== null);
  return {
    ...program,
    setup,
    steps: scaleStepsToTarget(kept, program.durationTargetSec ?? program.durationMin * 60),
  };
}

/** Resolves any program id, authored or generated, into a runnable program. */
export function resolveProgram(
  programId: string,
  setup: SetupId,
  pro: boolean,
): Program | null {
  const authored = getProgram(programId);
  if (authored) return adaptProgramToSetup(authored, setup);

  const parsed = parseGeneratedProgramId(programId);
  if (!parsed) return null;
  return buildProgram({ ...parsed, setup, pro });
}
