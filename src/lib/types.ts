export type BodyArea =
  | "neck"
  | "shoulders"
  | "upperBack"
  | "wrists"
  | "hips"
  | "legs"
  | "breathing";

export type Dose = {
  reps?: number;
  holdSec?: number;
  breaths?: number;
  seconds?: number;
  perSide?: boolean;
};

export type Exercise = {
  id: string;
  name: string;
  cue: string;
  bodyArea: BodyArea;
  defaultDose: Dose;
  commonMistake: string;
  skipIf: string[];
  saferSwapId: string | null;
};

export type ProgramStep = {
  exerciseId: string;
  durationSec: number;
};

export type Program = {
  id: string;
  name: string;
  shortLabel: string;
  durationMin: number;
  tagline: string;
  steps: ProgramStep[];
};

export type Catalog = {
  exercises: Exercise[];
  programs: Program[];
};

export type WorkoutSession = {
  programId: string;
  programName: string;
  durationMin: number;
  completedExerciseIds: string[];
  skippedExerciseIds: string[];
  elapsedSec: number;
  finishedAt: string;
};

export type ProgressState = {
  streak: number;
  lastWorkoutDate: string | null;
  lastWorkout: WorkoutSession | null;
  totalWorkouts: number;
};
