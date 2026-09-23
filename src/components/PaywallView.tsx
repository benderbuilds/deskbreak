"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, ButtonLink } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { track } from "@/lib/analytics";
import { openBillingPortal, renewalLine } from "@/lib/billing-client";
import { PRO_FEATURES, SUPPORT_EMAIL } from "@/lib/constants";
import { todayKey } from "@/lib/dates";
import { isProEntitlement } from "@/lib/entitlements";
import { PAYWALL_NEED_HEADLINES, paywallOutcomeLine } from "@/lib/paywall-copy";
import {
  ANNUAL_PER_MONTH_LABEL,
  ANNUAL_PRICE_USD,
  CHECKOUT_TRUST_LINE,
  CHECKOUT_UNAVAILABLE,
  FOUNDING_OFFER,
  FOUNDING_TERMS,
  PRICE_OPTIONS,
  checkoutCta,
  formatUsd,
} from "@/lib/pricing";
import { ensureAnonymousId, markPaywallSeen } from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import { BREAK_TYPE_COPY, REMINDER_LEVELS, defaultPreferences, formatMinutes, generateBreaks } from "@/lib/workday";
import { isPrimaryNeed, type BillingPeriod, type PrimaryNeed } from "@/lib/types";

/**
 * The paywall, after DeskBreak has demonstrated something.
 *
 * It leads with this person's own numbers, sells automation and
 * personalization rather than locked stretches, and always leaves a way to
 * keep using the free product. Someone who already has Pro sees what they
 * have instead.
 */
export function PaywallView() {
  const isClient = useIsClient();
  const state = useAppState();
  if (!isClient) return null;
  if (isProEntitlement(state.entitlement)) return <ProActiveView />;
  return <Paywall />;
}

