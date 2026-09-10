"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  captureAttribution,
  flushAnalytics,
  identify,
  track,
} from "@/lib/analytics";
import {
  ensureAnonymousId,
  getAppState,
  shiftDay,
  todayKey,
} from "@/lib/storage";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

/**
 * Loads PostHog after the page is interactive and records the two things that
 * only the client knows: where the visitor came from, and whether they came back.
 */
export function AnalyticsProvider() {
  const pathname = usePathname();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    captureAttribution(pathname, window.location.search);
    identify(ensureAnonymousId());

    const state = getAppState();
    const last = state.progress.lastWorkoutDate;
    if (last && last === shiftDay(todayKey(), -1)) {
      track("day_1_return", { total_resets: state.progress.totalWorkouts });
    }
  }, [pathname]);

  if (!POSTHOG_KEY) return null;

  return (
    <Script
      id="deskbreak-posthog"
      strategy="afterInteractive"
      onReady={flushAnalytics}
      dangerouslySetInnerHTML={{
        __html: `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init(${JSON.stringify(
          POSTHOG_KEY,
        )},{api_host:${JSON.stringify(
          POSTHOG_HOST,
        )},person_profiles:"identified_only",capture_pageview:true});`,
      }}
    />
  );
}
