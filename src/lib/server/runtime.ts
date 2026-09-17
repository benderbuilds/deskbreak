import "server-only";

import { isDurable } from "./store";

/**
 * What kind of deployment this is, and which capabilities it actually has.
 *
 * "Production" means the real thing: Vercel's production environment, or a
 * self-hosted deployment that sets DESKBREAK_ENV=production. Preview
 * deployments and local `next start` are not production, so they may run on
 * the in-memory store and hand back sign-in links for testing. Production
 * never does either; it reports the missing configuration instead.
 */
export function isProductionRuntime(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.DESKBREAK_ENV === "production";
}

/** Sign-in links returned in API responses. Only outside production, only opted in. */
export function devLinksEnabled(): boolean {
  return process.env.AUTH_DEV_LINKS === "1" && !isProductionRuntime();
}

export type Capability = "store" | "auth" | "email" | "stripe" | "push" | "cron";

export type CapabilityReport = {
  environment: "production" | "preview" | "development";
  configured: Record<Capability, boolean>;
  /** Capabilities production needs before the feature that depends on them is offered. */
  missingForProduction: Capability[];
  ready: boolean;
};

export function capabilityReport(): CapabilityReport {
  const configured: Record<Capability, boolean> = {
    store: isDurable(),
    auth: Boolean(process.env.AUTH_SECRET || process.env.CRON_SECRET),
    email: Boolean(process.env.RESEND_API_KEY),
    stripe: Boolean(
      process.env.STRIPE_SECRET_KEY &&
        process.env.STRIPE_WEBHOOK_SECRET &&
        (process.env.STRIPE_PRO_ANNUAL_PRICE_ID || process.env.STRIPE_PRO_MONTHLY_PRICE_ID),
    ),
    push: Boolean(
      (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) &&
        process.env.VAPID_PRIVATE_KEY,
    ),
    cron: Boolean(process.env.CRON_SECRET),
  };
  const missingForProduction = (Object.keys(configured) as Capability[]).filter(
    (key) => !configured[key],
  );
  const environment = isProductionRuntime()
    ? "production"
    : process.env.VERCEL_ENV === "preview"
      ? "preview"
      : "development";
  return {
    environment,
    configured,
    missingForProduction,
    ready: !isProductionRuntime() || missingForProduction.length === 0,
  };
}

/**
 * True when a feature that must persist (accounts, billing) is safe to offer.
 *
 * Outside production the in-memory store is fine for trying things out; in
 * production it would silently lose sign-ins and purchases on the next deploy.
 */
export function durableOrNotProduction(): boolean {
  return isDurable() || !isProductionRuntime();
}
