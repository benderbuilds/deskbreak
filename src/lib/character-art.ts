import { STANDING_RESET_ID } from "./constants";
import type { BodyArea, SetupId, StretchView } from "./types";

export type CharacterPose = "exercise" | "idle" | "done" | "locked" | "fallback";

const FALLBACK_STEM = "stretch-fallback";

/**
 * Catalog exercise ids → teaching-plane stems on disk.
 * Paths are always `/character/{stem}.svg` — never `-side`.
 * New P1 ids map to themselves; aliases cover renamed v3 ids and
 * catalog assets that do not have a dedicated file yet.
 */
const EXERCISE_STEMS: Record<string, string> = {
  "chin-tucks": "chin-tuck",
  "chin-tuck": "chin-tuck",
  "chin-tuck-hold": "chin-tuck",
  "neck-nods": "neck-nods",
  "neck-side-stretch": "neck-nods",
  "neck-rotation": "neck-nods",
  "suboccipital-nod": "chin-tuck",
  "shoulder-rolls": "shoulder-rolls",
  unshrug: "shoulder-rolls",
  "upper-trap-release": "shoulder-rolls",
  "seated-cat-cow": "seated-cat-cow",
  "wrist-circles": "wrist-circles",
  "finger-fans": "finger-fans",
  "seated-figure-four": "seated-figure-4",
  "seated-figure-4": "seated-figure-4",
  "seated-hip-opener": "seated-figure-4",
  "sit-bones-find": "seated-figure-4",
  "seated-marches": "seated-marches",
  "seated-march": "seated-marches",
  "walk-to-water-march": "seated-marches",
  "calf-raises": "seated-marches",
  "calf-raise": "seated-marches",
  "ankle-circles": "seated-marches",
  "standing-quad-stretch": "seated-marches",
  "box-breathing": "box-breathing",
  "physiological-sigh": "physiological-sigh",
  "long-exhale-reset": "long-exhale-reset",
  "scapular-squeezes": "seated-scap-squeeze",
  "seated-scap-squeeze": "seated-scap-squeeze",
  "scap-pack-hold": "seated-scap-squeeze",
  "wrist-flexor-stretch": "wrist-flexor-stretch",
  "wrist-extensor-stretch": "wrist-extensor-stretch",
  "standing-extension": "standing-posture-reset",
  "standing-posture-reset": "standing-posture-reset",
  "thoracic-extension": "standing-posture-reset",
  "desk-plank-lean": "standing-posture-reset",
  "seated-pelvic-tilts": "seated-cat-cow",
  "seated-side-bend": "seated-cat-cow",
  "seated-lumbar-support-reset": "seated-cat-cow",
  "standing-hip-hinge": "sit-to-stand-glute",
  "standing-hip-hinge-desk": "sit-to-stand-glute",
  "standing-hip-flexor": "standing-hip-flexor",
  "hamstring-hinge": "sit-to-stand-glute",
  "glute-bridge": "sit-to-stand-glute",
  "standing-glute-squeeze": "standing-glute-squeeze",
  "standing-wrist-shake": "standing-wrist-shake",
  "sit-to-stand": "sit-to-stand-glute",
  "sit-to-stand-glute": "sit-to-stand-glute",
  "pec-stretch-desk": "chest-opener",
  "chest-opener": "chest-opener",
  "chair-open-chest": "chest-opener",
  "overhead-reach": "standing-overhead-reach",
  "standing-overhead-reach": "standing-overhead-reach",
  "wall-angels": "wall-angels",
  "thoracic-rotation": "seated-thoracic-rotation",
  "seated-thoracic-rotation": "seated-thoracic-rotation",
  "elbows-pinned-er-scap": "elbows-pinned-er-scap",
  "seated-hip-windshield-wipers": "seated-hip-windshield-wipers",
  "foot-tripod-toe-spread": "foot-tripod-toe-spread",
  "short-foot-grip": "foot-tripod-toe-spread",
  "desk-wiggle-reset": "seated-cat-cow",
  "screen-distance-blink": "standing-posture-reset",
};

const BODY_AREA_STEMS: Record<BodyArea, string> = {
  neck: "chin-tuck",
  shoulders: "shoulder-rolls",
  upperBack: "seated-scap-squeeze",
  wrists: "wrist-flexor-stretch",
  hips: "seated-figure-4",
  legs: "seated-marches",
  breathing: "long-exhale-reset",
  core: "seated-cat-cow",
  posture: "standing-posture-reset",
};

