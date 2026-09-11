import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/server/auth";
import { ensureProfile } from "@/lib/server/entitlements";
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
  email?: string;
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

  try {
    // A feedback-only call updates the row the completion already wrote.
    if (body.perceivedEffect && !body.startedAt) {
      if (!isPerceivedEffect(body.perceivedEffect)) {
        return NextResponse.json({ error: "bad_request" }, { status: 400 });
      }
      await update("sessions", { id: body.sessionId }, { perceived_effect: body.perceivedEffect });
      return NextResponse.json({ ok: true });
    }

    const signedIn = await currentProfile();
    const profile =
      signedIn ??
      (body.email || body.anonymousId
        ? await ensureProfile({
            email: body.email ?? null,
            anonymousId: body.anonymousId ?? null,
            primaryNeed: body.primaryNeed ?? null,
            preferredSetup: body.setup ?? null,
          })
        : null);

    const existing = await findOne("sessions", { id: body.sessionId });
    const row: SessionRow = {
      id: body.sessionId,
      user_id: profile?.id ?? existing?.user_id ?? null,
      anonymous_id: body.anonymousId ?? existing?.anonymous_id ?? null,
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

/** History for sync: the signed-in profile's sessions, or an anonymous id's. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anonymousId = searchParams.get("anonymousId");
  try {
    const profile = await currentProfile();
    if (!profile && !anonymousId) return NextResponse.json({ sessions: [] });
    const sessions = await sessionsFor({ profileId: profile?.id, anonymousId: profile ? null : anonymousId });
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[deskbreak] session history failed:", error);
    return NextResponse.json({ sessions: [] }, { status: 503 });
  }
}
