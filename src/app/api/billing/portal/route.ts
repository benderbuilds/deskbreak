import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/server/auth";
import { getStripe, logCheckoutFailure, originFrom, stripeConfigured } from "@/lib/server/stripe";
import { findOne } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/**
 * Stripe Customer Portal: cancel, change card, see invoices.
 *
 * Only a verified session gets a portal link, and only for the Stripe customer
 * attached to that session's own account. An email address or anonymous id in
 * the request body proves nothing and is ignored.
 */
export async function POST(request: Request) {
  const profile = await currentProfile().catch(() => null);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!process.env.STRIPE_SECRET_KEY || !stripeConfigured()) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  try {
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
