"use client";

import Link from "next/link";
import { track } from "@/lib/analytics";
import { FREE_RESET_MINUTES, LANDING_TARGETED_LABELS, TARGETED_OPTIONS } from "@/lib/constants";
import type { PrimaryNeed } from "@/lib/types";
import { attributionProperties, startHref, useStartLink } from "./LandingCta";

/**
 * "Need something specific?" on the landing page.
 *
 * Picking one goes straight into the reset with that need preselected: no
 * intermediate screen, no account, no configuration. Each asks for the free
 * three minutes, so a stored preference for a longer Pro routine cannot
 * contradict what the page promised.
 */
export function NeedCards({ source = "landing" }: { source?: string }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {TARGETED_OPTIONS.map((option) => (
        <li key={option.id}>
          <NeedLink need={option.id} source={source} />
        </li>
      ))}
    </ul>
  );
}

function NeedLink({ need, source }: { need: PrimaryNeed; source: string }) {
  const { href, attribution } = useStartLink(startHref({ need, minutes: FREE_RESET_MINUTES }));
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={() => track("primary_cta_clicked", { cta: "need_card", need, minutes: FREE_RESET_MINUTES, source, ...attributionProperties(attribution) })}
      className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-line-strong bg-sheet px-4 text-sm font-semibold text-ink transition-colors hover:border-ink"
    >
      {LANDING_TARGETED_LABELS[need]}
    </Link>
  );
}
