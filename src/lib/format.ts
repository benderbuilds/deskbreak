import type { Dose, Exercise, Program, ProgramStep, GoalId, SetupId, StretchView } from "./types";
import { stepsForGoal } from "./goal-steps";
import { stepsForSetup } from "./setup-steps";

export type ResolvedStep = {
  index: number;
  step: ProgramStep;
  exercise: Exercise;
  durationSec: number;
};

type SetupVariant = {
  cue?: string;
  stretchView?: StretchView;
  stretchAsset?: string;
  stretchAssetB?: string;
};

function variantForPose(
  exercise: Exercise,
  pose: SetupId | null | undefined,
): SetupVariant | undefined {
  if (pose !== "seated" && pose !== "standing") return undefined;
  const variants = (
    exercise as Exercise & {
      setupVariants?: { seated?: SetupVariant; standing?: SetupVariant };
    }
  ).setupVariants;
  return variants?.[pose];
}

export function resolveProgramSteps(
  program: Program,
  exercisesById: Map<string, Exercise>,
  setup?: SetupId | null,
  goal?: GoalId | null,
): ResolvedStep[] {
  const prepared = stepsForGoal(
    stepsForSetup(program.steps, setup, program.id),
    goal,
    program.id,
  );
  const pose = program.stance ?? setup;
  return prepared.map((step, index) => {
    const exercise = exercisesById.get(step.exerciseId);
    if (!exercise) {
      throw new Error(
        `Program ${program.id} references missing exercise ${step.exerciseId}`,
      );
    }
    const variant = variantForPose(exercise, pose);
    return {
      index,
      step,
      exercise: {
        ...exercise,
        cue: step.positionCue ?? variant?.cue ?? exercise.cue,
        stretchView: step.stretchView ?? variant?.stretchView ?? exercise.stretchView,
        stretchAsset:
          step.stretchAsset ?? variant?.stretchAsset ?? exercise.stretchAsset,
        stretchAssetB:
          step.stretchAssetB ?? variant?.stretchAssetB ?? exercise.stretchAssetB,
      },
      durationSec: step.durationSec,
    };
  });
}

export function formatDose(dose: Dose): string {
  const parts: string[] = [];
  if (dose.reps) {
    parts.push(`${dose.reps} reps`);
  }
  if (dose.holdSec) {
    parts.push(`${dose.holdSec}s hold`);
  }
  if (dose.breaths) {
    parts.push(`${dose.breaths} breaths`);
  }
  if (dose.rounds) {
    parts.push(`${dose.rounds} rounds`);
  }
  if (dose.seconds && parts.length === 0) {
    parts.push(`${dose.seconds}s`);
  }
  const eachSide =
    dose.perSide ||
    (typeof dose.type === "string" && /EachSide/i.test(dose.type));
  if (eachSide) {
    parts.push("each side");
  }
  return parts.join(" · ") || "Move with the timer";
}

export function formatClock(totalSec: number): string {
  const safe = Math.max(0, Math.ceil(totalSec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function buildSessionSummary(input: {
  programName: string;
  durationMin: number;
  completedNames: string[];
  skippedNames: string[];
  streak: number;
  elapsedSec: number;
}): string {
  const lines = [
    `DeskBreak · ${input.programName}`,
    `Finished ${input.completedNames.length} move${input.completedNames.length === 1 ? "" : "s"} in ${formatClock(input.elapsedSec)} (about ${input.durationMin} min).`,
    `Streak: ${input.streak} day${input.streak === 1 ? "" : "s"}`,
  ];
  if (input.completedNames.length) {
    lines.push("", input.completedNames.map((name) => `• ${name}`).join("\n"));
  }
  if (input.skippedNames.length) {
    lines.push("", `Skipped: ${input.skippedNames.join(", ")}`);
  }
  return lines.join("\n");
}
