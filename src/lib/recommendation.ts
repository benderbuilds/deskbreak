import {
  isHoldDose,
  isRepsHoldDose,
  scaleStepsToTarget,
  splitsIntoSides,
  stepBounds,
} from "./dose";
import {
  effectiveSetup,
  fitsSetup,
  getExercise,
  getExercises,
  getProgram,
  getPrograms,
  getTemplates,
  isFloorMove,
} from "./content";
import { BODY_AREA_SHORT } from "./body-areas";
import {
  emptySignals,
  helpRate,
  NEED_FOCUS_AREAS,
  prefersSeated,
  prefersStanding,
  type PersonalizationSignals,
} from "./personalization";
import { constraintsForFlags, excludedBySafety } from "./safety";
import {
  ROUTINE_PHASES,
  type BodyArea,
  type DurationMinutes,
  type Exercise,
  type FunctionalConstraint,
  type PrimaryNeed,
  type Program,
  type ProgramStep,
  type RoutinePhase,
  type RoutineTemplate,
  type SafetyFlag,
  type SetupId,
  type SetupRequest,
  type StoredRecommendation,
  type TemplateSlot,
  type TimeOfDay,
} from "./types";

/**
 * The one place that decides what a user should do next.
 *
 * Deterministic on purpose: same inputs in, same routine out. Nothing here
 * calls the network or reads storage; the caller passes everything in, which is
 * what makes the same engine runnable on the server and as an offline fallback.
 */
export const ALGORITHM_VERSION = "3.1.0";

export type RecommendationContext = {
  need: PrimaryNeed;
  setup: SetupRequest;
  durationMinutes: DurationMinutes;
  timeOfDay?: TimeOfDay;
  /** Pro unlocks the deeper catalog; free stays on the free movements. */
  pro?: boolean;
  constraints?: FunctionalConstraint[];
  /**
   * "Go easy on" answers. Merged with signals.screening, so callers that only
   * pass personalizationSignals(state) are covered too.
   */
  safetyFlags?: SafetyFlag[];
  /** Floor exercises are only ever served when this is true. */
  allowFloor?: boolean;
  signals?: PersonalizationSignals;
  /** Exercise ids from recent sessions. Superseded by signals when present. */
  recentExerciseIds?: string[];
  /** Variety seed. Defaults to a fixed value so tests are stable. */
  seed?: string;
};

export type ScoredExercise = {
  exerciseId: string;
  phase: RoutinePhase;
  score: number;
};

export type ValidationIssue =
  | "time"
  | "constraint"
  | "setup"
  | "sequence"
  | "repetition"
  | "balance"
  | "safety"
  | "access"
  | "empty";

export type ValidationResult = { ok: boolean; issues: ValidationIssue[] };

export type Recommendation = {
  id: string;
  algorithmVersion: string;
  program: Program;
  reason: string;
  /** True when the reason line reflects this person's history, not a default. */
  personalized: boolean;
  exercises: ScoredExercise[];
  authored: boolean;
  fallback: boolean;
  validation: ValidationResult;
  inputs: {
    need: PrimaryNeed;
    setup: SetupRequest;
    durationMinutes: DurationMinutes;
    timeOfDay: TimeOfDay;
    pro: boolean;
    constraints: FunctionalConstraint[];
    sessionCount: number;
  };
};

/** Kept for callers that only want the routine. */
export type RecommendedProgram = { program: Program; reason: string };

const NEED_LABELS: Record<PrimaryNeed, string> = {
  neck_shoulders: "Neck + Shoulder",
  back_hips: "Back + Hip",
  wrists_hands: "Wrist + Hand",
  energy: "Energy",
  stress: "Stress",
  posture: "Posture",
  general: "Desk",
};

const NEED_PROMISE: Record<PrimaryNeed, string> = {
  neck_shoulders: "Undo the laptop lean.",
  back_hips: "Loosen up after sitting.",
  wrists_hands: "Give keyboard hands a break.",
  energy: "A few minutes of movement to wake you up.",
  stress: "Slow things down for a few minutes.",
  // A change of position, not a correction: there is no one correct posture.
  posture: "Change position and open up your upper back.",
  general: "Full-body movement for your workday.",
};

