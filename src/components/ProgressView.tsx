"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CharacterArt } from "@/components/CharacterArt";
import { NEED_BY_ID } from "@/lib/constants";
import { isProEntitlement } from "@/lib/entitlements";
import { shiftDay, todayKey } from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import type { WorkoutSession } from "@/lib/types";

/** Free keeps the last week of history; Pro keeps all of it. */
const FREE_HISTORY_DAYS = 7;

function withinDays(session: WorkoutSession, days: number): boolean {
  const cutoff = shiftDay(todayKey(), -(days - 1));
  return session.finishedAt.slice(0, 10) >= cutoff;
}

export function ProgressView() {
  const isClient = useIsClient();
  const state = useAppState();
  const pro = isProEntitlement(state.entitlement);

  const stats = useMemo(() => {
    const history = state.progress.history;
    const week = history.filter((session) => withinDays(session, 7));
    const days = new Set(week.map((session) => session.finishedAt.slice(0, 10)));

    const needCounts = new Map<string, number>();
    const programCounts = new Map<string, { name: string; count: number }>();
    for (const session of history) {
      needCounts.set(session.primaryNeed, (needCounts.get(session.primaryNeed) ?? 0) + 1);
      const entry = programCounts.get(session.programId);
      programCounts.set(session.programId, {
        name: session.programName,
        count: (entry?.count ?? 0) + 1,
      });
    }

    const rated = history.filter((session) => session.perceivedEffect);
    const helped = rated.filter(
      (session) => session.perceivedEffect === "better",
    ).length;

    const topNeed = [...needCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const topProgram = [...programCounts.values()].sort((a, b) => b.count - a.count)[0];

    return {
      weekCount: week.length,
      consistencyDays: days.size,
      topNeed: topNeed?.[0] ?? null,
      topProgram: topProgram?.name ?? null,
      helped,
      rated: rated.length,
    };
  }, [state.progress.history]);

  if (!isClient) return null;

  const empty = state.progress.totalWorkouts === 0;

  return (
    <div className="flex flex-1 flex-col px-5 py-6">
      <h1 className="font-display text-[1.8rem] font-semibold leading-tight text-ink">
        Progress
      </h1>

      {empty ? (
        <div className="mt-8 text-center">
          <CharacterArt pose="idle" size={170} alt="" />
          <p className="mt-4 font-display text-lg font-semibold text-ink">
            Nothing here yet.
          </p>
          <p className="mt-1 text-sm text-ink/60">
            Do one DeskBreak and this page starts meaning something.
          </p>
          <Link
            href="/app"
            className="mt-5 inline-flex min-h-12 items-center rounded-full bg-coral px-5 font-semibold text-white"
          >
            Start a reset
          </Link>
        </div>
      ) : (
        <>
          <dl className="mt-5 grid grid-cols-2 gap-3">
            <Stat label="This week" value={String(stats.weekCount)} unit="DeskBreaks" />
            <Stat
              label="Consistency"
              value={String(stats.consistencyDays)}
              unit={stats.consistencyDays === 1 ? "day" : "days"}
            />
          </dl>

          <dl className="mt-3 grid gap-3">
            {stats.topNeed ? (
              <Row
                label="What needed attention most"
                value={NEED_BY_ID[stats.topNeed as keyof typeof NEED_BY_ID]?.label ?? "Desk"}
              />
            ) : null}
            {stats.rated > 0 ? (
              <Row
                label="Sessions that helped"
                value={`${stats.helped} of ${stats.rated} rated`}
              />
            ) : null}
            {stats.topProgram ? (
              <Row label="Favourite reset" value={stats.topProgram} />
            ) : null}
            <Row
              label="Streak"
              value={`${state.progress.streak} day${state.progress.streak === 1 ? "" : "s"}`}
            />
          </dl>

          {!pro ? (
            <Link
              href="/app/pro?from=progress"
              className="mt-6 block rounded-[22px] border-2 border-ink/10 px-5 py-4"
            >
              <p className="font-display text-base font-semibold text-ink">
                Only the last {FREE_HISTORY_DAYS} days on Free.
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink/60">
                Pro keeps your full history and shows which resets actually help.
              </p>
              <p className="mt-2 text-sm font-semibold text-coral">See Pro &rarr;</p>
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-[22px] bg-white px-4 py-5 shadow-[0_3px_0_rgba(28,25,23,0.06)]">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">
        {label}
      </dt>
      <dd className="mt-1 font-display text-2xl font-semibold text-ink">
        {value} <span className="text-base font-semibold text-ink/50">{unit}</span>
      </dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] bg-white px-4 py-3.5 shadow-[0_2px_0_rgba(28,25,23,0.06)]">
      <dt className="text-sm text-ink/55">{label}</dt>
      <dd className="text-right text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}
