import type { BodyArea } from "./types";

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
};

export const BODY_AREAS = Object.keys(BODY_AREA_LABELS) as BodyArea[];
