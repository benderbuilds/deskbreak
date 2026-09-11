import { NextResponse } from "next/server";
import { currentProfile, mergeAnonymousInto } from "@/lib/server/auth";
import { sessionsFor } from "@/lib/server/signals";
import { findMany } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/**
 * Who is this browser? For a signed-in user, also the history the server holds
 * and the preferences stored against the profile, so a new device fills in.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anonymousId = searchParams.get("anonymousId");
  try {
    const profile = await currentProfile();
    if (!profile) return NextResponse.json({ signedIn: false });

    if (anonymousId) await mergeAnonymousInto(profile, anonymousId).catch(() => {});

    const [constraints, favorites, sessions] = await Promise.all([
      findMany("functional_constraints", { profile_id: profile.id }),
      findMany("favorites", { profile_id: profile.id }),
      sessionsFor({ profileId: profile.id }, 200),
    ]);

    return NextResponse.json({
      signedIn: true,
      profile: {
        id: profile.id,
        email: profile.email,
        constraints: constraints.map((row) => row.constraint_key),
        favorites: favorites.map((row) => row.item_id),
        preferredDuration: profile.preferred_duration ?? null,
        preferredSetup: profile.preferred_setup ?? null,
      },
      sessions,
    });
  } catch (error) {
    console.error("[deskbreak] me failed:", error);
    return NextResponse.json({ signedIn: false }, { status: 503 });
  }
}
