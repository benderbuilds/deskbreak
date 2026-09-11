import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/server/auth";
import { isValidEmail, normalizeEmail } from "@/lib/server/entitlements";
import { getStripe, logCheckoutFailure, originFrom, stripeConfigured } from "@/lib/server/stripe";
import { findOne } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/**
 * Stripe Customer Portal: cancel, change card, see invoices. Normal billing
 * management never needs a support email.
 */
export async function POST(request: Request) {
  let body: { email?: string; anonymousId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  if (!process.env.STRIPE_SECRET_KEY || !stripeConfigured()) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  try {
    const profile =
      (await currentProfile()) ??
      (body.email && isValidEmail(body.email)
        ? await findOne("profiles", { email: normalizeEmail(body.email) })
        : null) ??
      (body.anonymousId ? await findOne("profiles", { anonymous_id: body.anonymousId }) : null);
    if (!profile) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const subscription = await findOne("subscriptions", { user_id: profile.id });
    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${originFrom(request)}/app/you`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    logCheckoutFailure("portal", error);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
