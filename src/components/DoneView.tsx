"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { InstallPrompt } from "@/components/InstallPrompt";
import { WeekSummary } from "@/components/WeekSummary";
import { describeAccountError, requestMagicLink } from "@/lib/account-client";
import { track } from "@/lib/analytics";
import {
  CHALLENGE_OFFER_AFTER_SESSIONS,
  FEEDBACK_OPTIONS,
  FEEDBACK_RESPONSES,
  TARGETED_OPTIONS,
} from "@/lib/constants";
import { isProEntitlement } from "@/lib/entitlements";
import {
  dismissSavePrompt,
  ensureAnonymousId,
  recordFeedback,
  saveEmail,
  setPrimaryNeed,
  shouldAskForFeedback,
} from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import type { PerceivedEffect, PrimaryNeed } from "@/lib/types";

type Stage = "feedback" | "focus" | "save" | "sent" | "wrap";

/** Helpful sessions before the paywall earns its first appearance. */
const PAYWALL_AFTER_HELPFUL = 3;

/**
 * The screen that decides whether someone ever comes back.
 *
 * One honest question. Then, only the first time, where desk work usually
 * lands. Then an offer to remember what worked. The paywall comes later, and
 * only once DeskBreak has something real to point at.
 */
export function DoneView() {
  const router = useRouter();
  const isClient = useIsClient();
  const state = useAppState();
  const session = state.progress.lastWorkout;
  const pro = isProEntitlement(state.entitlement);
  const signedIn = Boolean(state.account.profileId);

  const askFeedback = useMemo(
    () => isClient && shouldAskForFeedback() && !session?.perceivedEffect,
    [isClient, session?.perceivedEffect],
  );

  const [advanced, setAdvanced] = useState<Stage | null>(null);
  const [effect, setEffect] = useState<PerceivedEffect | null>(session?.perceivedEffect ?? null);
  const [email, setEmail] = useState(state.email ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  const askFocus = isClient && state.progress.totalWorkouts <= 1 && !state.primaryNeed;
  const askSave =
    isClient && !signedIn && !pro && !state.savePromptDismissedAt && state.progress.totalWorkouts <= 6;

  const afterFeedback: Stage = askFocus ? "focus" : askSave ? "save" : "wrap";
  const afterFocus: Stage = askSave ? "save" : "wrap";
  const stage: Stage = advanced ?? (askFeedback ? "feedback" : afterFeedback);

  useEffect(() => {
    if (stage === "save") track("email_prompt_viewed", { source: "done", kind: "save_progress" });
  }, [stage]);

  if (!isClient) return null;

  const minutesLabel = session ? `${session.durationMin} minute${session.durationMin === 1 ? "" : "s"}` : "Reset";

  function submitFeedback(value: PerceivedEffect) {
    setEffect(value);
    if (session) {
      recordFeedback(session.sessionId, value);
      track("session_feedback_submitted", {
        perceived_effect: value,
        program_id: session.programId,
        need: session.primaryNeed,
        recommendation_id: session.recommendationId ?? undefined,
        algorithm_version: session.algorithmVersion ?? undefined,
      });
      track("reset_feedback_submitted", { perceived_effect: value, program_id: session.programId });
      void fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.sessionId,
          programId: session.programId,
          anonymousId: ensureAnonymousId(),
          perceivedEffect: value,
        }),
      }).catch(() => {});
    }
    setAdvanced(afterFeedback);
  }

  function chooseFocus(need: PrimaryNeed | null) {
    if (need) setPrimaryNeed(need);
    track("need_selected", { need: need ?? "none", source: "done_focus" });
    setAdvanced(afterFocus);
  }

  async function submitSave(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      setEmailError("That doesn't look like an email address.");
      return;
    }
    setSubmitting(true);
    setEmailError(null);
    const result = await requestMagicLink(trimmed, { next: "/app?saved=1" });
    setSubmitting(false);
    if (!result.ok) {
      setEmailError(describeAccountError(result.error));
      return;
    }
    saveEmail(trimmed);
    track("email_submitted", { source: "done", kind: "save_progress" });
    if (result.devLink) setDevLink(result.devLink);
    setAdvanced("sent");
  }

  function skipSave() {
    dismissSavePrompt();
    track("email_skipped", { source: "done", kind: "save_progress" });
    setAdvanced("wrap");
  }

  function continueOn() {
    const helpful = state.progress.history.filter((entry) => entry.perceivedEffect === "better").length;
    const showPaywall =
      !pro &&
      helpful >= PAYWALL_AFTER_HELPFUL &&
      (!state.paywallSeen || state.progress.totalWorkouts % 5 === 0);
    if (showPaywall) {
      router.push(`/app/pro?from=done&need=${state.primaryNeed ?? "general"}`);
      return;
    }
    router.push("/app");
  }

  const offerChallenge =
    state.progress.totalWorkouts >= CHALLENGE_OFFER_AFTER_SESSIONS && !state.challenge.startedOn;

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex justify-center">
        <CharacterArt
          pose="done"
          setup={session?.setup === "standing" ? "standing" : "seated"}
          size={170}
          alt="Stretch, done and noticeably less folded"
        />
      </div>

      <h1 className="mt-4 text-center font-display text-[2rem] font-semibold leading-tight tracking-tight text-ink">
        Nice. {minutesLabel} done.
      </h1>

      {stage === "feedback" ? (
        <>
          <p className="mt-8 text-center font-display text-xl font-semibold text-ink">How do you feel?</p>
          <div className="mt-4 grid gap-2.5">
            {FEEDBACK_OPTIONS.map((option, index) => (
              <Button
                key={option.id}
                variant={index === 0 ? "primary" : "secondary"}
                onClick={() => submitFeedback(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </>
      ) : null}

      {stage === "focus" ? (
        <>
          {effect ? <p className="mt-3 text-center text-ink/70">{FEEDBACK_RESPONSES[effect]}</p> : null}
          <p className="mt-8 text-center font-display text-xl font-semibold text-ink">
            Where do you usually feel desk work the most?
          </p>
          <div className="mt-4 grid gap-2">
            {TARGETED_OPTIONS.map((option) => (
              <Button key={option.id} variant="secondary" onClick={() => chooseFocus(option.id)}>
                {option.label}
              </Button>
            ))}
            <Button variant="secondary" onClick={() => chooseFocus("general")}>
              Mostly just stiff
            </Button>
            <Button variant="tertiary" onClick={() => chooseFocus(null)}>
              No particular problem
            </Button>
          </div>
        </>
      ) : null}

      {stage === "save" ? (
        <>
          {effect ? <p className="mt-3 text-center text-ink/70">{FEEDBACK_RESPONSES[effect]}</p> : null}
          <form onSubmit={submitSave} className="mt-8">
            <h2 className="font-display text-xl font-semibold text-ink">
              Want DeskBreak to remember what works for you?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">
              We&apos;ll email you a sign-in link. No password, and your history so far comes with you.
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
              className="mt-4 min-h-13 w-full rounded-[16px] border border-ink/12 bg-white px-4 text-base text-ink outline-none focus-visible:border-coral"
            />
            {emailError ? (
              <p className="mt-2 text-sm font-semibold text-coral" role="alert">
                {emailError}
              </p>
            ) : null}
            <div className="mt-4 grid gap-2.5">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Sending..." : "Save my progress"}
              </Button>
              <Button variant="tertiary" onClick={skipSave}>
                Not now
              </Button>
            </div>
          </form>
        </>
      ) : null}

      {stage === "sent" ? (
        <>
          <h2 className="mt-8 text-center font-display text-xl font-semibold text-ink">Check your inbox.</h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-ink/60">
            We sent a sign-in link to {email.trim()}. Open it on any device and your resets follow you.
          </p>
          {devLink ? (
            <p className="mt-3 text-center text-xs text-ink/50">
              Email isn&apos;t configured here, so here is the link:{" "}
              <a href={devLink} className="font-semibold text-coral">
                sign in
              </a>
            </p>
          ) : null}
          <div className="mt-6">
            <Button onClick={() => setAdvanced("wrap")}>Continue</Button>
          </div>
        </>
      ) : null}

      {stage === "wrap" ? (
        <>
          {effect ? (
            <p className="mt-3 text-center text-[1.05rem] text-ink/70">{FEEDBACK_RESPONSES[effect]}</p>
          ) : null}

          <div className="surface mt-7 px-4 py-4">
            <WeekSummary />
          </div>

          {offerChallenge ? (
            <Link href="/app/challenge" className="surface mt-3 block px-4 py-4 transition-colors hover:bg-ink/3">
              <p className="font-display text-base font-semibold text-ink">Try the 5-Day Desk Reset</p>
              <p className="mt-1 text-sm leading-relaxed text-ink/60">
                See how a workweek of moving more feels.
              </p>
            </Link>
          ) : null}

          <div className="mt-3">
            <InstallPrompt />
          </div>

          <div className="mt-auto pt-6">
            <Button onClick={continueOn}>Back to Today</Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
