"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { track } from "@/lib/analytics";
import { PAYWALL_HEADLINES, PRO_FEATURES } from "@/lib/constants";
import {
  ANNUAL_LIST_PRICE_USD,
  ANNUAL_PER_MONTH_LABEL,
  ANNUAL_PRICE_USD,
  CHECKOUT_UNAVAILABLE,
  PRICE_OPTIONS,
  TRIAL_DAYS,
  formatUsd,
} from "@/lib/pricing";
import { ensureAnonymousId, markPaywallSeen } from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { isPrimaryNeed, type BillingPeriod, type PrimaryNeed } from "@/lib/types";

/**
 * The paywall, after DeskBreak has demonstrated something.
 *
 * It leads with this person's own numbers, sells automation and
 * personalization rather than locked stretches, and always leaves a way to
 * keep using the free product.
 */
export function PaywallView() {
  const router = useRouter();
  const params = useSearchParams();
  const state = useAppState();

  const source = params.get("from") ?? "direct";
  const needParam = params.get("need");
  const need: PrimaryNeed = isPrimaryNeed(needParam) ? needParam : (state.primaryNeed ?? "general");
  const minutes = params.get("minutes");

  const [period, setPeriod] = useState<BillingPeriod>("annual");
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const stats = useMemo(() => {
    const total = state.progress.totalWorkouts;
    const helped = state.progress.history.filter((session) => session.perceivedEffect === "better").length;
    return { total, helped };
  }, [state.progress.totalWorkouts, state.progress.history]);

  useEffect(() => {
    markPaywallSeen();
    track("paywall_viewed", { paywall_source: source, need, sessions: stats.total, helped: stats.helped });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, need]);

  function choosePeriod(next: BillingPeriod) {
    setPeriod(next);
    track("pricing_period_selected", { period: next, paywall_source: source });
  }

  async function startCheckout() {
    setSubmitting(true);
    setFailed(false);
    track("checkout_started", { period, paywall_source: source, need });

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period,
          email: state.account.email ?? state.email,
          anonymousId: ensureAnonymousId(),
          primaryNeed: need,
          paywallSource: source,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { url?: string };
      if (!response.ok || !data.url) throw new Error("checkout_unavailable");
      window.location.href = data.url;
    } catch {
      // The customer never sees why. Operators get the detail in the server log.
      track("checkout_failed", { period, paywall_source: source });
      setFailed(true);
      setSubmitting(false);
    }
  }

  function continueFree() {
    track("free_continued", { paywall_source: source, need });
    router.push("/app");
  }

  const option = PRICE_OPTIONS[period];
  const showListPrice = period === "annual" && ANNUAL_LIST_PRICE_USD > ANNUAL_PRICE_USD;
  const headline =
    source === "duration" && minutes
      ? `${minutes}-minute workouts are part of Pro.`
      : PAYWALL_HEADLINES[need];

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] lg:px-10">
      <div className="flex justify-center">
        <CharacterArt pose="ready" size={130} alt="Stretch, ready to go" />
      </div>

      <h1 className="mt-4 text-center font-display text-[2rem] font-semibold leading-tight tracking-tight text-ink">
        {headline}
      </h1>

      {stats.total > 0 ? (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="surface px-4 py-4 text-center">
            <p className="font-display text-2xl font-semibold text-ink">{stats.total}</p>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
              DeskBreak{stats.total === 1 ? "" : "s"}
            </p>
          </div>
          <div className="surface px-4 py-4 text-center">
            <p className="font-display text-2xl font-semibold text-ink">{stats.helped}</p>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">helped</p>
          </div>
        </div>
      ) : null}

      <p className="mt-5 text-center leading-relaxed text-ink/70">
        With Pro, DeskBreak learns what works and puts the right movement breaks into your workday automatically.
      </p>

      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        {PRO_FEATURES.map((feature) => (
          <li key={feature} className="flex items-center gap-2.5 text-sm font-semibold text-ink/80">
            <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-mint text-[11px] font-bold text-ink">
              ✓
            </span>
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-7 grid grid-cols-2 gap-2 rounded-[16px] bg-ink/5 p-1.5" role="radiogroup" aria-label="Billing period">
        {(["annual", "monthly"] as BillingPeriod[]).map((value) => {
          const active = period === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choosePeriod(value)}
              className={[
                "min-h-12 rounded-[12px] text-sm font-semibold transition-colors",
                active ? "bg-white text-ink" : "text-ink/55",
              ].join(" ")}
            >
              {value === "annual" ? "Annual" : "Monthly"}
              {value === "annual" && PRICE_OPTIONS.annual.badge ? (
                <span className="ml-1.5 text-[11px] font-semibold text-coral">{PRICE_OPTIONS.annual.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-5 text-center">
        <p className="font-display text-[2.4rem] font-semibold leading-none tracking-tight text-ink">
          {option.amountLabel}
          <span className="text-lg font-semibold text-ink/45">{option.cadenceLabel}</span>
        </p>
        <p className="mt-2 text-sm text-ink/55">
          {showListPrice ? <span className="line-through">{formatUsd(ANNUAL_LIST_PRICE_USD)}/year</span> : null}{" "}
          {period === "annual" ? `About ${ANNUAL_PER_MONTH_LABEL.replace("about ", "")}` : option.supportLabel}
        </p>
      </div>

      {failed ? (
        <div className="mt-5 rounded-[16px] border border-coral/30 bg-white px-4 py-4 text-center" role="alert">
          <p className="font-display text-base font-semibold text-ink">{CHECKOUT_UNAVAILABLE.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink/60">{CHECKOUT_UNAVAILABLE.body}</p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-2.5">
        <Button onClick={startCheckout} disabled={submitting}>
          {submitting ? "Opening checkout..." : TRIAL_DAYS > 0 ? `Start ${TRIAL_DAYS} days free` : "Build my workday"}
        </Button>
        <Button variant="tertiary" onClick={continueFree}>
          Continue free
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-ink/45">Cancel anytime from You. No support email needed.</p>
    </div>
  );
}
