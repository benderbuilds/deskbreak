import { getActiveWorkout, type ActiveWorkout } from "./storage";

/** A half-finished reset is only worth resuming for about an hour. */
const RESUME_WINDOW_MS = 60 * 60 * 1000;

/**
 * Whether there is a reset worth offering to continue.
 *
 * Called from a lazy state initializer so the answer is fixed for the life of
 * the screen: nobody should have the prompt vanish because a render happened to
 * cross the one-hour boundary.
 */
export function resumableWorkout(programId: string): ActiveWorkout | null {
  const active = getActiveWorkout();
  if (!active) return null;
  if (active.programId !== programId) return null;
  if (active.stepIndex <= 0) return null;
  if (Date.now() - new Date(active.savedAt).getTime() >= RESUME_WINDOW_MS) return null;
  return active;
}
