"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Chip } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { LogoMark } from "@/components/LogoMark";
import { ProBadge } from "@/components/ProBadge";
import { TodayTimeline } from "@/components/TodayTimeline";
import { WeekSummary } from "@/components/WeekSummary";
import { track, recommendationProperties } from "@/lib/analytics";
import { areaLine } from "@/lib/body-areas";
import {
  DEFAULT_DURATION,
  DURATION_OPTIONS,
  SETUP_COPY,
  TARGETED_OPTIONS,
} from "@/lib/constants";
import { getExercise } from "@/lib/content";
import { canAccessDuration, isProEntitlement } from "@/lib/entitlements";
import { greetingForHour } from "@/lib/format";
import { workoutHref } from "@/lib/recommend-client";
import { preferredDurationFrom } from "@/lib/personalization";
import {
  getAppState,
  personalizationSignals,
  setPreferredDuration,
  setPreferredSetup,
  setPrimaryNeed,
} from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import { useRecommendation } from "@/lib/use-recommendation";
import type { DurationMinutes, PrimaryNeed, SetupRequest } from "@/lib/types";

/**
 * Today: tell me what to do now.
 *
 * One recommended reset, one Start button. Targeted resets are overrides on
 * the same card, not a question that has to be answered first.
 */
export function TodayView() {
  const router = useRouter();
  const isClient = useIsClient();
  const state = useAppState();
  const pro = isProEntitlement(state.entitlement);

  // A first visit that arrived with a need picked on the landing page keeps it.
  const [need, setNeed] = useState<PrimaryNeed>(() => {
    const initial = getAppState();
    return initial.primaryNeed && initial.primaryNeed !== "general" && initial.progress.totalWorkouts === 0
      ? initial.primaryNeed
      : "general";
  });
  const [changing, setChanging] = useState(false);

  // The duration a person actually does wins over the product default, once
  // they have shown a clear pattern.
  const signals = useMemo(() => (isClient ? personalizationSignals(state) : null), [isClient, state]);
  const learnedDuration = signals ? preferredDurationFrom(signals) : null;
  const duration: DurationMinutes =
    state.preferredDuration ??
    (learnedDuration && canAccessDuration(learnedDuration, state.entitlement)
      ? learnedDuration
      : DEFAULT_DURATION);
  const setup: SetupRequest = state.preferredSetup ?? "either";

  const recommendation = useRecommendation(
    { need, durationMinutes: duration, setup },
    { enabled: isClient, source: need === "general" ? "today" : "targeted", historyVersion: state.progress.totalWorkouts },
  );

  if (!isClient) return null;

  const areas = recommendation
    ? areaLine(recommendation.exerciseIds.flatMap((id) => getExercise(id)?.bodyAreas ?? []))
    : "";

  function start() {
    if (!recommendation) return;
    track("recommendation_started", {
      ...recommendationProperties({
        recommendationId: recommendation.id,
        algorithmVersion: recommendation.algorithmVersion,
        need: recommendation.need,
        duration: recommendation.recommendedDuration,
        setup: recommendation.setup,
        programId: recommendation.programId,
        source: need === "general" ? "today" : "targeted",
        generated: !recommendation.authored,
      }),
    });
    router.push(workoutHref(recommendation, { source: need === "general" ? "today" : "targeted" }));
  }

  function chooseNeed(next: PrimaryNeed) {
    const value = need === next ? "general" : next;
    setNeed(value);
    if (value !== "general") setPrimaryNeed(value);
    track("need_selected", { need: value, source: "today" });
    track("recommendation_changed", { change: "need", value });
  }

  function chooseDuration(minutes: DurationMinutes) {
    if (!canAccessDuration(minutes, state.entitlement)) {
      track("locked_program_clicked", { duration: minutes, source: "today_change" });
      router.push(`/app/pro?from=duration&minutes=${minutes}`);
      return;
    }
    setPreferredDuration(minutes);
    track("recommendation_changed", { change: "duration", value: minutes });
  }

  function chooseSetup(value: SetupRequest) {
    setPreferredSetup(value === "either" ? null : value);
    track("recommendation_changed", { change: "setup", value });
  }

  const hour = new Date().getHours();
  const name = state.account.email ? state.account.email.split("@")[0] : null;
  const title = need === "general" ? "Your Desk Reset" : `${TARGETED_OPTIONS.find((o) => o.id === need)?.label ?? "Desk"} Reset`;
  const subline =
    recommendation?.personalized ? recommendation.reason : recommendation?.programShortLabel === "Quick Reset" ? "A fast, balanced reset." : "Full-body movement for your workday.";

  return (
    <div className="flex flex-1 flex-col px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] lg:px-0">
      <header className="flex min-h-8 items-center justify-between">
        <div className="flex items-center gap-2 lg:hidden">
          <LogoMark size={30} />
          <span className="font-display text-lg font-semibold tracking-tight">DeskBreak</span>
        </div>
        <span className="hidden lg:block" aria-hidden />
        {pro ? <ProBadge /> : null}
      </header>

      <div className="lg:grid lg:grid-cols-[3fr_2fr] lg:gap-10">
        <div>
          <p className="mt-5 text-sm font-semibold text-ink/50 lg:mt-2">
            {greetingForHour(hour)}
            {name ? `, ${name}` : ""}
          </p>
          <h1 className="mt-1 font-display text-[1.7rem] font-semibold leading-tight tracking-tight text-ink lg:text-[2.1rem]">
            {state.progress.totalWorkouts === 0 ? "Sitting all day? Do this." : "Time for a quick reset."}
          </h1>

          <section className="surface-elevated mt-5 px-5 py-5 lg:px-7 lg:py-7" aria-labelledby="reset-title">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-coral">
                  {recommendation?.personalized ? "Recommended for you" : "Recommended now"}
                </p>
                <h2 id="reset-title" className="mt-1.5 font-display text-[1.55rem] font-semibold leading-tight text-ink lg:text-[1.8rem]">
                  {title}
                </h2>
                <p className="mt-1 text-sm font-semibold text-ink/55">
                  {duration} minutes · {recommendation?.exerciseIds.length ?? 0} movements
                </p>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-ink/70">{subline}</p>
                {areas ? (
                  <p className="mt-2 text-sm text-ink/50">{areas}</p>
                ) : null}
                <p className="mt-2 text-xs text-ink/45">No equipment · Office-friendly</p>
              </div>
              <CharacterArt pose="ready" setup={setup === "standing" ? "standing" : "seated"} size={96} alt="" className="hidden sm:block" />
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button onClick={start} disabled={!recommendation} className="sm:flex-1">
                Start reset
              </Button>
              <Button
                variant="tertiary"
                block={false}
                onClick={() => setChanging((open) => !open)}
                aria-expanded={changing}
                aria-controls="change-reset"
              >
                Change
              </Button>
            </div>

            {changing ? (
              <div id="change-reset" className="animate-sheet-up mt-4 border-t border-ink/8 pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">Length</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DURATION_OPTIONS.map((option) => (
                    <Chip
                      key={option.minutes}
                      label={
                        <>
                          {option.label} {option.minutes} min
                          {option.pro && !pro ? <span className="text-[10px] uppercase tracking-wide text-ink/50">Pro</span> : null}
                        </>
                      }
                      active={duration === option.minutes}
                      onClick={() => chooseDuration(option.minutes)}
                    />
                  ))}
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">Position</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["either", "seated", "standing"] as SetupRequest[]).map((value) => (
                    <Chip
                      key={value}
                      label={SETUP_COPY[value].label}
                      active={setup === value}
                      onClick={() => chooseSetup(value)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="mt-6" aria-labelledby="specific">
            <h2 id="specific" className="text-sm font-semibold text-ink/60">
              Need something specific?
            </h2>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              {TARGETED_OPTIONS.map((option) => {
                const active = need === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => chooseNeed(option.id)}
                    className={[
                      "min-h-12 rounded-[14px] px-4 text-left text-sm font-semibold transition-colors duration-200",
                      active ? "bg-ink text-paper" : "surface text-ink hover:bg-ink/3",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="mt-8 lg:mt-2">
          <h2 className="font-display text-lg font-semibold text-ink">Today</h2>
          <TodayTimeline />
          <div className="mt-6">
            <WeekSummary compact />
          </div>
          {state.progress.totalWorkouts >= 1 && !state.challenge.startedOn ? (
            <Link
              href="/app/challenge"
              className="surface mt-6 block px-4 py-4 transition-colors hover:bg-ink/3"
            >
              <p className="font-display text-base font-semibold text-ink">Try the 5-Day Desk Reset</p>
              <p className="mt-1 text-sm leading-relaxed text-ink/60">
                See how a workweek of moving more feels.
              </p>
            </Link>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
