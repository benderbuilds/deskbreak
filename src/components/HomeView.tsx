"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { CharacterArt } from "@/components/CharacterArt";
import { InstallPrompt } from "@/components/InstallPrompt";
import { LogoMark } from "@/components/LogoMark";
import { ProBadge } from "@/components/ProBadge";
import { UpgradeSheet } from "@/components/UpgradeSheet";
import { GOAL_COPY } from "@/lib/constants";
import { isProEntitlement, isProgramLocked } from "@/lib/entitlements";
import { getPrograms } from "@/lib/content";
import { greetingForHour } from "@/lib/format";
import {
  formatRelativeWorkoutDay,
  markReminderShown,
  todayKey,
} from "@/lib/storage";
import {
  currentHour,
  formatHourLabel,
  pingLocalNotification,
  shouldShowReminder,
} from "@/lib/reminders";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import type { Program } from "@/lib/types";

export function HomeView() {
  const programs = getPrograms();
  const isClient = useIsClient();
  const state = useAppState();
  const pro = isProEntitlement(state.entitlement);
  const [upgrade, setUpgrade] = useState<string | null>(null);
  const greeting = isClient ? greetingForHour(new Date().getHours()) : "Hey";
  const progress = state.progress;

  const lastLabel = useMemo(() => {
    if (!progress.lastWorkout) return null;
    const when = formatRelativeWorkoutDay(progress.lastWorkoutDate);
    return `${progress.lastWorkout.programName}${when ? ` · ${when}` : ""}`;
  }, [progress]);

  const goalLine = state.onboardingAnswers.goal
    ? GOAL_COPY[state.onboardingAnswers.goal].homeLine
    : "Office workouts and desk exercises that fit between meetings.";

  const reminderDue =
    isClient &&
    shouldShowReminder({
      enabled: state.settings.remindersEnabled,
      hour: state.settings.reminderHour,
      lastReminderDate: state.settings.lastReminderDate,
      today: todayKey(),
      hourNow: currentHour(),
    });

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1 px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <header className="mb-6 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div>
              <div className="flex items-center gap-2">
                <p className="font-display text-xl font-semibold leading-none text-ink">
                  DeskBreak
                </p>
                {pro ? <ProBadge /> : null}
              </div>
              <p className="mt-1 text-sm text-ink/55">{greeting}</p>
            </div>
          </div>
          <StreakPill streak={progress.streak} xp={pro ? progress.xp : null} />
        </header>

        {reminderDue ? (
          <Link
            href="/workout/desk-reset-2min"
            onClick={() => {
              markReminderShown();
              pingLocalNotification("DeskBreak", "Two minutes. That’s the whole ask.");
            }}
            className="mb-4 block w-full rounded-[22px] bg-mint/25 px-4 py-3 text-left"
          >
            <p className="text-sm font-semibold text-ink">Time for a desk reset.</p>
            <p className="text-xs text-ink/60">
              {state.settings.reminderHour != null
                ? `Your ${formatHourLabel(state.settings.reminderHour)} nudge.`
                : "A tiny unstick, then back to it."}
            </p>
          </Link>
        ) : null}

        <InstallPrompt />

        <div className="mb-4 flex justify-center">
          <CharacterArt pose="idle" size={148} tappable alt="Reed ready for a desk break" />
        </div>

        <section className="mb-7">
          <h1 className="font-display text-[1.75rem] font-semibold leading-[1.15] tracking-tight text-ink">
            {goalLine}
          </h1>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-ink/65">
            One tap to start. Desk exercises while working — or a home workout
            routine for busy days. No equipment.
          </p>
        </section>

        <section className="flex flex-col gap-3" aria-label="Start a break">
          {programs.map((program, index) => (
            <ProgramCard
              key={program.id}
              program={program}
              featured={index === 0}
              locked={isProgramLocked(program, state.entitlement)}
              onLocked={() =>
                setUpgrade(
                  `${program.name} is part of Pro, along with the full library.`,
                )
              }
            />
          ))}
        </section>

        {lastLabel ? (
          <p className="mt-6 text-center text-sm text-ink/45">Last break: {lastLabel}</p>
        ) : (
          <p className="mt-6 text-center text-sm text-ink/45">
            Show up for two minutes. That counts.
          </p>
        )}
      </main>
      <BottomNav />
      <UpgradeSheet
        open={Boolean(upgrade)}
        onClose={() => setUpgrade(null)}
        reason={upgrade ?? undefined}
      />
    </div>
  );
}

function ProgramCard({
  program,
  featured,
  locked,
  onLocked,
}: {
  program: Program;
  featured: boolean;
  locked: boolean;
  onLocked: () => void;
}) {
  const className = [
    "group block rounded-[28px] p-5 outline-none text-left w-full",
    "transition-transform duration-[280ms] ease-[cubic-bezier(0.34,1.4,0.64,1)]",
    "active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-coral",
    featured
      ? "bg-coral text-white shadow-[0_6px_0_#E04420]"
      : "bg-white text-ink shadow-[0_5px_0_rgba(28,25,23,0.08)]",
  ].join(" ");

  const inner = (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p
          className={[
            "text-xs font-semibold uppercase tracking-[0.14em]",
            featured ? "text-white/75" : "text-coral",
          ].join(" ")}
        >
          {program.durationMin} min{locked ? " · Pro" : ""}
        </p>
        <h2 className="mt-1 font-display text-[1.45rem] font-semibold leading-tight">
          {program.shortLabel}
        </h2>
        <p className={["mt-1 text-sm leading-snug", featured ? "text-white/85" : "text-ink/55"].join(" ")}>
          {program.tagline}
        </p>
      </div>
      <span
        aria-hidden
        className={[
          "grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl font-semibold",
          featured ? "bg-white/15" : "bg-paper",
        ].join(" ")}
      >
        {locked ? "🔒" : "→"}
      </span>
    </div>
  );

  if (locked) {
    return (
      <button type="button" className={className} onClick={onLocked}>
        {inner}
      </button>
    );
  }

  return (
    <Link href={`/workout/${program.id}`} className={className}>
      {inner}
    </Link>
  );
}

function StreakPill({ streak, xp }: { streak: number; xp: number | null }) {
  return (
    <div className="flex min-h-11 flex-col items-end justify-center rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-ink shadow-[0_3px_0_rgba(28,25,23,0.06)]">
      <span>
        🔥 {streak > 0 ? `${streak} day${streak === 1 ? "" : "s"}` : "Start"}
      </span>
      {xp != null ? (
        <span className="text-[11px] font-semibold text-ink/45">{xp} XP</span>
      ) : null}
    </div>
  );
}
