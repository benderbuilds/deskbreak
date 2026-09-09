export type CharacterPose = "exercise" | "idle" | "done" | "locked" | "fallback";

/** Catalog exercise ids → Stretch SVG stems in /public/character. */
const EXERCISE_STEMS: Record<string, string> = {
  "chin-tucks": "chin-tuck",
  "shoulder-rolls": "shoulder-rolls",
  "scapular-squeezes": "seated-scap-squeeze",
  "seated-figure-four": "seated-figure-4",
  "wrist-flexor-stretch": "wrist-flexor-stretch",
  "wrist-extensor-stretch": "wrist-extensor-stretch",
  "box-breathing": "long-exhale-reset",
  "physiological-sigh": "long-exhale-reset",
};

const MOTION_STEMS = new Set([
  "chin-tuck",
  "shoulder-rolls",
  "seated-scap-squeeze",
  "long-exhale-reset",
]);

export function stemForExercise(exerciseId: string): string {
  return EXERCISE_STEMS[exerciseId] ?? "stretch-fallback";
}

export function hasMotionFrame(pose: CharacterPose, exerciseId?: string): boolean {
  if (pose !== "exercise" || !exerciseId) return false;
  return MOTION_STEMS.has(stemForExercise(exerciseId));
}

export function characterSrc({
  pose,
  exerciseId,
  frame = "a",
}: {
  pose: CharacterPose;
  exerciseId?: string;
  frame?: "a" | "b";
}): string {
  if (pose === "idle") return "/character/stretch-idle.svg";
  if (pose === "done") return "/character/stretch-done.svg";
  if (pose === "locked") return "/character/stretch-locked.svg";
  if (pose === "fallback") return "/character/stretch-fallback.svg";
  const stem = exerciseId ? stemForExercise(exerciseId) : "stretch-fallback";
  if (frame === "b" && MOTION_STEMS.has(stem)) {
    return `/character/${stem}-b.svg`;
  }
  return `/character/${stem}.svg`;
}
