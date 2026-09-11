"use client";

import { isProEntitlement } from "./entitlements";
import {
  ALGORITHM_VERSION,
  recommend,
  timeOfDayNow,
  toStoredRecommendation,
  type Recommendation,
} from "./recommendation";
import {
  ensureAnonymousId,
  getAppState,
  personalizationSignals,
  rememberRecommendation,
  todayKey,
} from "./storage";
import type {
  DurationMinutes,
  PrimaryNeed,
  SessionSource,
  SetupRequest,
  StoredRecommendation,
} from "./types";

/**
 * How the client gets a recommendation.
 *
 * The local engine answers instantly from local history, so Today never waits
 * on a network round trip and a workout can start offline. When the server is
 * reachable it answers with the same engine fed by the server's fuller picture
 * (other devices, the full session table); that answer replaces the local one
 * if it arrives before the user presses Start.
 */
export type RecommendationRequest = {
  need: PrimaryNeed;
  durationMinutes: DurationMinutes;
  setup: SetupRequest;
};

export function localRecommendation(request: RecommendationRequest): Recommendation {
  const state = getAppState();
  return recommend({
    ...request,
    pro: isProEntitlement(state.entitlement),
    constraints: state.constraints,
    signals: personalizationSignals(state),
    timeOfDay: timeOfDayNow(),
    seed: todayKey(),
  });
}

export function storeRecommendation(
  recommendation: Recommendation,
  source: "client" | "server",
): StoredRecommendation {
  const stored = toStoredRecommendation(recommendation, source);
  rememberRecommendation(stored);
  return stored;
}

type ServerResponse = {
  recommendationId: string;
  algorithmVersion: string;
  reason: string;
  personalized: boolean;
  authored: boolean;
  program: {
    id: string;
    name: string;
    shortLabel: string;
    durationMinutes: DurationMinutes;
    steps: { exerciseId: string; durationSec: number; phase?: StoredRecommendation["steps"][number]["phase"] }[];
  };
};

export async function serverRecommendation(
  request: RecommendationRequest,
  signal?: AbortSignal,
): Promise<StoredRecommendation | null> {
  if (typeof window === "undefined" || !navigator.onLine) return null;
  const state = getAppState();
  try {
    const response = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        need: request.need,
        durationMinutes: request.durationMinutes,
        setup: request.setup,
        anonymousId: ensureAnonymousId(),
        timeOfDay: timeOfDayNow(),
        seed: todayKey(),
        constraints: state.constraints,
        // The server merges these with what it already knows.
        signals: personalizationSignals(state),
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as ServerResponse;
    if (!data?.recommendationId || !data.program?.steps?.length) return null;
    const stored: StoredRecommendation = {
      id: data.recommendationId,
      algorithmVersion: data.algorithmVersion ?? ALGORITHM_VERSION,
      need: request.need,
      setup: request.setup,
      requestedDuration: request.durationMinutes,
      recommendedDuration: data.program.durationMinutes,
      timeOfDay: timeOfDayNow(),
      reason: data.reason,
      personalized: Boolean(data.personalized),
      programId: data.program.id,
      programName: data.program.name,
      programShortLabel: data.program.shortLabel,
      exerciseIds: data.program.steps.map((step) => step.exerciseId),
      steps: data.program.steps,
      authored: Boolean(data.authored),
      createdAt: new Date().toISOString(),
      source: "server",
    };
    rememberRecommendation(stored);
    return stored;
  } catch {
    return null;
  }
}

/** The URL that runs a stored recommendation. */
export function workoutHref(
  stored: StoredRecommendation,
  options: { source?: SessionSource; plannedBreakId?: string | null } = {},
): string {
  const params = new URLSearchParams({
    need: stored.need,
    setup: stored.setup,
    rec: stored.id,
  });
  if (options.source) params.set("source", options.source);
  if (options.plannedBreakId) params.set("break", options.plannedBreakId);
  return `/app/workout/${stored.programId}?${params.toString()}`;
}
