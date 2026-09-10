import type {
  AppSettings,
  AppState,
  Attribution,
  ChallengeState,
  Entitlement,
  PerceivedEffect,
  PrimaryNeed,
  ProgressState,
  Reminder,
  SetupId,
  WorkdayPlan,
  WorkoutSession,
} from "./types";
import { isPrimaryNeed } from "./types";

export const APP_STATE_VERSION = 2;

const KEY = "deskbreak.app.v2";
const ACTIVE_WORKOUT_KEY = "deskbreak.activeWorkout.v1";
const LEGACY_ONBOARDING = "deskbreak.onboarding.v1";
const LEGACY_PROGRESS = "deskbreak.progress.v1";

/** Free keeps a short tail of history; Pro sees all of it. */
const HISTORY_CAP = 200;
/** Ask "did that help?" roughly every third reset, not every single time. */
export const FEEDBACK_EVERY = 3;

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

export const defaultState = (): AppState => ({
  version: APP_STATE_VERSION,
  anonymousId: null,
  email: null,
  emailPromptDismissedAt: null,
  primaryNeed: null,
  preferredSetup: null,
  firstResetComplete: false,
  paywallSeen: false,
  installPromptSeen: false,
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
    celebrationTheme: "classic",
    reminders: [],
    lastReminderDate: null,
  },
  plan: null,
  challenge: emptyChallenge(),
  attribution: emptyAttribution(),
  resetsSinceFeedback: 0,
});

const SERVER_STATE = defaultState();

let cache: { raw: string; state: AppState } | null = null;

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftDay(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return todayKey(date);
}

export function newId(): string {
  if (canUseStorage() && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `db_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

type LegacyGoal = "neck" | "energy" | "consistent";

const LEGACY_GOAL_TO_NEED: Record<LegacyGoal, PrimaryNeed> = {
  neck: "neck_shoulders",
  energy: "energy",
  consistent: "general",
};

type LegacyState = {
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
 * Preferences, streak and counts carry over. A local `plan: "pro"` does not:
 * entitlement is Stripe's answer now, and the app re-checks it against the
 * server on load. Losing a wrongly-cached unlock is recoverable; handing out
 * Pro because a browser said so is not.
 */
export function migrateState(oldState: LegacyState): AppState {
  const base = defaultState();
  const answers = oldState.onboardingAnswers ?? {};
  const legacyGoal = answers.goal ?? null;
  const legacyProgress = oldState.progress ?? {};

  return {
    ...base,
    anonymousId: base.anonymousId,
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
  let parsed: Partial<AppState> & LegacyState;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return base;
  }

  if ((parsed.version ?? 1) < APP_STATE_VERSION) {
    return migrateState(parsed);
  }

  return {
    ...base,
    ...(parsed as Partial<AppState>),
    version: APP_STATE_VERSION,
    entitlement: { ...base.entitlement, ...parsed.entitlement },
    progress: {
      ...base.progress,
      ...(parsed.progress as Partial<ProgressState>),
      history: (parsed.progress as Partial<ProgressState>)?.history ?? [],
    },
    settings: { ...base.settings, ...(parsed.settings as Partial<AppSettings>) },
    challenge: { ...base.challenge, ...parsed.challenge },
    attribution: { ...base.attribution, ...parsed.attribution },
    primaryNeed: isPrimaryNeed(parsed.primaryNeed) ? parsed.primaryNeed : null,
  };
}

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

export function setPrimaryNeed(need: PrimaryNeed): void {
  patchAppState((state) => ({ ...state, primaryNeed: need }));
}

export function setPreferredSetup(setup: SetupId): void {
  patchAppState((state) => ({ ...state, preferredSetup: setup }));
}

export function markPaywallSeen(): void {
  patchAppState((state) => ({ ...state, paywallSeen: true }));
}

export function markInstallPromptSeen(): void {
  patchAppState((state) => ({ ...state, installPromptSeen: true }));
}

export function saveEmail(email: string): void {
  patchAppState((state) => ({ ...state, email }));
}

export function dismissEmailPrompt(): void {
  patchAppState((state) => ({
    ...state,
    emailPromptDismissedAt: new Date().toISOString(),
  }));
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

export function saveChallenge(patch: Partial<ChallengeState>): void {
  patchAppState((state) => ({ ...state, challenge: { ...state.challenge, ...patch } }));
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
    history: [session, ...current.progress.history].slice(0, HISTORY_CAP),
  };

  patchAppState((state) => ({
    ...state,
    firstResetComplete: true,
    progress,
    resetsSinceFeedback: state.resetsSinceFeedback + 1,
    plan: markPlanBreakDone(state.plan, session),
    challenge: markChallengeDay(state.challenge, today),
  }));

  return progress;
}

function markPlanBreakDone(
  plan: WorkdayPlan | null,
  session: WorkoutSession,
): WorkdayPlan | null {
  if (!plan || plan.generatedFor !== todayKey()) return plan;
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  // Credit the nearest pending break rather than asking the user to say which.
  const pending = plan.breaks
    .filter((entry) => entry.status === "pending" || entry.status === "snoozed")
    .sort(
      (a, b) => Math.abs(a.minutes - nowMinutes) - Math.abs(b.minutes - nowMinutes),
    );
  const target =
    pending.find((entry) => entry.need === session.primaryNeed) ?? pending[0];
  if (!target) return plan;
  return {
    ...plan,
    breaks: plan.breaks.map((entry) =>
      entry.id === target.id ? { ...entry, status: "done" as const } : entry,
    ),
  };
}

function markChallengeDay(challenge: ChallengeState, today: string): ChallengeState {
  if (!challenge.startedOn || challenge.completedAt) return challenge;
  if (challenge.completedDays.includes(today)) return challenge;
  return { ...challenge, completedDays: [...challenge.completedDays, today] };
}

export function shouldAskForFeedback(): boolean {
  const state = getAppState();
  if (!state.progress.totalWorkouts) return false;
  // Always ask after the very first reset. It is the most valuable signal we get.
  if (state.progress.totalWorkouts === 1) return true;
  return state.resetsSinceFeedback >= FEEDBACK_EVERY;
}

export function recordFeedback(
  sessionId: string,
  effect: PerceivedEffect,
): void {
  patchAppState((state) => ({
    ...state,
    resetsSinceFeedback: 0,
    progress: {
      ...state.progress,
      lastWorkout:
        state.progress.lastWorkout?.sessionId === sessionId
          ? { ...state.progress.lastWorkout, perceivedEffect: effect }
          : state.progress.lastWorkout,
      history: state.progress.history.map((session) =>
        session.sessionId === sessionId
          ? { ...session, perceivedEffect: effect }
          : session,
      ),
    },
  }));
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
  setup: SetupId;
  need: PrimaryNeed;
  stepIndex: number;
  startedAt: string;
  savedAt: string;
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