/** Stems that ship a same-plane `-b` motion frame. Hold-only / no-b masters omitted. */
const MOTION_STEMS = new Set([
  "chin-tuck",
  "chin-tuck-standing",
  "shoulder-rolls",
  "shoulder-rolls-standing",
  "seated-cat-cow",
  "seated-scap-squeeze",
  "long-exhale-reset",
  "long-exhale-reset-standing",
  "standing-posture-reset",
  "box-breathing",
  "wall-angels",
  "chest-opener",
  "standing-overhead-reach",
  "sit-to-stand-glute",
  "elbows-pinned-er-scap",
  "seated-thoracic-rotation",
  "seated-hip-windshield-wipers",
  "standing-hip-flexor",
  "standing-glute-squeeze",
  "standing-wrist-shake",
]);

/** Shared seated masters that ship a standing dual (`{id}-standing.svg`). */
const SHARED_STANDING_DUALS = new Set([
  "chin-tuck",
  "long-exhale-reset",
  "shoulder-rolls",
]);

function standingContext({
  setup,
  programId,
  stretchAsset,
}: {
  setup?: SetupId | null;
  programId?: string;
  stretchAsset?: string;
}): boolean {
  return (
    setup === "standing" ||
    programId === STANDING_RESET_ID ||
    Boolean(stretchAsset?.includes("standing"))
  );
}

function stripSideSuffix(file: string): string {
  return file
    .replace(/^\/character\//, "")
    .replace(/-side(?=\.(svg|png)$)/i, "");
}

function aliasedStem(stem: string): string {
  return EXERCISE_STEMS[stem] ?? stem;
}

function stemFromAsset(file: string): string {
  return stripSideSuffix(file).replace(/\.(svg|png)$/i, "").replace(/-b$/, "");
}

function aliasedCharacterPath(file: string): string {
  const cleaned = stripSideSuffix(file);
  const isB = /-b\.(svg|png)$/i.test(cleaned);
  const stem = aliasedStem(stemFromAsset(cleaned));
  return `/character/${stem}${isB ? "-b" : ""}.svg`;
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
  setup,
  programId,
}: {
  pose: CharacterPose;
  exerciseId?: string;
  bodyArea?: BodyArea;
  stretchAsset?: string;
  stretchAssetB?: string;
  setup?: SetupId | null;
  programId?: string;
}): boolean {
  if (pose !== "exercise") return false;
  if (stretchAssetB) {
    return MOTION_STEMS.has(aliasedStem(stemFromAsset(stretchAssetB)));
  }
  if (stretchAsset) return MOTION_STEMS.has(aliasedStem(stemFromAsset(stretchAsset)));
  if (!exerciseId) return false;
  const standing = standingContext({ setup, programId, stretchAsset });
  const stem =
    standing && SHARED_STANDING_DUALS.has(exerciseId)
      ? `${exerciseId}-standing`
      : stemForExercise(exerciseId, bodyArea);
  return MOTION_STEMS.has(stem);
}

export function characterSrc({
  pose,
  exerciseId,
  bodyArea,
  frame = "a",
  stretchAsset,
  stretchAssetB,
  setup,
  programId,
}: {
  pose: CharacterPose;
  exerciseId?: string;
  bodyArea?: BodyArea;
  frame?: "a" | "b";
  stretchAsset?: string;
  stretchAssetB?: string;
  stretchView?: StretchView;
  setup?: SetupId | null;
  programId?: string;
}): string {
  const standing = standingContext({ setup, programId, stretchAsset });
  if (pose === "idle") {
    return standing
      ? "/character/stretch-idle-standing.svg"
      : "/character/stretch-idle.svg";
  }
  if (pose === "done") {
    return standing
      ? "/character/stretch-done-standing.svg"
      : "/character/stretch-done.svg";
  }
  if (pose === "locked") return "/character/stretch-locked.svg";
  if (pose === "fallback") return "/character/stretch-fallback.svg";

  if (stretchAsset) {
    if (frame === "b") {
      if (stretchAssetB) return aliasedCharacterPath(stretchAssetB);
      const stem = aliasedStem(stemFromAsset(stretchAsset));
      if (MOTION_STEMS.has(stem)) return `/character/${stem}-b.svg`;
    }
    return aliasedCharacterPath(stretchAsset);
  }

  if (exerciseId) {
    const dual =
      standing && SHARED_STANDING_DUALS.has(exerciseId)
        ? `${exerciseId}-standing`
        : stemForExercise(exerciseId, bodyArea);
    if (frame === "b" && MOTION_STEMS.has(dual)) {
      return `/character/${dual}-b.svg`;
    }
    return `/character/${dual}.svg`;
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
