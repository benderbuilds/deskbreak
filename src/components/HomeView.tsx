"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { CharacterArt } from "@/components/CharacterArt";
import { InstallPrompt } from "@/components/InstallPrompt";
import { LogoMark } from "@/components/LogoMark";
import { ProBadge } from "@/components/ProBadge";
import { UpgradeSheet } from "@/components/UpgradeSheet";
import { FIRST_WIN_PROGRAM_ID, GOAL_COPY, HOME_START_NUDGE, SETUP_COPY } from "@/lib/constants";
import { isProEntitlement, isProgramLocked } from "@/lib/entitlements";
import { getProgram, getPrograms } from "@/lib/content";
import { greetingForHour } from "@/lib/format";
import { taglineForSetup } from "@/lib/setup-steps";
import { deskResetGoalKicker } from "@/lib/goal-steps";
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
  const goal = state.onboardingAnswers.goal;
  const setup = state.onboardingAnswers.setup;
  const startProgram = getProgram(FIRST_WIN_PROGRAM_ID) ?? programs[0];
  const morePrograms = programs.filter((program) => program.id !== startProgram?.id);

  const lastLabel = useMemo(() => {
    if (!progress.lastWorkout) return null;
    const when = formatRelativeWorkoutDay(progress.lastWorkoutDate);
    return `${progress.lastWorkout.programName}${when ? ` · ${when}` : ""}`;
  }, [progress]);

  const title = goal ? GOAL_COPY[goal].homeLine : HOME_START_NUDGE;
  const sub = setup
    ? SETUP_COPY[setup].hint
    : "Two minutes. Still at your desk. Actually feel better.";

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
        <header className="mb-5 flex items-start justify-between gap-3">
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
          <StreakPill streak={progress.streak} showXp={pro ? progress.xp : null} />
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

        <section className="mb-5">
          <p className="text-sm font-semibold leading-snug text-coral">{HOME_START_NUDGE}</p>
          <h1 className="mt-2 font-display text-[1.75rem] font-semibold leading-[1.15] tracking-tight text-ink">
            {title === HOME_START_NUDGE ? "Two minutes. Still at your desk." : title}
          </h1>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-ink/60">{sub}</p>
          {(goal || setup) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {goal ? <MetaChip>{GOAL_COPY[goal].label}</MetaChip> : null}
              {setup ? <MetaChip>{SETUP_COPY[setup].label}</MetaChip> : null}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3" aria-label="Start a break">
          {startProgram ? (
            <div className="relative pt-10">
              <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
                <CharacterArt
                  pose="idle"
                  size={172}
                  tappable
                  alt="Stretch ready for a desk break"
                />
              </div>
              <ProgramCard
                program={startProgram}
                featured
                locked={isProgramLocked(startProgram, state.entitlement)}
                tagline={taglineForSetup(startProgram, setup)}
                kicker={deskResetGoalKicker(startProgram.id, goal)}
                onLocked={() =>
                  setUpgrade(`${startProgram.name} is part of Pro, along with the full library.`)
                }
              />
            </div>
          ) : null}

          {pro
            ? morePrograms.map((program) => (
                <ProgramCard
                  key={program.id}
                  program={program}
                  featured={false}
                  locked={isProgramLocked(program, state.entitlement)}
                  tagline={taglineForSetup(program, setup)}
                  kicker={deskResetGoalKicker(program.id, goal)}
                  onLocked={() =>
                    setUpgrade(`${program.name} is part of Pro, along with the full library.`)
                  }
                />
              ))
            : (
                <button
                  type="button"
                  onClick={() =>
                    setUpgrade("Lunch Reset and Busy-Day Circuit unlock with Pro.")
                  }
                  className="min-h-11 text-left text-sm font-semibold text-ink/45"
                >
                  More breaks with Pro →
                </button>
              )}
        </section>

        {lastLabel ? (
          <p className="mt-6 text-center text-sm text-ink/45">Last break: {lastLabel}</p>
        ) : (
          <p className="mt-6 text-center text-sm text-ink/45">
            Fresh slate. That’s kind of nice.
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

function MetaChip({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-[0_2px_0_rgba(28,25,23,0.06)]">
      {children}
    </span>
  );
}

function ProgramCard({
  program,
  featured,
  locked,
  tagline,
  kicker,
  onLocked,
}: {
  program: Program;
  featured: boolean;
  locked: boolean;
  tagline: string;
  kicker?: string | null;
  onLocked: () => void;
}) {
  const className = [
    "group block rounded-[28px] p-5 outline-none text-left w-full",
    "transition-[transform,box-shadow] duration-[240ms] ease-[cubic-bezier(0.34,1.4,0.64,1)]",
    "active:translate-y-[2px] active:shadow-none focus-visible:ring-2 focus-visible:ring-coral",
    featured
      ? "bg-coral pt-16 text-white shadow-[0_6px_0_#E04420]"
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
          {program.durationMin} min{locked ? " · Pro" : featured ? " · Start" : ""}
        </p>
        <h2 className="mt-1 font-display text-[1.45rem] font-semibold leading-tight">
          {program.shortLabel}
        </h2>
        <p className={["mt-1 text-sm leading-snug", featured ? "text-white/85" : "text-ink/55"].join(" ")}>
          {tagline}
        </p>
        {kicker && !locked ? (
          <p
            className={[
              "mt-1 text-xs font-semibold",
              featured ? "text-white/70" : "text-coral",
            ].join(" ")}
          >
            {kicker}
          </p>
        ) : null}
      </div>
      <span
        aria-hidden
        className={[
          "grid h-12 min-w-12 shrink-0 place-items-center rounded-full px-3 text-sm font-semibold",
          featured ? "bg-white/15" : "bg-paper",
        ].join(" ")}
      >
        {locked ? "🔒" : featured ? "Start" : "→"}
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

function StreakPill({ streak, showXp }: { streak: number; showXp: number | null }) {
  return (
    <div className="flex min-h-11 flex-col items-end justify-center rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-ink shadow-[0_3px_0_rgba(28,25,23,0.06)]">
      <span>
        {streak > 0 ? `🔥 ${streak}-day groove` : "Day one anytime"}
      </span>
      {showXp != null ? (
        <span className="text-[11px] font-semibold text-ink/45">{showXp} XP</span>
      ) : null}
    </div>
  );
}
