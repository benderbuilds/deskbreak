"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  cacheEntitlement,
  ensureAnonymousId,
  getAppState,
  getServerAppState,
  subscribeAppState,
} from "./storage";
import { fetchEntitlement, isProEntitlement, toEntitlement } from "./entitlements";
import type { AppState } from "./types";

export function useAppState(): AppState {
  return useSyncExternalStore(subscribeAppState, getAppState, getServerAppState);
}

export function useIsPro(): boolean {
  return isProEntitlement(useAppState().entitlement);
}

/**
 * Reconciles the cached entitlement with the server once per mount.
 *
 * Mounted high in the app so Pro survives a refresh and a second device, and so
 * a cancellation actually takes effect without the user clearing storage.
 */
export function useEntitlementSync(sessionId?: string | null): void {
  const state = useAppState();
  const email = state.email;
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current && !sessionId) return;
    checked.current = true;

    let cancelled = false;
    const anonymousId = ensureAnonymousId();

    void (async () => {
      const response = await fetchEntitlement({ anonymousId, email, sessionId });
      if (cancelled || !response) return;
      cacheEntitlement(toEntitlement(response));
    })();

    return () => {
      cancelled = true;
    };
  }, [email, sessionId]);
}
