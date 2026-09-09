import { getExercise, getProgram } from "./content";
import { getEntitlement } from "./storage";
import type { Entitlement, Exercise, Program } from "./types";

export function isProEntitlement(entitlement: Entitlement): boolean {
  if (entitlement.plan !== "pro") return false;
  if (!entitlement.proExpiresAt) return true;
  return new Date(entitlement.proExpiresAt).getTime() > Date.now();
}

export function isPro(): boolean {
  return isProEntitlement(getEntitlement());
}

export function isFreeProgram(programId: string): boolean {
  return getProgram(programId)?.access === "free";
}

export function isFreeExercise(exerciseId: string): boolean {
  return getExercise(exerciseId)?.access === "free";
}

export function canAccessProgram(programId: string, entitlement: Entitlement): boolean {
  return isProEntitlement(entitlement) || isFreeProgram(programId);
}

export function canAccessExercise(exerciseId: string, entitlement: Entitlement): boolean {
  return isProEntitlement(entitlement) || isFreeExercise(exerciseId);
}

export function isProgramLocked(program: Program, entitlement: Entitlement): boolean {
  return !canAccessProgram(program.id, entitlement);
}

export function isExerciseLocked(exercise: Exercise, entitlement: Entitlement): boolean {
  return !canAccessExercise(exercise.id, entitlement);
}

export function canDemoUnlock(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_UNLOCK === "true") return true;
  return process.env.NODE_ENV !== "production";
}

export function stripePriceConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_STRIPE_PRICE_ID);
}
