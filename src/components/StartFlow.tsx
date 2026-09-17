"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CharacterArt } from "@/components/CharacterArt";
import { track, recommendationProperties } from "@/lib/analytics";
import { DEFAULT_DURATION } from "@/lib/constants";
import { getProgram } from "@/lib/content";
import { canAccessDuration, isProEntitlement, isProgramLocked } from "@/lib/entitlements";
import { localRecommendation, storeRecommendation, workoutHref } from "@/lib/recommend-client";
import { getAppState, setPreferredSetup, setPrimaryNeed } from "@/lib/storage";
import {
  isDurationMinutes,
  isPrimaryNeed,
  isSetupRequest,
  type DurationMinutes,
  type PrimaryNeed,
  type SessionSource,
  type SetupRequest,
} from "@/lib/types";

const SOURCES: SessionSource[] = ["today", "targeted", "explore", "planned_break", "push", "seo", "landing", "resume"];

/**
 * The way into a workout from anywhere outside Today.
 *
 * No questions. It reads what the link already knows (a need, a length, a
 * position, where it came from), asks the engine, and starts the reset. A
 * first-time visitor from a search result is moving within a second.
 */
export function StartFlow() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const state = getAppState();
    const pro = isProEntitlement(state.entitlement);

    const needParam = params.get("need");
    const need: PrimaryNeed = isPrimaryNeed(needParam) ? needParam : "general";
    const minutesParam = Number(params.get("minutes"));
    const durationMinutes: DurationMinutes = isDurationMinutes(minutesParam)
      ? minutesParam
      : (state.preferredDuration ?? DEFAULT_DURATION);
    const setupParam = params.get("setup");
    const setup: SetupRequest = isSetupRequest(setupParam)
      ? setupParam
      : (state.preferredSetup ?? "either");
    const sourceParam = params.get("source");
    const source: SessionSource = SOURCES.includes(sourceParam as SessionSource)
      ? (sourceParam as SessionSource)
      : "landing";
    const plannedBreakId = params.get("break");
    const programParam = params.get("program");

    if (isPrimaryNeed(needParam) && needParam !== "general") {
      setPrimaryNeed(needParam);
      track("need_selected", { need: needParam, source });
    }
    if (setupParam === "seated" || setupParam === "standing") setPreferredSetup(setupParam);

    // A specific authored routine (Explore "Do now", a reminder deep link).
    if (programParam) {
      const program = getProgram(programParam);
      if (program) {
        if (isProgramLocked(program, state.entitlement)) {
          track("locked_program_clicked", { program_id: program.id, need: program.primaryNeed, source });
          router.replace(`/app/pro?from=locked&program=${program.id}&need=${program.primaryNeed}`);
          return;
        }
        const query = new URLSearchParams({ need: program.primaryNeed, setup, source });
        if (plannedBreakId) query.set("break", plannedBreakId);
        router.replace(`/app/workout/${program.id}?${query.toString()}`);
        return;
      }
    }

    if (!canAccessDuration(durationMinutes, state.entitlement)) {
      track("locked_program_clicked", { duration: durationMinutes, need, source });
      router.replace(`/app/pro?from=duration&minutes=${durationMinutes}&need=${need}`);
      return;
    }

    const recommendation = storeRecommendation(
      localRecommendation({ need, durationMinutes, setup }),
      "client",
    );
    track("recommendation_started", {
      ...recommendationProperties({
        recommendationId: recommendation.id,
        algorithmVersion: recommendation.algorithmVersion,
        need,
        duration: recommendation.recommendedDuration,
        setup,
        programId: recommendation.programId,
        source,
        generated: !recommendation.authored,
      }),
      pro,
    });
    if (source === "seo") track("seo_workout_started", { need, duration: durationMinutes });
    router.replace(workoutHref(recommendation, { source, plannedBreakId }));
  }, [params, router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-5" role="status">
      <CharacterArt pose="ready" size={150} alt="Stretch, ready to go" />
      <p className="text-sm font-semibold text-ink/50">Building your reset...</p>
    </div>
  );
}
