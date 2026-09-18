"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { InstallPrompt } from "@/components/InstallPrompt";
import { ReminderAsk } from "@/components/ReminderAsk";
import { WeekSummary } from "@/components/WeekSummary";
import { describeAccountError, requestMagicLink } from "@/lib/account-client";
import { track } from "@/lib/analytics";
import { BODY_AREA_LABELS, BODY_AREAS } from "@/lib/body-areas";
import { playCelebrationTune } from "@/lib/celebration-tune";
import {
  CHALLENGE_OFFER_AFTER_SESSIONS,
  FEEDBACK_OPTIONS,
  FEEDBACK_RESPONSES,
  TARGETED_OPTIONS,
  WORSE_AREA_PROMPT,
  WORSE_REPEAT_CLINICIAN_LINE,
} from "@/lib/constants";
import { getExercise } from "@/lib/content";
import { isProEntitlement } from "@/lib/entitlements";
import {
  activeSecondsFor,
  formatActiveTime,
  patternsReady,
  ratedSessions,
  ratingsUntilPatterns,
  sessionMovedLabel,
} from "@/lib/insights";
import { areaAvoidanceNotice } from "@/lib/recommendation";
import {
  dismissSavePrompt,
  ensureAnonymousId,
  getAppState,
  markPaywallSeen,
  personalizationSignals,
  recordFeedback,
  recordWorseAreas,
  saveEmail,
  setPrimaryNeed,
  shouldAskForFeedback,
} from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import type { BodyArea, PerceivedEffect, PrimaryNeed, WorkoutSession } from "@/lib/types";

type Stage = "feedback" | "worse" | "focus" | "save" | "sent" | "wrap";

/** Left to right: Worse, Same, Better, all styled alike so none is suggested. */
const RATING_ORDER: PerceivedEffect[] = ["worse", "same", "better"];
const RATING_GLYPHS: Record<PerceivedEffect, string> = { worse: "↓", same: "=", better: "↑" };

/** Areas worth asking about: not breathing, eyes or "posture". */
const ASKABLE_AREAS = BODY_AREAS.filter((area) => !["breathing", "eyes", "posture"].includes(area));

