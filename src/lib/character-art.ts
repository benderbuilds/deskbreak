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
  // Standing-native: never alias onto chair marches.
  "calf-raises": "standing-posture-reset",
  "calf-raise": "standing-posture-reset",
  "ankle-circles": "seated-marches",
  "standing-quad-stretch": "standing-hip-flexor",
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

/** Chair / seated-only teaching masters — never show these in a standing workout. */
const SEATED_CHAIR_STEMS = new Set([
  "seated-cat-cow",
  "seated-figure-4",
  "seated-figure-four",
  "seated-marches",
  "seated-scap-squeeze",
  "seated-thoracic-rotation",
  "seated-hip-windshield-wipers",
]);

const SEATED_TO_STANDING_FALLBACK: Record<string, string> = {
  "seated-cat-cow": "standing-posture-reset",
  "seated-figure-4": "standing-hip-flexor",
  "seated-figure-four": "standing-hip-flexor",
  "seated-marches": "standing-posture-reset",
  "seated-scap-squeeze": "shoulder-rolls-standing",
  "seated-thoracic-rotation": "standing-posture-reset",
  "seated-hip-windshield-wipers": "standing-hip-flexor",
};

function standingContext({
  setup,
  programId,
}: {
  setup?: SetupId | null;
  programId?: string;
}): boolean {
  return setup === "standing" || programId === STANDING_RESET_ID;
}

function baseStem(stem: string): string {
  return stem.replace(/-standing$/, "");
}

/**
 * Stretch posture follows the workout. Shared duals pick seated vs `-standing`.
 * Chair-only stems remap only inside a standing program (Library keeps the
 * exercise's own teaching art). Standing-native masters are never swapped
 * down to a chair.
 */
function poseMatchedStem(
  stem: string,
  standing: boolean,
  programId?: string,
): string {
  const aliased = aliasedStem(stem);
  const base = baseStem(aliased);
  if (standing) {
    if (SHARED_STANDING_DUALS.has(base)) return `${base}-standing`;
    if (programId && SEATED_CHAIR_STEMS.has(aliased)) {
      return SEATED_TO_STANDING_FALLBACK[aliased] ?? "standing-posture-reset";
    }
    return aliased;
  }
  if (SHARED_STANDING_DUALS.has(base) && aliased.endsWith("-standing")) {
    return base;
  }
  return aliased;
}

function poseMatchedPath(
  file: string,
  standing: boolean,
  frame: "a" | "b",
  programId?: string,
): string {
  const cleaned = stripSideSuffix(file);
  const wantB = frame === "b" || /-b\.(svg|png)$/i.test(cleaned);
  const stem = poseMatchedStem(stemFromAsset(cleaned), standing, programId);
  if (wantB && MOTION_STEMS.has(stem)) return `/character/${stem}-b.svg`;
  return `/character/${stem}.svg`;
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

export function stemForExercise(exerciseId: string, bodyArea?: BodyArea): string {
  if (EXERCISE_STEMS[exerciseId]) return EXERCISE_STEMS[exerciseId];
  if (exerciseId) return exerciseId;
  if (bodyArea) return BODY_AREA_STEMS[bodyArea];
  return FALLBACK_STEM;
}

function resolvedExerciseStem({
  exerciseId,
  bodyArea,
  stretchAsset,
  stretchAssetB,
  standing,
  programId,
}: {
  exerciseId?: string;
  bodyArea?: BodyArea;
  stretchAsset?: string;
  stretchAssetB?: string;
  standing: boolean;
  programId?: string;
}): string {
  const file = stretchAssetB ?? stretchAsset;
  if (file) return poseMatchedStem(stemFromAsset(file), standing, programId);
  if (exerciseId) {
    return poseMatchedStem(stemForExercise(exerciseId, bodyArea), standing, programId);
  }
  if (bodyArea) return poseMatchedStem(BODY_AREA_STEMS[bodyArea], standing, programId);
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
  const standing = standingContext({ setup, programId });
  return MOTION_STEMS.has(
    resolvedExerciseStem({
      exerciseId,
      bodyArea,
      stretchAsset,
      stretchAssetB,
      standing,
      programId,
    }),
  );
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
  const standing = standingContext({ setup, programId });
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
    const file = frame === "b" && stretchAssetB ? stretchAssetB : stretchAsset;
    return poseMatchedPath(file, standing, frame, programId);
  }

  const stem = resolvedExerciseStem({
    exerciseId,
    bodyArea,
    standing,
    programId,
  });
  if (frame === "b" && MOTION_STEMS.has(stem)) {
    return `/character/${stem}-b.svg`;
  }
  return `/character/${stem}.svg`;
}

