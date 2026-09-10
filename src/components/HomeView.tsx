"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { LogoMark } from "@/components/LogoMark";
import { ProBadge } from "@/components/ProBadge";
import { track } from "@/lib/analytics";
import { NEED_OPTIONS } from "@/lib/constants";
import { getPrograms } from "@/lib/content";
import { isProEntitlement } from "@/lib/entitlements";
import { greetingForHour } from "@/lib/format";
import {
  getRecommendedProgram,
  timeOfDayNow,
} from "@/lib/recommendation";
import { recentExerciseIds, setPrimaryNeed } from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import { formatMinutes, planForToday, planProgress } from "@/lib/workday";
import type { PrimaryNeed } from "@/lib/types";

export function HomeView() {
  const router = useRouter();
  const isClient = useIsClient();
  const state = useAppState();
  const pro = isProEntitlement(state.entitlement);

  const [need, setNeed] = useState<PrimaryNeed>(state.primaryNeed ?? "general");
  const setup = state.preferredSetup ?? "seated";

  const recommendation = useMemo(
    () =>
      getRecommendedProgram({
        need,
        setup,
        durationMinutes: 2,
        pro,
        recentExerciseIds: isClient ? recentExerciseIds() : [],
        timeOfDay: timeOfDayNow(),
      }),
    [need, setup, pro, isClient],
  );

  const merchandised = useMemo(
    () => getPrograms().filter((program) => program.durationMin >= 2),
    [],
  );

  if (!isClient) return null;

  const plan = state.plan ? planForToday(state.plan, setup) : null;
  const progress = plan ? planProgress(plan) : null;
  const { program, reason } = recommendation;

  function chooseNeed(next: PrimaryNeed) {
    setNeed(next);
    setPrimaryNeed(next);
    track("need_selected", { need: next, source: "home_chip" });
  }

  function start() {
    router.push(`/app/workout/${program.id}?need=${need}&setup=${setup}`);
  }

  return (
    <div className="flex flex-1 flex-col px-5 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoMark size={30} />
          <span className="font-display text-lg font-semibold tracking-tight">
            DeskBreak
          </span>
        </div>
        {pro ? <ProBadge /> : null}
      </header>

      <p className="mt-4 text-sm font-semibold text-ink/50">
        {greetingForHour(new Date().getHours())}
      </p>
      <h1 className="mt-1 font-display text-[1.6rem] font-semibold leading-tight tracking-tight text-ink">
        How are you feeling?
      </h1>

      <ul className="mt-3 flex flex-wrap gap-2">
        {NEED_OPTIONS.map((option) => {
          const active = option.id === need;
          return (
            <li key={option.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => chooseNeed(option.id)}
                className={[
                  "min-h-11 rounded-full px-4 text-sm font-semibold transition-colors",
                  active
                    ? "bg-ink text-paper"
                    : "bg-white text-ink/60 shadow-[0_2px_0_rgba(28,25,23,0.06)]",
                ].join(" ")}
              >
                {option.chip}
              </button>
            </li>
          );
        })}
      </ul>

      <section className="mt-5 rounded-[26px] bg-white px-5 py-5 shadow-[0_5px_0_rgba(28,25,23,0.07)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-coral">
          Recommended now
        </p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-[1.35rem] font-semibold leading-tight text-ink">
              {program.name}
            </h2>
            <p className="mt-1 text-sm font-semibold text-ink/50">
              {program.durationMin} min · {program.steps.length} moves
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">{reason}</p>
          </div>
          <CharacterArt pose="idle" setup={setup} size={92} alt="" />
        </div>
        <div className="mt-4">
          <Button onClick={start}>Start</Button>
        </div>
      </section>

      {pro && plan ? (
        <section className="mt-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold text-ink">
              Today&apos;s DeskBreaks
            </h2>
            <Link href="/app/plan" className="text-sm font-semibold text-coral">
              Edit plan
            </Link>
          </div>
          <ul className="mt-3 grid gap-2">
            {plan.breaks.map((entry) => {
              const done = entry.status === "done";
              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-[0_2px_0_rgba(28,25,23,0.06)]"
                >
                  <span className="text-sm font-semibold tabular-nums text-ink">
                    {formatMinutes(entry.minutes)}
                  </span>
                  <span className="text-sm text-ink/55">
                    {entry.durationMin} min
                  </span>
                  <span
                    className={done ? "text-mint" : "text-ink/25"}
                    aria-label={done ? "Done" : "Not done yet"}
                  >
                    {done ? "✓" : "○"}
                  </span>
                </li>
              );
            })}
          </ul>
          {progress ? (
            <p className="mt-2 text-sm text-ink/55">
              {progress.done} of {progress.total} done
            </p>
          ) : null}
        </section>
      ) : null}

      {pro && !plan ? (
        <Link
          href="/app/plan"
          className="mt-5 block rounded-[22px] bg-ink px-5 py-4 text-paper"
        >
          <p className="font-display text-base font-semibold">
            Build your workday plan
          </p>
          <p className="mt-1 text-sm text-paper/70">
            Tell us your hours and DeskBreak schedules the rest.
          </p>
        </Link>
      ) : null}

      {!pro ? (
        <Link
          href="/app/pro?from=home_plan_teaser"
          className="mt-5 block rounded-[22px] border-2 border-ink/10 px-5 py-4"
        >
          <p className="font-display text-base font-semibold text-ink">
            Want DeskBreak to plan your day?
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink/60">
            Pro schedules the right breaks around your workday.
          </p>
          <p className="mt-2 text-sm font-semibold text-coral">See Pro &rarr;</p>
        </Link>
      ) : null}

      <section className="mt-6">
        <h2 className="font-display text-lg font-semibold text-ink">
          More resets
        </h2>
        <ul className="mt-3 grid gap-2">
          {merchandised.map((entry) => {
            const locked = entry.access === "pro" && !pro;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (locked) {
                      track("locked_program_clicked", {
                        program_id: entry.id,
                        need: entry.primaryNeed,
                      });
                      router.push(
                        `/app/pro?from=locked_routine&program=${entry.id}&need=${entry.primaryNeed}`,
                      );
                      return;
                    }
                    router.push(
                      `/app/workout/${entry.id}?need=${entry.primaryNeed}&setup=${setup}`,
                    );
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-[0_2px_0_rgba(28,25,23,0.06)] transition-transform duration-200 active:translate-y-[2px] active:shadow-none"
                >
                  <span className="min-w-0">
                    <span className="block font-display text-base font-semibold text-ink">
                      {entry.name}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink/55">
                      {entry.durationMin} min · {entry.tagline}
                    </span>
                  </span>
                  <span
                    className={[
                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]",
                      locked ? "bg-ink text-paper" : "bg-mint/25 text-ink/70",
                    ].join(" ")}
                  >
                    {locked ? "Pro" : "Free"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
