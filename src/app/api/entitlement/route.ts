import { NextResponse } from "next/server";
import { absorbBillingProfiles, currentProfile } from "@/lib/server/auth";
import {
  FREE_ENTITLEMENT,
  anonymousProfile,
  ensureProfile,
  getEntitlementForAnonymousId,
  getEntitlementForUser,
  normalizeEmail,
} from "@/lib/server/entitlements";
import { getStripe, stripeConfigured } from "@/lib/server/stripe";
import { findOne, update, upsert, type Profile, type Subscription } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/**
 * What the client asks on load: is this person Pro right now?
 *
 * The answer comes from the subscription table, which only the Stripe webhook
 * (and the Stripe-verified checkout return below) writes. Identity comes from
 * the session cookie, or from the anonymous id of a device that paid. An email
 * address in the query is not accepted: knowing someone's address must not
 * unlock their subscription.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anonymousId = searchParams.get("anonymousId");
  const sessionId = searchParams.get("sessionId");

  try {
    // Returning from Checkout: read the session directly so Pro unlocks even if
    // the webhook has not landed yet. Stripe vouches for the session id.
    if (sessionId && stripeConfigured()) {
      const resolved = await entitlementFromCheckoutSession(sessionId, anonymousId);
      if (resolved) return NextResponse.json(resolved);
    }

    const profile = await currentProfile();
    if (profile) {
      // A verified account claims purchases made under its address.
      await absorbBillingProfiles(profile).catch(() => {});
      return NextResponse.json(await getEntitlementForUser(profile.id));
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

  // The profile checkout was started for, as recorded in Stripe's own copy of
  // the session. Never the caller's choice.
  const checkoutProfileId = session.client_reference_id ?? session.metadata?.user_id ?? null;
  let profile: Profile | null = checkoutProfileId ? await findOne("profiles", { id: checkoutProfileId }) : null;
  if (!profile) {
    const metadataAnonymousId = session.metadata?.anonymous_id || anonymousId;
    profile = metadataAnonymousId ? await anonymousProfile(metadataAnonymousId) : null;
  }
  if (!profile) profile = await ensureProfile({});

  const collected = session.customer_details?.email ? normalizeEmail(session.customer_details.email) : null;
  if (collected && !profile.email && profile.billing_email !== collected) {
    await update("profiles", { id: profile.id }, { billing_email: collected });
  }

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
    user_id: existing?.user_id ?? profile.id,
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
  };
}
