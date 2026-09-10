import { isDeskResetId } from "./constants";
import type { Program, ProgramStep, SetupId } from "./types";

/**
 * Seated-only catalog ids → stand-at-desk alternatives that already exist.
 * Used for 5/10 programs when setup is standing. The two 2-min Desk Resets
 * stay distinct (seated vs standing-native) and are not swapped.
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
  programId?: string,
): ProgramStep[] {
  if (setup !== "standing") return steps;
  if (programId && isDeskResetId(programId)) return steps;
  return steps.map((step) => {
    const swapId = STANDING_STEP_SWAPS[step.exerciseId];
    if (!swapId || swapId === step.exerciseId) return step;
    return { ...step, exerciseId: swapId };
  });
}

export function taglineForSetup(
  program: Program,
  _setup?: SetupId | null,
): string {
  return program.tagline;
}
