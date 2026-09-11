import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/server/auth";
import { ensureProfile } from "@/lib/server/entitlements";
import {
  findMany,
  findOne,
  insert,
  remove,
  update,
  upsert,
  type FavoriteRow,
  type FunctionalConstraintRow,
  type WorkdayPreferencesRow,
} from "@/lib/server/store";
import { isFunctionalConstraint, type WorkdayPreferences } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body = {
  anonymousId?: string;
  primaryNeed?: string | null;
  preferredSetup?: string | null;
  preferredDuration?: number | null;
  constraints?: unknown;
  favorites?: unknown;
  notificationLevel?: string | null;
  workday?: WorkdayPreferences | null;
  timezone?: string | null;
};

/**
 * PATCH /api/profile: the client's preferences, pushed to the server.
 *
 * Anonymous browsers may call this too (constraints matter for server-side
 * recommendations); the row is keyed on the anonymous id until sign-in merges it.
 */
export async function PATCH(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const profile =
      (await currentProfile()) ??
      (body.anonymousId ? await ensureProfile({ anonymousId: body.anonymousId }) : null);
    if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    await update(
      "profiles",
      { id: profile.id },
      {
        primary_need: body.primaryNeed ?? profile.primary_need,
        preferred_setup: body.preferredSetup ?? null,
        preferred_duration: body.preferredDuration ?? null,
        notification_level: body.notificationLevel ?? profile.notification_level ?? null,
        timezone: body.timezone ?? profile.timezone,
        workday_start: body.workday?.startMinutes ?? profile.workday_start,
        workday_end: body.workday?.endMinutes ?? profile.workday_end,
        updated_at: new Date().toISOString(),
      },
    );

    if (Array.isArray(body.constraints)) {
      const wanted = body.constraints.filter(isFunctionalConstraint) as string[];
      const existing = await findMany("functional_constraints", { profile_id: profile.id });
      for (const row of existing) {
        if (!wanted.includes(row.constraint_key)) await remove("functional_constraints", { id: row.id });
      }
      for (const key of wanted) {
        if (!existing.some((row) => row.constraint_key === key)) {
          const row: FunctionalConstraintRow = {
            id: crypto.randomUUID(),
            profile_id: profile.id,
            constraint_key: key,
            created_at: new Date().toISOString(),
          };
          await insert("functional_constraints", row);
        }
      }
    }

    if (Array.isArray(body.favorites)) {
      const wanted = body.favorites.filter((entry): entry is string => typeof entry === "string");
      const existing = await findMany("favorites", { profile_id: profile.id });
      for (const row of existing) {
        if (!wanted.includes(row.item_id)) await remove("favorites", { id: row.id });
      }
      for (const itemId of wanted) {
        if (!existing.some((row) => row.item_id === itemId)) {
          const row: FavoriteRow = {
            id: crypto.randomUUID(),
            profile_id: profile.id,
            item_id: itemId,
            item_type: itemId.includes("reset") || itemId.includes("break") || itemId.includes("workout") ? "program" : "exercise",
            created_at: new Date().toISOString(),
          };
          await insert("favorites", row);
        }
      }
    }

    if (body.workday) {
      const days = body.workday.enabledDays ?? [1, 2, 3, 4, 5];
      const row: WorkdayPreferencesRow = {
        profile_id: profile.id,
        timezone: body.workday.timezone ?? body.timezone ?? null,
        workday_start: body.workday.startMinutes,
        workday_end: body.workday.endMinutes,
        monday_enabled: days.includes(1),
        tuesday_enabled: days.includes(2),
        wednesday_enabled: days.includes(3),
        thursday_enabled: days.includes(4),
        friday_enabled: days.includes(5),
        saturday_enabled: days.includes(6),
        sunday_enabled: days.includes(0),
        reminder_level: body.workday.level,
        updated_at: new Date().toISOString(),
      };
      await upsert("workday_preferences", row, "profile_id");
    }

    return NextResponse.json({ ok: true, profileId: profile.id });
  } catch (error) {
    console.error("[deskbreak] profile update failed:", error);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anonymousId = searchParams.get("anonymousId");
  try {
    const profile =
      (await currentProfile()) ?? (anonymousId ? await findOne("profiles", { anonymous_id: anonymousId }) : null);
    if (!profile) return NextResponse.json({ profile: null });
    const workday = await findOne("workday_preferences", { profile_id: profile.id });
    return NextResponse.json({
      profile: {
        id: profile.id,
        email: profile.email,
        preferredDuration: profile.preferred_duration ?? null,
        preferredSetup: profile.preferred_setup ?? null,
        workday: workday
          ? {
              startMinutes: workday.workday_start,
              endMinutes: workday.workday_end,
              level: workday.reminder_level,
              timezone: workday.timezone,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("[deskbreak] profile read failed:", error);
    return NextResponse.json({ profile: null }, { status: 503 });
  }
}
