import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/server/auth";
import { sessionsFor } from "@/lib/server/signals";
import {
  findOne,
  insertMany,
  remove,
  update,
  upsert,
  type SessionExerciseRow,
  type SessionRow,
} from "@/lib/server/store";
import { isUuid } from "@/lib/ids";
import { isPerceivedEffect } from "@/lib/types";

export const dynamic = "force-dynamic";

type ExerciseBody = {
  exerciseId?: string;
  sequence?: number;
  plannedSec?: number;
  actualSec?: number;
  completed?: boolean;
  skipped?: boolean;
  swapped?: boolean;
  swappedToExerciseId?: string | null;
  discomfortReported?: boolean;
  discomfortReason?: string | null;
};

type Body = {
  sessionId?: string;
  anonymousId?: string;
  programId?: string;
  programName?: string;
  primaryNeed?: string;
  setup?: string;
  durationMinutes?: number;
  startedAt?: string;
  completedAt?: string;
  durationSeconds?: number;
  perceivedEffect?: string;
  recommendationId?: string | null;
  algorithmVersion?: string | null;
  source?: string;
  plannedBreakId?: string | null;
  generated?: boolean;
  exercises?: ExerciseBody[];
};

/**
 * May this caller write this session row?
 *
 * A signed-in account owns its rows. An anonymous browser owns rows that have
 * no account and carry its anonymous id. Nothing else: an email in the body,
 * or someone else's anonymous id, gives no access.
 */
function owns(existing: SessionRow, profileId: string | null, anonymousId: string | null): boolean {
  if (profileId && existing.user_id === profileId) return true;
  if (!existing.user_id && anonymousId && existing.anonymous_id === anonymousId) return true;
  return false;
}

/**
 * Records a completed reset with everything that happened inside it, and later
 * its "how do you feel?" answer. This is the table the engine learns from.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (!body.sessionId || !body.programId) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  // The column is a uuid; say so up front instead of failing at the database.
  if (!isUuid(body.sessionId)) {
    return NextResponse.json({ error: "invalid_session_id" }, { status: 400 });
  }
  const anonymousId = typeof body.anonymousId === "string" ? body.anonymousId : null;

  try {
    const profile = await currentProfile();
    const existing = await findOne("sessions", { id: body.sessionId });
    if (existing && !owns(existing, profile?.id ?? null, anonymousId)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // A feedback-only call updates the row the completion already wrote.
    if (body.perceivedEffect && !body.startedAt) {
      if (!isPerceivedEffect(body.perceivedEffect)) {
        return NextResponse.json({ error: "bad_request" }, { status: 400 });
      }
      if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
      await update("sessions", { id: body.sessionId }, { perceived_effect: body.perceivedEffect });
      return NextResponse.json({ ok: true });
    }

    const row: SessionRow = {
      id: body.sessionId,
      // Ownership comes from the session cookie alone. Anonymous rows stay
      // ownerless until a verified sign-in merges them.
      user_id: profile?.id ?? existing?.user_id ?? null,
      anonymous_id: anonymousId ?? existing?.anonymous_id ?? null,
      program_id: body.programId,
      program_name: body.programName ?? null,
      primary_need: body.primaryNeed ?? "general",
      setup: body.setup ?? "either",
      started_at: body.startedAt ?? new Date().toISOString(),
      completed_at: body.completedAt ?? null,
      duration_seconds: Math.max(0, Math.round(body.durationSeconds ?? 0)),
      duration_minutes: body.durationMinutes ?? null,
      perceived_effect: isPerceivedEffect(body.perceivedEffect) ? body.perceivedEffect : (existing?.perceived_effect ?? null),
      recommendation_id: body.recommendationId ?? null,
      algorithm_version: body.algorithmVersion ?? null,
      source: body.source ?? null,
      scheduled_break_id: body.plannedBreakId ?? null,
      generated: Boolean(body.generated),
    };
    await upsert("sessions", row, "id");

    if (Array.isArray(body.exercises) && body.exercises.length) {
      if (existing) await remove("session_exercises", { session_id: body.sessionId });
      const rows: SessionExerciseRow[] = body.exercises
        .filter((entry) => typeof entry.exerciseId === "string")
        .map((entry, index) => ({
          id: crypto.randomUUID(),
          session_id: body.sessionId as string,
          exercise_id: entry.exerciseId as string,
          sequence: entry.sequence ?? index,
          planned_duration: Math.round(entry.plannedSec ?? 0),
          actual_duration: Math.round(entry.actualSec ?? 0),
          completed: Boolean(entry.completed),
          skipped: Boolean(entry.skipped),
          swapped: Boolean(entry.swapped),
          swapped_to_exercise_id: entry.swappedToExerciseId ?? null,
          discomfort_reported: Boolean(entry.discomfortReported),
          discomfort_reason: entry.discomfortReason ?? null,
        }));
      await insertMany("session_exercises", rows);
    }

    if (body.plannedBreakId && profile) {
      await update(
        "planned_breaks",
        { id: body.plannedBreakId, profile_id: profile.id },
        { status: "completed", completed_session_id: body.sessionId, updated_at: new Date().toISOString() },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[deskbreak] session record failed:", error);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

/**
 * History for sync: the signed-in account's sessions, or for an anonymous
 * browser, the ownerless rows carrying its id. Rows that belong to an account
 * are only ever returned to that account's session.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anonymousId = searchParams.get("anonymousId");
  try {
    const profile = await currentProfile();
    if (!profile && !anonymousId) return NextResponse.json({ sessions: [] });
    const sessions = await sessionsFor(profile ? { profileId: profile.id } : { anonymousId });
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[deskbreak] session history failed:", error);
    return NextResponse.json({ sessions: [] }, { status: 503 });
  }
}
