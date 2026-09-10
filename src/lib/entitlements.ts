import { getExercise, getProgram } from "./content";
import type { Entitlement, Exercise, Program } from "./types";

/**
 * Client-side reading of a server-issued entitlement.
 *
 * This is a cache, not an authority. The app asks `/api/entitlement` on load and
 * stores the answer; nothing here can promote a user to Pro on its own, and an
 * expired period end drops them back to free without waiting for a round trip.
 */
export function isProEntitlement(entitlement: Entitlement): boolean {
  if (entitlement.plan !== "pro") return false;
  if (!entitlement.proExpiresAt) return true;
  return new Date(entitlement.proExpiresAt).getTime() > Date.now();
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
  return !canAccessProgram(program.id, entitlement);
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

export async function fetchEntitlement(params: {
  anonymousId?: string | null;
  email?: string | null;
  sessionId?: string | null;
}): Promise<ServerEntitlementResponse | null> {
  const query = new URLSearchParams();
  if (params.anonymousId) query.set("anonymousId", params.anonymousId);
  if (params.email) query.set("email", params.email);
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
