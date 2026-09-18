"use client";

import Link from "next/link";
import { track } from "@/lib/analytics";
import { attributionProperties, startHref, useStartLink } from "@/components/marketing/LandingCta";

/**
 * The header's "Start my reset". Carries the visit's `ref`/utm tags onto
 * /app/start like the page's own start buttons, so header clicks from
 * Product Hunt or Reddit are attributed too.
 */
export function HeaderStartLink() {
  const { href, attribution } = useStartLink(startHref({}));
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={() => track("primary_cta_clicked", { cta: "header", ...attributionProperties(attribution) })}
      className="rounded-[12px] bg-ink px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-ink/90"
    >
      Start my reset
    </Link>
  );
}
