import { getExercise } from "./content";
import { canonicalExerciseId } from "./exercise-aliases";
import type {
  BodyArea,
  DurationMinutes,
  ExerciseSignal,
  PerceivedEffect,
  PrimaryNeed,
  SafetyFlag,
  SetupId,
  TimeOfDay,
  WorkoutSession,
} from "./types";

/**
 * Everything the recommendation engine knows about one person.
 *
 * Derived from behaviour, never asked for. Built on the client from local
 * history and on the server from the sessions table, so both sides produce the
 * same shape and the engine does not care where it came from.
 */
export type OutcomeTally = { better: number; same: number; worse: number; rated: number };

export type PersonalizationSignals = {
  sessionCount: number;
  exercises: Record<string, ExerciseSignal>;
  /** Newest first, de-duplicated. */
  recentExerciseIds: string[];
  setupOutcomes: Record<SetupId, OutcomeTally>;
  needOutcomes: Partial<Record<PrimaryNeed, OutcomeTally>>;
  timeOfDayOutcomes: Partial<Record<TimeOfDay, OutcomeTally>>;
  durationCounts: Partial<Record<DurationMinutes, number>>;
  /** Minutes-of-day at which completed sessions started, newest first. */
  completionMinutes: number[];
  /**
   * Areas to leave alone right now: reported painful, or rated worse twice or
   * more, in the last AREA_WINDOW_DAYS. Every recommendation path excludes
   * moves whose primary area is listed here.
   */
  avoidAreas: BodyArea[];
  /** Areas rated worse once recently: kept, but gentler and lower priority. */
  easeAreas: BodyArea[];
  /** Recent "worse" count per area, for the repeat-worse clinician line. */
  worseAreaCounts: Partial<Record<BodyArea, number>>;
  /** Areas reported painful in the window. */
  painfulAreas: BodyArea[];
  /**
   * Not behaviour: the person's own "Go easy on" answers and floor opt-in.
   * Carried with the signals so every engine entry point that already takes
   * signals honours them. Never persisted server-side.
   */
  screening?: Screening;
};

export type Screening = { safetyFlags: SafetyFlag[]; allowFloorWork: boolean };

/** How long a painful or worse area is left alone. */
export const AREA_WINDOW_DAYS = 7;
/** "Worse" this many times for one area in the window: leave it alone. */
export const WORSE_AREA_AVOID_AT = 2;

/**
 * The areas a targeted reset is about. When a targeted reset is rated worse
 * and the person does not say which area, these take the blame.
 */
export const NEED_FOCUS_AREAS: Partial<Record<PrimaryNeed, BodyArea[]>> = {
  neck_shoulders: ["neck", "shoulders"],
  back_hips: ["core", "hips"],
  wrists_hands: ["wrists"],
};

export const emptySignal = (): ExerciseSignal => ({
  completed: 0,
  skipped: 0,
  swapped: 0,
  discomfort: 0,
  better: 0,
  worse: 0,
  lastAt: null,
});

export const emptyTally = (): OutcomeTally => ({ better: 0, same: 0, worse: 0, rated: 0 });

export const emptySignals = (): PersonalizationSignals => ({
  sessionCount: 0,
  exercises: {},
  recentExerciseIds: [],
  setupOutcomes: { seated: emptyTally(), standing: emptyTally() },
  needOutcomes: {},
  timeOfDayOutcomes: {},
  durationCounts: {},
  completionMinutes: [],
  avoidAreas: [],
  easeAreas: [],
  worseAreaCounts: {},
  painfulAreas: [],
});

function addOutcome(tally: OutcomeTally, effect: PerceivedEffect): OutcomeTally {
  return {
    better: tally.better + (effect === "better" ? 1 : 0),
    same: tally.same + (effect === "same" ? 1 : 0),
    worse: tally.worse + (effect === "worse" ? 1 : 0),
    rated: tally.rated + 1,
  };
}

/** Share of rated sessions that helped, with a mild prior so small counts stay humble. */
export function helpRate(tally: OutcomeTally): number {
  return (tally.better + 1) / (tally.rated + 2);
}