const TIME_REASONS: Record<TimeOfDay, string> = {
  morning: "A balanced start before the chair starts shaping you.",
  midday: "Halfway through. A good time to undo the morning.",
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

/* ------------------------------------------------------------------ *
 * Eligibility: hard constraints. Score never overrides these.
 *
 * Every path goes through hardExcluded: generated routines, authored
 * routines and their adaptation, the safe fallback, swaps and "Doesn't feel
 * right". Nothing the person has ruled out, told us hurt, or kept rating
 * worse comes back through a side door.
 * ------------------------------------------------------------------ */

function safetyFlagsOf(context: Pick<RecommendationContext, "safetyFlags" | "signals">): SafetyFlag[] {
  const fromSignals = context.signals?.screening?.safetyFlags ?? [];
  if (!context.safetyFlags?.length) return fromSignals;
  return [...new Set([...context.safetyFlags, ...fromSignals])];
}

function floorAllowed(context: Pick<RecommendationContext, "allowFloor" | "signals">): boolean {
  return context.allowFloor ?? context.signals?.screening?.allowFloorWork ?? false;
}

/** The user's own "avoid" list plus whatever their "Go easy on" answers imply. */
function effectiveConstraints(
  context: Pick<RecommendationContext, "constraints" | "safetyFlags" | "signals">,
): FunctionalConstraint[] {
  const implied = constraintsForFlags(safetyFlagsOf(context));
  if (!implied.length) return context.constraints ?? [];
  return [...new Set([...(context.constraints ?? []), ...implied])];
}

function violatesConstraint(
  exercise: Exercise,
  constraints: FunctionalConstraint[] | undefined,
): boolean {
  if (!constraints?.length) return false;
  return exercise.constraints.some((constraint) => constraints.includes(constraint));
}

/** A move rated worse far more often than it helped. */
function mostlyWorse(signal: { better: number; worse: number }): boolean {
  return signal.worse >= 3 && signal.worse > signal.better * 2;
}

/** Behaviour that means "stop showing me this" without a settings screen. */
function suppressedBySignals(exercise: Exercise, signals?: PersonalizationSignals): boolean {
  const signal = signals?.exercises[exercise.id];
  if (!signal) return false;
  if (signal.discomfort >= 1) return true;
  if (signal.swapped >= 2) return true;
  if (signal.skipped >= 3 && signal.skipped > signal.completed) return true;
  if (mostlyWorse(signal)) return true;
  return false;
}

/** A held stretch or a seated stillness, as opposed to movement. */
export function isStaticHold(exercise: Exercise): boolean {
  const dose = exercise.defaultDose;
  if (!isHoldDose(dose) || isRepsHoldDose(dose)) return false;
  if (exercise.movementType === "mobility") return true;
  return exercise.movementType === "position_change" && exercise.setup !== "standing";
}

/**
 * Areas the person should not be working right now: reported painful, or
 * rated worse twice or more, in the last week. A move is out when it mainly
 * works that area, or holds it at end range.
 */
function inAvoidedArea(exercise: Exercise, signals?: PersonalizationSignals): boolean {
  const avoid = signals?.avoidAreas;
  if (!avoid?.length) return false;
  if (avoid.includes(exercise.bodyArea)) return true;
  return isStaticHold(exercise) && exercise.bodyAreas.some((area) => avoid.includes(area));
}

/** The position check, with floor moves admitted only for people who opted in. */
function fitsPosition(
  exercise: Exercise,
  context: Pick<RecommendationContext, "setup" | "allowFloor" | "signals">,
): boolean {
  if (exercise.setup === "floor") return floorAllowed(context);
  return fitsSetup(exercise, context.setup);
}

type ExclusionContext = Pick<
  RecommendationContext,
  "constraints" | "safetyFlags" | "allowFloor" | "signals"
>;

/**
 * Hard exclusions that do not depend on position or plan: constraints,
 * "Go easy on" answers, floor opt-in, and what the person's behaviour says.
 */
export function hardExcluded(exercise: Exercise, context: ExclusionContext): boolean {
  if (isFloorMove(exercise) && !floorAllowed(context)) return true;
  if (violatesConstraint(exercise, effectiveConstraints(context))) return true;
  if (excludedBySafety(exercise, safetyFlagsOf(context))) return true;
  if (suppressedBySignals(exercise, context.signals)) return true;
  if (inAvoidedArea(exercise, context.signals)) return true;
  return false;
}

function eligible(exercise: Exercise, context: RecommendationContext): boolean {
  if (!fitsPosition(exercise, context)) return false;
  if (!context.pro && exercise.access !== "free") return false;
  return !hardExcluded(exercise, context);
}

/** Whether this person could be served this move at all, in this position and plan. */
export function isExerciseEligible(exerciseId: string, context: RecommendationContext): boolean {
  const exercise = getExercise(exerciseId);
  return exercise ? eligible(exercise, context) : false;
}

/* ------------------------------------------------------------------ *
 * Scoring. Weights follow the V3 spec; each term is scaled to its weight.
 * ------------------------------------------------------------------ */

const WEIGHTS = {
  relevance: 30,
  helpfulness: 25,
  structure: 15,
  preferences: 10,
  repetition: 10,
  timeOfDay: 5,
  variety: 5,
} as const;

/** Small, stable per-(seed, exercise) number in [0, 1) for day-to-day rotation. */
function jitter(seed: string, id: string): number {
  let hash = 2166136261;
  const input = `${seed}|${id}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

function relevanceScore(
  exercise: Exercise,
  slot: TemplateSlot,
  context: RecommendationContext,
): number {
  let area = 0.5;
  if (slot.bodyAreas?.length) {
    if (slot.bodyAreas.includes(exercise.bodyArea)) area = 1;
    else if (exercise.bodyAreas.some((entry) => slot.bodyAreas!.includes(entry))) area = 0.7;
    else area = 0;
  }
  const need = exercise.needs.includes(context.need)
    ? 1
    : context.need === "general" && exercise.needs.length > 1
      ? 0.7
      : 0.3;
  // An area rated worse once this week: still in play, but not held at end
  // range or loaded, and not first choice.
  const ease = context.signals?.easeAreas ?? [];
  const easing =
    ease.includes(exercise.bodyArea) && (isStaticHold(exercise) || exercise.intensity === "moderate")
      ? 0.5
      : 1;
  return WEIGHTS.relevance * (0.65 * area + 0.35 * need) * easing;
}

function helpfulnessScore(exercise: Exercise, signals?: PersonalizationSignals): number {
  const signal = signals?.exercises[exercise.id];
  if (!signal) return WEIGHTS.helpfulness * 0.5;
  const rate = (signal.better + 1) / (signal.better + signal.worse + 2);
  const skipPenalty = Math.min(0.3, signal.skipped * 0.1);
  return WEIGHTS.helpfulness * Math.max(0, rate - skipPenalty);
}

function structureScore(exercise: Exercise, slot: TemplateSlot): number {
  const phaseFit = exercise.phases.includes(slot.phase) ? 1 : 0;
  const typeFit = slot.movementTypes?.length
    ? slot.movementTypes.includes(exercise.movementType)
      ? 1
      : 0
    : phaseFit;
  return WEIGHTS.structure * (0.6 * phaseFit + 0.4 * typeFit);
}

function preferenceScore(
  exercise: Exercise,
  slot: TemplateSlot,
  context: RecommendationContext,
): number {
  let score = 0.5;
  const standing = exercise.setup === "standing";
  const signals = context.signals;

  if (slot.preferStanding && standing) score += 0.25;
  if (slot.preferSeated && exercise.setup !== "standing") score += 0.25;

  if (context.setup === "either" && signals) {
    if (prefersStanding(signals) && standing) score += 0.25;
    if (prefersSeated(signals) && !standing) score += 0.25;
  }

  if (context.need === "stress" && exercise.intensity === "moderate") score -= 0.3;
  if (context.need === "energy" && exercise.intensity === "moderate") score += 0.2;

  return WEIGHTS.preferences * Math.max(0, Math.min(1, score));
}

function repetitionScore(exercise: Exercise, context: RecommendationContext): number {
  const recent = context.signals?.recentExerciseIds ?? context.recentExerciseIds ?? [];
  const index = recent.indexOf(exercise.id);
  if (index < 0) return WEIGHTS.repetition;
  // Just did it: worth nothing. Twelve moves ago: nearly forgiven.
  return WEIGHTS.repetition * Math.min(1, index / 12);
}

function timeOfDayScore(exercise: Exercise, timeOfDay?: TimeOfDay): number {
  if (!timeOfDay) return WEIGHTS.timeOfDay * 0.5;
  const type = exercise.movementType;
  let fit = 0.5;
  if (timeOfDay === "morning" && (type === "mobility" || type === "position_change")) fit = 1;
  if (timeOfDay === "afternoon" && (type === "aerobic" || type === "strength")) fit = 1;
  if (timeOfDay === "midday" && (type === "aerobic" || type === "position_change")) fit = 0.9;
  if (timeOfDay === "evening" && (type === "breathing" || exercise.intensity === "gentle")) fit = 1;
  return WEIGHTS.timeOfDay * fit;
}

function varietyScore(
  exercise: Exercise,
  chosen: Exercise[],
  seed: string,
): number {
  const areaAlreadyCovered = chosen.some((entry) => entry.bodyArea === exercise.bodyArea);
  const base = areaAlreadyCovered ? 0.2 : 0.7;
  return WEIGHTS.variety * Math.min(1, base + jitter(seed, exercise.id) * 0.3);
}

function scoreForSlot(
  exercise: Exercise,
  slot: TemplateSlot,
  chosen: Exercise[],
  context: RecommendationContext,
  seed: string,
): number {
  return (
    relevanceScore(exercise, slot, context) +
    helpfulnessScore(exercise, context.signals) +
    structureScore(exercise, slot) +
    preferenceScore(exercise, slot, context) +
    repetitionScore(exercise, context) +
    timeOfDayScore(exercise, context.timeOfDay) +
    varietyScore(exercise, chosen, seed)
  );
}

/* ------------------------------------------------------------------ *
 * Templates and assembly.
 * ------------------------------------------------------------------ */

export function templateFor(
  need: PrimaryNeed,
  durationMinutes: DurationMinutes,
): RoutineTemplate {
  const exact = getTemplates().find(
    (template) => template.need === need && template.durationMin === durationMinutes,
  );
  if (exact) return exact;
  // 4 minutes has no template of its own: use the 5 and let scaling trim it.
  const nearest = getTemplates()
    .filter((template) => template.need === need)
    .sort(
      (a, b) =>
        Math.abs(a.durationMin - durationMinutes) - Math.abs(b.durationMin - durationMinutes),
    )[0];
  if (nearest) return nearest;
  return templateFor("general", durationMinutes);
}

type SlotPick = { exercise: Exercise; slot: TemplateSlot; score: number };

function fillTemplate(
  template: RoutineTemplate,
  context: RecommendationContext,
): SlotPick[] {
  const seed = context.seed ?? "deskbreak";
  const excluded = new Set(template.excludeExerciseIds ?? []);
  const pool = getExercises().filter(
    (exercise) =>
      eligible(exercise, context) &&
      !excluded.has(exercise.id) &&
      !(template.excludeStaticHolds && isStaticHold(exercise)),
  );
  const picks: SlotPick[] = [];
  const chosen: Exercise[] = [];

  for (const slot of template.slots) {
    const ranked = pool
      .filter((exercise) => !chosen.includes(exercise))
      .map((exercise) => ({
        exercise,
        slot,
        score: scoreForSlot(exercise, slot, chosen, context, seed),
      }))
      // A move that matches nothing about the slot is not a candidate for it.
      .filter((entry) => relevanceScore(entry.exercise, slot, context) > 0)
      .sort(
        (a, b) => b.score - a.score || a.exercise.id.localeCompare(b.exercise.id),
      );

    const best = ranked[0];
    if (!best) {
      if (slot.optional) continue;
      // Nothing fits the slot exactly: take the best remaining move rather than
      // ship a routine short of its advertised duration.
      const fallback = pool
        .filter((exercise) => !chosen.includes(exercise))
        .map((exercise) => ({
          exercise,
          slot,
          score: scoreForSlot(exercise, slot, chosen, context, seed),
        }))
        .sort((a, b) => b.score - a.score)[0];
      if (!fallback) continue;
      picks.push(fallback);
      chosen.push(fallback.exercise);
      continue;
    }
    picks.push(best);
    chosen.push(best.exercise);
  }

  return picks;
}

/**
 * Orders the routine so nobody stands up, sits down, stands up again.
 *
 * Phase order is kept. Standing-only moves are gathered into one block placed
 * where the first of them appeared, so a routine reads: seated warm-up, get up,
 * do the standing work, and either stay up or settle back down once.
 */
export function sequenceSteps(
  steps: ProgramStep[],
  setup: SetupRequest,
): ProgramStep[] {
  const withSetup = steps.map((step) => ({
    step,
    standing: (() => {
      const exercise = getExercise(step.exerciseId);
      return exercise ? effectiveSetup(exercise, setup) === "standing" : false;
    })(),
  }));
  if (countTransitions(withSetup.map((entry) => entry.standing)) <= 1) return steps;

  const firstStanding = withSetup.findIndex((entry) => entry.standing);
  const standing = withSetup.filter((entry) => entry.standing).map((entry) => entry.step);
  const seated = withSetup.filter((entry) => !entry.standing).map((entry) => entry.step);
  const before = seated.slice(0, firstStanding);
  const after = seated.slice(firstStanding);
  // Keep a closing breath or position change at the very end where it belongs.
  const closing = after.length && after[after.length - 1].phase === "return" ? [after.pop()!] : [];
  return [...before, ...standing, ...after, ...closing];
}

/** A static end-range stretch on a cold body, or a move marked never-first. */
export function canOpenRoutine(exercise: Exercise): boolean {
  if (exercise.notFirst) return false;
  return !(isStaticHold(exercise) && exercise.movementType === "mobility");
}

/**
 * Makes sure a routine does not open on a move that should never be first:
 * the first move that may open it is brought to the front.
 */
export function enforceFirstMove(steps: ProgramStep[]): ProgramStep[] {
  const first = steps[0] ? getExercise(steps[0].exerciseId) : undefined;
  if (!first || canOpenRoutine(first)) return steps;
  const index = steps.findIndex((step) => {
    const exercise = getExercise(step.exerciseId);
    return exercise ? canOpenRoutine(exercise) : false;
  });
  if (index <= 0) return steps;
  return [steps[index], ...steps.slice(0, index), ...steps.slice(index + 1)];
}

function boundsForStep(step: ProgramStep) {
  return stepBounds(getExercise(step.exerciseId));
}

/** Seconds a step needs at minimum when it runs (both sides of a split hold). */
function minimumSecFor(step: ProgramStep): number {
  const exercise = getExercise(step.exerciseId);
  if (!exercise) return 0;
  return stepBounds(exercise).min * (splitsIntoSides(exercise, step.dose) ? 2 : 1);
}

/** Whether every move in the routine can get its minimum time within the target. */
export function fitsMinimumDurations(steps: ProgramStep[], targetSec: number): boolean {
  return steps.reduce((sum, step) => sum + minimumSecFor(step), 0) <= targetSec;
}

/**
 * Drops moves until every remaining one gets its minimum time. A move is
 * dropped rather than squeezed: a 10-second breath or walk is not one.
 * Position-change filler goes first, then the shortest slot; the opening move
 * and a closing return are kept while anything else can go.
 */
export function dropToFitMinimums(steps: ProgramStep[], targetSec: number): ProgramStep[] {
  let kept = [...steps];
  while (kept.length > 1 && !fitsMinimumDurations(kept, targetSec)) {
    const candidates = kept
      .map((step, index) => ({ step, index, exercise: getExercise(step.exerciseId) }))
      .filter(({ index, step }) => index !== 0 && !(index === kept.length - 1 && step.phase === "return"));
    const pool = candidates.length ? candidates : kept.map((step, index) => ({ step, index, exercise: getExercise(step.exerciseId) }));
    const filler = pool.filter(({ exercise }) => exercise?.movementType === "position_change");
    const choice = (filler.length ? filler : pool).sort(
      (a, b) => a.step.durationSec - b.step.durationSec || b.index - a.index,
    )[0];
    kept = kept.filter((_, index) => index !== choice.index);
  }
  return kept;
}

/** Order, drop and time a set of steps for a routine of targetSec. */
function finishSteps(steps: ProgramStep[], setup: SetupRequest, targetSec: number): ProgramStep[] {
  const ordered = enforceFirstMove(sequenceSteps(steps, setup));
  return scaleStepsToTarget(dropToFitMinimums(ordered, targetSec), targetSec, boundsForStep);
}

function countTransitions(flags: boolean[]): number {
  let transitions = 0;
  for (let i = 1; i < flags.length; i += 1) {
    if (flags[i] !== flags[i - 1]) transitions += 1;
  }
  return transitions;
}

function stepsFromPicks(picks: SlotPick[], targetSec: number, setup: SetupRequest): ProgramStep[] {
  const steps: ProgramStep[] = picks.map(({ exercise, slot }) => ({
    exerciseId: exercise.id,
    durationSec: Math.max(8, slot.seconds),
    dose: exercise.defaultDose,
    phase: slot.phase,
  }));
  return finishSteps(steps, setup, targetSec);
}

export function generatedProgramId(context: {
  need: PrimaryNeed;
  setup: SetupRequest;
  durationMinutes: DurationMinutes;
}): string {
  return `reset-${context.need}-${context.setup}-${context.durationMinutes}`;
}

/** Parses an id produced by generatedProgramId back into a context. */
export function parseGeneratedProgramId(
  id: string,
): Pick<RecommendationContext, "need" | "setup" | "durationMinutes"> | null {
  const match = /^reset-(.+)-(seated|standing|either)-(\d+)$/.exec(id);
  if (!match) return null;
  const [, need, setup, minutes] = match;
  return {
    need: need as PrimaryNeed,
    setup: setup as SetupRequest,
    durationMinutes: Number(minutes) as DurationMinutes,
  };
}

/** Assembles a routine from the pool. Always returns something runnable. */
export function buildProgram(context: RecommendationContext): Program {
  const template = templateFor(context.need, context.durationMinutes);
  const picks = fillTemplate(template, context);
  const targetSec = context.durationMinutes * 60;
  const label = NEED_LABELS[context.need];
  return {
    id: generatedProgramId(context),
    access: "free",
    name:
      context.durationMinutes === template.durationMin
        ? template.name
        : `${context.durationMinutes}-Minute ${label} Reset`,
    shortLabel: template.shortLabel,
    durationMin: context.durationMinutes,
    durationTargetSec: targetSec,
    tagline: template.tagline,
    promise: NEED_PROMISE[context.need],
    primaryNeed: context.need,
    setup: context.setup,
    steps: stepsFromPicks(picks, targetSec, context.setup),
    generated: true,
    templateId: template.id,
  };
}

/* ------------------------------------------------------------------ *
 * Validation. A routine that fails here is replaced by an authored one.
 * ------------------------------------------------------------------ */

/** Whether a move counts toward the need the user picked. */
export function isOnTopic(exercise: Exercise, need: PrimaryNeed): boolean {
  if (need === "general") return true;
  if (exercise.needs.includes(need)) return true;
  if (need === "energy") {
    return ["aerobic", "strength", "position_change", "eye_break"].includes(
      exercise.movementType,
    );
  }
  if (need === "stress") {
    return exercise.movementType === "breathing" || exercise.movementType === "eye_break";
  }
  if (need === "posture") {
    return exercise.movementType === "position_change";
  }
  return false;
}

export type ValidationOptions = {
  /** The fallback path does not mind repeating recent moves; it minds safety. */
  ignoreRepetition?: boolean;
};

/** Areas a need is about, for checking whether its moves are still available. */
function eligibleOnTopicCount(context: RecommendationContext): number {
  return getExercises().filter(
    (exercise) => eligible(exercise, context) && isOnTopic(exercise, context.need),
  ).length;
}

export function validateProgram(
  program: Program,
  context: RecommendationContext,
  options: ValidationOptions = {},
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const exercises = program.steps.map((step) => getExercise(step.exerciseId));

  if (!program.steps.length) issues.push("empty");
  if (exercises.some((exercise) => !exercise)) issues.push("safety");
  const present = exercises.filter((exercise): exercise is Exercise => Boolean(exercise));

  const total = program.steps.reduce((sum, step) => sum + step.durationSec, 0);
  const target = program.durationTargetSec ?? program.durationMin * 60;
  if (Math.abs(total - target) > 5) issues.push("time");
  // Every move must be able to get its minimum time when it runs.
  if (!fitsMinimumDurations(program.steps, target) && !issues.includes("time")) issues.push("time");

  if (present.some((exercise) => violatesConstraint(exercise, effectiveConstraints(context)))) {
    issues.push("constraint");
  }
  if (present.some((exercise) => !fitsPosition(exercise, context))) issues.push("setup");
  if (!context.pro && present.some((exercise) => exercise.access !== "free")) {
    issues.push("access");
  }
  // Pain, "worse", "Go easy on", floor: anything hard-excluded is a safety failure.
  if (present.some((exercise) => hardExcluded(exercise, context)) && !issues.includes("safety")) {
    issues.push("safety");
  }

  const ids = program.steps.map((step) => step.exerciseId);
  const flags = present.map((exercise) => effectiveSetup(exercise, context.setup) === "standing");
  if (
    new Set(ids).size !== ids.length ||
    countTransitions(flags) > 2 ||
    (present[0] && !canOpenRoutine(present[0]))
  ) {
    issues.push("sequence");
  }

  const recent = (context.signals?.recentExerciseIds ?? context.recentExerciseIds ?? []).slice(0, 6);
  if (!options.ignoreRepetition && ids.length >= 3 && recent.length) {
    const shared = ids.filter((id) => recent.includes(id)).length;
    if (shared / ids.length > 0.6) issues.push("repetition");
  }

  if (context.need === "general" && context.durationMinutes >= 3) {
    const areas = new Set(present.flatMap((exercise) => exercise.bodyAreas));
    if (areas.size < 4) issues.push("balance");
  } else if (context.need !== "general" && present.length) {
    // Most of a targeted routine has to be about the thing the user picked.
    // Longer routines deliberately round themselves out with other areas, so
    // the floor is 40% rather than a strict majority. When pain, "worse" or
    // "Go easy on" has taken most of that area away, what is left is enough.
    const onTopic = present.filter((exercise) => isOnTopic(exercise, context.need)).length;
    const wanted = Math.max(2, Math.floor(present.length * 0.4));
    if (onTopic < Math.min(wanted, eligibleOnTopicCount(context))) issues.push("balance");
  }

  return { ok: issues.length === 0, issues };
}

/* ------------------------------------------------------------------ *
 * Authored routines: the illustrated, hand-sequenced fallbacks.
 * ------------------------------------------------------------------ */

function setupMatchRank(program: Program, setup: SetupRequest): number {
  if (program.setup === setup) return 0;
  if (program.setup === "either") return 1;
  return 2;
}

/**
 * Authored routines that could serve this request, exact position first: a
 * standing user gets the hand-authored standing routine, not a seated one with
 * its chair moves swapped out.
 */
function authoredCandidates(context: RecommendationContext): Program[] {
  return getPrograms()
    .filter(
      (program) =>
        program.primaryNeed === context.need &&
        program.durationMin === context.durationMinutes &&
        (context.pro || program.access === "free") &&
        (context.setup === "either" ||
          program.setup === "either" ||
          program.setup === context.setup ||
          // A seated authored routine can be adapted; a standing one cannot be
          // made seated without changing what it is.
          (program.setup === "seated" && context.setup === "standing")),
    )
    .map((program, index) => ({ program, index }))
    .sort(
      (a, b) =>
        setupMatchRank(a.program, context.setup) - setupMatchRank(b.program, context.setup) ||
        a.index - b.index,
    )
    .map(({ program }) => program);
}

export type AdaptContext = Pick<
  RecommendationContext,
  "setup" | "constraints" | "pro" | "safetyFlags" | "allowFloor" | "signals"
>;

/**
 * Adapts an authored program to the position the user is actually in, their
 * constraints and "Go easy on" answers, and what their history rules out,
 * swapping any move that does not fit for its safer alternative or the
 * closest move that does. A move with no acceptable replacement is dropped.
 */
export function adaptProgram(program: Program, context: AdaptContext): Program {
  const setup = context.setup;
  const used = new Set(program.steps.map((step) => step.exerciseId));
  const fits = (exercise: Exercise) =>
    fitsPosition(exercise, context) &&
    !hardExcluded(exercise, context) &&
    (context.pro || exercise.access === "free" || program.access === "pro");

  const needsAdapting = program.steps.some((step) => {
    const exercise = getExercise(step.exerciseId);
    return exercise ? !fits(exercise) || exercise.id !== step.exerciseId : false;
  });
  if (!needsAdapting) return { ...program, setup };

  const steps = program.steps.map((step) => {
    const exercise = getExercise(step.exerciseId);
    if (!exercise) return step;
    if (fits(exercise)) return exercise.id === step.exerciseId ? step : { ...step, exerciseId: exercise.id };

    const safer = exercise.saferSwapId ? getExercise(exercise.saferSwapId) : undefined;
    const replacement =
      (safer && !used.has(safer.id) && fits(safer) ? safer : undefined) ??
      getExercises().find(
        (candidate) =>
          !used.has(candidate.id) &&
          fits(candidate) &&
          candidate.access === exercise.access &&
          candidate.bodyArea === exercise.bodyArea,
      ) ??
      getExercises().find(
        (candidate) =>
          !used.has(candidate.id) &&
          fits(candidate) &&
          candidate.access === exercise.access &&
          candidate.bodyAreas.some((area) => exercise.bodyAreas.includes(area)),
      );
    if (!replacement) return null;
    used.add(replacement.id);
    return {
      exerciseId: replacement.id,
      durationSec: step.durationSec,
      dose: replacement.defaultDose,
      phase: step.phase,
    };
  });

  const kept = steps.filter((step): step is ProgramStep => step !== null);
  return {
    ...program,
    setup,
    steps: kept.length
      ? finishSteps(kept, setup, program.durationTargetSec ?? program.durationMin * 60)
      : [],
  };
}

/** Older name, kept for existing callers. */
export function adaptProgramToSetup(program: Program, setup: SetupId): Program {
  return adaptProgram(program, { setup, pro: true });
}

/** Signals with the recency memory wiped but every exclusion kept. */
function withoutRecency(signals?: PersonalizationSignals): PersonalizationSignals | undefined {
  return signals ? { ...signals, recentExerciseIds: [] } : undefined;
}

/**
 * The last resort when everything else is ruled out: slow breathing and an eye
 * break, which nothing in "Go easy on" excludes.
 */
function breathingFallback(context: RecommendationContext): Program {
  const targetSec = context.durationMinutes * 60;
  const pool = getExercises().filter(
    (exercise) =>
      (exercise.movementType === "breathing" || exercise.movementType === "eye_break") &&
      exercise.access === "free" &&
      fitsPosition(exercise, context) &&
      !hardExcluded(exercise, context),
  );
  const picks = pool.length ? pool : getExercises().filter((exercise) => exercise.id === "long-exhale-reset");
  const steps = picks.map((exercise) => ({
    exerciseId: exercise.id,
    durationSec: 60,
    dose: exercise.defaultDose,
    phase: "return" as RoutinePhase,
  }));
  return {
    id: generatedProgramId(context),
    access: "free",
    name: `${context.durationMinutes}-Minute Breathing Reset`,
    shortLabel: "Breathing Reset",
    durationMin: context.durationMinutes,
    durationTargetSec: targetSec,
    tagline: "Slow breathing and somewhere else to look.",
    promise: NEED_PROMISE.stress,
    primaryNeed: context.need,
    setup: context.setup,
    steps: scaleStepsToTarget(dropToFitMinimums(steps, targetSec), targetSec, boundsForStep),
    generated: true,
  };
}

/**
 * The routine we can always fall back to, whatever else has gone wrong.
 *
 * It honours everything the person has told us (pain, "worse", "Go easy on",
 * floor, constraints); only the preference for not repeating recent moves is
 * relaxed.
 */
export function safeFallbackProgram(context: RecommendationContext): Program {
  const lenient: ValidationOptions = { ignoreRepetition: true };
  const authored = authoredCandidates(context)
    .map((program) => adaptProgram(program, context))
    .find((program) => validateProgram(program, context, lenient).ok);
  if (authored) return authored;

  const general = getProgram(
    context.setup === "standing" ? "desk-reset-3min-standing" : "desk-reset-3min",
  );
  const adapted = general ? adaptProgram(general, context) : null;
  if (adapted && adapted.steps.length) {
    const issues = validateProgram(adapted, context, lenient).issues;
    if (!issues.some((issue) => issue === "safety" || issue === "setup" || issue === "constraint" || issue === "access")) {
      return adapted;
    }
  }

  // Nearly last resort: a generated routine without the recency preference.
  const built = buildProgram({ ...context, signals: withoutRecency(context.signals), recentExerciseIds: [] });
  if (built.steps.length) return built;
  return breathingFallback(context);
}

/* ------------------------------------------------------------------ *
 * Explanation.
 * ------------------------------------------------------------------ */

/** "neck", "neck and shoulders", "neck, shoulders and wrists". */
function areaList(areas: BodyArea[]): string {
  const labels = [...new Set(areas.map((area) => BODY_AREA_SHORT[area]))];
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export type AreaAvoidanceNotice = {
  areas: BodyArea[];
  /** One line for Today or the routine card. */
  message: string;
  /** Show WORSE_REPEAT_CLINICIAN_LINE / PAINFUL_RESPONSE as well. */
  suggestClinician: boolean;
};

/**
 * What the engine is leaving out this week and why, for the UI to say out
 * loud. Null when nothing is being avoided.
 */
export function areaAvoidanceNotice(signals?: PersonalizationSignals | null): AreaAvoidanceNotice | null {
  const areas = signals?.avoidAreas ?? [];
  if (!areas.length) return null;
  const painful = (signals?.painfulAreas ?? []).filter((area) => areas.includes(area));
  const why = painful.length === areas.length ? "it hurt" : painful.length ? "they hurt or felt worse" : areas.length > 1 ? "they felt worse" : "it felt worse";
  return {
    areas,
    message: `We're leaving your ${areaList(areas)} out for a few days because ${why}.`,
    suggestClinician: true,
  };
}

