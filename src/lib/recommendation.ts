import { scaleStepsToTarget } from "./dose";
import {
  effectiveSetup,
  fitsSetup,
  getExercise,
  getExercises,
  getProgram,
  getPrograms,
  getTemplates,
} from "./content";
import {
  emptySignals,
  helpRate,
  prefersSeated,
  prefersStanding,
  type PersonalizationSignals,
} from "./personalization";
import {
  ROUTINE_PHASES,
  type DurationMinutes,
  type Exercise,
  type FunctionalConstraint,
  type PrimaryNeed,
  type Program,
  type ProgramStep,
  type RoutinePhase,
  type RoutineTemplate,
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
export const ALGORITHM_VERSION = "3.0.0";

export type RecommendationContext = {
  need: PrimaryNeed;
  setup: SetupRequest;
  durationMinutes: DurationMinutes;
  timeOfDay?: TimeOfDay;
  /** Pro unlocks the deeper catalog; free stays on the free movements. */
  pro?: boolean;
  constraints?: FunctionalConstraint[];
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
  general: "Desk",
};

const NEED_PROMISE: Record<PrimaryNeed, string> = {
  neck_shoulders: "Undo the laptop lean.",
  back_hips: "Loosen up after sitting.",
  wrists_hands: "Give keyboard hands a break.",
  energy: "Wake yourself up without another coffee.",
  stress: "Slow things down for a few minutes.",
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
 * ------------------------------------------------------------------ */

function violatesConstraint(
  exercise: Exercise,
  constraints: FunctionalConstraint[] | undefined,
): boolean {
  if (!constraints?.length) return false;
  return exercise.constraints.some((constraint) => constraints.includes(constraint));
}

/** Behaviour that means "stop showing me this" without a settings screen. */
function suppressedBySignals(exercise: Exercise, signals?: PersonalizationSignals): boolean {
  const signal = signals?.exercises[exercise.id];
  if (!signal) return false;
  if (signal.discomfort >= 1) return true;
  if (signal.swapped >= 2) return true;
  if (signal.skipped >= 3 && signal.skipped > signal.completed) return true;
  return false;
}

function eligible(exercise: Exercise, context: RecommendationContext): boolean {
  if (!fitsSetup(exercise, context.setup)) return false;
  if (!context.pro && exercise.access !== "free") return false;
  if (violatesConstraint(exercise, context.constraints)) return false;
  if (suppressedBySignals(exercise, context.signals)) return false;
  return true;
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
  return WEIGHTS.relevance * (0.65 * area + 0.35 * need);
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
  const pool = getExercises().filter((exercise) => eligible(exercise, context));
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
  return scaleStepsToTarget(sequenceSteps(steps, setup), targetSec);
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
  return false;
}

export function validateProgram(
  program: Program,
  context: RecommendationContext,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const exercises = program.steps.map((step) => getExercise(step.exerciseId));

  if (!program.steps.length) issues.push("empty");
  if (exercises.some((exercise) => !exercise)) issues.push("safety");
  const present = exercises.filter((exercise): exercise is Exercise => Boolean(exercise));

  const total = program.steps.reduce((sum, step) => sum + step.durationSec, 0);
  const target = program.durationTargetSec ?? program.durationMin * 60;
  if (Math.abs(total - target) > 5) issues.push("time");

  if (present.some((exercise) => violatesConstraint(exercise, context.constraints))) {
    issues.push("constraint");
  }
  if (present.some((exercise) => !fitsSetup(exercise, context.setup))) issues.push("setup");
  if (!context.pro && present.some((exercise) => exercise.access !== "free")) {
    issues.push("access");
  }

  const ids = program.steps.map((step) => step.exerciseId);
  const flags = present.map((exercise) => effectiveSetup(exercise, context.setup) === "standing");
  if (new Set(ids).size !== ids.length || countTransitions(flags) > 2) {
    issues.push("sequence");
  }

  const recent = (context.signals?.recentExerciseIds ?? context.recentExerciseIds ?? []).slice(0, 6);
  if (ids.length >= 3 && recent.length) {
    const shared = ids.filter((id) => recent.includes(id)).length;
    if (shared / ids.length > 0.6) issues.push("repetition");
  }

  if (context.need === "general" && context.durationMinutes >= 3) {
    const areas = new Set(present.flatMap((exercise) => exercise.bodyAreas));
    if (areas.size < 4) issues.push("balance");
  } else if (context.need !== "general" && present.length) {
    // Most of a targeted routine has to be about the thing the user picked.
    // Longer routines deliberately round themselves out with other areas, so
    // the floor is 40% rather than a strict majority.
    const onTopic = present.filter((exercise) => isOnTopic(exercise, context.need)).length;
    if (onTopic < Math.max(2, Math.floor(present.length * 0.4))) issues.push("balance");
  }

  return { ok: issues.length === 0, issues };
}

/* ------------------------------------------------------------------ *
 * Authored routines: the illustrated, hand-sequenced fallbacks.
 * ------------------------------------------------------------------ */

function authoredCandidates(context: RecommendationContext): Program[] {
  return getPrograms().filter(
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
  );
}

/**
 * Adapts an authored program to the position the user is actually in and to
 * their constraints, swapping any move that does not fit for its safer
 * alternative or the closest move that does.
 */
export function adaptProgram(
  program: Program,
  context: Pick<RecommendationContext, "setup" | "constraints" | "pro">,
): Program {
  const setup = context.setup;
  const used = new Set(program.steps.map((step) => step.exerciseId));
  const fits = (exercise: Exercise) =>
    fitsSetup(exercise, setup) &&
    !violatesConstraint(exercise, context.constraints) &&
    (context.pro || exercise.access === "free" || program.access === "pro");

  const needsAdapting = program.steps.some((step) => {
    const exercise = getExercise(step.exerciseId);
    return exercise ? !fits(exercise) : false;
  });
  if (!needsAdapting) return { ...program, setup };

  const steps = program.steps.map((step) => {
    const exercise = getExercise(step.exerciseId);
    if (!exercise || fits(exercise)) return step;

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
    steps: scaleStepsToTarget(
      sequenceSteps(kept, setup),
      program.durationTargetSec ?? program.durationMin * 60,
    ),
  };
}

/** Older name, kept for existing callers. */
export function adaptProgramToSetup(program: Program, setup: SetupId): Program {
  return adaptProgram(program, { setup, pro: true });
}

/** The routine we can always fall back to, whatever else has gone wrong. */
export function safeFallbackProgram(context: RecommendationContext): Program {
  const authored = authoredCandidates(context)
    .map((program) => adaptProgram(program, context))
    .find((program) => validateProgram(program, { ...context, signals: undefined }).ok);
  if (authored) return authored;

  const general = getProgram(
    context.setup === "standing" ? "desk-reset-3min-standing" : "desk-reset-3min",
  );
  const adapted = general ? adaptProgram(general, context) : null;
  if (adapted && adapted.steps.length) return adapted;

  // Truly last resort: a generated routine with personalization switched off.
  return buildProgram({ ...context, signals: undefined, recentExerciseIds: [] });
}

/* ------------------------------------------------------------------ *
 * Explanation.
 * ------------------------------------------------------------------ */

function explain(
  program: Program,
  context: RecommendationContext,
): { reason: string; personalized: boolean } {
  const signals = context.signals;
  const timeOfDay = context.timeOfDay ?? "afternoon";
  const label = NEED_LABELS[context.need].toLowerCase();

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
      exercise.id !== exerciseId && !inProgram.has(exercise.id) && eligible(exercise, context),
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
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.exercise);

  const safer = current.saferSwapId ? ranked.find((e) => e.id === current.saferSwapId) : null;
  const rest = ranked.filter((exercise) => exercise !== safer);
  return [...(safer ? [safer] : []), ...rest].slice(0, limit);
}

/** Rebuilds the exact routine a stored recommendation described. */
export function programFromStored(stored: StoredRecommendation): Program | null {
  if (!stored.steps.length) return null;
  const steps: ProgramStep[] = [];
  for (const step of stored.steps) {
    const exercise = getExercise(step.exerciseId);
    if (!exercise) return null;
    steps.push({
      exerciseId: step.exerciseId,
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

/** Resolves any program id, authored or generated, into a runnable program. */
export function resolveProgram(
  programId: string,
  setup: SetupRequest,
  pro: boolean,
  options: {
    constraints?: FunctionalConstraint[];
    signals?: PersonalizationSignals;
    stored?: StoredRecommendation | null;
  } = {},
): Program | null {
  if (options.stored && options.stored.programId === programId) {
    const fromStored = programFromStored(options.stored);
    if (fromStored) return fromStored;
  }

  const authored = getProgram(programId);
  if (authored) return adaptProgram(authored, { setup, pro, constraints: options.constraints });

  const parsed = parseGeneratedProgramId(programId);
  if (!parsed) return null;
  return buildProgram({
    ...parsed,
    setup,
    pro,
    constraints: options.constraints,
    signals: options.signals,
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
