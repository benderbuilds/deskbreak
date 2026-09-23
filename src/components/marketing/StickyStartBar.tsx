"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonClassName } from "@/components/Button";
import { track } from "@/lib/analytics";
import { FREE_REASSURANCE } from "@/lib/constants";
import { attributionProperties, useStartLink } from "./LandingCta";

/**
 * A phone-only bar that carries the page's own free start action down the
 * page with the reader.
 *
 * It only appears once every real start button has scrolled away, and it
 * steps aside again whenever one is back on screen, so a visitor never sees
 * the same action twice. Which reset it starts is decided by the page, not by
 * this bar: on an intent page it repeats that page's need, setup and length.
 *
 * Marketing pages only. The app has its own bottom navigation, and this must
 * never sit over it.
 */
export function StickyStartBar({
  href,
  label,
  placement,
  note = FREE_REASSURANCE,
}: {
  /** The same /app/start link the page's main CTA uses. */
  href: string;
  label: string;
  /** Analytics placement, e.g. "landing_sticky" or "seo_neck_sticky". */
  placement: string;
  note?: string;
}) {
  const { href: attributed, attribution } = useStartLink(href);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const targets = document.querySelectorAll("[data-free-start]");
    if (!targets.length || typeof IntersectionObserver === "undefined") return;

    // Watching the buttons themselves, rather than polling the scroll
    // position, keeps this to one callback per crossing.
    const visible = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        setShown(visible.size === 0);
      },
      // The bar covers the bottom strip, so a CTA hiding behind it does not
      // count as visible.
      { rootMargin: "0px 0px -104px 0px" },
    );
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <aside
      aria-label="Start a free reset"
      aria-hidden={!shown}
      // Kept in the DOM so the transition has something to animate, and
      // taken out of the tab order entirely while it is away.
      className={[
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-sheet/95 backdrop-blur md:hidden",
        "px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 transition-opacity duration-200",
        shown ? "opacity-100" : "pointer-events-none opacity-0",
      ].join(" ")}
      inert={!shown}
    >
      <Link
        href={attributed}
        prefetch={false}
        className={buttonClassName("primary", true, "text-center")}
        onClick={() =>
          track("primary_cta_clicked", { cta: placement, ...attributionProperties(attribution) })
        }
      >
        {label}
      </Link>
      <p className="mt-1.5 text-center text-xs text-muted">{note}</p>
    </aside>
  );
}