export function timeOfDayFor(iso: string): TimeOfDay {
  const hour = new Date(iso).getHours();
  if (hour < 11) return "morning";
  if (hour < 14) return "midday";
  if (hour < 18) return "afternoon";
  return "evening";
}

/**
 * Folds one finished session into the per-exercise signal map.
 *
 * Outcome attribution: a "better" session credits every move that was actually
 * completed. A "worse" session debits every move, and debits a swapped or
 * skipped move twice, because the user already told us something about it.
 */
export function applySessionToSignals(
  signals: Record<string, ExerciseSignal>,
  session: WorkoutSession,
): Record<string, ExerciseSignal> {
  const next: Record<string, ExerciseSignal> = { ...signals };
  const touch = (id: string) => {
    next[id] = { ...(next[id] ?? emptySignal()), lastAt: session.finishedAt };
    return next[id];
  };

  const records = session.exercises.length
    ? session.exercises
    : [
        ...session.completedExerciseIds.map((exerciseId, sequence) => ({
          exerciseId,
          sequence,
          plannedSec: 0,
          actualSec: 0,
          completed: true,
          skipped: false,
          swapped: false,
          swappedToExerciseId: null,
          discomfortReported: false,
          discomfortReason: null,
        })),
        ...session.skippedExerciseIds.map((exerciseId, sequence) => ({
          exerciseId,
          sequence,
          plannedSec: 0,
          actualSec: 0,
          completed: false,
          skipped: true,
          swapped: false,
          swappedToExerciseId: null,
          discomfortReported: false,
          discomfortReason: null,
        })),
      ];

  for (const record of records) {
    const signal = touch(canonicalExerciseId(record.exerciseId));
    if (record.completed) signal.completed += 1;
    if (record.skipped) signal.skipped += 1;
    if (record.swapped) signal.swapped += 1;
    if (record.discomfortReported) signal.discomfort += 1;
    if (record.swapped && record.swappedToExerciseId) {
      const replacement = touch(canonicalExerciseId(record.swappedToExerciseId));
      if (record.completed) replacement.completed += 1;
    }
  }
  return next;
}

/** Applies a later "how do you feel?" answer to the moves in that session. */
export function applyFeedbackToSignals(
  signals: Record<string, ExerciseSignal>,
  session: WorkoutSession,
  effect: PerceivedEffect,
): Record<string, ExerciseSignal> {
  if (effect === "same") return signals;
  const next: Record<string, ExerciseSignal> = { ...signals };
  const ids = session.exercises.length
    ? session.exercises
    : session.completedExerciseIds.map((exerciseId) => ({
        exerciseId,
        completed: true,
        skipped: false,
        swapped: false,
        swappedToExerciseId: null,
      }));

  for (const record of ids) {
    const targetId = canonicalExerciseId(
      record.swapped && record.swappedToExerciseId
        ? record.swappedToExerciseId
        : record.exerciseId,
    );
    const signal = { ...(next[targetId] ?? emptySignal()) };
    if (effect === "better" && record.completed) signal.better += 1;
    if (effect === "worse") {
      signal.worse += record.skipped || record.swapped ? 2 : 1;
    }
    next[targetId] = signal;
  }
  return next;
}

/** The areas a session's "worse" rating points at: what the person said, or the reset's focus. */
export function worseAreasFor(session: WorkoutSession): BodyArea[] {
  if (session.perceivedEffect !== "worse") return [];
  if (session.worseAreas?.length) return [...new Set(session.worseAreas)];
  return NEED_FOCUS_AREAS[session.primaryNeed] ?? [];
}

/** Primary areas of the moves reported "painful" in a session. */
export function painfulAreasFor(session: WorkoutSession): BodyArea[] {
  const areas = session.exercises
    .filter((record) => record.discomfortReason === "painful")
    .map((record) => getExercise(canonicalExerciseId(record.exerciseId))?.bodyArea)
    .filter((area): area is BodyArea => Boolean(area));
  return [...new Set(areas)];
}

/**
 * Which areas to leave alone, and which to go gently on, as of `now`.
 *
 * Pain on any move leaves its area alone for AREA_WINDOW_DAYS. "Worse" twice
 * for the same area in that window does the same; once makes it gentler.
 */
