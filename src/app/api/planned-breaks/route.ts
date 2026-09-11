import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/server/auth";
import { findMany, update, upsert, type PlannedBreakRow } from "@/lib/server/store";
import type { PlannedBreak } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Mirrors the client's plan for today on the server, so push delivery and the
 * Today screen agree about what is planned, snoozed, skipped and done.
 */
export async function PUT(request: Request) {
  let body: { date?: string; breaks?: PlannedBreak[] };
  try {
    body = (await request.json()) as { date?: string; breaks?: PlannedBreak[] };
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!body.date || !Array.isArray(body.breaks)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    for (const entry of body.breaks) {
      const row: PlannedBreakRow = {
        id: `${profile.id.slice(0, 8)}-${entry.id}`,
        profile_id: profile.id,
        date: body.date,
        start_window: entry.startMinutes,
        end_window: entry.endMinutes,
        type: entry.type,
        need: entry.need,
        duration_minutes: entry.durationMin,
        recommendation_id: entry.recommendationId,
        status: entry.status,
        snoozed_until: entry.snoozedUntilMinutes,
        completed_session_id: entry.completedSessionId,
        delivered_at: null,
        updated_at: new Date().toISOString(),
      };
      await upsert("planned_breaks", row, "id");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[deskbreak] planned breaks sync failed:", error);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  let body: { id?: string; status?: string; snoozedUntilMinutes?: number | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const profile = await currentProfile();
  if (!profile || !body.id || !body.status) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  try {
    await update(
      "planned_breaks",
      { id: `${profile.id.slice(0, 8)}-${body.id}`, profile_id: profile.id },
      { status: body.status, snoozed_until: body.snoozedUntilMinutes ?? null, updated_at: new Date().toISOString() },
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[deskbreak] planned break update failed:", error);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const profile = await currentProfile();
  if (!profile || !date) return NextResponse.json({ breaks: [] });
  try {
    const rows = await findMany("planned_breaks", { profile_id: profile.id, date });
    return NextResponse.json({ breaks: rows });
  } catch {
    return NextResponse.json({ breaks: [] }, { status: 503 });
  }
}
