import { isDeskResetId, REMINDER_HOURS } from "./constants";
import type {
  AppSettings,
  AppState,
  CelebrationTheme,
  Entitlement,
  OnboardingAnswers,
  ProgressState,
  ReminderPref,
  WorkoutSession,
} from "./types";

const KEY = "deskbreak.app.v2";
const LEGACY_ONBOARDING = "deskbreak.onboarding.v1";
const LEGACY_PROGRESS = "deskbreak.progress.v1";
const SESSION_KEY = "deskbreak.lastSession.v1";
const COOKIE = "deskbreak_onboarded";

const listeners = new Set<() => void>();

export const emptyProgress = (): ProgressState => ({
  streak: 0,
  lastWorkoutDate: null,
  lastWorkout: null,
  totalWorkouts: 0,
  xp: 0,
});

export const defaultState = (): AppState => ({
  onboardingComplete: false,
  onboardingAnswers: { goal: null, setup: null, reminder: null },
  firstWinComplete: false,
  paywallSeen: false,
  entitlement: { plan: "free", proExpiresAt: null, source: null },
  progress: emptyProgress(),
  settings: {
    remindersEnabled: false,
    reminderHour: null,
    celebrationTheme: "classic",
    lastReminderDate: null,
  },
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

function shiftDay(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return todayKey(date);
}

function migrateLegacy(): Partial<AppState> | null {
  if (!canUseStorage()) return null;
  const onboarded = window.localStorage.getItem(LEGACY_ONBOARDING) === "1";
  const rawProgress = window.localStorage.getItem(LEGACY_PROGRESS);
  if (!onboarded && !rawProgress) return null;
  let progress = emptyProgress();
  if (rawProgress) {
    try {
      progress = { ...progress, ...(JSON.parse(rawProgress) as ProgressState) };
    } catch {
      /* ignore */
    }
  }
  return {
    onboardingComplete: onboarded,
    progress,
  };
}

function parseState(raw: string | null): AppState {
  const base = defaultState();
  if (!raw) {
    const migrated = migrateLegacy();
    return migrated ? { ...base, ...migrated, progress: { ...base.progress, ...migrated.progress } } : base;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...base,
      ...parsed,
      onboardingAnswers: { ...base.onboardingAnswers, ...parsed.onboardingAnswers },
      entitlement: { ...base.entitlement, ...parsed.entitlement },
      progress: { ...base.progress, ...parsed.progress },
      settings: { ...base.settings, ...parsed.settings },
    };
  } catch {
    return base;
  }
}

export function getAppState(): AppState {
  if (!canUseStorage()) return SERVER_STATE;
  const raw = window.localStorage.getItem(KEY);
  if (cache && cache.raw === (raw ?? "")) return cache.state;
  const state = parseState(raw);
  cache = { raw: raw ?? "", state };
  return state;
}

function persist(next: AppState): AppState {
  if (!canUseStorage()) return next;
  const raw = JSON.stringify(next);
  window.localStorage.setItem(KEY, raw);
  cache = { raw, state: next };
  if (next.onboardingComplete) {
    document.cookie = `${COOKIE}=1; path=/; max-age=31536000; SameSite=Lax`;
  } else {
    document.cookie = `${COOKIE}=; path=/; max-age=0; SameSite=Lax`;
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
  if (canUseStorage()) {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (canUseStorage()) {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function getServerAppState(): AppState {
  return SERVER_STATE;
}

export function isOnboardingComplete(): boolean {
  return getAppState().onboardingComplete;
}

export function completeOnboarding(): void {
  patchAppState((state) => ({ ...state, onboardingComplete: true }));
}

export function resetOnboarding(): void {
  patchAppState((state) => ({
    ...state,
    onboardingComplete: false,
    firstWinComplete: false,
    paywallSeen: false,
    onboardingAnswers: { goal: null, setup: null, reminder: null },
  }));
}

export function saveOnboardingAnswers(answers: OnboardingAnswers): void {
  const hour = answers.reminder ? REMINDER_HOURS[answers.reminder] : null;
  patchAppState((state) => ({
    ...state,
    onboardingAnswers: answers,
    settings: {
      ...state.settings,
      remindersEnabled: Boolean(hour),
      reminderHour: hour,
    },
  }));
}

export function saveSetup(setup: OnboardingAnswers["setup"]): void {
  patchAppState((state) => ({
    ...state,
    onboardingAnswers: { ...state.onboardingAnswers, setup },
  }));
}

export function markFirstWinComplete(): void {
  patchAppState((state) => ({ ...state, firstWinComplete: true }));
}

export function markPaywallSeen(): void {
  patchAppState((state) => ({ ...state, paywallSeen: true, onboardingComplete: true }));
}

export function getProgress(): ProgressState {
  return getAppState().progress;
}

export function getEntitlement(): Entitlement {
  return getAppState().entitlement;
}

export function unlockPro(source: "stripe" | "demo", expiresAt?: string): void {
  const expiry =
    expiresAt ??
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  patchAppState((state) => ({
    ...state,
    onboardingComplete: true,
    paywallSeen: true,
    entitlement: { plan: "pro", proExpiresAt: expiry, source },
  }));
}

export function setPlanFree(): void {
  patchAppState((state) => ({
    ...state,
    entitlement: { plan: "free", proExpiresAt: null, source: null },
  }));
}

export function saveSettings(patch: Partial<AppSettings>): void {
  patchAppState((state) => ({
    ...state,
    settings: { ...state.settings, ...patch },
  }));
}

export function setCelebrationTheme(theme: CelebrationTheme): void {
  saveSettings({ celebrationTheme: theme });
}

export function recordCompletedWorkout(session: WorkoutSession): ProgressState {
  const current = getAppState();
  const today = todayKey();
  let streak = current.progress.streak;

  if (current.progress.lastWorkoutDate === today) {
    streak = Math.max(current.progress.streak, 1);
  } else if (current.progress.lastWorkoutDate === shiftDay(today, -1)) {
    streak = current.progress.streak + 1;
  } else {
    streak = 1;
  }

  const gained = 10 + session.completedExerciseIds.length * 2;
  const progress: ProgressState = {
    streak,
    lastWorkoutDate: today,
    lastWorkout: session,
    totalWorkouts: current.progress.totalWorkouts + 1,
    xp: current.progress.xp + gained,
  };
  patchAppState((state) => ({
    ...state,
    firstWinComplete:
      state.firstWinComplete || isDeskResetId(session.programId),
    progress,
  }));
  return progress;
}

export function saveLastSession(session: WorkoutSession): void {
  if (!canUseStorage()) return;
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getLastSession(): WorkoutSession | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WorkoutSession;
  } catch {
    return null;
  }
}

export function formatRelativeWorkoutDay(dateKey: string | null): string | null {
  if (!dateKey) return null;
  const today = todayKey();
  if (dateKey === today) return "today";
  if (dateKey === shiftDay(today, -1)) return "yesterday";
  return dateKey;
}

export function applyReminderPref(pref: ReminderPref): void {
  const hour = REMINDER_HOURS[pref];
  saveSettings({
    remindersEnabled: Boolean(hour),
    reminderHour: hour,
  });
}

export function markReminderShown(date = todayKey()): void {
  saveSettings({ lastReminderDate: date });
}
