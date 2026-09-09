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

export type Access = "free" | "pro";

export type StretchView = "side" | "front" | "threeQuarter";

export type Exercise = {
  id: string;
  access: Access;
  name: string;
  cue: string;
  bodyArea: BodyArea;
  defaultDose: Dose;
  commonMistake: string;
  skipIf: string[];
  saferSwapId: string | null;
  stretchView?: StretchView;
  stretchAsset?: string;
  stretchAssetB?: string;
  stretchAssetFrontArchive?: string;
};

export type ProgramStep = {
  exerciseId: string;
  durationSec: number;
};

export type Program = {
  id: string;
  access: Access;
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

export type GoalId = "neck" | "energy" | "consistent";
export type SetupId = "seated" | "standing";
export type ReminderPref = "off" | "midday" | "afternoon";
export type CelebrationTheme = "classic" | "confetti" | "spark";
export type Plan = "free" | "pro";
export type EntitlementSource = "stripe" | "demo" | null;

export type OnboardingAnswers = {
  goal: GoalId | null;
  setup: SetupId | null;
  reminder: ReminderPref | null;
};

export type Entitlement = {
  plan: Plan;
  proExpiresAt: string | null;
  source: EntitlementSource;
};

export type ProgressState = {
  streak: number;
  lastWorkoutDate: string | null;
  lastWorkout: WorkoutSession | null;
  totalWorkouts: number;
  xp: number;
};

export type AppSettings = {
  remindersEnabled: boolean;
  reminderHour: number | null;
  celebrationTheme: CelebrationTheme;
  lastReminderDate: string | null;
};

export type AppState = {
  onboardingComplete: boolean;
  onboardingAnswers: OnboardingAnswers;
  firstWinComplete: boolean;
  paywallSeen: boolean;
  entitlement: Entitlement;
  progress: ProgressState;
  settings: AppSettings;
};
