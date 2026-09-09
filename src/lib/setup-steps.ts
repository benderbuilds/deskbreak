import type { Program, ProgramStep, SetupId } from "./types";

/**
 * Seated-only catalog ids → stand-at-desk alternatives that already exist.
 * Used for standing-desk onboarding. Desk Reset stays a free program even when
 * a swap points at a Pro catalog id (first-win must not paywall).
 */
export const STANDING_STEP_SWAPS: Record<string, string> = {
  "seated-cat-cow": "standing-extension",
  "seated-figure-four": "standing-hip-hinge",
  "seated-marches": "calf-raises",
  "seated-hip-flexor": "standing-hip-hinge",
  "seated-twist": "standing-extension",
  "thoracic-rotation": "pec-stretch-desk",
  "glute-squeezes": "sit-to-stand",
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
