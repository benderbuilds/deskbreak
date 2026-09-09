import Stripe from "stripe";
import { NextResponse } from "next/server";

function originFrom(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const header = request.headers.get("origin");
  if (header) return header;
  const host = request.headers.get("host");
  if (host) {
    const proto = host.includes("localhost") ? "http" : "https";
    return `${proto}://${host}`;
  }
  return "http://localhost:3000";
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;
  if (!secret || !priceId) {
    return NextResponse.json(
      {
        error: "stripe_not_configured",
        message:
          "Stripe keys are not set. Add STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PRICE_ID.",
      },
      { status: 501 },
    );
  }

  const stripe = new Stripe(secret);
  const origin = originFrom(request);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/paywall/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/paywall`,
    allow_promotion_codes: true,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "no_checkout_url" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}
