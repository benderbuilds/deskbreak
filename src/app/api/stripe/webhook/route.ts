import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, logCheckoutFailure } from "@/lib/server/stripe";
import { ensureProfile } from "@/lib/server/entitlements";
import { findOne, isDurable, upsert, type Subscription } from "@/lib/server/store";

/**
 * Stripe is the source of truth for entitlement; this is where it lands.
 *
 * Nothing else in the app writes `subscriptions`, and no code path invents an
 * expiry date. Period end and status come from the subscription object itself.
 */
export const dynamic = "force-dynamic";

const HANDLED = new Set<Stripe.Event["type"]>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]);

function periodEnd(subscription: Stripe.Subscription): string | null {
  const item = subscription.items?.data?.[0];
  const seconds =
    item?.current_period_end ??
    (subscription as unknown as { current_period_end?: number }).current_period_end;
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;
}

async function resolveUserId(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const fromMetadata = subscription.metadata?.user_id;
  if (fromMetadata) return fromMetadata;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
  if (!customerId) return null;

  const existing = await findOne("subscriptions", {
    stripe_customer_id: customerId,
  });
  if (existing) return existing.user_id;

  // Last resort: match on the customer's email so a purchase is never orphaned.
  try {
    const customer = await getStripe().customers.retrieve(customerId);
    const email = "deleted" in customer ? null : customer.email;
    if (!email) return null;
    const profile = await ensureProfile({ email });
    return profile.id;
  } catch (error) {
    logCheckoutFailure("customer lookup", error);
    return null;
  }
}

async function persist(subscription: Stripe.Subscription): Promise<void> {
  const userId = await resolveUserId(subscription);
  if (!userId) {
    logCheckoutFailure(
      "webhook",
      `no profile for subscription ${subscription.id}`,
    );
    return;
  }

  const existing = await findOne("subscriptions", {
    stripe_subscription_id: subscription.id,
  });

  const row: Subscription = {
    id: existing?.id ?? crypto.randomUUID(),
    user_id: userId,
    stripe_customer_id:
      typeof subscription.customer === "string"
        ? subscription.customer
        : (subscription.customer?.id ?? null),
    stripe_subscription_id: subscription.id,
    stripe_price_id: subscription.items?.data?.[0]?.price?.id ?? null,
    status: subscription.status,
    current_period_end: periodEnd(subscription),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    created_at: existing?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await upsert("subscriptions", row, "stripe_subscription_id");
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  if (!secret || !signature) {
    logCheckoutFailure("webhook", "missing signing secret or signature header");
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    logCheckoutFailure("webhook signature", error);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  if (!HANDLED.has(event.type)) {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  if (!isDurable()) {
    // Worth shouting about: without Supabase this write survives only until the
    // server restarts, so a real purchase would silently evaporate.
    logCheckoutFailure(
      "webhook",
      "no durable store configured; subscription state is in-memory only",
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (!subscriptionId) break;
        const subscription =
          await getStripe().subscriptions.retrieve(subscriptionId);
        if (session.client_reference_id && !subscription.metadata?.user_id) {
          subscription.metadata = {
            ...subscription.metadata,
            user_id: session.client_reference_id,
          };
        }
        if (session.customer_details?.email) {
          await ensureProfile({
            email: session.customer_details.email,
            anonymousId: session.metadata?.anonymous_id || null,
          });
        }
        await persist(subscription);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await persist(event.data.object);
        break;
      }
      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;
        if (!subscriptionId) break;
        await persist(await getStripe().subscriptions.retrieve(subscriptionId));
        break;
      }
    }
  } catch (error) {
    logCheckoutFailure(`webhook ${event.type}`, error);
    // 500 so Stripe retries rather than dropping a real state change.
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
