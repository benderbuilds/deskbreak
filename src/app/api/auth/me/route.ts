import { NextResponse } from "next/server";
import { absorbBillingProfiles, currentProfile, mergeAnonymousInto } from "@/lib/server/auth";
import { getEntitlementForUser } from "@/lib/server/entitlements";
import { sessionsFor } from "@/lib/server/signals";
import { findMany } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/**
 * Who is this browser? Answered only from the session cookie.
 *
 * A signed-in browser may also name its own anonymous id so history it
 * recorded before signing in on this device joins the account. That merge
 * takes ownerless rows only; it never takes rows from another signed-in
 * account, and it never moves a paid subscription (that needs the sign-in link
 * flow, which proves the browser).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anonymousId = searchParams.get("anonymousId");
  try {
    const profile = await currentProfile();
    if (!profile) return NextResponse.json({ signedIn: false });

    if (anonymousId) await mergeAnonymousInto(profile, anonymousId).catch(() => {});
    // Purchases made under this verified address, on any device, belong here.
    await absorbBillingProfiles(profile).catch(() => {});

    const [constraints, favorites, sessions, entitlement] = await Promise.all([
      findMany("functional_constraints", { profile_id: profile.id }),
      findMany("favorites", { profile_id: profile.id }),
      sessionsFor({ profileId: profile.id }, 200),
      getEntitlementForUser(profile.id),
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
        reminderFrequency: profile.reminder_frequency ?? null,
      },
      entitlement,
      sessions,
    });
  } catch (error) {
    console.error("[deskbreak] me failed:", error);
    return NextResponse.json({ signedIn: false }, { status: 503 });
  }
}
