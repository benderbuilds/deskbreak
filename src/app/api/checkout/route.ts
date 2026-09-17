import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/server/auth";
import {
  getStripe,
  logCheckoutFailure,
  originFrom,
  stripeConfigured,
  stripePriceId,
} from "@/lib/server/stripe";
import { anonymousProfile, ensureProfile, isValidEmail, normalizeEmail } from "@/lib/server/entitlements";
import { durableOrNotProduction } from "@/lib/server/runtime";
import { TRIAL_DAYS } from "@/lib/pricing";
import type { BillingPeriod } from "@/lib/types";
import type { Profile } from "@/lib/server/store";

type Body = {
  period?: BillingPeriod;
  email?: string;
  anonymousId?: string;
  primaryNeed?: string;
  paywallSource?: string;
};

/**
 * Why checkout could not run, as a code an operator can act on.
 *
 * Customers never see this: the paywall shows the same friendly copy whatever
 * comes back. It exists so `curl /api/checkout` says which of several unrelated
 * problems is actually happening, without naming an environment variable or
 * leaking anything about the configuration itself.
 */
type UnavailableReason =
  | "price_not_configured"
  | "store_not_configured"
  | "identity_unavailable"
  | "provider_rejected"
  | "no_checkout_url";

function unavailable(reason: UnavailableReason) {
  return NextResponse.json({ error: "unavailable", reason }, { status: 503 });
}

/**
 * The profile a purchase attaches to: the signed-in account, else the shell
 * profile for this anonymous browser. An email in the body is only ever a
 * prefill for Stripe's form; it never selects or alters a profile here.
 */
async function purchasingProfile(body: Body): Promise<Profile> {
  const signedIn = await currentProfile();
  if (signedIn) return signedIn;
  if (body.anonymousId) {
    const shell = await anonymousProfile(body.anonymousId, { primaryNeed: body.primaryNeed ?? null });
    if (shell) return shell;
  }
  // The anonymous id belongs to an account that has signed in, or there is no
  // id at all: a fresh profile keeps the purchase separate until sign-in.
  return ensureProfile({ primaryNeed: body.primaryNeed ?? null });
}

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
    return unavailable("price_not_configured");
  }
  if (!durableOrNotProduction()) {
    // Charging someone and storing their entitlement in memory would lose the
    // purchase on the next deploy. Refuse rather than pretend.
    logCheckoutFailure("configuration", "no durable store in production; refusing to start checkout");
    return unavailable("store_not_configured");
  }

  // Create the identity up front so the webhook has something to attach to even
  // if the customer closes the tab before returning. Kept in its own try so a
  // database problem is never reported as a payment problem: the two have
  // completely different fixes and used to look identical from outside.
  let profile: Profile;
  try {
    profile = await purchasingProfile(body);
  } catch (error) {
    logCheckoutFailure("identity", error);
    return unavailable("identity_unavailable");
  }

  const prefillEmail =
    profile.email ??
    profile.billing_email ??
    (body.email && isValidEmail(body.email) ? normalizeEmail(body.email) : undefined);

  try {
    const origin = originFrom(request);
    const session = await getStripe().checkout.sessions.create({
      // Configured in Checkout Studio. Change these there, not here.
      ui_mode: "hosted_page",
      billing_address_collection: "auto",
      phone_number_collection: { enabled: false },
      automatic_tax: { enabled: false },
      allow_promotion_codes: false,
      payment_method_collection: "always",
      submit_type: "auto",
      integration_identifier: "hosted_web_0001",
      origin_context: "web",

      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/app/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app/pro?checkout=cancelled`,

      // Identity wiring, not Checkout Studio settings. The webhook resolves a
      // subscription back to a DeskBreak profile through subscription_data
      // .metadata.user_id, falling back to client_reference_id. Drop these and
      // a customer is charged and never granted Pro, so they stay.
      client_reference_id: profile.id,
      customer_email: prefillEmail ?? undefined,
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
      return unavailable("no_checkout_url");
    }

    return NextResponse.json({ url: session.url, userId: profile.id });
  } catch (error) {
    logCheckoutFailure("create", error);
    return unavailable("provider_rejected");
  }
}
