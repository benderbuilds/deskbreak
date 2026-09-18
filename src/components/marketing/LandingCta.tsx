"use client";

import Link from "next/link";
import { buttonClassName } from "@/components/Button";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

type Attribution = {
  ref: string | null;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

const EMPTY: Attribution = { ref: null, referrerHost: null, utmSource: null, utmMedium: null, utmCampaign: null };

/**
 * Where this visit came from: `?ref=` (Product Hunt, HN and Reddit links use
 * it), the utm tags, and the referring site's host when it isn't us.
 */
function readAttribution(): Attribution {
  if (typeof window === "undefined") return EMPTY;
  const params = new URLSearchParams(window.location.search);
  let referrerHost: string | null = null;
  try {
    const host = document.referrer ? new URL(document.referrer).host : "";
    if (host && host !== window.location.host) referrerHost = host;
  } catch {
    referrerHost = null;
  }
  return {
    ref: params.get("ref"),
    referrerHost,
    utmSource: params.get("utm_source"),
    utmMedium: params.get("utm_medium"),
    utmCampaign: params.get("utm_campaign"),
  };
}

/** Event properties for a visit's attribution. Named apart from the first-touch utm_* base properties. */
export function attributionProperties(attribution: Attribution) {
  return {
    ref: attribution.ref,
    referrer_host: attribution.referrerHost,
    landing_utm_source: attribution.utmSource,
    landing_utm_medium: attribution.utmMedium,
    landing_utm_campaign: attribution.utmCampaign,
  };
}

/** Carries the visit's attribution onto a /app/start link. */
function withAttribution(href: string, attribution: Attribution): string {
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  const ref = attribution.ref ?? attribution.referrerHost;
  if (ref) params.set("ref", ref);
  if (attribution.utmSource) params.set("utm_source", attribution.utmSource);
  if (attribution.utmMedium) params.set("utm_medium", attribution.utmMedium);
  if (attribution.utmCampaign) params.set("utm_campaign", attribution.utmCampaign);
  return `${path}?${params.toString()}`;
}

/**
 * A /app/start link plus this visit's attribution. The server renders the
 * plain link; after hydration the `ref`/utm tags are added to it.
 */
export function useStartLink(href: string): { href: string; attribution: Attribution } {
  const [attribution, setAttribution] = useState<Attribution>(EMPTY);
  useEffect(() => {
    // location and referrer only exist in the browser, after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAttribution(readAttribution());
  }, []);
  return { href: withAttribution(href, attribution), attribution };
}

export function startHref({
  need,
  minutes,
  setup,
  program,
  seo = false,
}: {
  need?: string;
  minutes?: number;
  setup?: "seated" | "standing";
  /** A specific authored routine, e.g. the walk break. */
  program?: string;
  seo?: boolean;
}): string {
  const params = new URLSearchParams();
  if (program) params.set("program", program);
  if (need) params.set("need", need);
  if (minutes) params.set("minutes", String(minutes));
  if (setup) params.set("setup", setup);
  params.set("source", seo ? "seo" : "landing");
  return `/app/start?${params.toString()}`;
}

export function LandingViewTracker({ page = "landing", seo = false }: { page?: string; seo?: boolean }) {
  useEffect(() => {
    track(seo ? "seo_landing_viewed" : "landing_viewed", { page, ...attributionProperties(readAttribution()) });
  }, [page, seo]);
  return null;
}

/**
 * The button that starts a reset from any public page.
 *
 * A real `<a href>` to /app/start with the need and length preloaded, so it
 * works before the JavaScript lands, with middle-click, and for crawlers.
 * No signup, no questions.
 */
export function StartResetButton({
  children = "Start my reset",
  need,
  minutes,
  setup,
  program,
  source = "landing_hero",
  seo = false,
  variant = "primary",
}: {
  children?: string;
  need?: string;
  minutes?: number;
  setup?: "seated" | "standing";
  program?: string;
  source?: string;
  seo?: boolean;
  variant?: "primary" | "ink";
}) {
  const { href, attribution } = useStartLink(startHref({ need, minutes, setup, program, seo }));
  const base = buttonClassName(variant, true, "px-6 text-center sm:w-auto");
  return (
    <Link
      href={href}
      prefetch={false}
      className={base}
      onClick={() => {
        track("primary_cta_clicked", {
          cta: source,
          need: need ?? null,
          minutes: minutes ?? null,
          program: program ?? null,
          ...attributionProperties(attribution),
        });
      }}
    >
      {children}
    </Link>
  );
}
