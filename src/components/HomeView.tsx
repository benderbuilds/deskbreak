"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BottomNav } from "@/components/BottomNav";
import { LogoMark } from "@/components/LogoMark";
import { getPrograms } from "@/lib/content";
import { greetingForHour } from "@/lib/format";
import { formatRelativeWorkoutDay, getProgress } from "@/lib/storage";
import { useIsClient } from "@/lib/use-client";
import type { ProgressState } from "@/lib/types";

const empty: ProgressState = {
  streak: 0,
  lastWorkoutDate: null,
  lastWorkout: null,
  totalWorkouts: 0,
};

export function HomeView() {
  const programs = getPrograms();
  const isClient = useIsClient();
  const progress = isClient ? getProgress() : empty;
  const greeting = isClient
    ? greetingForHour(new Date().getHours())
    : "Hey";

  const lastLabel = useMemo(() => {
    if (!progress.lastWorkout) return null;
    const when = formatRelativeWorkoutDay(progress.lastWorkoutDate);
    return `${progress.lastWorkout.programName}${when ? ` · ${when}` : ""}`;
  }, [progress]);

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1 px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <header className="mb-8 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div>
              <p className="font-display text-xl font-semibold leading-none text-ink">
                DeskBreak
              </p>
              <p className="mt-1 text-sm text-ink/55">{greeting}</p>
            </div>
          </div>
          <StreakPill streak={progress.streak} />
        </header>

        <section className="mb-8">
          <h1 className="font-display text-[1.85rem] font-semibold leading-[1.15] tracking-tight text-ink">
            Office workouts and desk exercises that fit between meetings.
          </h1>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-ink/65">
            One tap to start. No equipment. Desk exercises while working —
            or a home workout routine for busy days when the office is your
            kitchen table.
          </p>
        </section>

        <section className="flex flex-col gap-3" aria-label="Start a break">
          {programs.map((program, index) => (
            <Link
              key={program.id}
              href={`/workout/${program.id}`}
              className={[
                "group block rounded-[28px] p-5 outline-none",
                "transition-transform duration-[280ms] ease-[cubic-bezier(0.34,1.4,0.64,1)]",
                "active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-coral",
                index === 0
                  ? "bg-coral text-white shadow-[0_6px_0_#E04420]"
                  : "bg-white text-ink shadow-[0_5px_0_rgba(28,25,23,0.08)]",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p
                    className={[
                      "text-xs font-semibold uppercase tracking-[0.14em]",
                      index === 0 ? "text-white/75" : "text-coral",
                    ].join(" ")}
                  >
                    {program.durationMin} min
                  </p>
                  <h2 className="mt-1 font-display text-[1.45rem] font-semibold leading-tight">
                    {program.shortLabel}
                  </h2>
                  <p
                    className={[
                      "mt-1 text-sm leading-snug",
                      index === 0 ? "text-white/85" : "text-ink/55",
                    ].join(" ")}
                  >
                    {program.tagline}
                  </p>
                </div>
                <span
                  aria-hidden
                  className={[
                    "grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl font-semibold",
                    index === 0 ? "bg-white/15" : "bg-paper",
                  ].join(" ")}
                >
                  →
                </span>
              </div>
            </Link>
          ))}
        </section>

        {lastLabel ? (
          <p className="mt-6 text-center text-sm text-ink/45">
            Last break: {lastLabel}
          </p>
        ) : (
          <p className="mt-6 text-center text-sm text-ink/45">
            Show up for two minutes. That counts.
          </p>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function StreakPill({ streak }: { streak: number }) {
  return (
    <div className="flex min-h-11 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-semibold text-ink shadow-[0_3px_0_rgba(28,25,23,0.06)]">
      <span aria-hidden>🔥</span>
      {streak > 0 ? (
        <span>
          {streak} day{streak === 1 ? "" : "s"}
        </span>
      ) : (
        <span className="text-ink/55">Start</span>
      )}
    </div>
  );
}