function expectSrc(label: string, got: string, ok: (src: string) => boolean): void {
  if (!ok(got)) {
    throw new Error(`Stretch pose-match failed (${label}): ${got}`);
  }
}

/** Catalog/build guard — standing workouts never resolve chair Stretch. */
export function assertStretchPoseMatch(): void {
  expectSrc(
    "standing chin-tuck from seated asset",
    characterSrc({
      pose: "exercise",
      exerciseId: "chin-tuck",
      stretchAsset: "chin-tuck.svg",
      setup: "standing",
      programId: STANDING_RESET_ID,
    }),
    (src) => src === "/character/chin-tuck-standing.svg",
  );
  expectSrc(
    "seated chin-tuck from standing asset",
    characterSrc({
      pose: "exercise",
      exerciseId: "chin-tuck",
      stretchAsset: "chin-tuck-standing.svg",
      setup: "seated",
      programId: "desk-reset-2min",
    }),
    (src) => src === "/character/chin-tuck.svg",
  );
  expectSrc(
    "standing unshrug aliases to standing shoulder-rolls, not chair",
    characterSrc({
      pose: "exercise",
      exerciseId: "unshrug",
      stretchAsset: "unshrug.svg",
      setup: "standing",
      programId: STANDING_RESET_ID,
    }),
    (src) => src === "/character/shoulder-rolls-standing.svg",
  );
  expectSrc(
    "standing calf-raise does not use seated marches",
    characterSrc({
      pose: "exercise",
      exerciseId: "calf-raise",
      stretchAsset: "calf-raise.svg",
      setup: "standing",
      programId: STANDING_RESET_ID,
    }),
    (src) => src === "/character/standing-posture-reset.svg",
  );
  expectSrc(
    "seated shoulder-rolls stay seated",
    characterSrc({
      pose: "exercise",
      exerciseId: "shoulder-rolls",
      stretchAsset: "shoulder-rolls.svg",
      setup: "seated",
      programId: "desk-reset-2min",
    }),
    (src) => src === "/character/shoulder-rolls.svg",
  );
  expectSrc(
    "library seated-cat-cow keeps chair art even if user stands",
    characterSrc({
      pose: "exercise",
      exerciseId: "seated-cat-cow",
      stretchAsset: "seated-cat-cow.svg",
      setup: "standing",
    }),
    (src) => src === "/character/seated-cat-cow.svg",
  );
  expectSrc(
    "standing idle",
    characterSrc({ pose: "idle", setup: "standing" }),
    (src) => src === "/character/stretch-idle-standing.svg",
  );
  expectSrc(
    "standing done",
    characterSrc({ pose: "done", setup: "standing" }),
    (src) => src === "/character/stretch-done-standing.svg",
  );
  expectSrc(
    "standing long-exhale from seated asset",
    characterSrc({
      pose: "exercise",
      exerciseId: "long-exhale-reset",
      stretchAsset: "long-exhale-reset.svg",
      setup: "standing",
      programId: STANDING_RESET_ID,
    }),
    (src) => src === "/character/long-exhale-reset-standing.svg",
  );
  expectSrc(
    "standing shoulder-rolls from seated asset",
    characterSrc({
      pose: "exercise",
      exerciseId: "shoulder-rolls",
      stretchAsset: "shoulder-rolls.svg",
      setup: "standing",
      programId: STANDING_RESET_ID,
    }),
    (src) => src === "/character/shoulder-rolls-standing.svg",
  );
}
