"use client";

import { useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { track } from "@/lib/analytics";
import { NEED_BY_ID, NEED_OPTIONS } from "@/lib/constants";
import { saveChallenge, shiftDay, todayKey } from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import type { PrimaryNeed, StiffnessRating } from "@/lib/types";

const RATINGS: { id: StiffnessRating; label: string }[] = [
  { id: "great", label: "Great" },
  { id: "pretty_good", label: "Pretty good" },
  { id: "stiff", label: "Stiff" },
  { id: "very_stiff", label: "Very stiff" },
  { id: "uncomfortable", label: "Uncomfortable" },
];

const RATING_LABEL = Object.fromEntries(
  RATINGS.map((rating) => [rating.id, rating.label]),
) as Record<StiffnessRating, string>;

const CHALLENGE_DAYS = 7;

/**
 * The 7-Day Desk Reset.
 *
 * Asks the same question on day 1 and day 7 and reports what the person said,
 * nothing more. No claims about what the movement did to their body.
 */
export function ChallengeView() {
  const isClient = useIsClient();
  const state = useAppState();
  const challenge = state.challenge;

  const [baseline, setBaseline] = useState<StiffnessRating | null>(null);
  const [problem, setProblem] = useState<PrimaryNeed | null>(state.primaryNeed);
  const [finalRating, setFinalRating] = useState<StiffnessRating | null>(null);

  const summary = useMemo(() => {
    if (!challenge.startedOn) return null;
    const start = challenge.startedOn;
    const dayKeys = Array.from({ length: CHALLENGE_DAYS }, (_, index) =>
      shiftDay(start, index),
    );
    const sessions = state.progress.history.filter((session) =>
      dayKeys.includes(session.finishedAt.slice(0, 10)),
    );
    const needCounts = new Map<PrimaryNeed, number>();
    for (const session of sessions) {
      if (session.perceivedEffect === "better") {
        needCounts.set(
          session.primaryNeed,
          (needCounts.get(session.primaryNeed) ?? 0) + 1,
        );
      }
    }
    const best = [...needCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      dayKeys,
      breaks: sessions.length,
      daysDone: challenge.completedDays.filter((day) => dayKeys.includes(day)).length,
      bestNeed: best?.[0] ?? null,
      finished: dayKeys[CHALLENGE_DAYS - 1] <= todayKey(),
    };
  }, [challenge.startedOn, challenge.completedDays, state.progress.history]);

  if (!isClient) return null;

  // Not started yet.
  if (!challenge.startedOn) {
    return (
      <div className="flex flex-1 flex-col px-5 py-6">
        <div className="flex justify-center">
          <CharacterArt pose="ready" size={170} alt="Stretch, ready to go" />
        </div>
        <h1 className="mt-4 font-display text-[1.8rem] font-semibold leading-tight text-ink">
          Try the 7-Day Desk Reset
        </h1>
        <p className="mt-3 leading-relaxed text-ink/65">
          Three tiny movement breaks a day. See how your body feels after one
          workweek.
        </p>

        <fieldset className="mt-7">
          <legend className="font-display text-lg font-semibold text-ink">
            At the end of a normal workday, how does your body usually feel?
          </legend>
          <div className="mt-3 grid gap-2">
            {RATINGS.map((rating) => (
              <button
                key={rating.id}
                type="button"
                aria-pressed={baseline === rating.id}
                onClick={() => setBaseline(rating.id)}
                className={[
                  "min-h-14 rounded-[18px] px-4 text-left font-semibold",
                  baseline === rating.id
                    ? "bg-ink text-paper"
                    : "bg-white text-ink shadow-[0_2px_0_rgba(28,25,23,0.06)]",
                ].join(" ")}
              >
                {rating.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-7">
          <legend className="font-display text-lg font-semibold text-ink">
            Anything in particular? (optional)
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {NEED_OPTIONS.filter((option) => option.id !== "general").map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={problem === option.id}
                onClick={() =>
                  setProblem((current) => (current === option.id ? null : option.id))
                }
                className={[
                  "min-h-11 rounded-full px-4 text-sm font-semibold",
                  problem === option.id
                    ? "bg-coral text-white"
                    : "bg-white text-ink/60 shadow-[0_2px_0_rgba(28,25,23,0.06)]",
                ].join(" ")}
              >
                {option.chip}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-7">
          <Button
            disabled={!baseline}
            onClick={() => {
              if (!baseline) return;
              saveChallenge({
                startedOn: todayKey(),
                baseline,
                primaryProblem: problem,
                completedDays: [],
                completedAt: null,
                finalRating: null,
              });
              track("challenge_started", {
                baseline,
                need: problem ?? "general",
              });
            }}
          >
            Start day 1
          </Button>
        </div>
      </div>
    );
  }

  // Finished and rated: show the summary.
  if (challenge.completedAt && challenge.finalRating) {
    return (
      <div className="flex flex-1 flex-col px-5 py-6">
        <div className="flex justify-center">
          <CharacterArt pose="done" size={170} alt="Stretch, satisfied" />
        </div>
        <h1 className="mt-4 font-display text-[1.8rem] font-semibold leading-tight text-ink">
          Your DeskBreak week
        </h1>
        <dl className="mt-5 grid gap-3">
          <SummaryRow
            label="Breaks completed"
            value={String(summary?.breaks ?? 0)}
          />
          <SummaryRow
            label="Days you showed up"
            value={`${summary?.daysDone ?? 0} of ${CHALLENGE_DAYS}`}
          />
          {summary?.bestNeed ? (
            <SummaryRow
              label="Helped most often"
              value={NEED_BY_ID[summary.bestNeed].label}
            />
          ) : null}
          {challenge.baseline ? (
            <SummaryRow
              label="End-of-day stiffness"
              value={`${RATING_LABEL[challenge.baseline]} to ${RATING_LABEL[challenge.finalRating]}`}
            />
          ) : null}
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-ink/45">
          These are the answers you gave, on the days you gave them.
        </p>
        <div className="mt-7">
          <ButtonLink href="/app">Back to DeskBreak</ButtonLink>
        </div>
      </div>
    );
  }

  const day = summary
    ? Math.min(
        CHALLENGE_DAYS,
        summary.dayKeys.findIndex((key) => key === todayKey()) + 1 || CHALLENGE_DAYS,
      )
    : 1;
  const readyToFinish = Boolean(summary?.finished);

  return (
    <div className="flex flex-1 flex-col px-5 py-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-coral">
        7-Day Desk Reset
      </p>
      <h1 className="mt-1 font-display text-[1.8rem] font-semibold leading-tight text-ink">
        Day {day} of {CHALLENGE_DAYS}
      </h1>

      <ul className="mt-5 grid grid-cols-7 gap-1.5" aria-label="Days completed">
        {summary?.dayKeys.map((key, index) => {
          const done = challenge.completedDays.includes(key);
          return (
            <li
              key={key}
              className={[
                "grid aspect-square place-items-center rounded-xl text-sm font-semibold",
                done ? "bg-mint text-ink" : "bg-white text-ink/35 shadow-[0_2px_0_rgba(28,25,23,0.06)]",
              ].join(" ")}
              aria-label={`Day ${index + 1}${done ? ", done" : ""}`}
            >
              {index + 1}
            </li>
          );
        })}
      </ul>

      <p className="mt-5 leading-relaxed text-ink/65">
        {challenge.completedDays.includes(todayKey())
          ? "Today's in the bag. Do another if you feel like it."
          : "Three tiny breaks today. Start whenever."}
      </p>

      <div className="mt-6 grid gap-3">
        <ButtonLink href="/app">Start a DeskBreak</ButtonLink>
      </div>

      {readyToFinish ? (
        <fieldset className="mt-8">
          <legend className="font-display text-lg font-semibold text-ink">
            One week on. How does your body feel at the end of a workday?
          </legend>
          <div className="mt-3 grid gap-2">
            {RATINGS.map((rating) => (
              <button
                key={rating.id}
                type="button"
                aria-pressed={finalRating === rating.id}
                onClick={() => setFinalRating(rating.id)}
                className={[
                  "min-h-14 rounded-[18px] px-4 text-left font-semibold",
                  finalRating === rating.id
                    ? "bg-ink text-paper"
                    : "bg-white text-ink shadow-[0_2px_0_rgba(28,25,23,0.06)]",
                ].join(" ")}
              >
                {rating.label}
              </button>
            ))}
          </div>
          <div className="mt-5">
            <Button
              disabled={!finalRating}
              onClick={() => {
                if (!finalRating) return;
                saveChallenge({
                  finalRating,
                  completedAt: new Date().toISOString(),
                });
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] bg-white px-4 py-3.5 shadow-[0_2px_0_rgba(28,25,23,0.06)]">
      <dt className="text-sm text-ink/55">{label}</dt>
      <dd className="text-right text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}
