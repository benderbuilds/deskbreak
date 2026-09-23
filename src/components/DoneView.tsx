"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { InstallPrompt } from "@/components/InstallPrompt";
import { ReminderAsk } from "@/components/ReminderAsk";
import { WeekSummary } from "@/components/WeekSummary";
import { track } from "@/lib/analytics";
import { BODY_AREA_LABELS, BODY_AREAS } from "@/lib/body-areas";
import { playCelebrationTune } from "@/lib/celebration-tune";
import {
  CHALLENGE_OFFER_AFTER_SESSIONS,
  FEEDBACK_OPTIONS,
  NEED_BY_ID,
  FEEDBACK_RESPONSES,
  PAINFUL_RESPONSE,
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
import { markOnce } from "@/lib/once";
import { areaAvoidanceNotice } from "@/lib/recommendation";
import {
  dismissSavePrompt,
  ensureAnonymousId,
  getAppState,
  markPaywallSeen,
  personalizationSignals,
  recordFeedback,
  recordWorseAreas,
  setPrimaryNeed,
  shouldAskForFeedback,
} from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import type { BodyArea, PerceivedEffect, PrimaryNeed, WorkoutSession } from "@/lib/types";

type Stage = "feedback" | "worse" | "wrap";

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
 * One honest question, then the invitation to come back, and nothing standing
 * between the two. Personalizing the next reset and saving progress are both
 * offered here, but as options on the summary rather than steps that have to
 * be cleared: someone who just finished their first three minutes has already
 * done the thing we wanted them to do.
 *
 * The paywall comes later, and only once DeskBreak has something real to
 * point at.
 */
export function DoneView() {
  const router = useRouter();
  const isClient = useIsClient();
  const state = useAppState();
  const session = state.progress.lastWorkout;
  const pro = isProEntitlement(state.entitlement);
  const signedIn = Boolean(state.account.profileId);

  // "Painful" during the reset: no celebration, and the advice is repeated
  // here in case the reset ended before it could be read.
  const hurt = Boolean(session?.exercises?.some((record) => record.discomfortReason === "painful"));

  const askFeedback = useMemo(
    () => isClient && shouldAskForFeedback() && !session?.perceivedEffect,
    [isClient, session?.perceivedEffect],
  );

  const [advanced, setAdvanced] = useState<Stage | null>(null);
  const [effect, setEffect] = useState<PerceivedEffect | null>(session?.perceivedEffect ?? null);
  const [personalizing, setPersonalizing] = useState(false);
  const [saveDismissed, setSaveDismissed] = useState(false);
  const [worseAreas, setWorseAreas] = useState<BodyArea[]>([]);
  const [clinician, setClinician] = useState(false);
  const tunePlayed = useRef(false);

  const worse = effect === "worse";
  // Worse, or painful along the way: no celebration, and nothing is asked of
  // them. Someone the reset left feeling worse is not a conversion step.
  const quiet = worse || hurt;

  // Offered on the summary, never in the way of it.
  const offerSave =
    isClient &&
    !quiet &&
    !signedIn &&
    !pro &&
    !state.savePromptDismissedAt &&
    state.progress.totalWorkouts <= 6;

  const stage: Stage = advanced ?? (askFeedback ? "feedback" : "wrap");

  useEffect(() => {
    if (stage !== "wrap" || !offerSave) return;
    // Revisiting Done shows the offer again; the funnel counts it once.
    if (!markOnce(`email_prompt:${session?.sessionId ?? "none"}`)) return;
    track("email_prompt_viewed", { source: "done", kind: "save_progress" });
  }, [stage, offerSave, session?.sessionId]);

  // No question to answer (already rated, or not asked): the reset is its own reward.
  useEffect(() => {
    if (!isClient || askFeedback || !session || hurt || session.perceivedEffect === "worse") return;
    playTuneOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, askFeedback, hurt, session?.sessionId]);

  if (!isClient) return null;

  function playTuneOnce() {
    if (tunePlayed.current || !session || !state.settings.soundEnabled) return;
    if (Date.now() - new Date(session.finishedAt).getTime() > TUNE_WINDOW_MS) return;
    tunePlayed.current = true;
    // A refresh within the window is the same finish, not a second one.
    if (!markOnce(`tune:${session.sessionId}`)) return;
    playCelebrationTune(session.finishedAt);
  }

  function submitFeedback(value: PerceivedEffect) {
    setEffect(value);
    // Never celebrate a reset that hurt or made someone feel worse.
    if (value !== "worse" && !hurt) playTuneOnce();
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
    setAdvanced(value === "worse" ? "worse" : "wrap");
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
    setAdvanced("wrap");
  }

  function chooseFocus(need: PrimaryNeed) {
    setPrimaryNeed(need);
    track("need_selected", { need, source: "done_focus" });
    setPersonalizing(false);
  }

  function skipSave() {
    setSaveDismissed(true);
    dismissSavePrompt();
    track("email_skipped", { source: "done", kind: "save_progress" });
  }

  const helpful = state.progress.history.filter((entry) => entry.perceivedEffect === "better").length;
  // Said out loud, on this screen, instead of hiding behind "Back to Today".
  const offerPro =
    !pro &&
    !quiet &&
    helpful >= PAYWALL_AFTER_HELPFUL &&
    (!state.paywallSeen || state.progress.totalWorkouts % 5 === 0);
  const offerChallenge =
    !quiet &&
    !offerPro &&
    state.progress.totalWorkouts >= CHALLENGE_OFFER_AFTER_SESSIONS &&
    !state.challenge.startedOn;

  const activeSec = session ? activeSecondsFor(session) : 0;
  const heading = !session
    ? "Reset done."
    : quiet
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
      {/* A good finish is written on a sticky note. Worse or painful stays plain paper. */}
      <div className={quiet ? "" : "sticky-note mx-auto w-full max-w-[30rem] -rotate-1 px-5 pb-6 pt-5"}>
        <div className="flex justify-center">
          <CharacterArt
            pose={quiet ? "idle" : "done"}
            setup={session?.setup === "standing" ? "standing" : "seated"}
            size={170}
            alt={quiet ? "Stretch" : "Stretch, done and noticeably less folded"}
          />
        </div>

        <h1 className="mt-4 text-center font-display font-extrabold text-[2rem] leading-tight text-ink">
          {heading}
        </h1>
        {session && !quiet && activeSec < 60 ? (
          <p className="mt-1 text-center text-sm text-ink/80">{capitalize(sessionMovedLabel(session))}.</p>
        ) : null}
        {hurt ? (
          <p className="mt-4 rounded-[12px] border-l-4 border-signal bg-ink/5 px-4 py-3 text-sm leading-relaxed text-ink" role="status">
            {PAINFUL_RESPONSE}
          </p>
        ) : null}

        {stage === "feedback" ? (
          <>
            <p className="mt-8 text-center font-display font-extrabold text-xl text-ink">How do you feel?</p>
            <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="How do you feel?">
              {RATING_ORDER.map((id) => {
                const option = FEEDBACK_OPTIONS.find((entry) => entry.id === id);
                if (!option) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => submitFeedback(id)}
                    className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[14px] border border-ink/60 bg-white px-2 py-2 text-center font-semibold leading-tight text-ink transition-colors hover:bg-paper active:bg-paper"
                  >
                    <span aria-hidden className="text-lg leading-none text-ink/75">
                      {RATING_GLYPHS[id]}
                    </span>
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
            <p className={`mt-3 text-center text-sm ${quiet ? "text-muted" : "text-ink/80"}`}>Your answer tunes the next reset.</p>
          </>
        ) : null}
      </div>

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

      {stage === "wrap" ? (
        <>
          {worse ? (
            // The clinician line is advice, not a thank-you: it gets the signal edge.
            <p
              className={
                clinician
                  ? "mt-3 rounded-[12px] border-l-4 border-signal bg-ink/5 px-4 py-3 text-[1.05rem] leading-relaxed text-ink"
                  : "mt-3 text-center text-[1.05rem] text-ink/75"
              }
            >
              {clinician
                ? WORSE_REPEAT_CLINICIAN_LINE
                : worseAreas.length
                  ? "Thanks. That shapes what we pick next time."
                  : "Thanks for saying so. We'll go easier next time."}
            </p>
          ) : effect ? (
            <p className="mt-3 text-center text-[1.05rem] text-ink/70">{FEEDBACK_RESPONSES[effect]}</p>
          ) : null}

          <div className="mt-7 grid gap-5">
            {offerPro ? (
              <div className="surface px-4 py-4">
                <p className="font-display font-extrabold text-base text-ink">
                  {helpful} resets helped. Want DeskBreak to plan them for you?
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
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

            {!quiet ? <ReminderAsk /> : null}

            {/* Both optional, both on the summary, neither in the way of it. */}
            {!quiet ? (
              <div className="grid gap-3 border-t border-line pt-4">
                <div>
                  <Button
                    variant="tertiary"
                    block={false}
                    className="px-0"
                    onClick={() => setPersonalizing((open) => !open)}
                    aria-expanded={personalizing}
                    aria-controls="done-personalize"
                  >
                    Personalize my next reset
                  </Button>
                  {personalizing ? (
                    <div id="done-personalize" className="animate-sheet-up mt-2 grid gap-2">
                      <p className="text-sm text-muted">Where do you usually feel desk work the most?</p>
                      {TARGETED_OPTIONS.map((option) => (
                        <Button key={option.id} variant="secondary" size="sm" onClick={() => chooseFocus(option.id)}>
                          {option.label}
                        </Button>
                      ))}
                      <Button variant="secondary" size="sm" onClick={() => chooseFocus("general")}>
                        Mostly just stiff
                      </Button>
                    </div>
                  ) : state.primaryNeed && state.primaryNeed !== "general" ? (
                    <p className="mt-1 text-sm text-muted">
                      Next reset leans towards {NEED_BY_ID[state.primaryNeed]?.label.toLowerCase() ?? "what you picked"}.
                    </p>
                  ) : null}
                </div>

                {offerSave && !saveDismissed ? (
                  <div>
                    <Link
                      href="/app/save?next=/app"
                      className="text-sm font-semibold text-pen underline underline-offset-4"
                      onClick={() => track("account_started", { source: "done", kind: "save_progress" })}
                    >
                      Save my progress
                    </Link>
                    <p className="mt-1 text-sm text-muted">
                      A sign-in link by email, no password, and today&apos;s resets come with you.{" "}
                      <button type="button" onClick={skipSave} className="font-semibold text-ink underline underline-offset-4">
                        No thanks
                      </button>
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="border-t border-line pt-4">
              <WeekSummary />
              {patternLine ? <p className="mt-3 text-sm text-muted">{patternLine}</p> : null}
            </div>

            {session?.exercises?.length ? <MovesDone session={session} /> : null}

            {offerChallenge ? (
              <Link href="/app/challenge" className="group block border-t border-line pt-4">
                <p className="font-display font-extrabold text-lg text-ink group-hover:text-pen group-hover:underline">Try the 5-Day Desk Reset</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  See how a workweek of moving more feels.
                </p>
              </Link>
            ) : null}

            {!quiet ? <InstallPrompt /> : null}
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
        <legend className="w-full text-center font-display font-extrabold text-xl text-ink">{WORSE_AREA_PROMPT}</legend>
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
                  active ? "border-ink bg-ink text-paper" : "border-line-strong bg-white text-ink hover:border-ink",
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
    <details className="border-t border-line pt-1">
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
              <span className="shrink-0 text-muted">{status}</span>
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
