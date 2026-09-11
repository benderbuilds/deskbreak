import "server-only";

import {
  applyFeedbackToSignals,
  applySessionToSignals,
  signalsFromHistory,
  type PersonalizationSignals,
} from "../personalization";
import { isPerceivedEffect, type DurationMinutes, type ExerciseSignal, type WorkoutSession } from "../types";
import { findMany, type SessionExerciseRow, type SessionRow } from "./store";

/**
 * Builds the engine's signals from the sessions table.
 *
 * The server sees every device a person has used, so its picture is fuller than
 * one browser's. The output shape is identical to the client's; the engine does
 * not know which side produced it.
 */
function toSession(row: SessionRow, exercises: SessionExerciseRow[]): WorkoutSession {
  const records = exercises
    .filter((entry) => entry.session_id === row.id)
    .sort((a, b) => a.sequence - b.sequence)
    .map((entry) => ({
      exerciseId: entry.exercise_id,
      sequence: entry.sequence,
      plannedSec: entry.planned_duration,
      actualSec: entry.actual_duration,
      completed: entry.completed,
      skipped: entry.skipped,
      swapped: entry.swapped,
      swappedToExerciseId: entry.swapped_to_exercise_id,
      discomfortReported: entry.discomfort_reported,
      discomfortReason: entry.discomfort_reason as WorkoutSession["exercises"][number]["discomfortReason"],
    }));
  const effect = row.perceived_effect;
  return {
    sessionId: row.id,
    programId: row.program_id,
    programName: row.program_name ?? row.program_id,
    primaryNeed: row.primary_need as WorkoutSession["primaryNeed"],
    setup: (row.setup as WorkoutSession["setup"]) ?? "seated",
    durationMin: (row.duration_minutes ?? Math.max(1, Math.round(row.duration_seconds / 60))) as DurationMinutes,
    completedExerciseIds: records.filter((r) => r.completed).map((r) => r.exerciseId),
    skippedExerciseIds: records.filter((r) => r.skipped).map((r) => r.exerciseId),
    exercises: records,
    elapsedSec: row.duration_seconds,
    startedAt: row.started_at,
    finishedAt: row.completed_at ?? row.started_at,
    perceivedEffect: isPerceivedEffect(effect)
      ? effect
      : effect === "somewhat"
        ? "same"
        : effect === "not_better"
          ? "worse"
          : undefined,
    recommendationId: row.recommendation_id ?? null,
    algorithmVersion: row.algorithm_version ?? null,
    source: (row.source as WorkoutSession["source"]) ?? "unknown",
    plannedBreakId: row.scheduled_break_id ?? null,
    generated: Boolean(row.generated),
  };
}

export async function sessionsFor(identity: {
  profileId?: string | null;
  anonymousId?: string | null;
}, limit = 120): Promise<WorkoutSession[]> {
  const rows: SessionRow[] = [];
  if (identity.profileId) {
    rows.push(...(await findMany("sessions", { user_id: identity.profileId }, { orderBy: "started_at", descending: true, limit })));
  }
  if (identity.anonymousId) {
    const anon = await findMany("sessions", { anonymous_id: identity.anonymousId }, { orderBy: "started_at", descending: true, limit });
    for (const row of anon) if (!rows.some((r) => r.id === row.id)) rows.push(row);
  }
  if (!rows.length) return [];
  const exercises = await findMany("session_exercises", {}, {
    filters: [{ column: "session_id", op: "in", value: rows.map((row) => row.id) }],
  });
  return rows
    .map((row) => toSession(row, exercises))
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
}

export async function signalsFor(identity: {
  profileId?: string | null;
  anonymousId?: string | null;
}): Promise<PersonalizationSignals> {
  const history = await sessionsFor(identity);
  let exercises: Record<string, ExerciseSignal> = {};
  for (const session of [...history].reverse()) {
    exercises = applySessionToSignals(exercises, session);
    if (session.perceivedEffect) exercises = applyFeedbackToSignals(exercises, session, session.perceivedEffect);
  }
  return signalsFromHistory(history, exercises);
}

/** Combines the server's view with what the client sent, preferring the larger record. */
export function mergeSignals(
  server: PersonalizationSignals,
  client: PersonalizationSignals | null | undefined,
): PersonalizationSignals {
  if (!client) return server;
  if (client.sessionCount > server.sessionCount) {
    const exercises = { ...client.exercises };
    for (const [id, signal] of Object.entries(server.exercises)) {
      const existing = exercises[id];
      if (!existing || signal.completed + signal.skipped > existing.completed + existing.skipped) exercises[id] = signal;
    }
    return { ...client, exercises };
  }
  return server;
}
