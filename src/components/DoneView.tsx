"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { InstallPrompt } from "@/components/InstallPrompt";
import { track } from "@/lib/analytics";
import { FEEDBACK_RESPONSES } from "@/lib/constants";
import { getDurationBenefit } from "@/lib/content";
import { isProEntitlement } from "@/lib/entitlements";
import {
  dismissEmailPrompt,
  ensureAnonymousId,
  recordFeedback,
  saveEmail,
  shouldAskForFeedback,
} from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import type { PerceivedEffect } from "@/lib/types";

type Stage = "feedback" | "email" | "wrap";

/**
 * The screen that decides whether someone ever comes back.
 *
 * It asks one honest question, answers it honestly, then asks for an email. The
 * paywall comes after, and only when there is something real to sell against.
 */
export function DoneView() {
  const router = useRouter();
  const isClient = useIsClient();
  const state = useAppState();
  const session = state.progress.lastWorkout;
  const pro = isProEntitlement(state.entitlement);

  const askFeedback = useMemo(
    () => isClient && shouldAskForFeedback() && !session?.perceivedEffect,
    [isClient, session?.perceivedEffect],
  );

  const [advanced, setAdvanced] = useState<Stage | null>(null);
  const [effect, setEffect] = useState<PerceivedEffect | null>(null);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Derived, not stored: the natural stage falls out of what we already know,
  // and `advanced` only records the steps the user has actually completed.
  const nextAfterFeedback: Stage = state.email || pro ? "wrap" : "email";
  const stage: Stage = advanced ?? (askFeedback ? "feedback" : nextAfterFeedback);

  useEffect(() => {
    if (stage === "email") track("email_prompt_viewed", { source: "done" });
  }, [stage]);

  if (!isClient) return null;

  const benefit = session ? getDurationBenefit(session.durationMin) : undefined;
  const minutesLabel = session ? `${session.durationMin} minutes` : "Two minutes";

  function submitFeedback(value: PerceivedEffect) {
    setEffect(value);
    if (session) {
      recordFeedback(session.sessionId, value);
      track("reset_feedback_submitted", {
        perceived_effect: value,
        program_id: session.programId,
        need: session.primaryNeed,
      });
      void fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.sessionId,
          programId: session.programId,
          perceivedEffect: value,
        }),
      }).catch(() => {});
    }
    setAdvanced(nextAfterFeedback);
  }

  async function submitEmail(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      setEmailError("That doesn't look like an email address.");
      return;
    }
    setSubmitting(true);
    setEmailError(null);
    try {
      const response = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          anonymousId: ensureAnonymousId(),
          primaryNeed: state.primaryNeed,
          preferredSetup: state.preferredSetup,
          attribution: {
            source: state.attribution.firstUtmSource,
            medium: state.attribution.firstUtmMedium,
            campaign: state.attribution.firstUtmCampaign,
            content: state.attribution.firstUtmContent,
            landingPath: state.attribution.firstLandingPath,
          },
        }),
      });
      if (!response.ok) throw new Error("email_failed");
      saveEmail(trimmed);
      track("email_submitted", { source: "done", need: state.primaryNeed });
      setAdvanced("wrap");
    } catch {
      setEmailError("We couldn't save that just now. You can add it in Settings.");
    } finally {
      setSubmitting(false);
    }
  }

  function skipEmail() {
    dismissEmailPrompt();
    track("email_skipped", { source: "done" });
    setAdvanced("wrap");
  }

  function continueOn() {
    // Free users see the offer once the reset has actually proved something.
    if (!pro) {
      router.push(`/app/pro?from=done&need=${state.primaryNeed ?? "general"}`);
      return;
    }
    router.push("/app");
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex justify-center">
        <CharacterArt
          pose="done"
          setup={session?.setup}
          size={190}
          alt="Stretch, done and noticeably less folded"
        />
      </div>

      <h1 className="mt-4 text-center font-display text-[2rem] font-semibold leading-tight tracking-tight text-ink">
        Nice. {minutesLabel} done.
      </h1>

      {stage === "feedback" && askFeedback ? (
        <>
          <p className="mt-2 text-center text-ink/60">
            Before you disappear back into your laptop...
          </p>
          <p className="mt-8 text-center font-display text-xl font-semibold text-ink">
            Did that help?
          </p>
          <div className="mt-4 grid gap-3">
            <Button onClick={() => submitFeedback("better")}>Yep, I feel better</Button>
            <Button variant="ghost" onClick={() => submitFeedback("somewhat")}>
              A little
            </Button>
            <Button variant="ghost" onClick={() => submitFeedback("not_better")}>
              Not really
            </Button>
          </div>
        </>
      ) : null}

      {stage === "email" ? (
        <>
          {effect ? (
            <p className="mt-3 text-center text-[1.05rem] text-ink/70">
              {FEEDBACK_RESPONSES[effect]}
            </p>
          ) : null}
          <form onSubmit={submitEmail} className="mt-8">
            <h2 className="font-display text-xl font-semibold text-ink">
              Want tomorrow&apos;s DeskBreak?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">
              We&apos;ll send one tiny reminder. No productivity newsletter avalanche.
            </p>
            <label htmlFor="done-email" className="sr-only">
              Your email address
            </label>
            <input
              id="done-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@work.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-4 min-h-14 w-full rounded-[22px] border-2 border-ink/12 bg-white px-5 text-base text-ink outline-none focus-visible:border-coral"
            />
            {emailError ? (
              <p className="mt-2 text-sm font-semibold text-coral" role="alert">
                {emailError}
              </p>
            ) : null}
            <div className="mt-4 grid gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Sending..." : "Send it to me"}
              </Button>
              <Button variant="ghost" onClick={skipEmail}>
                Not now
              </Button>
            </div>
          </form>
        </>
      ) : null}

      {stage === "wrap" ? (
        <>
          {effect ? (
            <p className="mt-3 text-center text-[1.05rem] text-ink/70">
              {FEEDBACK_RESPONSES[effect]}
            </p>
          ) : benefit ? (
            <p className="mt-3 text-center text-[1.05rem] text-ink/70">
              {benefit.doneLine}
            </p>
          ) : null}

          <dl className="mt-8 grid grid-cols-2 gap-3">
            <div className="rounded-[22px] bg-white px-4 py-5 text-center shadow-[0_4px_0_rgba(28,25,23,0.06)]">
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">
                Streak
              </dt>
              <dd className="mt-1 font-display text-2xl font-semibold text-ink">
                {state.progress.streak}{" "}
                <span className="text-base text-ink/50">
                  day{state.progress.streak === 1 ? "" : "s"}
                </span>
              </dd>
            </div>
            <div className="rounded-[22px] bg-white px-4 py-5 text-center shadow-[0_4px_0_rgba(28,25,23,0.06)]">
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">
                DeskBreaks
              </dt>
              <dd className="mt-1 font-display text-2xl font-semibold text-ink">
                {state.progress.totalWorkouts}
              </dd>
            </div>
          </dl>

          <div className="mt-6">
            <InstallPrompt />
          </div>

          <div className="mt-auto pt-8">
            <Button onClick={continueOn}>
              {pro ? "Back to DeskBreak" : "Keep going"}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
