export type BodyArea =
  | "neck"
  | "shoulders"
  | "upperBack"
  | "wrists"
  | "hips"
  | "legs"
  | "breathing"
  | "core"
  | "posture"
  | "eyes";

/**
 * What the user says is bothering them, or "general" for the default Desk Reset.
 *
 * The four targeted needs are overrides on the Today screen. "stress" survives
 * as an Explore goal and for older stored state; it is not a Today button.
 */
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

/** The needs a user can pick from the Today screen. */
export const TARGETED_NEEDS: PrimaryNeed[] = [
  "neck_shoulders",
  "back_hips",
  "wrists_hands",
  "energy",
];

export function isPrimaryNeed(value: unknown): value is PrimaryNeed {
  return typeof value === "string" && (PRIMARY_NEEDS as string[]).includes(value);
}

export type SetupId = "seated" | "standing";
/** "either" on content means the move works in both positions. */
export type ExerciseSetup = SetupId | "either";
/** What the user asked for. "either" lets the engine mix positions. */
export type SetupRequest = SetupId | "either";

export function isSetupRequest(value: unknown): value is SetupRequest {
  return value === "seated" || value === "standing" || value === "either";
}

export type Intensity = "gentle" | "moderate";

export type TimeOfDay = "morning" | "midday" | "afternoon" | "evening";

export type DurationMinutes = 1 | 2 | 3 | 4 | 5 | 10;
/** The durations the product actually offers. 4 only exists for one authored program. */
export const OFFERED_DURATIONS: DurationMinutes[] = [2, 3, 5, 10];

export function isDurationMinutes(value: unknown): value is DurationMinutes {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 10;
}

export type MovementType =
  | "mobility"
  | "strength"
  | "isometric"
  | "aerobic"
  | "breathing"
  | "position_change"
  | "eye_break";

/** Movements a user can ask DeskBreak to leave out. Never a diagnosis. */
export type FunctionalConstraint =
  | "overhead"
  | "weight_through_wrists"
  | "deep_knee_bend"
  | "balance"
  | "floor"
  | "neck_rotation"
  | "leave_chair";

export const FUNCTIONAL_CONSTRAINTS: FunctionalConstraint[] = [
  "overhead",
  "weight_through_wrists",
  "deep_knee_bend",
  "balance",
  "floor",
  "neck_rotation",
  "leave_chair",
];

export function isFunctionalConstraint(value: unknown): value is FunctionalConstraint {
  return (
    typeof value === "string" && (FUNCTIONAL_CONSTRAINTS as string[]).includes(value)
  );
}

export type EvidenceCategory =
  | "sitting_interruption"
  | "movement_breaks"
  | "mobility"
  | "strengthening"
  | "posture_variability"
  | "breathing"
  | "eye_strain";

export type EvidenceLevel = "general" | "emerging" | "moderate" | "strong";

/** Where a move sits in a routine. Internal; users never see phase names. */
export type RoutinePhase = "reset" | "mobilize" | "activate" | "move" | "return";

export const ROUTINE_PHASES: RoutinePhase[] = [
  "reset",
  "mobilize",
  "activate",
  "move",
  "return",
];

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
  /** The primary instruction. Short, imperative. */
  cue: string;
  tagline?: string;
  /** "What you should feel". */
  feelIt?: string;
  /** "Common mistake". */
  avoid?: string;
  /** "Make it easier". */
  easier?: string;
  /** "Avoid this movement if". Functional guidance only. */
  avoidIf?: string;
  /** "Why DeskBreak uses it". */
  rationale?: string;
  /** Primary body area, kept for art and older code paths. */
  bodyArea: BodyArea;
  /** Every area the move addresses. Always contains bodyArea. */
  bodyAreas: BodyArea[];
  movementType: MovementType;
  /** Phases this move can fill. Empty means the engine infers it. */
  phases: RoutinePhase[];
  needs: PrimaryNeed[];
  setup: ExerciseSetup;
  intensity: Intensity;
  defaultDose: Dose;
  skipIf: string[];
  saferSwapId: string | null;
  constraints: FunctionalConstraint[];
  evidenceCategories: EvidenceCategory[];
  evidenceLevel: EvidenceLevel;
  stretchView?: StretchView;
  setupVariants?: Partial<Record<SetupId, SetupVariant>>;
  media?: { thumbnail?: string; animation?: string };
};

