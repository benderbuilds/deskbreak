"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CharacterArt } from "@/components/CharacterArt";
import { track } from "@/lib/analytics";
import { NEED_OPTIONS } from "@/lib/constants";
import { getExercise } from "@/lib/content";
import {
  getRecommendedProgram,
  needLabel,
  timeOfDayNow,
} from "@/lib/recommendation";
import {
  getAppState,
  recentExerciseIds,
  setPreferredSetup,
  setPrimaryNeed,
} from "@/lib/storage";
import { isProEntitlement } from "@/lib/entitlements";
import { isPrimaryNeed, type PrimaryNeed, type SetupId } from "@/lib/types";

/**
 * Replaces the old multi-screen onboarding.
 *
 * One question, always. A second only when the recommended routine actually
 * needs the user on their feet. Nothing is configured, nothing is created, and
 * the reset starts the moment we know enough to pick the right one.
 */
export function StartFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const presetNeed = params.get("need");
  const presetDuration = Number(params.get("minutes"));

  const [need, setNeed] = useState<PrimaryNeed | null>(
    isPrimaryNeed(presetNeed) ? presetNeed : null,
  );

  const durationMinutes = ([2, 3, 4, 5, 10] as const).includes(
    presetDuration as 2 | 3 | 4 | 5 | 10,
  )
    ? (presetDuration as 2 | 3 | 4 | 5 | 10)
    : 2;

  useEffect(() => {
    if (isPrimaryNeed(presetNeed)) {
      setPrimaryNeed(presetNeed);
      track("need_selected", { need: presetNeed, source: "preselected" });
    }
  }, [presetNeed]);

  /**
   * Whether we have to ask about standing.
   *
   * Only asked when the standing version of this reset would genuinely differ.
   * If the user already told us how they work, we use that and skip the screen.
   */
  const standingCheck = useMemo(() => {
    if (!need) return { required: false, program: null };
    const state = getAppState();
    const pro = isProEntitlement(state.entitlement);
    const seated = getRecommendedProgram({
      need,
      setup: "seated",
      durationMinutes,
      pro,
      recentExerciseIds: recentExerciseIds(),
      timeOfDay: timeOfDayNow(),
    });
    const standing = getRecommendedProgram({
      need,
      setup: "standing",
      durationMinutes,
      pro,
      recentExerciseIds: recentExerciseIds(),
      timeOfDay: timeOfDayNow(),
    });
    const standingOnly = standing.program.steps.some((step) => {
      const exercise = getExercise(step.exerciseId);
      return exercise?.setup === "standing";
    });
    return {
      required: standingOnly,
      program: seated.program,
      standingProgram: standing.program,
    };
  }, [need, durationMinutes]);

  const [askedStanding, setAskedStanding] = useState(false);

  function chooseNeed(value: PrimaryNeed) {
    setPrimaryNeed(value);
    track("need_selected", { need: value, source: "start" });
    setNeed(value);
  }

  function begin(setup: SetupId, source: "answered" | "remembered") {
    if (!need) return;
    setPreferredSetup(setup);
    track("setup_selected", { setup, need, source });
    const { program } = getRecommendedProgram({
      need,
      setup,
      durationMinutes,
      pro: isProEntitlement(getAppState().entitlement),
      recentExerciseIds: recentExerciseIds(),
      timeOfDay: timeOfDayNow(),
    });
    router.push(`/app/workout/${program.id}?need=${need}&setup=${setup}`);
  }

  // Nothing left to ask: go.
  useEffect(() => {
    if (!need || askedStanding) return;
    if (standingCheck.required) return;
    const remembered = getAppState().preferredSetup ?? "seated";
    begin(remembered, "remembered");
    // begin() navigates away; re-running would be harmless but pointless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [need, askedStanding, standingCheck.required]);

  if (!need) {
    return (
      <div className="flex min-h-dvh flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
        <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight text-ink">
          What needs attention right now?
        </h1>
        <ul className="mt-6 grid gap-3">
          {NEED_OPTIONS.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => chooseNeed(option.id)}
                className="flex min-h-[4.5rem] w-full flex-col justify-center rounded-[22px] bg-white px-5 py-3 text-left shadow-[0_4px_0_rgba(28,25,23,0.06)] transition-transform duration-200 ease-[cubic-bezier(0.34,1.4,0.64,1)] active:translate-y-[3px] active:shadow-none"
              >
                <span className="font-display text-lg font-semibold text-ink">
                  {option.label}
                </span>
                <span className="text-sm text-ink/60">{option.blurb}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (standingCheck.required && !askedStanding) {
    return (
      <div className="flex min-h-dvh flex-col justify-center px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mb-6 flex justify-center">
          <CharacterArt pose="ready" size={180} alt="Stretch, ready to go" />
        </div>
        <h1 className="text-center font-display text-[2rem] font-semibold leading-tight tracking-tight text-ink">
          Can you stand right now?
        </h1>
        <p className="mt-3 text-center text-ink/60">
          Your {needLabel(need).toLowerCase()} reset works either way.
        </p>
        <div className="mt-8 grid gap-3">
          <button
            type="button"
            onClick={() => {
              setAskedStanding(true);
              begin("standing", "answered");
            }}
            className="min-h-14 rounded-[22px] bg-coral text-base font-semibold text-white shadow-[0_5px_0_#E04420] transition-transform duration-200 active:translate-y-[5px] active:shadow-none"
          >
            Yep
          </button>
          <button
            type="button"
            onClick={() => {
              setAskedStanding(true);
              begin("seated", "answered");
            }}
            className="min-h-14 rounded-[22px] border-2 border-ink/12 text-base font-semibold text-ink active:bg-ink/5"
          >
            Keep me seated
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-5" role="status">
      <CharacterArt pose="ready" size={150} alt="Stretch, ready to go" />
      <p className="text-sm font-semibold text-ink/50">Building your reset...</p>
    </div>
  );
}
