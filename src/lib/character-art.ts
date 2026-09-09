import type { BodyArea } from "./types";

export type CharacterPose = "exercise" | "idle" | "done" | "locked" | "fallback";

/**
 * Catalog exercise ids → files in /public/character.
 * Prefer `{exerciseId}.svg`. Aliases keep designer stems (chin-tuck, seated-figure-4, …).
 */
const EXERCISE_STEMS: Record<string, string> = {
  "chin-tucks": "chin-tucks",
  "neck-nods": "neck-nods",
  "shoulder-rolls": "shoulder-rolls",
  "seated-cat-cow": "seated-cat-cow",
  "wrist-circles": "wrist-circles",
  "finger-fans": "finger-fans",
  "seated-figure-four": "seated-figure-four",
  "seated-marches": "seated-marches",
  "box-breathing": "box-breathing",
  "physiological-sigh": "physiological-sigh",
  "scapular-squeezes": "scapular-squeezes",
  "wrist-flexor-stretch": "wrist-flexor-stretch",
  "wrist-extensor-stretch": "wrist-extensor-stretch",
  "chin-tuck": "chin-tuck",
  "seated-figure-4": "seated-figure-4",
  "long-exhale-reset": "long-exhale-reset",
  "seated-scap-squeeze": "seated-scap-squeeze",
};

const BODY_AREA_STEMS: Record<BodyArea, string> = {
  neck: "chin-tucks",
  shoulders: "shoulder-rolls",
  upperBack: "seated-scap-squeeze",
  wrists: "wrist-circles",
  hips: "seated-figure-four",
  legs: "seated-figure-four",
  breathing: "box-breathing",
};

const MOTION_STEMS = new Set([
  "chin-tucks",
  "chin-tuck",
  "shoulder-rolls",
  "seated-cat-cow",
  "scapular-squeezes",
  "seated-scap-squeeze",
  "box-breathing",
  "long-exhale-reset",
]);

export function stemForExercise(exerciseId: string, bodyArea?: BodyArea): string {
  if (EXERCISE_STEMS[exerciseId]) return EXERCISE_STEMS[exerciseId];
  if (bodyArea) return BODY_AREA_STEMS[bodyArea];
  return "stretch-fallback";
}

export function hasMotionFrame(
  pose: CharacterPose,
  exerciseId?: string,
  bodyArea?: BodyArea,
): boolean {
  if (pose !== "exercise" || !exerciseId) return false;
  return MOTION_STEMS.has(stemForExercise(exerciseId, bodyArea));
}

export function characterSrc({
  pose,
  exerciseId,
  bodyArea,
  frame = "a",
}: {
  pose: CharacterPose;
  exerciseId?: string;
  bodyArea?: BodyArea;
  frame?: "a" | "b";
}): string {
  if (pose === "idle") return "/character/stretch-idle.svg";
  if (pose === "done") return "/character/stretch-done.svg";
  if (pose === "locked") return "/character/stretch-locked.svg";
  if (pose === "fallback") return "/character/stretch-fallback.svg";
  const stem = exerciseId
    ? stemForExercise(exerciseId, bodyArea)
    : bodyArea
      ? BODY_AREA_STEMS[bodyArea]
      : "stretch-fallback";
  if (frame === "b" && MOTION_STEMS.has(stem)) {
    return `/character/${stem}-b.svg`;
  }
  return `/character/${stem}.svg`;
}
