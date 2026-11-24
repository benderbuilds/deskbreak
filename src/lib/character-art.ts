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
/** Stems with an SVG illustration. */
const SVG = new Set<string>(manifest.svg);
/** Stems with a WebP instructor photo. */
const WEBP = new Set<string>(manifest.webp);

export const NEUTRAL_FALLBACK = "stretch-fallback";
export const NEUTRAL_FALLBACK_SRC = `/character/${NEUTRAL_FALLBACK}.svg`;

const POSE_STEMS: Record<Exclude<CharacterPose, "exercise">, string> = {
  idle: "stretch-idle",
  ready: "stretch-ready",
  done: "stretch-done",
  locked: "stretch-locked",
  fallback: NEUTRAL_FALLBACK,
};

function svgPath(stem: string): string {
  return `/character/${stem}.svg`;
}

function pick(stem: string): string | null {
  return FILES.has(stem) ? stem : null;
}

/**
 * A stem is shown as a photo only when its whole motion pair is photographed.
 * Mixing a photo start with an illustrated end frame would flicker between two
 * different people every 900 ms.
 */
function usesPhoto(stem: string): boolean {
  if (!WEBP.has(stem)) return false;
  const end = `${stem}-b`;
  return !FILES.has(end) || WEBP.has(end);
}

function framePath(stem: string, photo: boolean): string {
  return photo ? `/character/${stem}.webp` : svgPath(stem);
}

export type ResolvedArt = {
  /** Starting position. Always a real file. */
  start: string;
  /** Ending position, or null when the move is a hold with no second frame. */
  end: string | null;
  /** True when we fell back to the neutral pose because the move has no art. */
  isFallback: boolean;
  /** True when the frames are instructor photos rather than Stretch illustrations. */
  isPhoto: boolean;
};

/**
 * Resolves art for one exercise.
 *
 * The only outcomes are the exercise's own artwork (photo or illustration) or
 * the neutral Stretch fallback. We never borrow another exercise's pose: a
 * wrong picture teaches a wrong movement, which is worse than no picture.
 */
export function resolveExerciseArt(
  exerciseId: string,
  setup?: SetupId | null,
): ResolvedArt {
  const stem =
    (setup === "standing" ? pick(`${exerciseId}-standing`) : null) ??
    pick(exerciseId);

  if (!stem) {
    return { start: NEUTRAL_FALLBACK_SRC, end: null, isFallback: true, isPhoto: false };
  }

  const photo = usesPhoto(stem);
  const end = pick(`${stem}-b`);
  return {
    start: framePath(stem, photo),
    end: end ? framePath(end, photo) : null,
    isFallback: false,
    isPhoto: photo,
  };
}

/**
 * The illustration a photo frame replaced, if it is still on disk. A photo that
 * fails to load shows this before the neutral card, so old art stays useful
 * until the replacement has been checked and the SVG removed.
 */
export function illustrationBackup(src: string): string | null {
  const match = /^\/character\/(.+)\.webp$/.exec(src);
  if (!match) return null;
  return SVG.has(match[1]) ? svgPath(match[1]) : null;
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
  // Pose art has no motion pair, so a lone WebP is enough.
  return framePath(stem, WEBP.has(stem));
}

/**
 * Accessible label for an exercise demonstration. Stretch is the illustrated
 * character; a photo shows a person, and calling her Stretch would be wrong.
 */
export function demonstrationAlt(
  exerciseId: string,
  exerciseName: string,
  setup?: SetupId | null,
): string {
  const art = resolveExerciseArt(exerciseId, setup);
  return `${art.isPhoto ? "Instructor" : "Stretch"} demonstrating ${exerciseName}`;
}

export function hasDedicatedArt(exerciseId: string): boolean {
  return FILES.has(exerciseId) || FILES.has(`${exerciseId}-standing`);
}

/** Every stem the manifest knows about. Used by the art audit test. */
export function knownArtStems(): string[] {
  return [...FILES];
}