function explain(
  program: Program,
  context: RecommendationContext,
): { reason: string; personalized: boolean } {
  const signals = context.signals;
  const timeOfDay = context.timeOfDay ?? "afternoon";
  const label = NEED_LABELS[context.need].toLowerCase();

  // Saying what we left out, and why, beats any other reason.
  const avoided = signals?.avoidAreas ?? [];
  if (avoided.length) {
    const focus = NEED_FOCUS_AREAS[context.need];
    const relevant = focus ? avoided.filter((area) => focus.includes(area)) : avoided;
    const notice = areaAvoidanceNotice({ ...signals!, avoidAreas: relevant.length ? relevant : avoided });
    if (notice) return { reason: notice.message, personalized: true };
  }

  if (signals && signals.sessionCount >= 3) {
    const hasStanding = program.steps.some((step) => {
      const exercise = getExercise(step.exerciseId);
      return exercise ? effectiveSetup(exercise, context.setup) === "standing" : false;
    });
    if (prefersStanding(signals) && hasStanding) {
      return {
        reason: "We've included more standing movement because you usually respond well to it.",
        personalized: true,
      };
    }

    const tod = signals.timeOfDayOutcomes[timeOfDay];
    const need = signals.needOutcomes[context.need];
    if (tod && tod.rated >= 3 && helpRate(tod) >= 0.7 && context.need !== "general") {
      return {
        reason: `Your ${timeOfDay} ${label} resets tend to help most.`,
        personalized: true,
      };
    }
    if (need && need.rated >= 3 && helpRate(need) >= 0.7) {
      return {
        reason: `${NEED_LABELS[context.need]} resets have helped you ${need.better} of ${need.rated} times.`,
        personalized: true,
      };
    }

    const proven = program.steps
      .map((step) => ({ step, signal: signals.exercises[step.exerciseId] }))
      .filter(({ signal }) => signal && signal.better >= 2 && signal.better > signal.worse * 2)
      .sort((a, b) => (b.signal?.better ?? 0) - (a.signal?.better ?? 0))[0];
    if (proven) {
      const exercise = getExercise(proven.step.exerciseId);
      if (exercise) {
        return {
          reason: `${exercise.name} is in here because it's helped you before.`,
          personalized: true,
        };
      }
    }
  }

  if (context.need !== "general") {
    return { reason: NEED_PROMISE[context.need], personalized: false };
  }
  return { reason: TIME_REASONS[timeOfDay], personalized: false };
}