/** A just-finished reset plays its tune once; a revisit to Done does not. */
const TUNE_WINDOW_MS = 2 * 60 * 1000;

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
  const [worseAreas, setWorseAreas] = useState<BodyArea[]>([]);
  const [clinician, setClinician] = useState(false);
  const tunePlayed = useRef(false);

  const askFocus = isClient && state.progress.totalWorkouts <= 1 && !state.primaryNeed;
  const askSave =
    isClient && !signedIn && !pro && !state.savePromptDismissedAt && state.progress.totalWorkouts <= 6;

  const afterFeedback: Stage = askFocus ? "focus" : askSave ? "save" : "wrap";
  const afterFocus: Stage = askSave ? "save" : "wrap";
  const stage: Stage = advanced ?? (askFeedback ? "feedback" : afterFeedback);

  useEffect(() => {
    if (stage === "save") track("email_prompt_viewed", { source: "done", kind: "save_progress" });
  }, [stage]);

  // No question to answer (already rated, or not asked): the reset is its own reward.
  useEffect(() => {
    if (!isClient || askFeedback || !session || session.perceivedEffect === "worse") return;
    playTuneOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, askFeedback, session?.sessionId]);

  if (!isClient) return null;

  function playTuneOnce() {
    if (tunePlayed.current || !session || !state.settings.soundEnabled) return;
    if (Date.now() - new Date(session.finishedAt).getTime() > TUNE_WINDOW_MS) return;
    tunePlayed.current = true;
    playCelebrationTune(session.finishedAt);
  }

  function submitFeedback(value: PerceivedEffect) {
    setEffect(value);
    // Never celebrate a reset that made someone feel worse.
    if (value !== "worse") playTuneOnce();
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
    setAdvanced(value === "worse" ? "worse" : afterFeedback);
  }

  function submitWorseAreas(areas: BodyArea[]) {
    if (session && areas.length) {
      recordWorseAreas(session.sessionId, areas);
      track("session_feedback_submitted", {
        perceived_effect: "worse",
        worse_areas: areas.join(","),
        program_id: session.programId,
        stage: "areas",
      });
      // Repeats in a week leave the area out; say so, and when to see someone.
      const notice = areaAvoidanceNotice(personalizationSignals(getAppState()));
      setClinician(Boolean(notice?.suggestClinician && notice.areas.some((area) => areas.includes(area))));
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

  const worse = effect === "worse";
  const helpful = state.progress.history.filter((entry) => entry.perceivedEffect === "better").length;
  // Said out loud, on this screen, instead of hiding behind "Back to Today".
  const offerPro =
    !pro &&
    !worse &&
    helpful >= PAYWALL_AFTER_HELPFUL &&
    (!state.paywallSeen || state.progress.totalWorkouts % 5 === 0);
  const offerChallenge =
    !worse &&
    !offerPro &&
    state.progress.totalWorkouts >= CHALLENGE_OFFER_AFTER_SESSIONS &&
    !state.challenge.startedOn;

  const activeSec = session ? activeSecondsFor(session) : 0;
  const heading = !session
    ? "Reset done."
    : worse
      ? `Done. ${capitalize(sessionMovedLabel(session))}.`
      : activeSec < 60
        ? "Short one. Still counts."
        : `Nice. ${capitalize(sessionMovedLabel(session))}.`;

  const rated = ratedSessions(state.progress.history);
  const patternLine = patternsReady(state.progress.history)
    ? `Resets have helped you ${helpful} of ${rated.length} times.`
    : rated.length
      ? `${ratingsUntilPatterns(state.progress.history)} more rated resets to see your patterns.`
      : null;

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex justify-center">
        <CharacterArt
          pose={worse ? "idle" : "done"}
          setup={session?.setup === "standing" ? "standing" : "seated"}
          size={170}
          alt={worse ? "Stretch" : "Stretch, done and noticeably less folded"}
        />
      </div>

      <h1 className="mt-4 text-center font-display text-[2rem] font-semibold leading-tight tracking-tight text-ink">
        {heading}
      </h1>
      {session && !worse && activeSec < 60 ? (
        <p className="mt-1 text-center text-sm text-ink/65">{capitalize(sessionMovedLabel(session))}.</p>
      ) : null}

      {stage === "feedback" ? (
        <>
          <p className="mt-8 text-center font-display text-xl font-semibold text-ink">How do you feel?</p>
          <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="How do you feel?">
            {RATING_ORDER.map((id) => {
              const option = FEEDBACK_OPTIONS.find((entry) => entry.id === id);
              if (!option) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => submitFeedback(id)}
                  className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[16px] border border-ink/12 bg-white px-2 py-2 text-center font-semibold leading-tight text-ink transition-colors hover:bg-ink/4 active:bg-ink/8"
                >
                  <span aria-hidden className="text-lg leading-none text-ink/60">
                    {RATING_GLYPHS[id]}
                  </span>
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-sm text-ink/60">Your answer tunes the next reset.</p>
        </>
      ) : null}

      {stage === "worse" ? (
        <WorseFollowUp
          session={session}
          selected={worseAreas}
          onToggle={(area) =>
            setWorseAreas((current) =>
              current.includes(area) ? current.filter((entry) => entry !== area) : [...current, area],
            )
          }
          onDone={() => submitWorseAreas(worseAreas)}
        />
      ) : null}

      {stage === "focus" ? (
        <>
          {effect && !worse ? <p className="mt-3 text-center text-ink/70">{FEEDBACK_RESPONSES[effect]}</p> : null}
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
          {effect && !worse ? <p className="mt-3 text-center text-ink/70">{FEEDBACK_RESPONSES[effect]}</p> : null}
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
          <p className="mt-2 text-center text-sm font-semibold leading-relaxed text-ink">
            Open the link on this device to keep today&apos;s reset.
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
          {worse ? (
            <p className="mt-3 text-center text-[1.05rem] text-ink/75">
              {clinician
                ? WORSE_REPEAT_CLINICIAN_LINE
                : worseAreas.length
                  ? "Thanks. That shapes what we pick next time."
                  : "Thanks for saying so. We'll go easier next time."}
            </p>
          ) : effect ? (
            <p className="mt-3 text-center text-[1.05rem] text-ink/70">{FEEDBACK_RESPONSES[effect]}</p>
          ) : null}

          <div className="mt-7 grid gap-3">
            {offerPro ? (
              <div className="surface px-4 py-4">
                <p className="font-display text-base font-semibold text-ink">
                  {helpful} resets helped. Want DeskBreak to plan them for you?
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink/65">
                  Pro fits breaks around your workday and reminds you when each one is due.
                </p>
                <div className="mt-3">
                  <Button
                    size="sm"
                    block={false}
                    onClick={() => router.push(`/app/pro?from=done&need=${state.primaryNeed ?? "general"}`)}
                  >
                    See your workday plan
                  </Button>
                </div>
              </div>
            ) : null}

            {!worse ? <ReminderAsk /> : null}

            <div className="surface px-4 py-4">
              <WeekSummary />
              {patternLine ? <p className="mt-3 text-sm text-ink/65">{patternLine}</p> : null}
            </div>

            {session?.exercises?.length ? <MovesDone session={session} /> : null}

            {offerChallenge ? (
              <Link href="/app/challenge" className="surface block px-4 py-4 transition-colors hover:bg-ink/3">
                <p className="font-display text-base font-semibold text-ink">Try the 5-Day Desk Reset</p>
                <p className="mt-1 text-sm leading-relaxed text-ink/60">
                  See how a workweek of moving more feels.
                </p>
              </Link>
            ) : null}

            <InstallPrompt />
          </div>

          <div className="mt-auto pt-6">
            <Button
              variant={offerPro ? "secondary" : "primary"}
              onClick={() => {
                // Seen and passed on: it comes back only every fifth reset.
                if (offerPro) markPaywallSeen();
                router.push("/app");
              }}
            >
              Back to Today
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function WorseFollowUp({
  session,
  selected,
  onToggle,
  onDone,
}: {
  session: WorkoutSession | null;
  selected: BodyArea[];
  onToggle: (area: BodyArea) => void;
  onDone: () => void;
}) {
  // The areas this reset worked, first; everything else after.
  const worked = new Set(
    (session?.exercises ?? [])
      .map((record) => getExercise(record.swappedToExerciseId ?? record.exerciseId)?.bodyArea)
      .filter((area): area is BodyArea => Boolean(area)),
  );
  const areas = [
    ...ASKABLE_AREAS.filter((area) => worked.has(area)),
    ...ASKABLE_AREAS.filter((area) => !worked.has(area)),
  ];
  return (
    <>
      <p className="mt-3 text-center text-ink/70">{FEEDBACK_RESPONSES.worse}</p>
      <fieldset className="mt-7">
        <legend className="w-full text-center font-display text-xl font-semibold text-ink">{WORSE_AREA_PROMPT}</legend>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {areas.map((area) => {
            const active = selected.includes(area);
            return (
              <button
                key={area}
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(area)}
                className={[
                  "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors",
                  active ? "border-ink bg-ink text-paper" : "border-ink/15 bg-white text-ink hover:bg-ink/4",
                ].join(" ")}
              >
                {BODY_AREA_LABELS[area]}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-6 grid gap-2.5">
        <Button onClick={onDone} disabled={!selected.length}>
          Done
        </Button>
        <Button variant="tertiary" onClick={onDone}>
          Not sure
        </Button>
      </div>
    </>
  );
}

/** What was actually done, behind a disclosure so it never crowds the screen. */
function MovesDone({ session }: { session: WorkoutSession }) {
  const records = session.exercises ?? [];
  return (
    <details className="surface px-4 py-3">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-ink">
        Moves in this reset ({records.length})
      </summary>
      <ul className="grid gap-1.5 pb-2 text-sm text-ink/75">
        {records.map((record) => {
          const done = getExercise(record.swappedToExerciseId ?? record.exerciseId);
          const status = record.skipped
            ? "skipped"
            : record.completed
              ? record.actualSec
                ? formatActiveTime(record.actualSec)
                : "done"
              : record.actualSec
                ? formatActiveTime(record.actualSec)
                : "not reached";
          return (
            <li key={`${record.exerciseId}-${record.sequence}`} className="flex justify-between gap-3">
              <span>{done?.name ?? record.exerciseId}</span>
              <span className="shrink-0 text-ink/60">{status}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
