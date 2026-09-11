"use client";

import { getAppState, patchAppState } from "./storage";
import { isProEntitlement } from "./entitlements";

/**
 * The only place the app talks to PostHog.
 *
 * Components call `track("recommendation_started", {...})`. If PostHog is not
 * configured (local dev, a preview build, an ad blocker) events queue briefly
 * and then drop silently: analytics must never block or break a reset.
 */
export type AnalyticsEvent =
  // Landing and acquisition
  | "landing_viewed"
  | "seo_landing_viewed"
  | "seo_workout_started"
  | "primary_cta_clicked"
  | "need_selected"
  | "setup_selected"
  // Recommendation loop
  | "recommendation_viewed"
  | "recommendation_started"
  | "recommendation_changed"
  | "recommendation_completed"
  | "exercise_started"
  | "exercise_completed"
  | "exercise_skipped"
  | "exercise_swapped"
  | "exercise_uncomfortable"
  | "session_feedback_submitted"
  | "session_abandoned"
  | "session_resumed"
  // Planner and reminders
  | "workday_plan_created"
  | "planned_break_created"
  | "planned_break_started"
  | "planned_break_completed"
  | "planned_break_snoozed"
  | "planned_break_skipped"
  | "reminder_created"
  | "reminder_clicked"
  | "push_subscribed"
  | "push_unsubscribed"
  | "push_delivered"
  | "push_opened"
  // Account and sync
  | "email_prompt_viewed"
  | "email_submitted"
  | "email_skipped"
  | "account_started"
  | "account_created"
  | "account_signed_out"
  | "history_synced"
  // Monetization
  | "paywall_viewed"
  | "pricing_period_selected"
  | "checkout_started"
  | "checkout_completed"
  | "checkout_failed"
  | "free_continued"
  | "locked_program_clicked"
  | "subscription_started"
  | "subscription_cancelled"
  | "billing_portal_opened"
  // Progress and retention
  | "progress_viewed"
  | "favorite_added"
  | "favorite_removed"
  | "install_prompt_viewed"
  | "install_accepted"
  | "day_1_return"
  | "third_reset_completed"
  | "challenge_started"
  | "challenge_completed"
  | "constraints_updated"
  | "app_error"
  // Older names, still emitted for existing dashboards.
  | "reset_started"
  | "reset_completed"
  | "reset_feedback_submitted"
  | "reset_snoozed"
  | "reset_skipped";

export type EventProperties = Record<string, string | number | boolean | null | undefined>;

type PostHogLike = {
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (id: string, properties?: Record<string, unknown>) => void;
  register: (properties: Record<string, unknown>) => void;
  init?: (key: string, config: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    posthog?: PostHogLike;
  }
}

const QUEUE_LIMIT = 40;
const queue: Array<{ event: string; properties: Record<string, unknown> }> = [];
let ready = false;

function client(): PostHogLike | null {
  if (typeof window === "undefined") return null;
  const ph = window.posthog;
  return ph && typeof ph.capture === "function" ? ph : null;
}

/** Called once PostHog's snippet has loaded, to drain anything captured early. */
export function flushAnalytics(): void {
  const ph = client();
  if (!ph) return;
  ready = true;
  while (queue.length) {
    const item = queue.shift();
    if (item) ph.capture(item.event, item.properties);
  }
}

/** Properties every event carries, so any funnel can be cut by plan or need. */
function baseProperties(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  const state = getAppState();
  return {
    plan: isProEntitlement(state.entitlement) ? "pro" : "free",
    identity: state.account.profileId ? "authenticated" : "anonymous",
    primary_need: state.primaryNeed ?? undefined,
    setup: state.preferredSetup ?? "either",
    preferred_duration: state.preferredDuration ?? undefined,
    total_resets: state.progress.totalWorkouts,
    utm_source: state.attribution.firstUtmSource ?? undefined,
    utm_medium: state.attribution.firstUtmMedium ?? undefined,
    utm_campaign: state.attribution.firstUtmCampaign ?? undefined,
    utm_content: state.attribution.firstUtmContent ?? undefined,
  };
}

export function track(event: AnalyticsEvent, properties: EventProperties = {}): void {
  if (typeof window === "undefined") return;
  const payload = { ...baseProperties(), ...properties };
  const ph = client();
  if (ph) {
    ready = true;
    ph.capture(event, payload);
    return;
  }
  if (queue.length < QUEUE_LIMIT) queue.push({ event, properties: payload });
}

export function identify(id: string, properties: EventProperties = {}): void {
  const ph = client();
  if (!ph) return;
  ph.identify(id, properties);
}

export function analyticsReady(): boolean {
  return ready;
}

/** The properties every recommendation-level event should carry. */
export function recommendationProperties(input: {
  recommendationId?: string | null;
  algorithmVersion?: string | null;
  need: string;
  duration: number;
  setup: string;
  programId: string;
  source?: string | null;
  generated?: boolean;
}): EventProperties {
  return {
    recommendation_id: input.recommendationId ?? undefined,
    algorithm_version: input.algorithmVersion ?? undefined,
    body_need: input.need,
    duration: input.duration,
    setup: input.setup,
    program_id: input.programId,
    source: input.source ?? undefined,
    routine_kind: input.generated ? "generated" : "authored",
  };
}

/**
 * Records where this visitor came from.
 *
 * First touch is written once and never overwritten, because that is the number
 * a channel experiment is judged on. Latest touch is tracked separately.
 */
export function captureAttribution(pathname: string, search: string): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(search);
  const source = params.get("utm_source");
  const medium = params.get("utm_medium");
  const campaign = params.get("utm_campaign");
  const content = params.get("utm_content");

  const existing = getAppState().attribution;
  const isFirstTouch = !existing.firstSeenAt;
  if (!isFirstTouch && !source) return;

  patchAppState((state) => ({
    ...state,
    attribution: {
      ...state.attribution,
      firstUtmSource: isFirstTouch ? source : state.attribution.firstUtmSource,
      firstUtmMedium: isFirstTouch ? medium : state.attribution.firstUtmMedium,
      firstUtmCampaign: isFirstTouch ? campaign : state.attribution.firstUtmCampaign,
      firstUtmContent: isFirstTouch ? content : state.attribution.firstUtmContent,
      firstLandingPath: isFirstTouch ? pathname : state.attribution.firstLandingPath,
      firstSeenAt: isFirstTouch ? new Date().toISOString() : state.attribution.firstSeenAt,
      latestUtmSource: source ?? state.attribution.latestUtmSource,
      latestUtmMedium: medium ?? state.attribution.latestUtmMedium,
      latestUtmCampaign: campaign ?? state.attribution.latestUtmCampaign,
      latestUtmContent: content ?? state.attribution.latestUtmContent,
    },
  }));
}