/* ------------------------------------------------------------------ *
 * Entry points.
 * ------------------------------------------------------------------ */

function newRecommendationId(): string {
  const random =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `rec_${random}`;
}

/**
 * Decides the routine for this person, now.
 *
 * The first couple of resets use an authored routine when one fits: those are
 * illustrated and hand-sequenced, and the engine has nothing to personalize on
 * yet. After that the engine assembles one, validates it, and falls back to an
 * authored routine if validation fails.
 */
export function recommend(context: RecommendationContext): Recommendation {
  const signals = context.signals ?? emptySignals();
  const full: RecommendationContext = {
    ...context,
    signals,
    constraints: context.constraints ?? [],
    safetyFlags: safetyFlagsOf(context),
    allowFloor: floorAllowed(context),
    timeOfDay: context.timeOfDay ?? "afternoon",
    pro: Boolean(context.pro),
  };

  const useAuthoredFirst = signals.sessionCount < 2 && !context.recentExerciseIds?.length;
  let program: Program | null = null;
  let authored = false;
  let fallback = false;

  if (useAuthoredFirst) {
    const candidate = authoredCandidates(full)
      .map((entry) => adaptProgram(entry, full))
      .find((entry) => validateProgram(entry, full).ok);
    if (candidate) {
      program = candidate;
      authored = true;
    }
  }

  if (!program) {
    const generated = buildProgram(full);
    if (validateProgram(generated, full).ok) {
      program = generated;
    } else {
      program = safeFallbackProgram(full);
      authored = !program.generated;
      fallback = true;
    }
  }

  const validation = validateProgram(program, full);
  const { reason, personalized } = explain(program, full);

  return {
    id: newRecommendationId(),
    algorithmVersion: ALGORITHM_VERSION,
    program,
    reason,
    personalized,
    exercises: program.steps.map((step, index) => ({
      exerciseId: step.exerciseId,
      phase: step.phase ?? ROUTINE_PHASES[Math.min(index, ROUTINE_PHASES.length - 1)],
      score: 0,
    })),
    authored,
    fallback,
    validation,
    inputs: {
      need: full.need,
      setup: full.setup,
      durationMinutes: full.durationMinutes,
      timeOfDay: full.timeOfDay ?? "afternoon",
      pro: Boolean(full.pro),
      constraints: full.constraints ?? [],
      sessionCount: signals.sessionCount,
    },
  };
}

