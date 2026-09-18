"use client";

import Link from "next/link";
import { track } from "@/lib/analytics";
import { LANDING_TARGETED_LABELS, TARGETED_OPTIONS } from "@/lib/constants";
import type { PrimaryNeed } from "@/lib/types";
import { attributionProperties, startHref, useStartLink } from "./LandingCta";

/**
 * "Need something specific?" on the landing page.
 *
 * Picking one goes straight into the reset with that need preselected: no
 * intermediate screen, no account, no configuration.
 */
export function NeedCards({ source = "landing" }: { source?: string }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {TARGETED_OPTIONS.map((option) => (
        <li key={option.id}>
          <NeedLink need={option.id} source={source} />
        </li>
      ))}
    </ul>
  );
}

function NeedLink({ need, source }: { need: PrimaryNeed; source: string }) {
  const { href, attribution } = useStartLink(startHref({ need }));
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={() => track("primary_cta_clicked", { cta: "need_card", need, source, ...attributionProperties(attribution) })}
      className="surface flex min-h-14 w-full items-center justify-center px-4 text-center text-sm font-semibold text-ink transition-colors hover:bg-ink/3"
    >
      {LANDING_TARGETED_LABELS[need]}
    </Link>
  );
}
