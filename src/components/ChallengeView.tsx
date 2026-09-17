"use client";

import { useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { track } from "@/lib/analytics";
import { saveChallenge, shiftDay, todayKey } from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import { weekdayOf } from "@/lib/dates";
import type { StiffnessRating } from "@/lib/types";

const RATINGS: { id: StiffnessRating; label: string }[] = [
  { id: 1, label: "Great" },
  { id: 2, label: "Pretty good" },
  { id: 3, label: "Stiff" },
  { id: 4, label: "Very stiff" },
  { id: 5, label: "Very stiff or uncomfortable" },
];

const RATING_LABEL: Record<StiffnessRating, string> = {
  1: "Great",
  2: "Pretty good",
  3: "Stiff",
  4: "Very stiff",
  5: "Very stiff or uncomfortable",
};

const CHALLENGE_DAYS = 5;

/** Next Monday's date key, or today if it is Monday. */
function nextMonday(): string {
  let key = todayKey();
  for (let i = 0; i < 7; i += 1) {
    if (weekdayOf(key) === 1) return key;
    key = shiftDay(key, 1);
  }
  return key;
}

/**
 * The 5-Day Desk Reset.
 *
 * Asks the same question on day 1 and day 5 and reports what the person said,
 * nothing more. No claims about what the movement did to their body.
 */
export function ChallengeView() {
  const isClient = useIsClient();
  const state = useAppState();
  const challenge = state.challenge;

  const [baseline, setBaseline] = useState<StiffnessRating | null>(null);
  const [finalRating, setFinalRating] = useState<StiffnessRating | null>(null);

  const summary = useMemo(() => {
    if (!challenge.startedOn) return null;
    const start = challenge.startedOn;
    const dayKeys = Array.from({ length: CHALLENGE_DAYS }, (_, index) => shiftDay(start, index));
    const sessions = state.progress.history.filter((session) =>
      dayKeys.includes(session.finishedAt.slice(0, 10)),
    );
    return {
      dayKeys,
      breaks: sessions.length,
      helped: sessions.filter((session) => session.perceivedEffect === "better").length,
      daysDone: challenge.completedDays.filter((day) => dayKeys.includes(day)).length,
      finished: dayKeys[CHALLENGE_DAYS - 1] <= todayKey(),
      started: start <= todayKey(),
    };
  }, [challenge.startedOn, challenge.completedDays, state.progress.history]);

  if (!isClient) return null;

  function begin(startOn: string) {
    if (!baseline) return;
    saveChallenge({
      startedOn: startOn,
      baseline,
      primaryProblem: state.primaryNeed,
      completedDays: [],
      completedAt: null,
      finalRating: null,
    });
    track("challenge_started", { baseline, start: startOn === todayKey() ? "today" : "monday" });
  }

  if (!challenge.startedOn) {
    return (
      <div className="flex flex-1 flex-col px-5 py-6 lg:max-w-[560px] lg:px-0">
        <div className="flex justify-center">
          <CharacterArt pose="ready" size={150} alt="Stretch, ready to go" />
        </div>
        <h1 className="mt-4 font-display text-[1.8rem] font-semibold leading-tight text-ink">
          Try the 5-Day Desk Reset
        </h1>
        <p className="mt-3 leading-relaxed text-ink/65">
          One or more movement breaks each workday. See how a workweek of moving more feels.
        </p>

        <fieldset className="mt-7">
          <legend className="font-display text-lg font-semibold text-ink">
            How do you usually feel at the end of a workday?
          </legend>
          <div className="mt-3 grid gap-2">
            {RATINGS.map((rating) => (
              <button
                key={rating.id}
                type="button"
                aria-pressed={baseline === rating.id}
                onClick={() => setBaseline(rating.id)}
                className={[
                  "flex min-h-13 items-center gap-3 rounded-[14px] px-4 text-left font-semibold transition-colors",
                  baseline === rating.id ? "bg-ink text-paper" : "surface text-ink hover:bg-ink/3",
                ].join(" ")}
              >
                <span className={["w-5 text-sm tabular-nums", baseline === rating.id ? "text-paper/60" : "text-ink/40"].join(" ")}>
                  {rating.id}
                </span>
                {rating.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-7 grid gap-2.5">
          <Button disabled={!baseline} onClick={() => begin(nextMonday())}>
            Start Monday
          </Button>
          <Button disabled={!baseline} variant="secondary" onClick={() => begin(todayKey())}>
            Start today
          </Button>
        </div>
      </div>
    );
  }

  if (challenge.completedAt && challenge.finalRating) {
    return (
      <div className="flex flex-1 flex-col px-5 py-6 lg:max-w-[560px] lg:px-0">
        <div className="flex justify-center">
          <CharacterArt pose="done" size={150} alt="Stretch, satisfied" />
        </div>
        <h1 className="mt-4 font-display text-[1.8rem] font-semibold leading-tight text-ink">Your DeskBreak week</h1>

        <div className="surface mt-5 grid grid-cols-2 gap-4 px-4 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">Day 1</p>
            <p className="mt-1 font-display text-lg font-semibold text-ink">
              {challenge.baseline ? RATING_LABEL[challenge.baseline] : "–"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">Day 5</p>
            <p className="mt-1 font-display text-lg font-semibold text-ink">{RATING_LABEL[challenge.finalRating]}</p>
          </div>
        </div>

        <p className="mt-5 font-display text-xl font-semibold text-ink">
          You completed {summary?.breaks ?? 0} DeskBreak{summary?.breaks === 1 ? "" : "s"} this week.
        </p>
        <p className="mt-1 text-sm text-ink/60">
          {summary?.daysDone ?? 0} of {CHALLENGE_DAYS} days with a reset
          {summary?.helped ? ` · ${summary.helped} helped` : ""}.
        </p>
        <p className="mt-4 text-xs leading-relaxed text-ink/45">
          These are the answers you gave, on the days you gave them.
        </p>
        <div className="mt-7">
          <ButtonLink href="/app">Back to Today</ButtonLink>
        </div>
      </div>
    );
  }

  const day = summary
    ? Math.max(1, Math.min(CHALLENGE_DAYS, summary.dayKeys.findIndex((key) => key === todayKey()) + 1 || (summary.finished ? CHALLENGE_DAYS : 1)))
    : 1;
  const readyToFinish = Boolean(summary?.finished);

  return (
    <div className="flex flex-1 flex-col px-5 py-6 lg:max-w-[560px] lg:px-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-coral">5-Day Desk Reset</p>
      <h1 className="mt-1 font-display text-[1.8rem] font-semibold leading-tight text-ink">
        {summary && !summary.started ? "Starts Monday" : `Day ${day} of ${CHALLENGE_DAYS}`}
      </h1>

      <ul className="mt-5 grid grid-cols-5 gap-1.5" aria-label="Days completed">
        {summary?.dayKeys.map((key, index) => {
          const done = challenge.completedDays.includes(key);
          return (
            <li
              key={key}
              className={[
                "grid aspect-square place-items-center rounded-[12px] text-sm font-semibold",
                done ? "bg-mint text-ink" : "surface text-ink/35",
              ].join(" ")}
              aria-label={`Day ${index + 1}${done ? ", done" : ""}`}
            >
              {done ? "✓" : index + 1}
            </li>
          );
        })}
      </ul>

      <p className="mt-5 leading-relaxed text-ink/65">
        {challenge.completedDays.includes(todayKey())
          ? "Today's in the bag. Do another if you feel like it."
          : "One movement break today. Start whenever."}
      </p>

      <div className="mt-6">
        <ButtonLink href="/app">Start a DeskBreak</ButtonLink>
      </div>

      {readyToFinish ? (
        <fieldset className="mt-8">
          <legend className="font-display text-lg font-semibold text-ink">
            One week on. How do you feel at the end of a workday?
          </legend>
          <div className="mt-3 grid gap-2">
            {RATINGS.map((rating) => (
              <button
                key={rating.id}
                type="button"
                aria-pressed={finalRating === rating.id}
                onClick={() => setFinalRating(rating.id)}
                className={[
                  "flex min-h-13 items-center gap-3 rounded-[14px] px-4 text-left font-semibold transition-colors",
                  finalRating === rating.id ? "bg-ink text-paper" : "surface text-ink hover:bg-ink/3",
                ].join(" ")}
              >
                <span className={["w-5 text-sm tabular-nums", finalRating === rating.id ? "text-paper/60" : "text-ink/40"].join(" ")}>
                  {rating.id}
                </span>
                {rating.label}
              </button>
            ))}
          </div>
          <div className="mt-5">
            <Button
              disabled={!finalRating}
              onClick={() => {
                if (!finalRating) return;
                saveChallenge({ finalRating, completedAt: new Date().toISOString() });
                track("challenge_completed", {
                  baseline: challenge.baseline,
                  final: finalRating,
                  breaks: summary?.breaks ?? 0,
                });
              }}
            >
              See my week
            </Button>
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
