import { NextResponse } from "next/server";
import {
  ensureProfile,
  getEntitlementForEmail,
  isValidEmail,
} from "@/lib/server/entitlements";

export const dynamic = "force-dynamic";

/**
 * "Restore Pro purchase": resolves the subscription behind a checkout email.
 *
 * Deliberately does not say whether an address exists, so this cannot be used to
 * probe who has an account. Either way the caller gets an entitlement object.
 */
export async function POST(request: Request) {
  let body: { email?: string; anonymousId?: string };
  try {
    body = (await request.json()) as { email?: string; anonymousId?: string };
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (!body.email || !isValidEmail(body.email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  try {
    const entitlement = await getEntitlementForEmail(body.email);
    if (entitlement.pro && body.anonymousId) {
      // Bind this device to the paying identity so it stays Pro on reload.
      await ensureProfile({ email: body.email, anonymousId: body.anonymousId });
    }
    return NextResponse.json({ ...entitlement, email: body.email.trim().toLowerCase() });
  } catch (error) {
    console.error("[deskbreak] restore failed:", error);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
