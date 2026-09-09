import type { BodyArea } from "./types";

export type CharacterPose = "exercise" | "idle" | "done" | "locked" | "fallback";

/**
 * Catalog exercise ids → teaching-plane files in /public/character.
 * Prefer `{exerciseId}.svg` (no -side suffix). Designer stems (chin-tuck,
 * seated-figure-4, long-exhale-reset, standing-posture-reset) are the v1.1
 * sideways masters. `*-front.svg` archives are kept but not requested yet.
 *
 * TODO: If Fitness catalog v3 lands with `stretchView` (`side` | `front`),
 * prefer `{id}.svg` for the teaching plane and `{id}-front.svg` when
 * stretchView === "front". Do not invent exercise data until that field exists.
 */
const EXERCISE_STEMS: Record<string, string> = {
  "chin-tucks": "chin-tuck",
  "chin-tuck": "chin-tuck",
  "neck-nods": "neck-nods",
  "shoulder-rolls": "shoulder-rolls",
  "seated-cat-cow": "seated-cat-cow",
  "wrist-circles": "wrist-circles",
  "finger-fans": "finger-fans",
  "seated-figure-four": "seated-figure-4",
  "seated-figure-4": "seated-figure-4",
  "seated-marches": "seated-marches",
  "box-breathing": "long-exhale-reset",
  "physiological-sigh": "long-exhale-reset",
  "long-exhale-reset": "long-exhale-reset",
  "scapular-squeezes": "scapular-squeezes",
  "wrist-flexor-stretch": "wrist-flexor-stretch",
  "wrist-extensor-stretch": "wrist-extensor-stretch",
  "standing-extension": "standing-posture-reset",
  "standing-posture-reset": "standing-posture-reset",
  "standing-hip-hinge": "seated-figure-4",
  "calf-raises": "seated-marches",
  "sit-to-stand": "seated-marches",
  "pec-stretch-desk": "seated-cat-cow",
  "seated-scap-squeeze": "seated-scap-squeeze",
};

const BODY_AREA_STEMS: Record<BodyArea, string> = {
  neck: "chin-tuck",
  shoulders: "shoulder-rolls",
  upperBack: "seated-scap-squeeze",
  wrists: "wrist-circles",
  hips: "seated-figure-4",
  legs: "seated-marches",
  breathing: "long-exhale-reset",
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
  "standing-posture-reset",
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
