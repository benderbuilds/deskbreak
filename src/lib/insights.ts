import { todayKey } from "./dates";
import type { WorkoutSession } from "./types";

/**
 * Honest numbers for Progress and the Done screen.
 *
 * Time is what was actually spent moving, never the advertised length of the
 * routine: a 3-minute reset left after 40 seconds is 40 seconds. Rates and
 * patterns wait until there is enough to say something true.
 */

/** Rated sessions needed before any "helped X%" style pattern is shown. */
export const PATTERNS_READY_AT = 5;
/** A routine is only called "most helpful" when it helped at least this often. */
export const MOST_HELPFUL_MIN_RATE = 0.5;
/** ...and was rated at least this many times. */
export const MOST_HELPFUL_MIN_RATED = 2;

/**
 * Seconds actually spent moving in one session.
 *
 * Summed from the per-move records (time on each move, including a move that
 * was swapped or skipped part-way). Older sessions without records fall back
 * to the session's measured elapsed time. Never the planned minutes.
 */
export function activeSecondsFor(session: Pick<WorkoutSession, "exercises" | "elapsedSec">): number {
  const fromRecords = (session.exercises ?? []).reduce(
    (sum, record) => sum + Math.max(0, record.actualSec || 0),
    0,
  );
  const elapsed = Math.max(0, Math.round(session.elapsedSec || 0));
  if (fromRecords > 0) return elapsed > 0 ? Math.min(fromRecords, elapsed + 5) : fromRecords;
  return elapsed;
}

/**
 * The local days a reset was finished on, in order, each counted once.
 *
 * The day is the one the person was living in, not UTC: a 9 pm reset in New
 * York belongs to that evening, not to tomorrow.
 */
export function activeDayKeys(history: Pick<WorkoutSession, "finishedAt">[]): string[] {
  const keys = new Set<string>();
  for (const session of history) {
    const date = new Date(session.finishedAt);
    if (!Number.isNaN(date.getTime())) keys.add(todayKey(date));
  }
  return [...keys].sort();
}

export function totalActiveSeconds(history: Pick<WorkoutSession, "exercises" | "elapsedSec">[]): number {
  return history.reduce((sum, session) => sum + activeSecondsFor(session), 0);
}

/** "40 seconds", "1 minute", "12 minutes". Rounds down: we never round anyone up. */
export function formatActiveTime(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) return `${safe} second${safe === 1 ? "" : "s"}`;
  const minutes = Math.floor(safe / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/** "3 minutes moved" for the Done screen, from real elapsed time. */
export function sessionMovedLabel(session: Pick<WorkoutSession, "exercises" | "elapsedSec">): string {
  return `${formatActiveTime(activeSecondsFor(session))} moved`;
}

export function ratedSessions<T extends Pick<WorkoutSession, "perceivedEffect">>(history: T[]): T[] {
  return history.filter((session) => Boolean(session.perceivedEffect));
}

/** True once there are enough rated sessions to show helped-rate patterns. */
export function patternsReady(history: Pick<WorkoutSession, "perceivedEffect">[]): boolean {
  return ratedSessions(history).length >= PATTERNS_READY_AT;
}

/** How many more rated sessions until patterns show. */
export function ratingsUntilPatterns(history: Pick<WorkoutSession, "perceivedEffect">[]): number {
  return Math.max(0, PATTERNS_READY_AT - ratedSessions(history).length);
}

/** Whether a "most helpful" label is earned: rated enough, and helped at least half the time. */
export function isHelpfulEnough(helped: number, rated: number): boolean {
  return rated >= MOST_HELPFUL_MIN_RATED && helped / rated >= MOST_HELPFUL_MIN_RATE;
}

export type DayActivity = {
  /** Guided resets finished that day. */
  resets: number;
  /** One-minute stands or walks logged outside a workout. */
  microBreaks: number;
  /** Seconds actually spent in resets. Micro-breaks are counted, not timed. */
  activeSeconds: number;
};

/** What someone did on one local day: resets and micro-breaks both count. */
export function activityOn(
  history: Pick<WorkoutSession, "finishedAt" | "exercises" | "elapsedSec">[],
  microBreaks: string[],
  dateKey: string = todayKey(),
): DayActivity {
  const sameDay = (iso: string) => {
    const date = new Date(iso);
    return !Number.isNaN(date.getTime()) && todayKey(date) === dateKey;
  };
  const sessions = history.filter((session) => sameDay(session.finishedAt));
  return {
    resets: sessions.length,
    microBreaks: microBreaks.filter(sameDay).length,
    activeSeconds: totalActiveSeconds(sessions),
  };
}
