import type { BodyArea, MovementType } from "./types";

export const BODY_AREA_LABELS: Record<BodyArea, string> = {
  neck: "Neck",
  shoulders: "Shoulders",
  upperBack: "Upper back",
  wrists: "Wrists",
  hips: "Hips",
  legs: "Legs",
  breathing: "Breathing",
  core: "Core",
  posture: "Posture",
  eyes: "Eyes",
};

export const BODY_AREAS = Object.keys(BODY_AREA_LABELS) as BodyArea[];

/** Short, lower-case labels for the "Neck · shoulders · back" lines. */
export const BODY_AREA_SHORT: Record<BodyArea, string> = {
  neck: "neck",
  shoulders: "shoulders",
  upperBack: "back",
  wrists: "wrists",
  hips: "hips",
  legs: "legs",
  breathing: "breathing",
  core: "core",
  posture: "posture",
  eyes: "eyes",
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  mobility: "Mobility",
  strength: "Strength",
  isometric: "Activation",
  aerobic: "Movement",
  breathing: "Breathing",
  position_change: "Position change",
  eye_break: "Eye break",
};

/** "Neck · shoulders · back · wrists · hips · legs" from a list of areas. */
export function areaLine(areas: string[], limit = 6): string {
  const order: BodyArea[] = ["neck", "shoulders", "upperBack", "wrists", "hips", "legs", "core", "posture", "breathing", "eyes"];
  const seen = new Set<string>();
  return order
    .filter((area) => areas.includes(area))
    .map((area) => BODY_AREA_SHORT[area])
    .filter((label) => (seen.has(label) ? false : (seen.add(label), true)))
    .slice(0, limit)
    .join(" · ");
}
