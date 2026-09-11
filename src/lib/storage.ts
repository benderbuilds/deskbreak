import { shiftDay, todayKey } from "./dates";
import {
  applyFeedbackToSignals,
  applySessionToSignals,
  signalsFromHistory,
  type PersonalizationSignals,
} from "./personalization";
import { satisfyBreak } from "./workday";
import {
  isFunctionalConstraint,
  isPrimaryNeed,
  type AccountState,
  type AppSettings,
  type AppState,
  type Attribution,
  type ChallengeState,
  type DurationMinutes,
  type Entitlement,
  type FunctionalConstraint,
  type PerceivedEffect,
  type PlannedBreak,
  type PrimaryNeed,
  type ProgressState,
  type PushState,
  type Reminder,
  type SessionSource,
  type SetupId,
  type SetupRequest,
  type StiffnessRating,
  type StoredRecommendation,
  type WorkdayPlan,
  type WorkoutSession,
} from "./types";

export { shiftDay, todayKey } from "./dates";

export const APP_STATE_VERSION = 3;

/** Same key as V2 on purpose: an upgrade must find the user's history. */
const KEY = "deskbreak.app.v2";
const ACTIVE_WORKOUT_KEY = "deskbreak.activeWorkout.v1";
const LEGACY_ONBOARDING = "deskbreak.onboarding.v1";
const LEGACY_PROGRESS = "deskbreak.progress.v1";

const HISTORY_CAP = 400;
const RECOMMENDATION_CAP = 20;

const listeners = new Set<() => void>();

export const emptyProgress = (): ProgressState => ({
  streak: 0,
  lastWorkoutDate: null,
  lastWorkout: null,
  totalWorkouts: 0,
  xp: 0,
  history: [],
});

export const emptyAttribution = (): Attribution => ({
  firstUtmSource: null,
  firstUtmMedium: null,
  firstUtmCampaign: null,
  firstUtmContent: null,
  firstLandingPath: null,
  firstSeenAt: null,
  latestUtmSource: null,
  latestUtmMedium: null,
  latestUtmCampaign: null,
  latestUtmContent: null,
});

export const emptyChallenge = (): ChallengeState => ({
  startedOn: null,
  baseline: null,
  finalRating: null,
  primaryProblem: null,
  completedDays: [],
  completedAt: null,
});

export const emptyAccount = (): AccountState => ({
  profileId: null,
  email: null,
  signedInAt: null,
  lastSyncedAt: null,
});

export const emptyPush = (): PushState => ({ endpoint: null, subscribedAt: null });

export const defaultState = (): AppState => ({
  version: APP_STATE_VERSION,
  anonymousId: null,
  email: null,
  emailPromptDismissedAt: null,
  primaryNeed: null,
  preferredSetup: null,
  preferredDuration: null,
  constraints: [],
  favorites: [],
  firstResetComplete: false,
  paywallSeen: false,
  installPromptSeen: false,
  savePromptDismissedAt: null,
  entitlement: {
    plan: "free",
    proExpiresAt: null,
    source: null,
    status: null,
    cancelAtPeriodEnd: false,
    checkedAt: null,
  },
  progress: emptyProgress(),
  settings: {
    soundEnabled: true,
    spokenCues: false,
    autoAdvance: true,
    celebrationTheme: "classic",
    reminders: [],
    lastReminderDate: null,
  },
  plan: null,
  challenge: emptyChallenge(),
  attribution: emptyAttribution(),
  signals: {},
  recommendations: [],
  account: emptyAccount(),
  push: emptyPush(),
  resetsSinceFeedback: 0,
});

const SERVER_STATE = defaultState();

