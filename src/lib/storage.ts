import type { ProgressState, WorkoutSession } from "./types";

const PROGRESS_KEY = "deskbreak.progress.v1";
const ONBOARDING_KEY = "deskbreak.onboarding.v1";
const SESSION_KEY = "deskbreak.lastSession.v1";

const emptyProgress = (): ProgressState => ({
  streak: 0,
  lastWorkoutDate: null,
  lastWorkout: null,
  totalWorkouts: 0,
});

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function todayKey(date = new Date()): string {
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

export function isOnboardingComplete(): boolean {
  if (!canUseStorage()) return true;
  return window.localStorage.getItem(ONBOARDING_KEY) === "1";
}

export function completeOnboarding(): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(ONBOARDING_KEY, "1");
}

export function getProgress(): ProgressState {
  if (!canUseStorage()) return emptyProgress();
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as ProgressState;
    return {
      ...emptyProgress(),
      ...parsed,
    };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(state: ProgressState): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(state));
}

export function recordCompletedWorkout(session: WorkoutSession): ProgressState {
  const current = getProgress();
  const today = todayKey();
  let streak = current.streak;

  if (current.lastWorkoutDate === today) {
    streak = Math.max(current.streak, 1);
  } else if (current.lastWorkoutDate === shiftDay(today, -1)) {
    streak = current.streak + 1;
  } else {
    streak = 1;
  }

  const next: ProgressState = {
    streak,
    lastWorkoutDate: today,
    lastWorkout: session,
    totalWorkouts: current.totalWorkouts + 1,
  };
  saveProgress(next);
  return next;
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
