"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { CharacterArt } from "@/components/CharacterArt";
import { WeekSummary } from "@/components/WeekSummary";
import { track } from "@/lib/analytics";
import { NEED_BY_ID } from "@/lib/constants";
import { getExercise } from "@/lib/content";
import { isProEntitlement } from "@/lib/entitlements";
import {
  formatActiveTime,
  isHelpfulEnough,
  patternsReady,
  ratingsUntilPatterns,
  totalActiveSeconds,
} from "@/lib/insights";
import { helpRate, signalsFromHistory } from "@/lib/personalization";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import type { WorkoutSession } from "@/lib/types";

/** Free sees the last few weeks; Pro sees everything. */
const FREE_HISTORY_DAYS = 14;

/**
 * Progress answers one question: is DeskBreak actually helping me?
 *
 * No XP. Counts, consistency, what helps, and patterns in this person's own
 * answers. Every line here is something they said, not something we inferred
 * about their body.
 */
export function ProgressView() {
  const isClient = useIsClient();
  const state = useAppState();
  const pro = isProEntitlement(state.entitlement);

  useEffect(() => {
    if (isClient) track("progress_viewed", { sessions: state.progress.totalWorkouts });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient]);

  const insights = useMemo(() => buildInsights(state.progress.history, state.signals), [state.progress.history, state.signals]);

  if (!isClient) return null;

  const empty = state.progress.totalWorkouts === 0;
  const ready = patternsReady(state.progress.history);
  const remaining = ratingsUntilPatterns(state.progress.history);

  return (
    <div className="flex flex-1 flex-col px-5 py-6 lg:max-w-[640px] lg:px-0">
      <h1 className="font-display font-extrabold text-[1.8rem] leading-tight text-ink">Progress</h1>
      {state.account.profileId && state.account.email ? (
        <p className="mt-1 text-sm break-words text-muted">Synced as {state.account.email}</p>
      ) : null}

      {empty ? (
        <div className="mt-8 text-center">
          <CharacterArt pose="idle" size={150} alt="" />
          <p className="mt-4 font-display font-extrabold text-lg text-ink">Nothing here yet.</p>
          <p className="mt-1 text-sm text-muted">Do one DeskBreak and this page starts meaning something.</p>
          <Link
            href="/app"
            className="mt-5 inline-flex min-h-12 items-center rounded-[14px] bg-pen px-5 font-semibold text-white"
          >
            Start a reset
          </Link>
        </div>
      ) : (
        <>
          <div className="surface mt-5 px-4 py-4">
            <WeekSummary />
          </div>

          {ready && insights.mostHelpful ? (
            <section className="mt-6" aria-labelledby="most-helpful">
              <h2 id="most-helpful" className="font-display text-xl font-extrabold text-ink">
                What helps you
              </h2>
              <div className="surface mt-2 px-4 py-4">
                <p className="text-sm text-muted">Most helpful</p>
                <p className="mt-0.5 font-display font-extrabold text-lg text-ink">{insights.mostHelpful.name}</p>
                <p className="mt-1 text-sm text-muted">
                  Helped {insights.mostHelpful.helped} of {insights.mostHelpful.rated} times
                </p>
              </div>
            </section>
          ) : null}

          {ready && insights.patterns.length ? (
            <section className="mt-6" aria-labelledby="patterns">
              <h2 id="patterns" className="font-display text-xl font-extrabold text-ink">
                Patterns
              </h2>
              <ul className="mt-2 grid gap-2">
                {insights.patterns.map((line) => (
                  <li key={line} className="surface px-4 py-3 text-sm leading-relaxed text-ink/75">
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="mt-6 text-sm leading-relaxed text-muted">
              {remaining > 0
                ? `${remaining} more rated ${remaining === 1 ? "reset" : "resets"} to see your patterns. Answer "How do you feel?" after a reset to count it.`
                : "Patterns show up here once your answers point somewhere."}
            </p>
          )}

          <section className="mt-6" aria-labelledby="totals">
            <h2 id="totals" className="font-display text-xl font-extrabold text-ink">
              All time
            </h2>
            <dl className="mt-2 grid grid-cols-2 border-t border-line">
              <Stat label="Resets" value={String(state.progress.totalWorkouts)} />
              <Stat label="Active workdays" value={String(insights.activeDays)} />
              <Stat label="Helped" value={insights.rated ? `${insights.helped} of ${insights.rated}` : "–"} />
              <Stat label="Time moved" value={formatActiveTime(insights.activeSeconds)} />
            </dl>
            {state.microBreaks.length ? (
              <p className="mt-3 text-sm text-muted">
                Plus {state.microBreaks.length} {state.microBreaks.length === 1 ? "stand-up" : "stand-ups"} between resets.
              </p>
            ) : null}
          </section>

          {!pro ? (
            <Link href="/app/pro?from=progress" className="surface mt-6 block px-5 py-4 transition-colors hover:border-ink">
              <p className="font-display font-extrabold text-base text-ink">
                Insights cover the last {FREE_HISTORY_DAYS} days on Free.
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Pro keeps your full history, syncs it across devices and shows which resets help most.
              </p>
              <p className="mt-2 text-sm font-semibold text-pen underline underline-offset-4">See Pro</p>
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-line py-3 pr-3">
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="mt-0.5 font-display font-extrabold text-[2rem] leading-tight text-ink tabular-nums">{value}</dd>
    </div>
  );
}

type Insights = {
  activeDays: number;
  helped: number;
  rated: number;
  activeSeconds: number;
  mostHelpful: { name: string; helped: number; rated: number } | null;
  patterns: string[];
};

function buildInsights(history: WorkoutSession[], signals: Record<string, { better: number; worse: number }>): Insights {
  const activeDays = new Set(history.map((session) => session.finishedAt.slice(0, 10))).size;
  const rated = history.filter((session) => session.perceivedEffect);
  const helped = rated.filter((session) => session.perceivedEffect === "better").length;
  // Real time spent moving, never the routine's advertised length.
  const activeSeconds = totalActiveSeconds(history);

  // Most helpful routine, by short label.
  const byProgram = new Map<string, { name: string; helped: number; rated: number }>();
  for (const session of rated) {
    const name = session.programName.replace(/^\d+-Minute /, "");
    const entry = byProgram.get(name) ?? { name, helped: 0, rated: 0 };
    entry.rated += 1;
    if (session.perceivedEffect === "better") entry.helped += 1;
    byProgram.set(name, entry);
  }
  const mostHelpful =
    [...byProgram.values()]
      .filter((entry) => isHelpfulEnough(entry.helped, entry.rated))
      .sort((a, b) => b.helped / b.rated - a.helped / a.rated || b.rated - a.rated)[0] ?? null;

  const patterns: string[] = [];
  const full = signalsFromHistory(history, {});

  // Where they feel it most.
  const needCounts = new Map<string, number>();
  for (const session of history) {
    if (session.primaryNeed !== "general") {
      needCounts.set(session.primaryNeed, (needCounts.get(session.primaryNeed) ?? 0) + 1);
    }
  }
  const topNeed = [...needCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topNeed && topNeed[1] >= 3) {
    patterns.push(`You reach for ${NEED_BY_ID[topNeed[0] as keyof typeof NEED_BY_ID].label.toLowerCase()} resets most often.`);
  }

  // Time of day.
  const tods = Object.entries(full.timeOfDayOutcomes).filter(([, tally]) => tally && tally.rated >= 3);
  if (tods.length >= 2) {
    const sorted = tods.sort((a, b) => helpRate(b[1]!) - helpRate(a[1]!));
    const [bestName, best] = sorted[0];
    const [worstName, worst] = sorted[sorted.length - 1];
    if (helpRate(best!) - helpRate(worst!) >= 0.2) {
      patterns.push(`${capitalize(bestName)} resets are helping more often than ${worstName} ones.`);
    }
  }

  // Standing vs seated.
  const standing = full.setupOutcomes.standing;
  const seated = full.setupOutcomes.seated;
  if (standing.rated >= 3 && helpRate(standing) >= 0.7 && helpRate(standing) > helpRate(seated)) {
    patterns.push(`Standing resets have helped you ${Math.round((standing.better / standing.rated) * 100)}% of the time.`);
  } else if (seated.rated >= 3 && helpRate(seated) >= 0.7 && helpRate(seated) > helpRate(standing)) {
    patterns.push(`Seated resets have helped you ${Math.round((seated.better / seated.rated) * 100)}% of the time.`);
  }

  // A move that keeps showing up in helpful sessions.
  const proven = Object.entries(signals)
    .filter(([, signal]) => signal.better >= 3 && signal.better > signal.worse * 2)
    .sort((a, b) => b[1].better - a[1].better)[0];
  if (proven) {
    const exercise = getExercise(proven[0]);
    if (exercise) patterns.push(`${exercise.name} appears in most of your highest-rated sessions.`);
  }

  // Duration habit.
  const durations = Object.entries(full.durationCounts).sort((a, b) => b[1] - a[1]);
  if (durations.length && history.length >= 5 && durations[0][1] / history.length >= 0.7) {
    patterns.push(`Most of your resets are ${durations[0][0]} minutes. DeskBreak defaults to that now.`);
  }

  return { activeDays, helped, rated: rated.length, activeSeconds, mostHelpful, patterns: patterns.slice(0, 4) };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