function Paywall() {
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

  // A taste of their own day: their saved hours if any, else the defaults.
  // One-minute stands are left out so the preview stays short.
  const preview = useMemo(() => {
    const preferences = {
      ...(state.plan?.preferences ?? defaultPreferences()),
      // Every day, so the preview is never empty on a weekend.
      enabledDays: [0, 1, 2, 3, 4, 5, 6],
    };
    return {
      preferences,
      breaks: generateBreaks({ preferences, date: todayKey() }).filter((entry) => entry.type !== "stand"),
    };
  }, [state.plan]);

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
  const founding = period === "annual" && FOUNDING_OFFER;
  const headline =
    source === "duration" && minutes ? `${minutes}-minute workouts are part of Pro.` : PAYWALL_NEED_HEADLINES[need];
  const outcome = paywallOutcomeLine(need, state.progress.history);

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] lg:px-10">
      <div className="flex justify-center">
        <CharacterArt pose="ready" size={110} alt="Stretch, ready to go" />
      </div>

      <h1 className="mt-4 text-center font-display font-extrabold text-[1.85rem] leading-tight text-ink">
        {headline}
      </h1>
      <p className="mt-3 text-center leading-relaxed text-ink/70">
        {outcome ?? "With Pro, DeskBreak learns what works and puts the right movement breaks into your workday."}
      </p>

      {stats.total > 0 ? (
        <div className="mt-5 grid grid-cols-2 divide-x divide-line border-y border-line py-3">
          <div className="px-4 text-center">
            <p className="font-display font-extrabold text-[2rem] leading-none text-ink">{stats.total}</p>
            <p className="text-sm font-semibold text-muted">
              {stats.total === 1 ? "Reset" : "Resets"}
            </p>
          </div>
          <div className="px-4 text-center">
            <p className="font-display font-extrabold text-[2rem] leading-none text-ink">{stats.helped}</p>
            <p className="text-sm font-semibold text-muted">helped</p>
          </div>
        </div>
      ) : null}

      <section className="surface-elevated mt-5 px-4 py-4" aria-labelledby="plan-preview">
        <h2 id="plan-preview" className="font-display text-lg font-extrabold text-ink">
          Your workday with Pro
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          {formatMinutes(preview.preferences.startMinutes)} to {formatMinutes(preview.preferences.endMinutes)} ·{" "}
          {REMINDER_LEVELS[preview.preferences.level].label}. You set the hours.
        </p>
        <ul className="mt-3 grid gap-1.5">
          {preview.breaks.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 text-sm text-ink/75">
              <span className="w-[4.6rem] shrink-0 font-semibold tabular-nums text-ink">
                {formatMinutes(entry.startMinutes)}
              </span>
              <span className="min-w-0 truncate">
                {BREAK_TYPE_COPY[entry.type].label} · {entry.durationMin} min
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          A reminder when each one opens. Also in Pro: 5- and 10-minute workouts and the full routine and move
          library.
        </p>
      </section>

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-[16px] border border-line-strong bg-sheet p-1.5" role="radiogroup" aria-label="Billing period">
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
                active ? "bg-ink text-paper" : "text-ink hover:bg-paper",
              ].join(" ")}
            >
              {value === "annual" ? "Annual" : "Monthly"}
              {value === "annual" && PRICE_OPTIONS.annual.badge ? (
                <span className={`ml-1.5 text-xs font-semibold ${period === "annual" ? "text-note" : "text-pen"}`}>{PRICE_OPTIONS.annual.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {founding ? (
        <div className="sticky-note mt-5 px-4 py-3.5">
          <p className="font-display text-lg font-extrabold text-ink">Founding member</p>
          <p className="mt-0.5 text-sm leading-relaxed text-ink/80">
            {formatUsd(ANNUAL_PRICE_USD)}/year, kept for as long as you stay subscribed. {FOUNDING_TERMS}
          </p>
        </div>
      ) : null}

      <div className="mt-5 text-center">
        <p className="font-display font-extrabold text-[2.4rem] leading-none text-ink">
          {option.amountLabel}
          <span className="text-lg font-semibold text-muted">{option.cadenceLabel}</span>
        </p>
        <p className="mt-2 text-sm text-muted">
          {founding ? (
            <>
              <span className="font-semibold text-ink/70">Founding price</span> ·{" "}
            </>
          ) : null}
          {period === "annual" ? `About ${ANNUAL_PER_MONTH_LABEL.replace("about ", "")}` : option.supportLabel}
        </p>
      </div>

      {failed ? (
        <div className="mt-5 rounded-[16px] border border-pen bg-white px-4 py-4 text-center" role="alert">
          <p className="font-display font-extrabold text-base text-ink">{CHECKOUT_UNAVAILABLE.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{CHECKOUT_UNAVAILABLE.body}</p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-2.5">
        <Button onClick={startCheckout} disabled={submitting}>
          {submitting ? "Opening checkout..." : checkoutCta(period)}
        </Button>
        <p className="text-center text-xs text-muted">{CHECKOUT_TRUST_LINE}</p>
        <Button variant="tertiary" onClick={continueFree}>
          Continue free
        </Button>
      </div>
    </div>
  );
}

/** /app/pro for someone who already has Pro: what's included and billing, not a sales pitch. */
function ProActiveView() {
  const state = useAppState();
  const signedIn = Boolean(state.account.profileId);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function manage() {
    setBusy(true);
    const result = await openBillingPortal();
    if (result === "opened") return;
    setBusy(false);
    setNotice(
      result === "signed_out"
        ? "Sign in on You with your checkout email, then manage billing from there."
        : `We couldn't open billing just now. Email ${SUPPORT_EMAIL} and we'll sort it the same day.`,
    );
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] lg:px-10">
      <div className="flex justify-center">
        <CharacterArt pose="ready" size={110} alt="Stretch, ready to go" />
      </div>
      <h1 className="mt-4 text-center font-display font-extrabold text-[2rem] leading-tight text-ink">
        You&apos;re Pro
      </h1>
      <p className="mt-2 text-center text-sm text-muted">{renewalLine(state.entitlement)}</p>

      <section className="surface mt-6 px-4 py-4" aria-labelledby="included">
        <h2 id="included" className="text-sm font-semibold text-ink">
          What&apos;s included
        </h2>
        <ul className="mt-3 grid gap-2">
          {PRO_FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-2.5 text-sm font-semibold text-ink/80">
              <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-note text-[11px] font-bold text-ink">
                ✓
              </span>
              {feature}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6 grid gap-2.5">
        <ButtonLink href="/app/plan">{state.plan ? "Open your workday plan" : "Build my workday"}</ButtonLink>
        {signedIn ? (
          <Button variant="secondary" onClick={manage} disabled={busy}>
            {busy ? "Opening..." : "Manage subscription"}
          </Button>
        ) : (
          <p className="text-center text-sm leading-relaxed text-muted">
            To cancel, change your card or see invoices, sign in on You with the email you used at checkout.
          </p>
        )}
        {notice ? (
          <p className="text-center text-sm leading-relaxed text-ink/70" role="status">
            {notice}
          </p>
        ) : null}
        <ButtonLink href="/app" variant="tertiary">
          Back to Today
        </ButtonLink>
      </div>
    </div>
  );
}

