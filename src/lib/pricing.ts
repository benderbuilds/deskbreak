import type { BillingPeriod } from "./types";

/**
 * The single source of pricing truth.
 *
 * Nothing else in the app should contain a price string. Amounts come from env
 * so a pricing test never needs a code change, with the launch prices as the
 * defaults. Next.js inlines NEXT_PUBLIC_* only for literal references, so these
 * reads have to stay spelled out.
 */
function money(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const MONTHLY_PRICE_USD = money(
  process.env.NEXT_PUBLIC_PRO_MONTHLY_PRICE,
  5.99,
);

export const ANNUAL_PRICE_USD = money(
  process.env.NEXT_PUBLIC_PRO_ANNUAL_PRICE,
  39,
);

/** Shown struck through next to the founding price. Optional. */
export const ANNUAL_LIST_PRICE_USD = money(
  process.env.NEXT_PUBLIC_PRO_ANNUAL_LIST_PRICE,
  59,
);

/** Only ever true when Stripe itself is configured with a trial. */
export const TRIAL_DAYS = Number(process.env.NEXT_PUBLIC_PRO_TRIAL_DAYS) || 0;

export function formatUsd(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

export const ANNUAL_PER_MONTH_LABEL = `about ${formatUsd(
  Math.round((ANNUAL_PRICE_USD / 12) * 100) / 100,
)}/month`;

export type PriceOption = {
  period: BillingPeriod;
  amountLabel: string;
  cadenceLabel: string;
  supportLabel: string;
  badge?: string;
};

export const PRICE_OPTIONS: Record<BillingPeriod, PriceOption> = {
  annual: {
    period: "annual",
    amountLabel: formatUsd(ANNUAL_PRICE_USD),
    cadenceLabel: "/year",
    supportLabel: `Founding price · ${ANNUAL_PER_MONTH_LABEL}`,
    badge: "Best value",
  },
  monthly: {
    period: "monthly",
    amountLabel: formatUsd(MONTHLY_PRICE_USD),
    cadenceLabel: "/month",
    supportLabel: "Cancel anytime.",
  },
};

export const CHECKOUT_CTA = TRIAL_DAYS > 0
  ? `Start ${TRIAL_DAYS} days free`
  : "Start DeskBreak Pro";

/** Customer-facing copy for a checkout that cannot run. Never names an env var. */
export const CHECKOUT_UNAVAILABLE = {
  title: "Pro checkout is temporarily unavailable.",
  body: "Your free DeskBreak still works. Try Pro again in a bit.",
};

/**
 * The founding offer: the annual price shown against a higher list price.
 * Only on when the list price is above the annual price.
 */
export const FOUNDING_OFFER = ANNUAL_LIST_PRICE_USD > ANNUAL_PRICE_USD;

/** Optional cap on founding members, shown as "First 100 members". Unset hides the line. */
export const FOUNDING_SPOTS = (() => {
  const parsed = Number(process.env.NEXT_PUBLIC_PRO_FOUNDING_SPOTS);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
})();

/** The paywall button says what it charges. */
export function checkoutCta(period: BillingPeriod): string {
  if (TRIAL_DAYS > 0) return `Start ${TRIAL_DAYS} days free`;
  const option = PRICE_OPTIONS[period];
  const price = `${option.amountLabel}${option.cadenceLabel}`;
  return period === "annual" && FOUNDING_OFFER ? `Become a founding member, ${price}` : `Start Pro, ${price}`;
}

export const CHECKOUT_TRUST_LINE = "Secure checkout with Stripe. Cancel anytime from You.";
