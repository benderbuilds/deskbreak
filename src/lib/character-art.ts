import manifest from "../../data/art-manifest.json";
import type { SetupId } from "./types";

export type CharacterPose =
  | "exercise"
  | "idle"
  | "ready"
  | "done"
  | "locked"
  | "fallback";

/** Every stem that actually exists in public/character/, from the manifest. */
const FILES = new Set<string>(manifest.files);

export const NEUTRAL_FALLBACK = "stretch-fallback";

const POSE_STEMS: Record<Exclude<CharacterPose, "exercise">, string> = {
  idle: "stretch-idle",
  ready: "stretch-ready",
  done: "stretch-done",
  locked: "stretch-locked",
  fallback: NEUTRAL_FALLBACK,
};

function path(stem: string): string {
  return `/character/${stem}.svg`;
}

function pick(stem: string): string | null {
  return FILES.has(stem) ? stem : null;
}

export type ResolvedArt = {
  /** Starting position. Always a real file. */
  start: string;
  /** Ending position, or null when the move is a hold with no second frame. */
  end: string | null;
  /** True when we fell back to the neutral pose because the move has no art. */
  isFallback: boolean;
};

/**
 * Resolves art for one exercise.
 *
 * The only two outcomes are the exercise's own artwork or the neutral Stretch
 * fallback. We never borrow another exercise's pose: a wrong picture teaches a
 * wrong movement, which is worse than no picture at all.
 */
export function resolveExerciseArt(
  exerciseId: string,
  setup?: SetupId | null,
): ResolvedArt {
  const stem =
    (setup === "standing" ? pick(`${exerciseId}-standing`) : null) ??
    pick(exerciseId);

  if (!stem) {
    return { start: path(NEUTRAL_FALLBACK), end: null, isFallback: true };
  }

  const end = pick(`${stem}-b`);
  return { start: path(stem), end: end ? path(end) : null, isFallback: false };
}

export function resolvePoseArt(
  pose: Exclude<CharacterPose, "exercise">,
  setup?: SetupId | null,
): string {
  const base = POSE_STEMS[pose];
  const stem =
    (setup === "standing" ? pick(`${base}-standing`) : null) ??
    pick(base) ??
    NEUTRAL_FALLBACK;
  return path(stem);
}

export function hasDedicatedArt(exerciseId: string): boolean {
  return FILES.has(exerciseId) || FILES.has(`${exerciseId}-standing`);
}

/** Every stem the manifest knows about. Used by the art audit test. */
export function knownArtStems(): string[] {
  return [...FILES];
}
