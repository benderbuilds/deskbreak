import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/server/entitlements";
import { insert, update, type SessionRow } from "@/lib/server/store";

export const dynamic = "force-dynamic";

type Body = {
  sessionId?: string;
  anonymousId?: string;
  email?: string;
  programId?: string;
  primaryNeed?: string;
  setup?: string;
  startedAt?: string;
  completedAt?: string;
  durationSeconds?: number;
  perceivedEffect?: string;
};

/**
 * Records a completed reset, and later its "did that help?" answer.
 *
 * V2 only stores this. Once there is enough of it, the recommendation engine can
 * start reading which kinds of reset a given person says actually worked.
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
      await update(
        "sessions",
        { id: body.sessionId },
        { perceived_effect: body.perceivedEffect },
      );
      return NextResponse.json({ ok: true });
    }

    const profile =
      body.email || body.anonymousId
        ? await ensureProfile({
            email: body.email ?? null,
            anonymousId: body.anonymousId ?? null,
            primaryNeed: body.primaryNeed ?? null,
            preferredSetup: body.setup ?? null,
          })
        : null;

    const row: SessionRow = {
      id: body.sessionId,
      user_id: profile?.id ?? null,
      anonymous_id: body.anonymousId ?? null,
      program_id: body.programId,
      primary_need: body.primaryNeed ?? "general",
      setup: body.setup ?? "seated",
      started_at: body.startedAt ?? new Date().toISOString(),
      completed_at: body.completedAt ?? null,
      duration_seconds: Math.max(0, Math.round(body.durationSeconds ?? 0)),
      perceived_effect: body.perceivedEffect ?? null,
    };

    await insert("sessions", row);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[deskbreak] session record failed:", error);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
