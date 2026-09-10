export type BodyArea =
  | "neck"
  | "shoulders"
  | "upperBack"
  | "wrists"
  | "hips"
  | "legs"
  | "breathing"
  | "core"
  | "posture";

/** What the user says is bothering them. The whole product hangs off this. */
export type PrimaryNeed =
  | "neck_shoulders"
  | "back_hips"
  | "wrists_hands"
  | "energy"
  | "stress"
  | "general";

export const PRIMARY_NEEDS: PrimaryNeed[] = [
  "neck_shoulders",
  "back_hips",
  "wrists_hands",
  "energy",
  "stress",
  "general",
];

export function isPrimaryNeed(value: unknown): value is PrimaryNeed {
  return typeof value === "string" && (PRIMARY_NEEDS as string[]).includes(value);
}

export type SetupId = "seated" | "standing";
/** "either" only appears on catalog content, never on a user preference. */
export type ExerciseSetup = SetupId | "either";

export type Intensity = "gentle" | "moderate";

export type TimeOfDay = "morning" | "midday" | "afternoon" | "evening";

export type Dose = {
  type?: string;
  reps?: number;
  holdSec?: number;
  breaths?: number;
  seconds?: number;
  perSide?: boolean;
  rounds?: number;
};

export type Access = "free" | "pro";

export type StretchView = "side" | "front" | "threeQuarter";

export type SetupVariant = { cue: string };

export type Exercise = {
  id: string;
  access: Access;
  name: string;
  cue: string;
  tagline?: string;
  feelIt?: string;
  avoid?: string;
  bodyArea: BodyArea;
  needs: PrimaryNeed[];
  setup: ExerciseSetup;
  intensity: Intensity;
  defaultDose: Dose;
  skipIf: string[];
  saferSwapId: string | null;
  stretchView?: StretchView;
  setupVariants?: Partial<Record<SetupId, SetupVariant>>;
};

export type StepSide = "left" | "right";

export type ProgramStep = {
  exerciseId: string;
  durationSec: number;
  dose?: Dose;
  side?: StepSide;
};

export type Program = {
  id: string;
  access: Access;
  name: string;
  shortLabel: string;
  durationMin: number;
  durationTargetSec?: number;
  tagline: string;
  promise?: string;
  primaryNeed: PrimaryNeed;
  setup: SetupId;
  steps: ProgramStep[];
  /** Set when the program was assembled on the fly by the recommendation engine. */
  generated?: boolean;
};

export type DurationBenefit = {
  cardLine: string;
  detail: string;
  doneLine: string;
};

export type Catalog = {
  exercises: Exercise[];
  programs: Program[];
  durationBenefits: Record<string, DurationBenefit>;
  disclaimer: string;
};

export type PerceivedEffect = "better" | "somewhat" | "not_better";

export type WorkoutSession = {
  sessionId: string;
  programId: string;
  programName: string;
  primaryNeed: PrimaryNeed;
  setup: SetupId;
  durationMin: number;
  completedExerciseIds: string[];
  skippedExerciseIds: string[];
  elapsedSec: number;
  startedAt: string;
  finishedAt: string;
  perceivedEffect?: PerceivedEffect;
};

export type CelebrationTheme = "classic" | "confetti" | "spark";
export type Plan = "free" | "pro";
export type EntitlementSource = "stripe" | "demo" | null;
export type BillingPeriod = "monthly" | "annual";

export type Entitlement = {
  plan: Plan;
  /** Mirrors the Stripe subscription period end. Never invented client-side. */
  proExpiresAt: string | null;
  source: EntitlementSource;
  status?: string | null;
  cancelAtPeriodEnd?: boolean;
  /** When this cached copy was last confirmed against the server. */
  checkedAt?: string | null;
};

export type ProgressState = {
  streak: number;
  lastWorkoutDate: string | null;
  lastWorkout: WorkoutSession | null;
  totalWorkouts: number;
  xp: number;
  /** Newest first, capped. Free users keep a short tail, Pro sees all of it. */
  history: WorkoutSession[];
};

export type ReminderKind = "daily" | "plan";

export type Reminder = {
  id: string;
  /** Minutes past local midnight. */
  minutes: number;
  weekdaysOnly: boolean;
  kind: ReminderKind;
  enabled: boolean;
};

export type BreakPreference = "light" | "balanced" | "frequent";

export type PlannedBreak = {
  id: string;
  minutes: number;
  need: PrimaryNeed;
  programId: string;
  durationMin: number;
  status: "pending" | "done" | "skipped" | "snoozed";
};

export type WorkdayPlan = {
  startMinutes: number;
  endMinutes: number;
  preference: BreakPreference;
  troubleSpots: PrimaryNeed[];
  /** Local date key the breaks were generated for. */
  generatedFor: string | null;
  breaks: PlannedBreak[];
};

export type ChallengeState = {
  startedOn: string | null;
  baseline: StiffnessRating | null;
  finalRating: StiffnessRating | null;
  primaryProblem: PrimaryNeed | null;
  completedDays: string[];
  completedAt: string | null;
};

export type StiffnessRating =
  | "great"
  | "pretty_good"
  | "stiff"
  | "very_stiff"
  | "uncomfortable";

export type Attribution = {
  firstUtmSource: string | null;
  firstUtmMedium: string | null;
  firstUtmCampaign: string | null;
  firstUtmContent: string | null;
  firstLandingPath: string | null;
  firstSeenAt: string | null;
  latestUtmSource: string | null;
  latestUtmMedium: string | null;
  latestUtmCampaign: string | null;
  latestUtmContent: string | null;
};

export type AppSettings = {
  soundEnabled: boolean;
  celebrationTheme: CelebrationTheme;
  reminders: Reminder[];
  lastReminderDate: string | null;
};

export type AppState = {
  version: number;
  anonymousId: string | null;
  email: string | null;
  emailPromptDismissedAt: string | null;
  primaryNeed: PrimaryNeed | null;
  preferredSetup: SetupId | null;
  firstResetComplete: boolean;
  paywallSeen: boolean;
  installPromptSeen: boolean;
  entitlement: Entitlement;
  progress: ProgressState;
  settings: AppSettings;
  plan: WorkdayPlan | null;
  challenge: ChallengeState;
  attribution: Attribution;
  /** Rolling counter that decides when to ask "Did that help?" again. */
  resetsSinceFeedback: number;
};
