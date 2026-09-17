import { NextResponse } from "next/server";
import { currentProfile, replaceConstraints } from "@/lib/server/auth";
import { anonymousProfile } from "@/lib/server/entitlements";
import {
  findMany,
  findOne,
  insert,
  remove,
  update,
  upsert,
  type FavoriteRow,
  type Profile,
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
  reminderFrequency?: string | null;
  workday?: WorkdayPreferences | null;
  timezone?: string | null;
};

/**
 * Whose preferences is this request allowed to write?
 *
 * A session cookie names an account. Without one, an anonymous id reaches only
 * the shell profile keyed on it; if that id belongs to an account that has
 * signed in, the caller has to sign in too.
 */
async function writableProfile(anonymousId: string | undefined): Promise<Profile | null> {
  const signedIn = await currentProfile();
  if (signedIn) return signedIn;
  if (!anonymousId) return null;
  return anonymousProfile(anonymousId);
}

export async function PATCH(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const profile = await writableProfile(body.anonymousId);
    if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const reminderFrequency =
      body.reminderFrequency === "daily" || body.reminderFrequency === "off"
        ? body.reminderFrequency
        : undefined;

    await update(
      "profiles",
      { id: profile.id },
      {
        primary_need: body.primaryNeed ?? profile.primary_need,
        preferred_setup: body.preferredSetup === undefined ? profile.preferred_setup : body.preferredSetup,
        preferred_duration:
          body.preferredDuration === undefined ? (profile.preferred_duration ?? null) : body.preferredDuration,
        notification_level: body.notificationLevel ?? profile.notification_level ?? null,
        reminder_frequency: reminderFrequency ?? profile.reminder_frequency,
        timezone: body.timezone ?? profile.timezone,
        workday_start: body.workday?.startMinutes ?? profile.workday_start,
        workday_end: body.workday?.endMinutes ?? profile.workday_end,
        updated_at: new Date().toISOString(),
      },
    );

    if (Array.isArray(body.constraints)) {
      await replaceConstraints(profile.id, body.constraints.filter(isFunctionalConstraint));
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

/** The signed-in account's stored preferences. Nothing for anonymous callers. */
export async function GET() {
  try {
    const profile = await currentProfile();
    if (!profile) return NextResponse.json({ profile: null }, { status: 401 });
    const [workday, constraints] = await Promise.all([
      findOne("workday_preferences", { profile_id: profile.id }),
      findMany("functional_constraints", { profile_id: profile.id }),
    ]);
    return NextResponse.json({
      profile: {
        id: profile.id,
        email: profile.email,
        preferredDuration: profile.preferred_duration ?? null,
        preferredSetup: profile.preferred_setup ?? null,
        primaryNeed: profile.primary_need ?? null,
        reminderFrequency: profile.reminder_frequency ?? null,
        timezone: profile.timezone ?? null,
        constraints: constraints.map((row) => row.constraint_key),
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
