import { NextResponse } from "next/server";
import { ensureProfile, isValidEmail } from "@/lib/server/entitlements";
import { isDurable } from "@/lib/server/store";

export const dynamic = "force-dynamic";

type Body = {
  email?: string;
  anonymousId?: string;
  primaryNeed?: string;
  preferredSetup?: string;
  attribution?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    content?: string | null;
    landingPath?: string | null;
  };
};

/**
 * Stores a captured email server-side and links it to the anonymous visitor.
 *
 * No password, no confirmation step: the point is to be able to send tomorrow's
 * reminder, and asking for a password here would cost more signups than it saves.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (!body.email || !isValidEmail(body.email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  try {
    const profile = await ensureProfile({
      email: body.email,
      anonymousId: body.anonymousId ?? null,
      primaryNeed: body.primaryNeed ?? null,
      preferredSetup: body.preferredSetup ?? null,
      attribution: body.attribution,
    });
    return NextResponse.json({ ok: true, userId: profile.id, durable: isDurable() });
  } catch (error) {
    console.error("[deskbreak] email capture failed:", error);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
