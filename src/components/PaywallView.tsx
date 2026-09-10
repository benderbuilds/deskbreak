"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { track } from "@/lib/analytics";
import { PAYWALL_HEADLINES, PRO_PROMISE } from "@/lib/constants";
import {
  ANNUAL_LIST_PRICE_USD,
  ANNUAL_PRICE_USD,
  CHECKOUT_CTA,
  CHECKOUT_UNAVAILABLE,
  PRICE_OPTIONS,
  formatUsd,
} from "@/lib/pricing";
import { ensureAnonymousId, markPaywallSeen } from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { isPrimaryNeed, type BillingPeriod, type PrimaryNeed } from "@/lib/types";

const BENEFITS = [
  {
    title: "The right reset",
    body: "Tell DeskBreak what's tight and get a routine matched to it.",
  },
  {
    title: "The right time",
    body: "Get nudged before your desk day catches up with you.",
  },
  {
    title: "Zero planning",
    body: "Open DeskBreak and we'll tell you what to do next.",
  },
  {
    title: "Progress that means something",
    body: "See which breaks actually make you feel better.",
  },
];

export function PaywallView() {
  const router = useRouter();
  const params = useSearchParams();
  const state = useAppState();

  const source = params.get("from") ?? "direct";
  const needParam = params.get("need");
  const need: PrimaryNeed = isPrimaryNeed(needParam)
    ? needParam
    : (state.primaryNeed ?? "general");

  const [period, setPeriod] = useState<BillingPeriod>("annual");
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    markPaywallSeen();
    track("paywall_viewed", { paywall_source: source, need });
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
          email: state.email,
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
  const showListPrice =
    period === "annual" && ANNUAL_LIST_PRICE_USD > ANNUAL_PRICE_USD;

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex justify-center">
        <CharacterArt pose="ready" size={150} alt="Stretch, ready to go" />
      </div>

      <h1 className="mt-4 text-center font-display text-[2rem] font-semibold leading-tight tracking-tight text-ink">
        {PAYWALL_HEADLINES[need]}
      </h1>
      <p className="mt-3 text-center leading-relaxed text-ink/65">{PRO_PROMISE}</p>

      <ul className="mt-7 grid gap-2.5">
        {BENEFITS.map((benefit) => (
          <li
            key={benefit.title}
            className="rounded-[20px] bg-white px-4 py-3.5 shadow-[0_3px_0_rgba(28,25,23,0.06)]"
          >
            <p className="font-display text-base font-semibold text-ink">
              {benefit.title}
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-ink/60">{benefit.body}</p>
          </li>
        ))}
      </ul>

      <div
        className="mt-7 grid grid-cols-2 gap-2 rounded-[20px] bg-ink/5 p-1.5"
        role="radiogroup"
        aria-label="Billing period"
      >
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
                "min-h-12 rounded-[16px] text-sm font-semibold transition-colors",
                active ? "bg-white text-ink shadow-[0_2px_0_rgba(28,25,23,0.08)]" : "text-ink/55",
              ].join(" ")}
            >
              {value === "annual" ? "Annual" : "Monthly"}
              {value === "annual" && PRICE_OPTIONS.annual.badge ? (
                <span className="ml-1.5 text-[11px] font-semibold text-coral">
                  {PRICE_OPTIONS.annual.badge}
                </span>
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
          {showListPrice ? (
            <>
              <span className="line-through">{formatUsd(ANNUAL_LIST_PRICE_USD)}/year</span>{" "}
            </>
          ) : null}
          {option.supportLabel}
        </p>
      </div>

      {failed ? (
        <div
          className="mt-5 rounded-[20px] border-2 border-coral/30 bg-white px-4 py-4 text-center"
          role="alert"
        >
          <p className="font-display text-base font-semibold text-ink">
            {CHECKOUT_UNAVAILABLE.title}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink/60">
            {CHECKOUT_UNAVAILABLE.body}
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3">
        <Button onClick={startCheckout} disabled={submitting}>
          {submitting ? "Opening checkout..." : CHECKOUT_CTA}
        </Button>
        <Button variant="ghost" onClick={continueFree}>
          Keep using DeskBreak free
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-ink/45">Cancel anytime.</p>
    </div>
  );
}