export type StepSide = "left" | "right";

export type ProgramStep = {
  exerciseId: string;
  durationSec: number;
  dose?: Dose;
  side?: StepSide;
  phase?: RoutinePhase;
};

export type Program = {
  id: string;
  access: Access;
  name: string;
  shortLabel: string;
  durationMin: DurationMinutes;
  durationTargetSec?: number;
  tagline: string;
  promise?: string;
  primaryNeed: PrimaryNeed;
  setup: ExerciseSetup;
  steps: ProgramStep[];
  /** Set when the program was assembled on the fly by the recommendation engine. */
  generated?: boolean;
  /** Which template produced a generated program. */
  templateId?: string;
};

export type DurationBenefit = {
  cardLine: string;
  detail: string;
  doneLine: string;
};

/** One slot in a routine template. The engine fills each from the pool. */
export type TemplateSlot = {
  phase: RoutinePhase;
  seconds: number;
  bodyAreas?: BodyArea[];
  movementTypes?: MovementType[];
  /** Prefer a move that does not need the user on their feet. */
  preferSeated?: boolean;
  /** Prefer a move that gets the user up. */
  preferStanding?: boolean;
  optional?: boolean;
};

export type RoutineTemplate = {
  id: string;
  need: PrimaryNeed;
  durationMin: DurationMinutes;
  name: string;
  shortLabel: string;
  tagline: string;
  slots: TemplateSlot[];
};

export type EvidenceReference = {
  id: string;
  category: EvidenceCategory;
  title: string;
  source: string;
  year: number;
  url: string;
  summary: string;
};

export type Catalog = {
  exercises: Exercise[];
  programs: Program[];
  templates: RoutineTemplate[];
  evidence: EvidenceReference[];
  durationBenefits: Record<string, DurationBenefit>;
  disclaimer: string;
};

export type PerceivedEffect = "better" | "same" | "worse";

export const PERCEIVED_EFFECTS: PerceivedEffect[] = ["better", "same", "worse"];

export function isPerceivedEffect(value: unknown): value is PerceivedEffect {
  return value === "better" || value === "same" || value === "worse";
}

export type DiscomfortReason =
  | "uncomfortable"
  | "painful"
  | "awkward"
  | "too_hard"
  | "dislike";

/** What happened to one move inside one session. */
export type SessionExerciseRecord = {
  exerciseId: string;
  sequence: number;
  plannedSec: number;
  actualSec: number;
  completed: boolean;
  skipped: boolean;
  swapped: boolean;
  swappedToExerciseId: string | null;
  discomfortReported: boolean;
  discomfortReason: DiscomfortReason | null;
};

export type SessionSource =
  | "today"
  | "targeted"
  | "explore"
  | "planned_break"
  | "push"
  | "seo"
  | "landing"
  | "resume"
  | "unknown";

