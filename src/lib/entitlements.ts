import { getExercise, getProgram } from "./content";
import type { DurationMinutes, Entitlement, Exercise, Program } from "./types";

/**
 * Client-side reading of a server-issued entitlement.
 *
 * This is a cache, not an authority. The app asks `/api/entitlement` on load and
 * stores the answer; nothing here can promote a user to Pro on its own. An
 * expired period end drops them back to free without waiting for a round trip,
 * with a short grace window so a slow lookup never locks a paying user out.
 */
const GRACE_MS = 48 * 60 * 60 * 1000;

export function isProEntitlement(entitlement: Entitlement): boolean {
  if (entitlement.plan !== "pro") return false;
  if (!entitlement.proExpiresAt) return true;
  const expires = new Date(entitlement.proExpiresAt).getTime();
  if (expires > Date.now()) return true;
  // Past the period end but recently confirmed: Stripe may simply not have
  // renewed the row yet. Keep Pro on briefly while the server catches up.
  const checked = entitlement.checkedAt ? new Date(entitlement.checkedAt).getTime() : 0;
  return checked > 0 && Date.now() - checked < GRACE_MS && expires > Date.now() - GRACE_MS;
}

/** Free gets the quick and daily resets; deeper and full workouts are Pro. */
export const FREE_DURATIONS: DurationMinutes[] = [1, 2, 3];

export function canAccessDuration(minutes: DurationMinutes, entitlement: Entitlement): boolean {
  return isProEntitlement(entitlement) || FREE_DURATIONS.includes(minutes);
}

export function isFreeProgram(programId: string): boolean {
  return getProgram(programId)?.access !== "pro";
}

export function canAccessProgram(programId: string, entitlement: Entitlement): boolean {
  return isProEntitlement(entitlement) || isFreeProgram(programId);
}

export function canAccessExercise(exerciseId: string, entitlement: Entitlement): boolean {
  return isProEntitlement(entitlement) || getExercise(exerciseId)?.access === "free";
}

export function isProgramLocked(program: Program, entitlement: Entitlement): boolean {
  if (isProEntitlement(entitlement)) return false;
  if (program.access === "pro") return true;
  return !FREE_DURATIONS.includes(program.durationMin);
}

export function isExerciseLocked(exercise: Exercise, entitlement: Entitlement): boolean {
  return !canAccessExercise(exercise.id, entitlement);
}

export type ServerEntitlementResponse = {
  pro: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  email?: string | null;
};

export function toEntitlement(response: ServerEntitlementResponse): Entitlement {
  return {
    plan: response.pro ? "pro" : "free",
    proExpiresAt: response.currentPeriodEnd,
    source: response.pro ? "stripe" : null,
    status: response.status,
    cancelAtPeriodEnd: response.cancelAtPeriodEnd,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Asks the server. Identity is the session cookie (sent automatically) or the
 * anonymous id of a device that paid; an email address is never sent, because
 * the server would not accept it as proof of anything.
 */
export async function fetchEntitlement(params: {
  anonymousId?: string | null;
  sessionId?: string | null;
}): Promise<ServerEntitlementResponse | null> {
  const query = new URLSearchParams();
  if (params.anonymousId) query.set("anonymousId", params.anonymousId);
  if (params.sessionId) query.set("sessionId", params.sessionId);
  if (![...query.keys()].length) return null;

  try {
    const response = await fetch(`/api/entitlement?${query.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as ServerEntitlementResponse;
  } catch {
    // Offline or blocked: keep whatever we last heard rather than downgrading.
    return null;
  }
}
