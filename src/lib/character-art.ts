import type { BodyArea, StretchView } from "./types";

export type CharacterPose = "exercise" | "idle" | "done" | "locked" | "fallback";

const FALLBACK_STEM = "stretch-fallback";

/**
 * Catalog exercise ids → Fitness v3 teaching-plane stems.
 * Paths are always `/character/{stem}.svg` — never `-side`.
 * Prefer new stems when both old and new files exist.
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
  "seated-marches": "seated-marches", // no seated-march.svg on disk
  "seated-march": "seated-marches",
  "box-breathing": "long-exhale-reset",
  "physiological-sigh": "physiological-sigh",
  "long-exhale-reset": "long-exhale-reset",
  "scapular-squeezes": "seated-scap-squeeze",
  "seated-scap-squeeze": "seated-scap-squeeze",
  "wrist-flexor-stretch": "wrist-flexor-stretch",
  "wrist-extensor-stretch": "wrist-extensor-stretch",
  "standing-extension": "standing-posture-reset",
  "standing-posture-reset": "standing-posture-reset",
  "standing-hip-hinge": "seated-figure-4",
  "calf-raises": "seated-marches",
  "sit-to-stand": "seated-marches",
  "pec-stretch-desk": "seated-cat-cow",
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

/** Stems that ship a same-plane `-b` motion frame. Hold moves are omitted. */
const MOTION_STEMS = new Set([
  "chin-tuck",
  "shoulder-rolls",
  "seated-cat-cow",
  "seated-scap-squeeze",
  "long-exhale-reset",
  "standing-posture-reset",
  "box-breathing",
]);

function stripSideSuffix(file: string): string {
  return file
    .replace(/^\/character\//, "")
    .replace(/-side(?=\.(svg|png)$)/i, "");
}

function characterPath(file: string): string {
  return `/character/${stripSideSuffix(file)}`;
}

function stemFromAsset(file: string): string {
  return stripSideSuffix(file).replace(/\.(svg|png)$/i, "").replace(/-b$/, "");
}

export function stemForExercise(exerciseId: string, bodyArea?: BodyArea): string {
  if (EXERCISE_STEMS[exerciseId]) return EXERCISE_STEMS[exerciseId];
  if (exerciseId) return exerciseId;
  if (bodyArea) return BODY_AREA_STEMS[bodyArea];
  return FALLBACK_STEM;
}

export function hasMotionFrame({
  pose,
  exerciseId,
  bodyArea,
  stretchAsset,
  stretchAssetB,
}: {
  pose: CharacterPose;
  exerciseId?: string;
  bodyArea?: BodyArea;
  stretchAsset?: string;
  stretchAssetB?: string;
}): boolean {
  if (pose !== "exercise") return false;
  if (stretchAssetB) return true;
  if (stretchAsset) return MOTION_STEMS.has(stemFromAsset(stretchAsset));
  if (!exerciseId) return false;
  return MOTION_STEMS.has(stemForExercise(exerciseId, bodyArea));
}

export function characterSrc({
  pose,
  exerciseId,
  bodyArea,
  frame = "a",
  stretchAsset,
  stretchAssetB,
}: {
  pose: CharacterPose;
  exerciseId?: string;
  bodyArea?: BodyArea;
  frame?: "a" | "b";
  stretchAsset?: string;
  stretchAssetB?: string;
  stretchView?: StretchView;
}): string {
  if (pose === "idle") return "/character/stretch-idle.svg";
  if (pose === "done") return "/character/stretch-done.svg";
  if (pose === "locked") return "/character/stretch-locked.svg";
  if (pose === "fallback") return "/character/stretch-fallback.svg";

  if (stretchAsset) {
    if (frame === "b") {
      if (stretchAssetB) return characterPath(stretchAssetB);
      const stem = stemFromAsset(stretchAsset);
      if (MOTION_STEMS.has(stem)) return `/character/${stem}-b.svg`;
    }
    return characterPath(stretchAsset);
  }

  if (exerciseId) {
    const stem = EXERCISE_STEMS[exerciseId] ?? exerciseId;
    if (frame === "b" && MOTION_STEMS.has(stem)) {
      return `/character/${stem}-b.svg`;
    }
    return `/character/${stem}.svg`;
  }

  if (bodyArea) {
    const stem = BODY_AREA_STEMS[bodyArea];
    if (frame === "b" && MOTION_STEMS.has(stem)) {
      return `/character/${stem}-b.svg`;
    }
    return `/character/${stem}.svg`;
  }

  return "/character/stretch-fallback.svg";
}