/** Older entry point. Same engine, smaller answer. */
export function getRecommendedProgram(context: RecommendationContext): RecommendedProgram {
  const recommendation = recommend(context);
  return { program: recommendation.program, reason: recommendation.reason };
}

/** Alternatives for one move, best first. The safer swap always leads if it fits. */
export function swapCandidates(
  exerciseId: string,
  program: Program,
  context: RecommendationContext,
  limit = 3,
): Exercise[] {
  const current = getExercise(exerciseId);
  if (!current) return [];
  const inProgram = new Set(program.steps.map((step) => step.exerciseId));
  const pool = getExercises().filter(
    (exercise) =>
      exercise.id !== current.id && !inProgram.has(exercise.id) && eligible(exercise, context),
  );

  const slot: TemplateSlot = {
    phase: current.phases[0] ?? "mobilize",
    seconds: 30,
    bodyAreas: current.bodyAreas,
    movementTypes: [current.movementType],
  };
  const ranked = pool
    .map((exercise) => ({
      exercise,
      score: scoreForSlot(exercise, slot, [], context, context.seed ?? "swap"),
    }))
    .sort((a, b) => b.score - a.score || a.exercise.id.localeCompare(b.exercise.id))
    .map((entry) => entry.exercise);

  const safer = current.saferSwapId ? ranked.find((e) => e.id === current.saferSwapId) : null;
  const rest = ranked.filter((exercise) => exercise !== safer);
  return [...(safer ? [safer] : []), ...rest].slice(0, limit);
}

