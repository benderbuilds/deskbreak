import type { Program, ProgramStep, SetupId } from "./types";

/**
 * Seated-only catalog ids → stand-at-desk alternatives that already exist.
 * Used for standing-desk onboarding. Desk Reset stays a free program even when
 * a swap points at a Pro catalog id (first-win must not paywall).
 */
export const STANDING_STEP_SWAPS: Record<string, string> = {
  "seated-cat-cow": "standing-posture-reset",
  "seated-figure-4": "standing-hip-hinge-desk",
  "seated-march": "calf-raise",
  "seated-hip-opener": "standing-hip-flexor",
  "seated-thoracic-rotation": "chest-opener",
  "glute-bridge": "sit-to-stand-glute",
};

export function stepsForSetup(
  steps: ProgramStep[],
  setup: SetupId | null | undefined,
): ProgramStep[] {
  if (setup !== "standing") return steps;
  return steps.map((step) => {
    const swapId = STANDING_STEP_SWAPS[step.exerciseId];
    if (!swapId || swapId === step.exerciseId) return step;
    return { ...step, exerciseId: swapId };
  });
}

export function taglineForSetup(
  program: Program,
  setup: SetupId | null | undefined,
): string {
  if (setup === "standing" && program.id === "desk-reset-2min") {
    return "A tiny unstick. Still at your desk.";
  }
  return program.tagline;
}
