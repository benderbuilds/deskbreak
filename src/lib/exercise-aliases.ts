/**
 * Retired exercise ids and the move that replaced them.
 *
 * Merged or renamed moves keep resolving, so saved history, stored
 * recommendations, signals and old /moves/<id> links do not break. Kept free of
 * content imports so the server, the client and scripts can all use it.
 */
export const EXERCISE_ALIASES: Readonly<Record<string, string>> = {
  // Merged: the walk covers "walk to get water".
  "walk-to-water-march": "short-walk",
  // Merged: the tripod cue now includes the gentle midfoot grip.
  "short-foot-grip": "foot-tripod-toe-spread",
  // Replaced: 32 circles never fit the timer; slow pumps do.
  "ankle-circles": "ankle-pumps",
};

/** The current id for any exercise id, retired or not. */
export function canonicalExerciseId(id: string): string {
  return EXERCISE_ALIASES[id] ?? id;
}
