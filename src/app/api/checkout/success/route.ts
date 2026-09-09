import Stripe from "stripe";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");

  if (!secret) {
    return NextResponse.json(
      { error: "stripe_not_configured" },
      { status: 501 },
    );
  }
  if (!sessionId) {
    return NextResponse.json({ error: "missing_session" }, { status: 400 });
  }

  const stripe = new Stripe(secret);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const paid =
    session.payment_status === "paid" ||
    session.status === "complete";

  if (!paid) {
    return NextResponse.json({ ok: false, status: session.status }, { status: 402 });
  }

  let expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  if (typeof session.expires_at === "number" && session.mode !== "subscription") {
    expiresAt = new Date(session.expires_at * 1000).toISOString();
  }

  return NextResponse.json({ ok: true, expiresAt });
}
