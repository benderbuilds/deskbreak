"use client";

import Link from "next/link";
import { track } from "@/lib/analytics";
import { attributionProperties, startHref, useStartLink } from "@/components/marketing/LandingCta";
import { FREE_RESET_MINUTES } from "@/lib/constants";

/**
 * The header's "Start free". Carries the visit's `ref`/utm tags onto
 * /app/start like the page's own start buttons, so header clicks from
 * Product Hunt or Reddit are attributed too, and asks for the free three
 * minutes rather than whatever length this browser last preferred.
 */
export function HeaderStartLink() {
  const { href, attribution } = useStartLink(startHref({ minutes: FREE_RESET_MINUTES }));
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={() => track("primary_cta_clicked", { cta: "header", minutes: FREE_RESET_MINUTES, ...attributionProperties(attribution) })}
      className="rounded-[12px] bg-pen px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-pen-hover"
    >
      Start free
    </Link>
  );
}
