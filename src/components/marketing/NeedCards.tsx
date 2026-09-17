"use client";

import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import { LANDING_TARGETED_LABELS, TARGETED_OPTIONS } from "@/lib/constants";
import type { PrimaryNeed } from "@/lib/types";

/**
 * "Need something specific?" on the landing page.
 *
 * Picking one goes straight into the reset with that need preselected: no
 * intermediate screen, no account, no configuration.
 */
export function NeedCards({ source = "landing" }: { source?: string }) {
  const router = useRouter();

  function choose(need: PrimaryNeed) {
    track("primary_cta_clicked", { cta: "need_card", need, source });
    router.push(`/app/start?need=${need}&source=landing`);
  }

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {TARGETED_OPTIONS.map((option) => (
        <li key={option.id}>
          <button
            type="button"
            onClick={() => choose(option.id)}
            className="surface flex min-h-14 w-full items-center justify-center px-4 text-center text-sm font-semibold text-ink transition-colors hover:bg-ink/3"
          >
            {LANDING_TARGETED_LABELS[option.id]}
          </button>
        </li>
      ))}
    </ul>
  );
}