/** A move that gives the area that did not feel right a rest. */
function restsArea(candidate: Exercise, original: Exercise): boolean {
  if (candidate.movementType === "breathing") return true;
  return candidate.bodyArea !== original.bodyArea && !candidate.bodyAreas.includes(original.bodyArea);
}

/**
 * Replacements for "Doesn't feel right", best first.
 *
 * Never the same body area (chin tuck -> suboccipital nod is the same motion),
 * never a move that makes a seated person stand up or a standing person sit,
 * gentle before moderate, and a slow breath as the last resort. The move's
 * saferSwapId leads when it rests the area too.
 */
export function discomfortCandidates(
  exerciseId: string,
  program: Program,
  context: RecommendationContext,
  limit = 3,
): Exercise[] {
  const current = getExercise(exerciseId);
  if (!current) return [];
  const full: RecommendationContext = {
    ...context,
    safetyFlags: safetyFlagsOf(context),
    allowFloor: floorAllowed(context),
  };
  const inProgram = new Set(program.steps.map((step) => getExercise(step.exerciseId)?.id ?? step.exerciseId));
  const position = effectiveSetup(current, full.setup);
  const pool = getExercises().filter(
    (exercise) =>
      exercise.id !== current.id &&
      !inProgram.has(exercise.id) &&
      eligible(exercise, full) &&
      restsArea(exercise, current) &&
      effectiveSetup(exercise, full.setup) === position,
  );

  const slot: TemplateSlot = { phase: current.phases[0] ?? "mobilize", seconds: 30 };
  const ranked = pool
    .map((exercise) => ({
      exercise,
      score:
        scoreForSlot(exercise, slot, [], full, full.seed ?? "swap") +
        (exercise.intensity === "gentle" ? 10 : 0) -
        (isStaticHold(exercise) ? 5 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.exercise.id.localeCompare(b.exercise.id))
    .map((entry) => entry.exercise);

  const safer = current.saferSwapId ? ranked.find((exercise) => exercise.id === current.saferSwapId) : undefined;
  const breaths = ranked.filter((exercise) => exercise.movementType === "breathing" && exercise !== safer);
  const moves = ranked.filter((exercise) => exercise.movementType !== "breathing" && exercise !== safer);
  const ordered = [...(safer ? [safer] : []), ...moves.slice(0, Math.max(0, limit - 1)), ...breaths];
  // Always keep a breath in the list when one is available.
  const withBreath =
    breaths.length && !ordered.slice(0, limit).some((exercise) => exercise.movementType === "breathing")
      ? [...ordered.slice(0, limit - 1), breaths[0]]
      : ordered;
  return withBreath.slice(0, limit);
}

/** The single replacement "Doesn't feel right" swaps to, or null to skip the move. */
export function discomfortReplacement(
  exerciseId: string,
  program: Program,
  context: RecommendationContext,
): Exercise | null {
  return discomfortCandidates(exerciseId, program, context, 1)[0] ?? null;
}

/** Rebuilds the exact routine a stored recommendation described. */
export function programFromStored(stored: StoredRecommendation): Program | null {
  if (!stored.steps.length) return null;
  const steps: ProgramStep[] = [];
  for (const step of stored.steps) {
    const exercise = getExercise(step.exerciseId);
    if (!exercise) return null;
    steps.push({
      exerciseId: exercise.id,
      durationSec: step.durationSec,
      dose: exercise.defaultDose,
      phase: step.phase,
    });
  }
  return {
    id: stored.programId,
    access: "free",
    name: stored.programName,
    shortLabel: stored.programShortLabel,
    durationMin: stored.recommendedDuration,
    durationTargetSec: stored.recommendedDuration * 60,
    tagline: stored.reason,
    primaryNeed: stored.need,
    setup: stored.setup,
    steps,
    generated: !getProgram(stored.programId),
  };
}

/**
 * Resolves any program id, authored or generated, into a runnable program.
 *
 * A stored recommendation runs exactly as it was recommended, unless something
 * in it has since been ruled out (a "Go easy on" answer, pain, floor); then
 * only those moves are swapped.
 */
export function resolveProgram(
  programId: string,
  setup: SetupRequest,
  pro: boolean,
  options: {
    constraints?: FunctionalConstraint[];
    safetyFlags?: SafetyFlag[];
    allowFloor?: boolean;
    signals?: PersonalizationSignals;
    stored?: StoredRecommendation | null;
  } = {},
): Program | null {
  const exclusions = {
    constraints: options.constraints,
    safetyFlags: options.safetyFlags,
    allowFloor: options.allowFloor,
    signals: options.signals,
  };
  // Only hard safety exclusions re-adapt a stored routine; a move that has
  // merely been skipped a lot since stays, so the recommendation is honoured.
  const safetyOnly: AdaptContext = {
    setup,
    pro: true,
    constraints: options.constraints,
    safetyFlags: safetyFlagsOf(exclusions),
    allowFloor: floorAllowed(exclusions),
    signals: options.signals
      ? { ...emptySignals(), avoidAreas: options.signals.avoidAreas ?? [], painfulAreas: options.signals.painfulAreas ?? [] }
      : undefined,
  };

  if (options.stored && options.stored.programId === programId) {
    const fromStored = programFromStored(options.stored);
    if (fromStored) return adaptProgram(fromStored, safetyOnly);
  }

  const authored = getProgram(programId);
  if (authored) return adaptProgram(authored, { setup, pro, ...exclusions });

  const parsed = parseGeneratedProgramId(programId);
  if (!parsed) return null;
  return buildProgram({
    ...parsed,
    setup,
    pro,
    ...exclusions,
  });
}

/** Turns a recommendation into the compact record the client stores and sends. */
export function toStoredRecommendation(
  recommendation: Recommendation,
  source: "server" | "client",
): StoredRecommendation {
  return {
    id: recommendation.id,
    algorithmVersion: recommendation.algorithmVersion,
    need: recommendation.inputs.need,
    setup: recommendation.inputs.setup,
    requestedDuration: recommendation.inputs.durationMinutes,
    recommendedDuration: recommendation.program.durationMin,
    timeOfDay: recommendation.inputs.timeOfDay,
    reason: recommendation.reason,
    personalized: recommendation.personalized,
    programId: recommendation.program.id,
    programName: recommendation.program.name,
    programShortLabel: recommendation.program.shortLabel,
    exerciseIds: recommendation.program.steps.map((step) => step.exerciseId),
    steps: recommendation.program.steps.map((step) => ({
      exerciseId: step.exerciseId,
      durationSec: step.durationSec,
      phase: step.phase,
    })),
    authored: recommendation.authored,
    createdAt: new Date().toISOString(),
    source,
  };
}