let cache: { raw: string; state: AppState } | null = null;

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function newId(): string {
  if (canUseStorage() && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `db_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/* ------------------------------------------------------------------ *
 * Migrations. Nobody loses history on an upgrade.
 * ------------------------------------------------------------------ */

type LegacyGoal = "neck" | "energy" | "consistent";

const LEGACY_GOAL_TO_NEED: Record<LegacyGoal, PrimaryNeed> = {
  neck: "neck_shoulders",
  energy: "energy",
  consistent: "general",
};

type LegacyV1State = {
  version?: number;
  onboardingComplete?: boolean;
  onboardingAnswers?: { goal?: LegacyGoal | null; setup?: SetupId | null };
  firstWinComplete?: boolean;
  paywallSeen?: boolean;
  entitlement?: Partial<Entitlement>;
  progress?: Partial<ProgressState> & { lastWorkout?: unknown };
  settings?: {
    remindersEnabled?: boolean;
    reminderHour?: number | null;
    celebrationTheme?: AppSettings["celebrationTheme"];
    lastReminderDate?: string | null;
  };
};

/**
 * Brings a v1 blob forward without losing the user.
 *
 * A local `plan: "pro"` does not carry over: entitlement is Stripe's answer, and
 * the app re-checks it against the server on load.
 */
export function migrateState(oldState: LegacyV1State): AppState {
  const base = defaultState();
  const answers = oldState.onboardingAnswers ?? {};
  const legacyGoal = answers.goal ?? null;
  const legacyProgress = oldState.progress ?? {};

  return {
    ...base,
    primaryNeed: legacyGoal ? LEGACY_GOAL_TO_NEED[legacyGoal] : null,
    preferredSetup: answers.setup ?? null,
    firstResetComplete: Boolean(oldState.firstWinComplete || oldState.onboardingComplete),
    paywallSeen: Boolean(oldState.paywallSeen),
    progress: {
      ...base.progress,
      streak: legacyProgress.streak ?? 0,
      lastWorkoutDate: legacyProgress.lastWorkoutDate ?? null,
      totalWorkouts: legacyProgress.totalWorkouts ?? 0,
      xp: legacyProgress.xp ?? 0,
      history: [],
      lastWorkout: null,
    },
    settings: {
      ...base.settings,
      celebrationTheme: oldState.settings?.celebrationTheme ?? "classic",
      lastReminderDate: oldState.settings?.lastReminderDate ?? null,
      reminders:
        oldState.settings?.remindersEnabled && oldState.settings?.reminderHour != null
          ? [
              {
                id: "daily",
                minutes: oldState.settings.reminderHour * 60,
                weekdaysOnly: true,
                kind: "daily",
                enabled: true,
              },
            ]
          : [],
    },
  };
}

type LegacyV2Session = Omit<
  WorkoutSession,
  "perceivedEffect" | "exercises" | "recommendationId" | "algorithmVersion" | "source" | "plannedBreakId" | "generated"
> & {
  perceivedEffect?: string;
  exercises?: WorkoutSession["exercises"];
  recommendationId?: string | null;
  algorithmVersion?: string | null;
  source?: SessionSource;
  plannedBreakId?: string | null;
  generated?: boolean;
};

type LegacyV2Plan = {
  startMinutes: number;
  endMinutes: number;
  preference: "light" | "balanced" | "frequent";
  troubleSpots?: PrimaryNeed[];
  generatedFor?: string | null;
  breaks?: unknown[];
};

type LegacyV2State = Omit<Partial<AppState>, "plan" | "challenge" | "progress"> & {
  plan?: LegacyV2Plan | WorkdayPlan | null;
  challenge?: Partial<ChallengeState> & { baseline?: unknown; finalRating?: unknown };
  progress?: Partial<ProgressState> & { history?: LegacyV2Session[]; lastWorkout?: LegacyV2Session | null };
};

function migrateEffect(value: unknown): PerceivedEffect | undefined {
  if (value === "better") return "better";
  if (value === "somewhat" || value === "same") return "same";
  if (value === "not_better" || value === "worse") return "worse";
  return undefined;
}

const LEGACY_RATINGS: Record<string, StiffnessRating> = {
  great: 1,
  pretty_good: 2,
  stiff: 3,
  very_stiff: 4,
  uncomfortable: 5,
};

function migrateRating(value: unknown): StiffnessRating | null {
  if (typeof value === "number" && value >= 1 && value <= 5) return value as StiffnessRating;
  if (typeof value === "string" && value in LEGACY_RATINGS) return LEGACY_RATINGS[value];
  return null;
}

export function normalizeSession(raw: LegacyV2Session): WorkoutSession {
  return {
    sessionId: raw.sessionId,
    programId: raw.programId,
    programName: raw.programName,
    primaryNeed: isPrimaryNeed(raw.primaryNeed) ? raw.primaryNeed : "general",
    setup: raw.setup ?? "seated",
    durationMin: (raw.durationMin ?? 2) as DurationMinutes,
    completedExerciseIds: raw.completedExerciseIds ?? [],
    skippedExerciseIds: raw.skippedExerciseIds ?? [],
    exercises: raw.exercises ?? [],
    elapsedSec: raw.elapsedSec ?? 0,
    startedAt: raw.startedAt,
    finishedAt: raw.finishedAt,
    perceivedEffect: migrateEffect(raw.perceivedEffect),
    recommendationId: raw.recommendationId ?? null,
    algorithmVersion: raw.algorithmVersion ?? null,
    source: raw.source ?? "unknown",
    plannedBreakId: raw.plannedBreakId ?? null,
    generated: raw.generated ?? false,
  };
}

function isV3Plan(plan: unknown): plan is WorkdayPlan {
  return Boolean(plan && typeof plan === "object" && "preferences" in plan);
}

function migratePlan(plan: LegacyV2Plan | WorkdayPlan | null | undefined): WorkdayPlan | null {
  if (!plan) return null;
  if (isV3Plan(plan)) return plan;
  const level =
    plan.preference === "light" ? "minimal" : plan.preference === "frequent" ? "active" : "balanced";
  return {
    preferences: {
      startMinutes: plan.startMinutes,
      endMinutes: plan.endMinutes,
      level,
      enabledDays: [1, 2, 3, 4, 5],
      timezone: null,
    },
    // Regenerated on the next visit with the V3 shape.
    generatedFor: null,
    breaks: [],
    responseMinutes: [],
    ignoredMinutes: [],
  };
}

/** Recomputes the per-exercise signal map from scratch. Used on migration. */
function signalsFromScratch(history: WorkoutSession[]): AppState["signals"] {
  let signals: AppState["signals"] = {};
  for (const session of [...history].reverse()) {
    signals = applySessionToSignals(signals, session);
    if (session.perceivedEffect) {
      signals = applyFeedbackToSignals(signals, session, session.perceivedEffect);
    }
  }
  return signals;
}

export function migrateV2State(parsed: LegacyV2State): AppState {
  const base = defaultState();
  const history = (parsed.progress?.history ?? []).map(normalizeSession);
  const lastWorkout = parsed.progress?.lastWorkout
    ? normalizeSession(parsed.progress.lastWorkout)
    : null;

  return {
    ...base,
    ...(parsed as Partial<AppState>),
    version: APP_STATE_VERSION,
    entitlement: { ...base.entitlement, ...parsed.entitlement },
    progress: {
      ...base.progress,
      ...(parsed.progress as Partial<ProgressState>),
      history,
      lastWorkout,
    },
    settings: { ...base.settings, ...(parsed.settings as Partial<AppSettings>) },
    plan: migratePlan(parsed.plan),
    challenge: {
      ...base.challenge,
      ...parsed.challenge,
      baseline: migrateRating(parsed.challenge?.baseline),
      finalRating: migrateRating(parsed.challenge?.finalRating),
    },
    attribution: { ...base.attribution, ...parsed.attribution },
    primaryNeed: isPrimaryNeed(parsed.primaryNeed) ? parsed.primaryNeed : null,
    constraints: (parsed.constraints ?? []).filter(isFunctionalConstraint),
    favorites: parsed.favorites ?? [],
    signals:
      parsed.signals && Object.keys(parsed.signals).length
        ? parsed.signals
        : signalsFromScratch(history),
    recommendations: parsed.recommendations ?? [],
    account: { ...base.account, ...parsed.account, email: parsed.account?.email ?? parsed.email ?? null },
    push: { ...base.push, ...parsed.push },
  };
}

function migrateLegacyKeys(): Partial<AppState> | null {
  if (!canUseStorage()) return null;
  const onboarded = window.localStorage.getItem(LEGACY_ONBOARDING) === "1";
  const rawProgress = window.localStorage.getItem(LEGACY_PROGRESS);
  if (!onboarded && !rawProgress) return null;
  let progress = emptyProgress();
  if (rawProgress) {
    try {
      progress = { ...progress, ...(JSON.parse(rawProgress) as ProgressState), history: [] };
    } catch {
      /* a corrupt legacy blob is not worth failing the app over */
    }
  }
  return { firstResetComplete: onboarded, progress };
}

function parseState(raw: string | null): AppState {
  const base = defaultState();
  if (!raw) {
    const migrated = migrateLegacyKeys();
    return migrated
      ? { ...base, ...migrated, progress: { ...base.progress, ...migrated.progress } }
      : base;
  }
  let parsed: LegacyV2State & LegacyV1State;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return base;
  }

  const version = parsed.version ?? 1;
  if (version < 2) return migrateV2State(migrateState(parsed));
  // v2 and v3 blobs share a shape; the v3 migration is idempotent on v3 data.
  return migrateV2State(parsed);
}

/* ------------------------------------------------------------------ *
 * Store.
 * ------------------------------------------------------------------ */

export function getAppState(): AppState {
  if (!canUseStorage()) return SERVER_STATE;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return SERVER_STATE;
  }
  if (cache && cache.raw === (raw ?? "")) return cache.state;
  const state = parseState(raw);
  cache = { raw: raw ?? "", state };
  return state;
}

function persist(next: AppState): AppState {
  if (!canUseStorage()) return next;
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem(KEY, raw);
    cache = { raw, state: next };
  } catch {
    // Private mode / quota. The session still works, it just will not persist.
    cache = { raw: cache?.raw ?? "", state: next };
  }
  listeners.forEach((listener) => listener());
  return next;
}

export function patchAppState(patch: (current: AppState) => AppState): AppState {
  return persist(patch(getAppState()));
}

export function subscribeAppState(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) {
      cache = null;
      listener();
    }
  };
  if (canUseStorage()) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (canUseStorage()) window.removeEventListener("storage", onStorage);
  };
}

export function getServerAppState(): AppState {
  return SERVER_STATE;
}

/** Stable per-browser id, created lazily so a bare visit does not write storage. */
export function ensureAnonymousId(): string {
  const current = getAppState().anonymousId;
  if (current) return current;
  const id = newId();
  patchAppState((state) => ({ ...state, anonymousId: id }));
  return id;
}

/* ------------------------------------------------------------------ *
 * Preferences.
 * ------------------------------------------------------------------ */

export function setPrimaryNeed(need: PrimaryNeed | null): void {
  patchAppState((state) => ({ ...state, primaryNeed: need }));
}

export function setPreferredSetup(setup: SetupId | null): void {
  patchAppState((state) => ({ ...state, preferredSetup: setup }));
}

export function setPreferredDuration(minutes: DurationMinutes | null): void {
  patchAppState((state) => ({ ...state, preferredDuration: minutes }));
}

export function setConstraints(constraints: FunctionalConstraint[]): void {
  patchAppState((state) => ({ ...state, constraints: [...new Set(constraints)] }));
}

export function toggleFavorite(id: string): boolean {
  let added = false;
  patchAppState((state) => {
    const has = state.favorites.includes(id);
    added = !has;
    return {
      ...state,
      favorites: has ? state.favorites.filter((entry) => entry !== id) : [...state.favorites, id],
    };
  });
  return added;
}

export function markPaywallSeen(): void {
  patchAppState((state) => ({ ...state, paywallSeen: true }));
}

export function markInstallPromptSeen(): void {
  patchAppState((state) => ({ ...state, installPromptSeen: true }));
}

export function saveEmail(email: string): void {
  patchAppState((state) => ({
    ...state,
    email,
    account: { ...state.account, email },
  }));
}

export function dismissEmailPrompt(): void {
  patchAppState((state) => ({ ...state, emailPromptDismissedAt: new Date().toISOString() }));
}

export function dismissSavePrompt(): void {
  patchAppState((state) => ({ ...state, savePromptDismissedAt: new Date().toISOString() }));
}

export function getProgress(): ProgressState {
  return getAppState().progress;
}

export function getEntitlement(): Entitlement {
  return getAppState().entitlement;
}

/** Caches what the server said. Never a source of truth on its own. */
export function cacheEntitlement(entitlement: Entitlement): void {
  patchAppState((state) => ({
    ...state,
    entitlement: { ...entitlement, checkedAt: new Date().toISOString() },
  }));
}

export function saveSettings(patch: Partial<AppSettings>): void {
  patchAppState((state) => ({ ...state, settings: { ...state.settings, ...patch } }));
}

export function saveReminders(reminders: Reminder[]): void {
  saveSettings({ reminders });
}

export function saveWorkdayPlan(plan: WorkdayPlan | null): void {
  patchAppState((state) => ({ ...state, plan }));
}

export function updatePlannedBreak(
  id: string,
  patch: (entry: PlannedBreak) => PlannedBreak,
): void {
  patchAppState((state) =>
    state.plan
      ? {
          ...state,
          plan: {
            ...state.plan,
            breaks: state.plan.breaks.map((entry) => (entry.id === id ? patch(entry) : entry)),
          },
        }
      : state,
  );
}

export function saveChallenge(patch: Partial<ChallengeState>): void {
  patchAppState((state) => ({ ...state, challenge: { ...state.challenge, ...patch } }));
}

export function setAccount(patch: Partial<AccountState>): void {
  patchAppState((state) => ({
    ...state,
    account: { ...state.account, ...patch },
    email: patch.email ?? state.email,
  }));
}

export function clearAccount(): void {
  patchAppState((state) => ({ ...state, account: emptyAccount() }));
}

export function setPushState(patch: Partial<PushState>): void {
  patchAppState((state) => ({ ...state, push: { ...state.push, ...patch } }));
}

/* ------------------------------------------------------------------ *
 * Recommendations and sessions.
 * ------------------------------------------------------------------ */

export function rememberRecommendation(recommendation: StoredRecommendation): void {
  patchAppState((state) => ({
    ...state,
    recommendations: [
      recommendation,
      ...state.recommendations.filter((entry) => entry.id !== recommendation.id),
    ].slice(0, RECOMMENDATION_CAP),
  }));
}

export function getStoredRecommendation(id: string | null | undefined): StoredRecommendation | null {
  if (!id) return null;
  return getAppState().recommendations.find((entry) => entry.id === id) ?? null;
}

/** Signals the engine reads, built from what this browser has seen. */
export function personalizationSignals(state = getAppState()): PersonalizationSignals {
  return signalsFromHistory(state.progress.history, state.signals);
}

export function recordCompletedWorkout(session: WorkoutSession): ProgressState {
  const current = getAppState();
  const today = todayKey();
  let streak: number;

  if (current.progress.lastWorkoutDate === today) {
    streak = Math.max(current.progress.streak, 1);
  } else if (current.progress.lastWorkoutDate === shiftDay(today, -1)) {
    streak = current.progress.streak + 1;
  } else {
    streak = 1;
  }

  const progress: ProgressState = {
    streak,
    lastWorkoutDate: today,
    lastWorkout: session,
    totalWorkouts: current.progress.totalWorkouts + 1,
    xp: current.progress.xp + 10 + session.completedExerciseIds.length * 2,
    history: [session, ...current.progress.history.filter((s) => s.sessionId !== session.sessionId)].slice(
      0,
      HISTORY_CAP,
    ),
  };

  patchAppState((state) => ({
    ...state,
    firstResetComplete: true,
    progress,
    resetsSinceFeedback: state.resetsSinceFeedback + 1,
    signals: applySessionToSignals(state.signals, session),
    plan: state.plan ? satisfyBreak(state.plan, session) : null,
    challenge: markChallengeDay(state.challenge, today),
  }));

  return progress;
}

function markChallengeDay(challenge: ChallengeState, today: string): ChallengeState {
  if (!challenge.startedOn || challenge.completedAt) return challenge;
  if (challenge.completedDays.includes(today)) return challenge;
  return { ...challenge, completedDays: [...challenge.completedDays, today] };
}

/** V3 asks after every routine: the answer is the product's most valuable signal. */
export function shouldAskForFeedback(): boolean {
  const state = getAppState();
  const last = state.progress.lastWorkout;
  return Boolean(last) && !last?.perceivedEffect;
}

export function recordFeedback(sessionId: string, effect: PerceivedEffect): void {
  patchAppState((state) => {
    const session =
      state.progress.history.find((entry) => entry.sessionId === sessionId) ??
      (state.progress.lastWorkout?.sessionId === sessionId ? state.progress.lastWorkout : null);
    return {
      ...state,
      resetsSinceFeedback: 0,
      signals: session ? applyFeedbackToSignals(state.signals, session, effect) : state.signals,
      progress: {
        ...state.progress,
        lastWorkout:
          state.progress.lastWorkout?.sessionId === sessionId
            ? { ...state.progress.lastWorkout, perceivedEffect: effect }
            : state.progress.lastWorkout,
        history: state.progress.history.map((entry) =>
          entry.sessionId === sessionId ? { ...entry, perceivedEffect: effect } : entry,
        ),
      },
    };
  });
}

/**
 * Merges sessions synced from the server into local history.
 *
 * Local wins on conflict, because it is the more detailed record; the server
 * only adds sessions this browser has never seen (another device, or a signup
 * that pulled an older anonymous history back in). Signals are rebuilt so the
 * engine learns from the merged set.
 */
export function mergeRemoteHistory(remote: WorkoutSession[]): number {
  let added = 0;
  patchAppState((state) => {
    const known = new Set(state.progress.history.map((entry) => entry.sessionId));
    const fresh = remote.filter((entry) => !known.has(entry.sessionId));
    added = fresh.length;
    if (!fresh.length) return { ...state, account: { ...state.account, lastSyncedAt: new Date().toISOString() } };
    const history = [...state.progress.history, ...fresh]
      .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
      .slice(0, HISTORY_CAP);
    return {
      ...state,
      progress: {
        ...state.progress,
        history,
        totalWorkouts: Math.max(state.progress.totalWorkouts, history.length),
        lastWorkout: state.progress.lastWorkout ?? history[0] ?? null,
        lastWorkoutDate: state.progress.lastWorkoutDate ?? history[0]?.finishedAt.slice(0, 10) ?? null,
      },
      signals: signalsFromScratch(history),
      account: { ...state.account, lastSyncedAt: new Date().toISOString() },
    };
  });
  return added;
}

export function recentExerciseIds(limit = 12): string[] {
  const { history } = getAppState().progress;
  const ids: string[] = [];
  for (const session of history) {
    for (const id of session.completedExerciseIds) {
      if (!ids.includes(id)) ids.push(id);
      if (ids.length >= limit) return ids;
    }
  }
  return ids;
}

export function formatRelativeWorkoutDay(dateKey: string | null): string | null {
  if (!dateKey) return null;
  const today = todayKey();
  if (dateKey === today) return "today";
  if (dateKey === shiftDay(today, -1)) return "yesterday";
  return dateKey;
}

export function markReminderShown(date = todayKey()): void {
  saveSettings({ lastReminderDate: date });
}

/* ------------------------------------------------------------------ *
 * Active workout, so an accidental refresh does not lose the session.
 * ------------------------------------------------------------------ */

export type ActiveWorkout = {
  programId: string;
  setup: SetupRequest;
  need: PrimaryNeed;
  stepIndex: number;
  startedAt: string;
  savedAt: string;
  recommendationId: string | null;
  source: SessionSource;
  plannedBreakId: string | null;
};

export function saveActiveWorkout(active: ActiveWorkout): void {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(active));
  } catch {
    /* nothing to do; resume is a nicety, not a requirement */
  }
}

export function getActiveWorkout(): ActiveWorkout | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_WORKOUT_KEY);
    return raw ? (JSON.parse(raw) as ActiveWorkout) : null;
  } catch {
    return null;
  }
}

export function clearActiveWorkout(): void {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.removeItem(ACTIVE_WORKOUT_KEY);
  } catch {
    /* ignore */
  }
}
