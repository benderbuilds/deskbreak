import { isDeskResetId } from "./constants";
import { retargetStep } from "./setup-steps";
import type { GoalId, ProgramStep } from "./types";

/**
 * Energy prefers marches (seated) or calf-raise (after standing setup already
 * swapped figure-4 → hip-hinge). Desk Reset stays one free program.
 */
const ENERGY_MOVEMENT_SWAPS: Record<string, string> = {
  "seated-figure-4": "seated-march",
  "standing-hip-hinge-desk": "calf-raise",
};

function neckRank(id: string): number {
  if (id === "chin-tuck" || id === "chin-tuck-hold" || id === "suboccipital-nod") {
    return 0;
  }
  if (id === "shoulder-rolls" || id === "unshrug") return 1;
  if (id === "seated-cat-cow" || id === "standing-posture-reset") return 2;
  return 10;
}

function energyRank(id: string): number {
  if (id === "shoulder-rolls") return 0;
  if (id === "seated-march" || id === "calf-raise") return 1;
  if (id === "box-breathing" || id === "long-exhale-reset") return 2;
  return 10;
}

function stableByRank(
  steps: ProgramStep[],
  rank: (id: string) => number,
): ProgramStep[] {
  return steps
    .map((step, index) => ({ step, index, rank: rank(step.exerciseId) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.step);
}

export function stepsForGoal(
  steps: ProgramStep[],
  goal: GoalId | null | undefined,
  programId: string,
): ProgramStep[] {
  if (!isDeskResetId(programId)) return steps;
  if (goal === "energy") {
    const present = new Set(steps.map((step) => step.exerciseId));
    const swapped = steps.map((step) => {
      const nextId = ENERGY_MOVEMENT_SWAPS[step.exerciseId];
      if (!nextId || present.has(nextId)) return step;
      return retargetStep(step, nextId);
    });
    return stableByRank(swapped, energyRank);
  }
  if (goal === "neck") {
    return stableByRank(steps, neckRank);
  }
  return steps;
}

export function deskResetGoalKicker(
  programId: string,
  goal: GoalId | null | undefined,
): string | null {
  if (!isDeskResetId(programId)) return null;
  if (goal === "neck") return "Neck-first tonight";
  if (goal === "energy") return "Energy-first tonight";
  return null;
}
