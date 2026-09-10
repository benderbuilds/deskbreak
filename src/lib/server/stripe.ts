import "server-only";

import Stripe from "stripe";
import type { BillingPeriod } from "../types";

let cached: Stripe | null = null;

export function stripePriceId(period: BillingPeriod): string | undefined {
  return period === "annual"
    ? process.env.STRIPE_PRO_ANNUAL_PRICE_ID
    : process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
}

export function stripeConfigured(period?: BillingPeriod): boolean {
  if (!process.env.STRIPE_SECRET_KEY) return false;
  if (period) return Boolean(stripePriceId(period));
  return Boolean(
    process.env.STRIPE_PRO_ANNUAL_PRICE_ID ||
      process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
  );
}

export function getStripe(): Stripe {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("stripe_not_configured");
  if (!cached) cached = new Stripe(secret);
  return cached;
}

export function originFrom(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const header = request.headers.get("origin");
  if (header) return header;
  const host = request.headers.get("host");
  if (host) {
    const proto = host.startsWith("localhost") ? "http" : "https";
    return `${proto}://${host}`;
  }
  return "http://localhost:3000";
}

/**
 * Logs the real cause where operators can see it.
 *
 * Customers only ever see the copy in `CHECKOUT_UNAVAILABLE`. Environment
 * variable names are an internal detail and never reach the browser.
 */
export function logCheckoutFailure(context: string, error: unknown): void {
  console.error(`[deskbreak] checkout ${context}:`, error);
}
