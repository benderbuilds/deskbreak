"use client";

import { track } from "./analytics";
import {
  clearAccount,
  ensureAnonymousId,
  getAppState,
  mergeRemoteHistory,
  normalizeSession,
  setAccount,
  setConstraints,
} from "./storage";
import type { FunctionalConstraint, WorkoutSession } from "./types";

/**
 * The client side of "Save my progress".
 *
 * Sign-in is a magic link. Once the cookie is set, the server owns the truth
 * and this module keeps local state in step: it pulls history down, pushes
 * preferences up, and merges the anonymous browser into the account.
 */
type MeResponse = {
  signedIn: boolean;
  profile?: {
    id: string;
    email: string | null;
    constraints?: string[];
    favorites?: string[];
    preferredDuration?: number | null;
    preferredSetup?: string | null;
    reminderFrequency?: string | null;
  };
  sessions?: Array<Record<string, unknown>>;
};

export type AccountError =
  | "invalid_email"
  | "auth_not_configured"
  | "store_not_configured"
  | "email_not_configured"
  | "send_failed"
  | "rate_limited"
  | "network"
  | "unavailable";

/** What to tell the person when a sign-in link could not be sent. */
export function describeAccountError(error: string): string {
  switch (error) {
    case "invalid_email":
      return "That doesn't look like an email address.";
    case "auth_not_configured":
      return "Sign-in isn't set up on this deployment yet.";
    case "store_not_configured":
      return "Accounts aren't available on this deployment yet: nothing would be saved.";
    case "email_not_configured":
      return "Email delivery isn't set up on this deployment, so we can't send a sign-in link.";
    case "send_failed":
      return "We couldn't send that email just now. Try again shortly.";
    case "rate_limited":
      return "We sent a link to that address recently. Check your inbox and spam folder, or try again in a few minutes.";
    case "network":
      return "You look offline. Try again when you're connected.";
    default:
      return "We couldn't send that just now. Try again shortly.";
  }
}

export async function requestMagicLink(email: string, options: { next?: string } = {}): Promise<
  { ok: true; delivered: boolean; devLink?: string } | { ok: false; error: AccountError }
> {
  const state = getAppState();
  try {
    const response = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        anonymousId: ensureAnonymousId(),
        next: options.next ?? "/app",
        primaryNeed: state.primaryNeed,
        preferredSetup: state.preferredSetup,
        preferredDuration: state.preferredDuration,
        constraints: state.constraints,
        attribution: {
          source: state.attribution.firstUtmSource,
          medium: state.attribution.firstUtmMedium,
          campaign: state.attribution.firstUtmCampaign,
          content: state.attribution.firstUtmContent,
          landingPath: state.attribution.firstLandingPath,
        },
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      delivered?: boolean;
      devLink?: string;
      error?: string;
    };
    if (!response.ok || !data.ok) return { ok: false, error: (data.error as AccountError) ?? "unavailable" };
    track("account_started", { channel: "magic_link" });
    return { ok: true, delivered: Boolean(data.delivered), devLink: data.devLink };
  } catch {
    return { ok: false, error: "network" };
  }
}

function toSession(row: Record<string, unknown>): WorkoutSession | null {
  if (typeof row.sessionId !== "string" || typeof row.finishedAt !== "string") return null;
  try {
    return normalizeSession(row as Parameters<typeof normalizeSession>[0]);
  } catch {
    return null;
  }
}

/** Asks the server who this browser is, and reconciles. Safe to call often. */
export async function syncAccount(): Promise<boolean> {
  if (typeof window === "undefined" || !navigator.onLine) return false;
  try {
    // The anonymous id lets the server fold this browser's earlier, ownerless
    // history into the account. It cannot reach anything another account owns.
    const response = await fetch(`/api/auth/me?anonymousId=${encodeURIComponent(ensureAnonymousId())}`, {
      cache: "no-store",
    });
    if (!response.ok) return false;
    const data = (await response.json()) as MeResponse;
    if (!data.signedIn || !data.profile) {
      if (getAppState().account.profileId) clearAccount();
      return false;
    }
    const wasSignedIn = Boolean(getAppState().account.profileId);
    setAccount({
      profileId: data.profile.id,
      email: data.profile.email,
      signedInAt: getAppState().account.signedInAt ?? new Date().toISOString(),
    });
    if (!wasSignedIn) track("account_created", { channel: "magic_link" });

    const sessions = (data.sessions ?? [])
      .map(toSession)
      .filter((entry): entry is WorkoutSession => entry !== null);
    const added = mergeRemoteHistory(sessions);
    if (added) track("history_synced", { added });

    if (data.profile.constraints?.length && !getAppState().constraints.length) {
      setConstraints(data.profile.constraints as FunctionalConstraint[]);
    }
    // Push what this browser knows that the server may not.
    void pushPreferences();
    return true;
  } catch {
    return false;
  }
}

export async function pushPreferences(): Promise<void> {
  const state = getAppState();
  if (!state.account.profileId) return;
  const daily = state.settings.reminders.find((entry) => entry.kind === "daily");
  try {
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anonymousId: ensureAnonymousId(),
        primaryNeed: state.primaryNeed,
        preferredSetup: state.preferredSetup,
        preferredDuration: state.preferredDuration,
        constraints: state.constraints,
        favorites: state.favorites,
        notificationLevel: state.plan?.preferences.level ?? null,
        reminderFrequency: daily?.enabled ? "daily" : "off",
        workday: state.plan?.preferences ?? null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
      }),
    });
  } catch {
    /* preferences are re-pushed on the next sync */
  }
}

export async function signOut(): Promise<void> {
  try {
    await fetch("/api/auth/signout", { method: "POST" });
  } catch {
    /* the cookie will expire on its own */
  }
  clearAccount();
  track("account_signed_out");
}
