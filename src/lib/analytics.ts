"use client";

import { getAppState, patchAppState } from "./storage";

/**
 * The only place the app talks to PostHog.
 *
 * Components call `track("reset_started", {...})`. If PostHog is not configured
 * (local dev, a preview build, an ad blocker) events queue briefly and then drop
 * silently: analytics must never block or break a reset.
 */
export type AnalyticsEvent =
  | "landing_viewed"
  | "primary_cta_clicked"
  | "need_selected"
  | "setup_selected"
  | "reset_started"
  | "exercise_started"
  | "exercise_skipped"
  | "reset_completed"
  | "reset_feedback_submitted"
  | "email_prompt_viewed"
  | "email_submitted"
  | "email_skipped"
  | "paywall_viewed"
  | "pricing_period_selected"
  | "checkout_started"
  | "checkout_completed"
  | "checkout_failed"
  | "free_continued"
  | "locked_program_clicked"
  | "workday_plan_created"
  | "reminder_created"
  | "reminder_clicked"
  | "reset_snoozed"
  | "reset_skipped"
  | "day_1_return"
  | "third_reset_completed"
  | "challenge_started"
  | "challenge_completed"
  | "app_error";

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

function baseProperties(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  const state = getAppState();
  return {
    plan: state.entitlement.plan,
    primary_need: state.primaryNeed ?? undefined,
    setup: state.preferredSetup ?? undefined,
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
      firstSeenAt: isFirstTouch
        ? new Date().toISOString()
        : state.attribution.firstSeenAt,
      latestUtmSource: source ?? state.attribution.latestUtmSource,
      latestUtmMedium: medium ?? state.attribution.latestUtmMedium,
      latestUtmCampaign: campaign ?? state.attribution.latestUtmCampaign,
      latestUtmContent: content ?? state.attribution.latestUtmContent,
    },
  }));
}
