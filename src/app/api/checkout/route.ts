import { NextResponse } from "next/server";
import {
  getStripe,
  logCheckoutFailure,
  originFrom,
  stripeConfigured,
  stripePriceId,
} from "@/lib/server/stripe";
import { ensureProfile, isValidEmail, normalizeEmail } from "@/lib/server/entitlements";
import { TRIAL_DAYS } from "@/lib/pricing";
import type { BillingPeriod } from "@/lib/types";

type Body = {
  period?: BillingPeriod;
  email?: string;
  anonymousId?: string;
  primaryNeed?: string;
  paywallSource?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  const period: BillingPeriod = body.period === "monthly" ? "monthly" : "annual";
  const priceId = stripePriceId(period);

  if (!stripeConfigured(period) || !priceId) {
    logCheckoutFailure(
      "configuration",
      `no Stripe price configured for the ${period} plan`,
    );
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  try {
    // Create the identity up front so the webhook has something to attach to
    // even if the customer closes the tab before returning.
    const profile = await ensureProfile({
      email: body.email && isValidEmail(body.email) ? body.email : null,
      anonymousId: body.anonymousId ?? null,
      primaryNeed: body.primaryNeed ?? null,
    });

    const origin = originFrom(request);
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: profile.id,
      customer_email: profile.email ? normalizeEmail(profile.email) : undefined,
      success_url: `${origin}/app/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app/pro?checkout=cancelled`,
      allow_promotion_codes: true,
      metadata: {
        user_id: profile.id,
        anonymous_id: body.anonymousId ?? "",
        primary_need: body.primaryNeed ?? "",
        paywall_source: body.paywallSource ?? "",
        period,
      },
      subscription_data: {
        metadata: { user_id: profile.id },
        ...(TRIAL_DAYS > 0 ? { trial_period_days: TRIAL_DAYS } : {}),
      },
    });

    if (!session.url) {
      logCheckoutFailure("session", "Stripe returned a session with no URL");
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }

    return NextResponse.json({ url: session.url, userId: profile.id });
  } catch (error) {
    logCheckoutFailure("create", error);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