export type WorkoutSession = {
  sessionId: string;
  programId: string;
  programName: string;
  primaryNeed: PrimaryNeed;
  setup: SetupRequest;
  durationMin: DurationMinutes;
  completedExerciseIds: string[];
  skippedExerciseIds: string[];
  exercises: SessionExerciseRecord[];
  elapsedSec: number;
  startedAt: string;
  finishedAt: string;
  perceivedEffect?: PerceivedEffect;
  recommendationId: string | null;
  algorithmVersion: string | null;
  source: SessionSource;
  plannedBreakId: string | null;
  generated: boolean;
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
  /** Newest first, capped. */
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

/** How much help the planner gives. Break counts are the algorithm's business. */
export type ReminderLevel = "minimal" | "balanced" | "active";

export type BreakType = "move" | "stand" | "walk" | "eyes" | "energy";

export type PlannedBreakStatus =
  | "planned"
  | "delivered"
  | "snoozed"
  | "completed"
  | "skipped"
  | "expired";

export type PlannedBreak = {
  id: string;
  /** Local date key. */
  date: string;
  /** Minutes past local midnight. */
  startMinutes: number;
  endMinutes: number;
  type: BreakType;
  need: PrimaryNeed;
  durationMin: DurationMinutes;
  status: PlannedBreakStatus;
  snoozedUntilMinutes: number | null;
  completedSessionId: string | null;
  recommendationId: string | null;
};

export type WorkdayPreferences = {
  startMinutes: number;
  endMinutes: number;
  level: ReminderLevel;
  /** 0 = Sunday. */
  enabledDays: number[];
  timezone: string | null;
};

export type WorkdayPlan = {
  preferences: WorkdayPreferences;
  /** Local date key the breaks were generated for. */
  generatedFor: string | null;
  breaks: PlannedBreak[];
  /** Minutes-of-day at which reminders were acted on, newest first, capped. */
  responseMinutes: number[];
  /** Minutes-of-day at which reminders were ignored, newest first, capped. */
  ignoredMinutes: number[];
};

export type ChallengeState = {
  startedOn: string | null;
  baseline: StiffnessRating | null;
  finalRating: StiffnessRating | null;
  primaryProblem: PrimaryNeed | null;
  completedDays: string[];
  completedAt: string | null;
};

export type StiffnessRating = 1 | 2 | 3 | 4 | 5;

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
  spokenCues: boolean;
  autoAdvance: boolean;
  celebrationTheme: CelebrationTheme;
  reminders: Reminder[];
  lastReminderDate: string | null;
};

/** Everything the engine learns about one move from one person's behaviour. */
export type ExerciseSignal = {
  completed: number;
  skipped: number;
  swapped: number;
  discomfort: number;
  /** Sessions containing this move that the user rated better / worse. */
  better: number;
  worse: number;
  lastAt: string | null;
};

export type StoredRecommendation = {
  id: string;
  algorithmVersion: string;
  need: PrimaryNeed;
  setup: SetupRequest;
  requestedDuration: DurationMinutes;
  recommendedDuration: DurationMinutes;
  timeOfDay: TimeOfDay;
  reason: string;
  personalized: boolean;
  programId: string;
  programName: string;
  programShortLabel: string;
  exerciseIds: string[];
  steps: { exerciseId: string; durationSec: number; phase?: RoutinePhase }[];
  authored: boolean;
  createdAt: string;
  source: "server" | "client";
};

export type AccountState = {
  profileId: string | null;
  email: string | null;
  signedInAt: string | null;
  lastSyncedAt: string | null;
};

export type PushState = {
  endpoint: string | null;
  subscribedAt: string | null;
};

export type AppState = {
  version: number;
  anonymousId: string | null;
  email: string | null;
  emailPromptDismissedAt: string | null;
  primaryNeed: PrimaryNeed | null;
  preferredSetup: SetupId | null;
  preferredDuration: DurationMinutes | null;
  constraints: FunctionalConstraint[];
  favorites: string[];
  firstResetComplete: boolean;
  paywallSeen: boolean;
  installPromptSeen: boolean;
  savePromptDismissedAt: string | null;
  entitlement: Entitlement;
  progress: ProgressState;
  settings: AppSettings;
  plan: WorkdayPlan | null;
  challenge: ChallengeState;
  attribution: Attribution;
  signals: Record<string, ExerciseSignal>;
  recommendations: StoredRecommendation[];
  account: AccountState;
  push: PushState;
  /** Rolling counter that decides when to ask "How do you feel?" again. */
  resetsSinceFeedback: number;
};
