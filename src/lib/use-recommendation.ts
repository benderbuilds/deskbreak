"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { track, recommendationProperties } from "./analytics";
import {
  localRecommendation,
  serverRecommendation,
  type RecommendationRequest,
} from "./recommend-client";
import { toStoredRecommendation } from "./recommendation";
import { rememberRecommendation } from "./storage";
import type { StoredRecommendation } from "./types";

/**
 * The recommendation the Today screen shows.
 *
 * Local first, instantly. Then the server's answer, if it arrives and differs,
 * because it has seen more of this person than one browser has. Once the user
 * presses Start the answer is frozen: nobody wants the routine to change under
 * their thumb.
 */
export function useRecommendation(
  request: RecommendationRequest,
  options: { enabled?: boolean; source?: string; historyVersion?: number } = {},
): StoredRecommendation | null {
  const enabled = options.enabled ?? true;
  const key = `${request.need}|${request.durationMinutes}|${request.setup}|${options.historyVersion ?? 0}`;
  const [remote, setRemote] = useState<{ key: string; stored: StoredRecommendation } | null>(null);
  const viewedRef = useRef<string | null>(null);

  // Pure computation; nothing is written until the effect below.
  const local = useMemo(() => {
    if (!enabled) return null;
    return toStoredRecommendation(localRecommendation(request), "client");
    // The request object is rebuilt each render; key captures what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  useEffect(() => {
    if (!local || !enabled) return;
    rememberRecommendation(local);
    const controller = new AbortController();
    void serverRecommendation(request, controller.signal).then((stored) => {
      if (stored && !controller.signal.aborted) setRemote({ key, stored });
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, enabled]);

  const stored = remote?.key === key ? remote.stored : local;

  useEffect(() => {
    if (!stored || viewedRef.current === stored.id) return;
    viewedRef.current = stored.id;
    track("recommendation_viewed", {
      ...recommendationProperties({
        recommendationId: stored.id,
        algorithmVersion: stored.algorithmVersion,
        need: stored.need,
        duration: stored.recommendedDuration,
        setup: stored.setup,
        programId: stored.programId,
        source: options.source ?? "today",
        generated: !stored.authored,
      }),
      personalized: stored.personalized,
      origin: stored.source,
    });
  }, [stored, options.source]);

  return stored;
}
