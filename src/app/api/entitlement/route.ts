import { NextResponse } from "next/server";
import {
  FREE_ENTITLEMENT,
  getEntitlementForAnonymousId,
  getEntitlementForEmail,
  isValidEmail,
} from "@/lib/server/entitlements";
import { getStripe, stripeConfigured } from "@/lib/server/stripe";
import { findOne, upsert, type Subscription } from "@/lib/server/store";
import { ensureProfile } from "@/lib/server/entitlements";

export const dynamic = "force-dynamic";

/**
 * What the client asks on load: is this person Pro right now?
 *
 * The answer comes from the subscription table, which only the Stripe webhook
 * writes. Local storage caches this for a snappy first paint but never decides it.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const anonymousId = searchParams.get("anonymousId");
  const sessionId = searchParams.get("sessionId");

  try {
    // Returning from Checkout: read the session directly so Pro unlocks even if
    // the webhook has not landed yet.
    if (sessionId && stripeConfigured()) {
      const resolved = await entitlementFromCheckoutSession(sessionId, anonymousId);
      if (resolved) return NextResponse.json(resolved);
    }

    if (email && isValidEmail(email)) {
      return NextResponse.json(await getEntitlementForEmail(email));
    }
    if (anonymousId) {
      return NextResponse.json(await getEntitlementForAnonymousId(anonymousId));
    }
  } catch (error) {
    console.error("[deskbreak] entitlement lookup failed:", error);
  }

  return NextResponse.json(FREE_ENTITLEMENT);
}

async function entitlementFromCheckoutSession(
  sessionId: string,
  anonymousId: string | null,
) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  if (!subscriptionId) return null;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const profile = await ensureProfile({
    email: session.customer_details?.email ?? null,
    anonymousId: anonymousId ?? session.metadata?.anonymous_id ?? null,
  });

  const item = subscription.items?.data?.[0];
  const endSeconds =
    item?.current_period_end ??
    (subscription as unknown as { current_period_end?: number }).current_period_end;
  const currentPeriodEnd =
    typeof endSeconds === "number" ? new Date(endSeconds * 1000).toISOString() : null;

  const existing = await findOne("subscriptions", {
    stripe_subscription_id: subscription.id,
  });
  const row: Subscription = {
    id: existing?.id ?? crypto.randomUUID(),
    user_id: profile.id,
    stripe_customer_id:
      typeof subscription.customer === "string"
        ? subscription.customer
        : (subscription.customer?.id ?? null),
    stripe_subscription_id: subscription.id,
    stripe_price_id: item?.price?.id ?? null,
    status: subscription.status,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    created_at: existing?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await upsert("subscriptions", row, "stripe_subscription_id");

  return {
    pro: ["active", "trialing", "past_due"].includes(subscription.status),
    status: subscription.status,
    currentPeriodEnd,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    email: profile.email,
  };
}
