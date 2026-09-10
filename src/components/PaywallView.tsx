"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { LogoMark } from "@/components/LogoMark";
import { ProBadge } from "@/components/ProBadge";
import { ErrorState } from "@/components/StatusStates";
import {
  ANNUAL_DISCOUNT_PERCENT,
  ANNUAL_LIST_PRICE_USD,
  ANNUAL_PER_MONTH,
  ANNUAL_PRICE_USD,
} from "@/lib/constants";
import { getExercises, getFreeExercises } from "@/lib/content";
import { canDemoUnlock, isProEntitlement, stripePriceConfigured } from "@/lib/entitlements";
import { markPaywallSeen, unlockPro } from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";

export function PaywallView() {
  const router = useRouter();
  const state = useAppState();
  const alreadyPro = isProEntitlement(state.entitlement);
  const demo = canDemoUnlock();
  const stripeReady = stripePriceConfigured();
  const freeMoveCount = getFreeExercises().length;
  const libraryCount = getExercises().length;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = (await res.json()) as { url?: string; message?: string };
      if (!res.ok || !data.url) {
        setError(
          data.message ??
            "Stripe Checkout isn’t configured yet. Add keys or use the demo unlock in development.",
        );
        setBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Couldn’t reach Checkout. Try again, or use demo unlock if you’re local.");
      setBusy(false);
    }
  }

  function continueFree() {
    markPaywallSeen();
    router.replace("/");
  }

  function demoUnlock() {
    unlockPro("demo");
    router.replace("/");
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoMark size={32} />
          <span className="font-display text-lg font-semibold text-ink">DeskBreak</span>
        </div>
        <button
          type="button"
          onClick={continueFree}
          className="min-h-11 text-sm font-semibold text-ink/45"
        >
          Not now
        </button>
      </header>

      <main className="flex-1 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">
          After your reset
        </p>
        <div className="mt-3 flex justify-center">
          <CharacterArt pose="locked" size={140} alt="Stretch — Pro locked" />
        </div>
        <p className="mt-2 text-center text-xs font-semibold text-ink/45">
          Pro’s there when the day gets longer.
        </p>
        <h1 className="mt-3 font-display text-[2.1rem] font-semibold leading-[1.1] text-ink">
          Keep the momentum.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink/65">
          You felt a 2-minute reset. Pro fits the rest of the day.
        </p>

        {alreadyPro ? (
          <div className="mt-6 rounded-[24px] bg-mint/20 p-4">
            <ProBadge />
            <p className="mt-2 text-sm font-semibold text-ink">You’re on Pro.</p>
            <ButtonLink href="/" className="mt-4">
              Back home
            </ButtonLink>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            <PlanCard
              name="Free"
              price="Forever"
              items={[
                "Onboarding + Home",
                "2 min Desk Reset, seated or standing",
                `${freeMoveCount} moves in the library`,
                "Basic streak",
              ]}
            />
            <PlanCard
              featured
              name="Pro"
              price={`$${ANNUAL_PRICE_USD}/year`}
              compare={`$${ANNUAL_LIST_PRICE_USD}/year`}
              note={`${ANNUAL_DISCOUNT_PERCENT}% off. Less than $${ANNUAL_PER_MONTH}/month, billed annually.`}
              items={[
                "5 min Lunch Reset",
                "10 min Busy-Day Circuit",
                `Full ${libraryCount}-move library`,
                "Custom reminder time",
                "XP + celebration themes",
                "Pro badge",
              ]}
            />
          </div>
        )}

        {error ? (
          <div className="mt-4">
            <ErrorState title="Checkout unavailable" body={error} />
          </div>
        ) : null}

        {!stripeReady && !alreadyPro ? (
          <p className="mt-4 text-center text-xs leading-relaxed text-ink/45">
            Live billing needs <code className="font-semibold">STRIPE_SECRET_KEY</code> and{" "}
            <code className="font-semibold">NEXT_PUBLIC_STRIPE_PRICE_ID</code>. No charges
            are simulated.
          </p>
        ) : null}
      </main>

      {!alreadyPro && (
        <div className="flex flex-col gap-3">
          {!stripeReady && demo ? (
            <>
              <Button variant="mint" onClick={demoUnlock}>
                Unlock Pro for demo
              </Button>
              <Button variant="ghost" disabled>
                Unlock Pro — ${ANNUAL_PRICE_USD}/yr
              </Button>
              <p className="text-center text-xs leading-relaxed text-ink/45">
                Stripe isn’t configured on this build, so Subscribe would 501.
                Demo unlock is for local/morning use — no charges.
              </p>
            </>
          ) : (
            <>
              <Button onClick={subscribe} disabled={busy || !stripeReady}>
                {busy ? "Opening Checkout…" : `Unlock Pro — $${ANNUAL_PRICE_USD}/yr`}
              </Button>
              {demo ? (
                <Button variant="mint" onClick={demoUnlock}>
                  Unlock Pro for demo
                </Button>
              ) : null}
              {!stripeReady ? (
                <p className="text-center text-xs leading-relaxed text-ink/45">
                  Stripe isn’t configured, so Subscribe is unavailable. No charges
                  are simulated.
                </p>
              ) : null}
            </>
          )}
          <Button variant="ghost" onClick={continueFree}>
            Continue with Free
          </Button>
        </div>
      )}
    </div>
  );
}

function PlanCard({
  name,
  price,
  items,
  featured,
  compare,
  note,
}: {
  name: string;
  price: string;
  items: string[];
  featured?: boolean;
  compare?: string;
  note?: string;
}) {
  return (
    <section
      className={[
        "rounded-[24px] p-4",
        featured
          ? "bg-ink text-paper shadow-[0_6px_0_#0C0A09]"
          : "bg-white text-ink shadow-[0_4px_0_rgba(28,25,23,0.06)]",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-semibold">{name}</h2>
        {featured ? <ProBadge /> : null}
      </div>
      <p className="mt-1 text-sm font-semibold">
        {compare ? (
          <span className={`mr-2 ${featured ? "text-paper/40" : "text-ink/35"} line-through`}>
            {compare}
          </span>
        ) : null}
        {price}
      </p>
      {note ? (
        <p className={`mt-1 text-xs ${featured ? "text-paper/70" : "text-ink/55"}`}>{note}</p>
      ) : null}
      <ul className={`mt-3 space-y-1 text-sm ${featured ? "text-paper/80" : "text-ink/65"}`}>
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </section>
  );
}