export function areaSignalsFromHistory(
  history: WorkoutSession[],
  now: Date = new Date(),
): Pick<PersonalizationSignals, "avoidAreas" | "easeAreas" | "worseAreaCounts" | "painfulAreas"> {
  const since = now.getTime() - AREA_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const painful = new Set<BodyArea>();
  const worse: Partial<Record<BodyArea, number>> = {};
  for (const session of history) {
    const at = new Date(session.finishedAt || session.startedAt).getTime();
    if (Number.isNaN(at) || at < since || at > now.getTime() + 60_000) continue;
    for (const area of painfulAreasFor(session)) painful.add(area);
    for (const area of worseAreasFor(session)) worse[area] = (worse[area] ?? 0) + 1;
  }
  const avoid = new Set<BodyArea>(painful);
  const ease = new Set<BodyArea>();
  for (const [area, count] of Object.entries(worse) as [BodyArea, number][]) {
    if (count >= WORSE_AREA_AVOID_AT) avoid.add(area);
    else ease.add(area);
  }
  for (const area of avoid) ease.delete(area);
  return {
    avoidAreas: [...avoid],
    easeAreas: [...ease],
    worseAreaCounts: worse,
    painfulAreas: [...painful],
  };
}

/** Builds the full signal set from history. Cheap enough to run on every render. */
export function signalsFromHistory(
  history: WorkoutSession[],
  exercises: Record<string, ExerciseSignal>,
  limit = 60,
  now: Date = new Date(),
): PersonalizationSignals {
  const signals = emptySignals();
  signals.exercises = exercises;
  const recent = history.slice(0, limit);
  signals.sessionCount = history.length;
  Object.assign(signals, areaSignalsFromHistory(recent, now));

  for (const session of recent) {
    for (const raw of session.completedExerciseIds) {
      const id = canonicalExerciseId(raw);
      if (!signals.recentExerciseIds.includes(id)) signals.recentExerciseIds.push(id);
    }
    if (signals.recentExerciseIds.length > 24) {
      signals.recentExerciseIds = signals.recentExerciseIds.slice(0, 24);
    }

    signals.durationCounts[session.durationMin] =
      (signals.durationCounts[session.durationMin] ?? 0) + 1;

    const started = new Date(session.startedAt);
    if (!Number.isNaN(started.getTime())) {
      signals.completionMinutes.push(started.getHours() * 60 + started.getMinutes());
    }

    const effect = session.perceivedEffect;
    if (!effect) continue;
    const setup: SetupId = session.setup === "standing" ? "standing" : "seated";
    signals.setupOutcomes[setup] = addOutcome(signals.setupOutcomes[setup], effect);
    signals.needOutcomes[session.primaryNeed] = addOutcome(
      signals.needOutcomes[session.primaryNeed] ?? emptyTally(),
      effect,
    );
    const tod = timeOfDayFor(session.startedAt);
    signals.timeOfDayOutcomes[tod] = addOutcome(
      signals.timeOfDayOutcomes[tod] ?? emptyTally(),
      effect,
    );
  }

  return signals;
}

/** The duration a person actually does, when they have shown a clear preference. */
export function preferredDurationFrom(
  signals: PersonalizationSignals,
): DurationMinutes | null {
  const entries = Object.entries(signals.durationCounts) as [string, number][];
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total < 4) return null;
  const [top, count] = entries.sort((a, b) => b[1] - a[1])[0];
  return count / total >= 0.6 ? (Number(top) as DurationMinutes) : null;
}

/** True when standing resets have clearly worked better than seated ones. */
export function prefersStanding(signals: PersonalizationSignals): boolean {
  const standing = signals.setupOutcomes.standing;
  const seated = signals.setupOutcomes.seated;
  if (standing.rated < 3) return false;
  return helpRate(standing) >= 0.7 && helpRate(standing) > helpRate(seated) + 0.15;
}

export function prefersSeated(signals: PersonalizationSignals): boolean {
  const standing = signals.setupOutcomes.standing;
  const seated = signals.setupOutcomes.seated;
  if (seated.rated < 3) return false;
  return helpRate(seated) >= 0.7 && helpRate(seated) > helpRate(standing) + 0.15;
}
